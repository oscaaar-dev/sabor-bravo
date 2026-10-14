import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { businesses, orderEvents, orderItems, orders, products, users } from "@/server/db/schema";
import { effectivePriceCents } from "@/lib/pricing";
import { canTransition, isOrderStatus, STATUS_LABEL, type OrderStatus, type OrderType } from "@/lib/order-status";
import type { PlaceOrderInput } from "@/lib/validation";
import { fail, isUuid, ok, pgError, UNIQUE_VIOLATION, type Result } from "./result";

export type OrderRow = typeof orders.$inferSelect;

export interface PlacedOrder {
  readonly id: string;
  readonly number: number;
  /** Token no adivinable para que el cliente consulte el estado de SU pedido. */
  readonly token: string;
  readonly totalCents: number;
  readonly status: OrderStatus;
  /** true si era un reenvío de un pedido ya registrado (misma clave de idempotencia). */
  readonly duplicate: boolean;
}

/** Tope del subtotal de un pedido (1 000 000,00): evita desbordes y pedidos absurdos. */
const MAX_SUBTOTAL_CENTS = 100_000_000;

/**
 * Registra un pedido de un cliente. Nada de lo que envía el navegador se toma como verdad salvo QUÉ productos y
 * CUÁNTAS unidades: nombres, precios, disponibilidad, costo de delivery y totales se leen y calculan aquí, de la base
 * de datos, dentro de una sola transacción. Reenviar la misma clave de idempotencia devuelve el mismo pedido.
 */
export async function placeOrder(db: Db, slug: string, input: PlaceOrderInput): Promise<Result<PlacedOrder>> {
  try {
    return await db.transaction(async (tx) => {
      const biz = (await tx.select().from(businesses).where(and(eq(businesses.slug, slug), eq(businesses.isPublished, true))).limit(1))[0];
      if (!biz) return fail("Este restaurante no está disponible.", { code: "not_found" });

      // idempotencia: mismo envío repetido (doble clic, reintento de red) → mismo pedido
      const prior = (
        await tx.select().from(orders).where(and(eq(orders.businessId, biz.id), eq(orders.idempotencyKey, input.idempotencyKey))).limit(1)
      )[0];
      if (prior) return ok(placed(prior, true));

      const typeAllowed =
        (input.type === "dine_in" && biz.acceptsDineIn) || (input.type === "pickup" && biz.acceptsPickup) || (input.type === "delivery" && biz.acceptsDelivery);
      if (!typeAllowed) return fail("Este restaurante no acepta esa modalidad de pedido.", { code: "type_not_allowed" });

      // unir líneas repetidas del mismo producto
      const wanted = new Map<string, number>();
      for (const it of input.items) wanted.set(it.productId, Math.min(99, (wanted.get(it.productId) ?? 0) + it.quantity));
      const ids = [...wanted.keys()];

      const found = await tx.select().from(products).where(and(eq(products.businessId, biz.id), inArray(products.id, ids)));
      const byId = new Map(found.map((p) => [p.id, p]));
      const unavailable = ids.filter((id) => {
        const p = byId.get(id);
        return !p || !p.isPublished || !p.isAvailable;
      });
      if (unavailable.length > 0) {
        const names = unavailable.map((id) => byId.get(id)?.name ?? "un producto que ya no existe");
        return fail(`Ya no está disponible: ${names.join(", ")}. Quítalo del carrito para continuar.`, { code: "unavailable", details: { unavailableIds: unavailable } });
      }

      const now = new Date();
      const lines = ids.map((id) => {
        const p = byId.get(id)!;
        const quantity = wanted.get(id)!;
        const unit = effectivePriceCents(p, now); // precio con la promoción vigente, calculado AQUÍ
        return { productId: id, name: p.name, unit, list: unit < p.priceCents ? p.priceCents : null, quantity, total: unit * quantity };
      });
      const subtotal = lines.reduce((acc, l) => acc + l.total, 0);
      if (subtotal > MAX_SUBTOTAL_CENTS) return fail("El pedido supera el importe máximo permitido. Divídelo en dos.", { code: "too_large" });
      const deliveryFee = input.type === "delivery" ? biz.deliveryFeeCents : 0;

      // número correlativo por restaurante; el UPDATE bloquea la fila y serializa los pedidos del mismo local
      const bumped = await tx
        .update(businesses)
        .set({ nextOrderNumber: sql`${businesses.nextOrderNumber} + 1` })
        .where(eq(businesses.id, biz.id))
        .returning({ next: businesses.nextOrderNumber });
      const number = (bumped[0]?.next ?? 2) - 1;

      const inserted = await tx
        .insert(orders)
        .values({
          businessId: biz.id,
          number,
          orderType: input.type,
          tableLabel: input.type === "dine_in" ? input.tableLabel : null,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deliveryAddress: input.type === "delivery" ? input.deliveryAddress : null,
          notes: input.notes,
          status: "pending",
          subtotalCents: subtotal,
          deliveryFeeCents: deliveryFee,
          totalCents: subtotal + deliveryFee,
          idempotencyKey: input.idempotencyKey,
          publicToken: randomBytes(18).toString("base64url"),
        })
        .returning();
      const order = inserted[0];
      if (!order) return fail("No se pudo registrar el pedido. Inténtalo de nuevo.");

      await tx.insert(orderItems).values(
        lines.map((l) => ({ orderId: order.id, businessId: biz.id, productId: l.productId, productName: l.name, unitPriceCents: l.unit, listPriceCents: l.list, quantity: l.quantity, lineTotalCents: l.total })),
      );
      await tx.insert(orderEvents).values({ orderId: order.id, businessId: biz.id, fromStatus: null, toStatus: "pending", actorUserId: null });
      return ok(placed(order, false));
    });
  } catch (e) {
    // carrera: dos envíos simultáneos con la misma clave; el segundo choca con la restricción única y devuelve el primero
    if (pgError(e).code === UNIQUE_VIOLATION && pgError(e).constraint === "orders_idempotency_key") {
      const biz = (await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, slug)).limit(1))[0];
      if (biz) {
        const prior = (await db.select().from(orders).where(and(eq(orders.businessId, biz.id), eq(orders.idempotencyKey, input.idempotencyKey))).limit(1))[0];
        if (prior) return ok(placed(prior, true));
      }
    }
    throw e;
  }
}

