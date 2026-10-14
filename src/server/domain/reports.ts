import { sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { TYPE_LABEL, STATUS_LABEL, type OrderStatus, type OrderType } from "@/lib/order-status";
import { centsToDecimal } from "@/lib/csv";

/**
 * Informes: todo se calcula con consultas sobre pedidos GUARDADOS (nada ficticio). Las ventas cuentan solo los pedidos
 * COMPLETADOS, por su fecha de recepción en hora de Lima, dentro del rango [from, to). Siempre filtrado por restaurante.
 */
export interface SalesReport {
  readonly completedCount: number;
  readonly revenueCents: number;
  readonly avgTicketCents: number;
  readonly cancelledCount: number;
  readonly openCount: number;
  /** Total descontado por promociones en pedidos completados. */
  readonly discountCents: number;
  readonly byType: Array<{ type: OrderType; count: number; revenueCents: number }>;
  readonly byDay: Array<{ day: string; count: number; revenueCents: number }>;
  readonly topProducts: Array<{ name: string; quantity: number; revenueCents: number }>;
}

export async function salesReport(db: Db, businessId: string, range: { from: Date; to: Date }): Promise<SalesReport> {
  // Las fechas van como texto ISO con conversión explícita: con prepare:false (pooler de Supabase) el driver no infiere el tipo de un Date.
  const f = range.from.toISOString();
  const t = range.to.toISOString();
  const [totals] = await db.execute<{ completed: number; revenue: string; cancelled: number; open: number }>(sql`
    select
      count(*) filter (where status = 'completed')::int as completed,
      coalesce(sum(total_cents) filter (where status = 'completed'), 0)::bigint as revenue,
      count(*) filter (where status = 'cancelled')::int as cancelled,
      count(*) filter (where status in ('pending', 'confirmed', 'preparing', 'ready'))::int as open
    from orders
    where business_id = ${businessId} and created_at >= ${f}::timestamptz and created_at < ${t}::timestamptz`);

  const byType = await db.execute<{ type: string; count: number; revenue: string }>(sql`
    select order_type as type, count(*)::int as count, coalesce(sum(total_cents), 0)::bigint as revenue
    from orders
    where business_id = ${businessId} and status = 'completed' and created_at >= ${f}::timestamptz and created_at < ${t}::timestamptz
    group by order_type order by revenue desc`);

  const byDay = await db.execute<{ day: string; count: number; revenue: string }>(sql`
    select to_char((created_at at time zone 'America/Lima')::date, 'YYYY-MM-DD') as day, count(*)::int as count, coalesce(sum(total_cents), 0)::bigint as revenue
    from orders
    where business_id = ${businessId} and status = 'completed' and created_at >= ${f}::timestamptz and created_at < ${t}::timestamptz
    group by 1 order by 1`);

  const top = await db.execute<{ name: string; quantity: string; revenue: string }>(sql`
    select oi.product_name as name, sum(oi.quantity)::bigint as quantity, sum(oi.line_total_cents)::bigint as revenue
    from order_items oi
    join orders o on o.id = oi.order_id and o.business_id = oi.business_id
    where oi.business_id = ${businessId} and o.status = 'completed' and o.created_at >= ${f}::timestamptz and o.created_at < ${t}::timestamptz
    group by oi.product_name order by quantity desc, revenue desc, name limit 10`);

  const [disc] = await db.execute<{ discount: string }>(sql`
    select coalesce(sum((oi.list_price_cents - oi.unit_price_cents) * oi.quantity), 0)::bigint as discount
    from order_items oi
    join orders o on o.id = oi.order_id and o.business_id = oi.business_id
    where oi.business_id = ${businessId} and o.status = 'completed' and oi.list_price_cents is not null and o.created_at >= ${f}::timestamptz and o.created_at < ${t}::timestamptz`);

  const completed = totals?.completed ?? 0;
  const revenue = Number(totals?.revenue ?? 0);
  return {
    completedCount: completed,
    revenueCents: revenue,
    avgTicketCents: completed > 0 ? Math.round(revenue / completed) : 0,
    cancelledCount: totals?.cancelled ?? 0,
    openCount: totals?.open ?? 0,
    discountCents: Number(disc?.discount ?? 0),
    byType: byType.map((r) => ({ type: r.type as OrderType, count: r.count, revenueCents: Number(r.revenue) })),
    byDay: byDay.map((r) => ({ day: r.day, count: r.count, revenueCents: Number(r.revenue) })),
    topProducts: top.map((r) => ({ name: r.name, quantity: Number(r.quantity), revenueCents: Number(r.revenue) })),
  };
}

// ───────────────────────── Exportaciones CSV ─────────────────────────

const fmtLima = (d: Date) => d.toLocaleString("sv-SE", { timeZone: "America/Lima" });

/** Un pedido por fila (todos los estados) dentro del rango. Contiene datos de clientes: solo para roles con permiso. */
export async function exportOrders(db: Db, businessId: string, range: { from: Date; to: Date }) {
  const rows = await db.execute<{
    number: number; created_at: Date; order_type: string; table_label: string | null; customer_name: string; customer_phone: string;
    delivery_address: string | null; notes: string | null; status: string; subtotal_cents: number; delivery_fee_cents: number; total_cents: number;
  }>(sql`
    select number, created_at, order_type, table_label, customer_name, customer_phone, delivery_address, notes, status, subtotal_cents, delivery_fee_cents, total_cents
    from orders where business_id = ${businessId} and created_at >= ${range.from.toISOString()}::timestamptz and created_at < ${range.to.toISOString()}::timestamptz
    order by created_at, number`);
  return {
    header: ["Pedido", "Fecha (Lima)", "Modalidad", "Mesa", "Cliente", "Teléfono", "Dirección de entrega", "Notas", "Estado", "Subtotal (S/)", "Delivery (S/)", "Total (S/)"],
    rows: rows.map((r) => [
      r.number,
      fmtLima(new Date(r.created_at)),
      TYPE_LABEL[r.order_type as OrderType] ?? r.order_type,
      r.table_label,
      r.customer_name,
      r.customer_phone,
      r.delivery_address,
      r.notes,
      STATUS_LABEL[r.status as OrderStatus] ?? r.status,
      centsToDecimal(r.subtotal_cents),
      centsToDecimal(r.delivery_fee_cents),
      centsToDecimal(r.total_cents),
    ]),
  };
}

/** Una línea de pedido por fila (con precio de lista y cobrado) dentro del rango. */
export async function exportItems(db: Db, businessId: string, range: { from: Date; to: Date }) {
  const rows = await db.execute<{
    number: number; created_at: Date; status: string; product_name: string; quantity: number; unit_price_cents: number; list_price_cents: number | null; line_total_cents: number;
  }>(sql`
    select o.number, o.created_at, o.status, oi.product_name, oi.quantity, oi.unit_price_cents, oi.list_price_cents, oi.line_total_cents
    from order_items oi
    join orders o on o.id = oi.order_id and o.business_id = oi.business_id
    where oi.business_id = ${businessId} and o.created_at >= ${range.from.toISOString()}::timestamptz and o.created_at < ${range.to.toISOString()}::timestamptz
    order by o.created_at, o.number, oi.product_name`);
  return {
    header: ["Pedido", "Fecha (Lima)", "Estado", "Producto", "Cantidad", "Precio cobrado (S/)", "Precio de lista (S/)", "Total línea (S/)"],
    rows: rows.map((r) => [
      r.number,
      fmtLima(new Date(r.created_at)),
      STATUS_LABEL[r.status as OrderStatus] ?? r.status,
      r.product_name,
      r.quantity,
      centsToDecimal(r.unit_price_cents),
      r.list_price_cents === null ? "" : centsToDecimal(r.list_price_cents),
      centsToDecimal(r.line_total_cents),
    ]),
  };
}