function placed(o: OrderRow, duplicate: boolean): PlacedOrder {
  return { id: o.id, number: o.number, token: o.publicToken, totalCents: o.totalCents, status: o.status as OrderStatus, duplicate };
}

// ───────────────────────── Panel del restaurante ─────────────────────────

export interface OrderListItem {
  readonly id: string;
  readonly number: number;
  readonly orderType: OrderType;
  readonly tableLabel: string | null;
  readonly customerName: string;
  readonly totalCents: number;
  readonly status: OrderStatus;
  readonly createdAt: Date;
  readonly itemCount: number;
}

export async function listOrders(db: Db, businessId: string, opts: { status?: OrderStatus; limit?: number } = {}): Promise<OrderListItem[]> {
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      orderType: orders.orderType,
      tableLabel: orders.tableLabel,
      customerName: orders.customerName,
      totalCents: orders.totalCents,
      status: orders.status,
      createdAt: orders.createdAt,
      // Subconsulta con nombres calificados a mano: en un select de una sola tabla Drizzle omite el prefijo y compararía id con id.
      itemCount: sql<number>`(select coalesce(sum(oi.quantity), 0)::int from order_items oi where oi.order_id = "orders"."id" and oi.business_id = "orders"."business_id")`,
    })
    .from(orders)
    .where(opts.status ? and(eq(orders.businessId, businessId), eq(orders.status, opts.status)) : eq(orders.businessId, businessId))
    .orderBy(desc(orders.createdAt))
    .limit(Math.min(opts.limit ?? 100, 500));
  return rows as OrderListItem[];
}

export async function countOrdersByStatus(db: Db, businessId: string): Promise<Record<OrderStatus, number>> {
  const rows = await db
    .select({ status: orders.status, n: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.businessId, businessId))
    .groupBy(orders.status);
  const out: Record<OrderStatus, number> = { pending: 0, confirmed: 0, preparing: 0, ready: 0, completed: 0, cancelled: 0 };
  for (const r of rows) if (isOrderStatus(r.status)) out[r.status] = r.n;
  return out;
}

export interface OrderDetail {
  readonly order: OrderRow;
  readonly items: Array<typeof orderItems.$inferSelect>;
  readonly events: Array<{ fromStatus: string | null; toStatus: string; createdAt: Date; actorName: string | null }>;
}

export async function getOrderDetail(db: Db, businessId: string, orderId: string): Promise<OrderDetail | null> {
  if (!isUuid(orderId)) return null;
  const order = (await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.businessId, businessId))).limit(1))[0];
  if (!order) return null;
  const [items, events] = await Promise.all([
    db.select().from(orderItems).where(and(eq(orderItems.orderId, order.id), eq(orderItems.businessId, businessId))).orderBy(asc(orderItems.productName)),
    db
      .select({ fromStatus: orderEvents.fromStatus, toStatus: orderEvents.toStatus, createdAt: orderEvents.createdAt, actorName: users.name })
      .from(orderEvents)
      .leftJoin(users, eq(users.id, orderEvents.actorUserId))
      .where(and(eq(orderEvents.orderId, order.id), eq(orderEvents.businessId, businessId)))
      .orderBy(asc(orderEvents.createdAt), asc(orderEvents.id)),
  ]);
  return { order, items, events };
}

/**
 * Cambia el estado de un pedido SOLO si la transición es válida. El pedido se bloquea (`FOR UPDATE`) durante la
 * comprobación, así dos personas que pulsen a la vez no pueden saltarse la máquina de estados.
 */
export async function changeOrderStatus(
  db: Db,
  args: { businessId: string; orderId: string; to: OrderStatus; actorUserId: string },
): Promise<Result<{ from: OrderStatus; to: OrderStatus }>> {
  if (!isUuid(args.orderId)) return fail("Pedido no encontrado.", { code: "not_found" });
  return db.transaction(async (tx) => {
    const order = (
      await tx.select().from(orders).where(and(eq(orders.id, args.orderId), eq(orders.businessId, args.businessId))).limit(1).for("update")
    )[0];
    if (!order) return fail("Pedido no encontrado.", { code: "not_found" });
    const from = order.status as OrderStatus;
    if (!isOrderStatus(from) || !canTransition(from, args.to)) {
      return fail(`No se puede pasar un pedido de «${STATUS_LABEL[from] ?? from}» a «${STATUS_LABEL[args.to]}».`, { code: "invalid_transition" });
    }
    await tx.update(orders).set({ status: args.to, updatedAt: new Date() }).where(and(eq(orders.id, order.id), eq(orders.businessId, args.businessId)));
    await tx.insert(orderEvents).values({ orderId: order.id, businessId: args.businessId, fromStatus: from, toStatus: args.to, actorUserId: args.actorUserId });
    return ok({ from, to: args.to });
  });
}

// ───────────────────────── Consulta pública del cliente ─────────────────────────

export interface PublicOrderView {
  readonly number: number;
  readonly status: OrderStatus;
  readonly orderType: OrderType;
  readonly totalCents: number;
  readonly subtotalCents: number;
  readonly deliveryFeeCents: number;
  readonly createdAt: Date;
  readonly businessName: string;
  readonly items: Array<{ name: string; quantity: number; lineTotalCents: number }>;
}

/** Estado del pedido para el cliente: exige el slug Y el token no adivinable; no expone teléfono ni dirección. */
export async function getPublicOrder(db: Db, slug: string, token: string): Promise<PublicOrderView | null> {
  if (token.length < 10 || token.length > 64) return null;
  const row = (
    await db
      .select({ order: orders, businessName: businesses.name })
      .from(orders)
      .innerJoin(businesses, eq(businesses.id, orders.businessId))
      .where(and(eq(orders.publicToken, token), eq(businesses.slug, slug)))
      .limit(1)
  )[0];
  if (!row) return null;
  const items = await db.select().from(orderItems).where(and(eq(orderItems.orderId, row.order.id), eq(orderItems.businessId, row.order.businessId))).orderBy(asc(orderItems.productName));
  return {
    number: row.order.number,
    status: row.order.status as OrderStatus,
    orderType: row.order.orderType as OrderType,
    totalCents: row.order.totalCents,
    subtotalCents: row.order.subtotalCents,
    deliveryFeeCents: row.order.deliveryFeeCents,
    createdAt: row.order.createdAt,
    businessName: row.businessName,
    items: items.map((i) => ({ name: i.productName, quantity: i.quantity, lineTotalCents: i.lineTotalCents })),
  };
}
