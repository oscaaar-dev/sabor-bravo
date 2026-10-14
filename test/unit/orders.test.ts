import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteProduct, setProductAvailability, updateProduct } from "@/server/domain/catalog";
import { updateBusiness } from "@/server/domain/businesses";
import { changeOrderStatus, countOrdersByStatus, getOrderDetail, getPublicOrder, listOrders, placeOrder } from "@/server/domain/orders";
import { placeOrderSchema, type PlaceOrderInput } from "@/lib/validation";
import { businessInput, createTestDb, makeBusiness, makeMenu, makeUser, productInput, type TestDb } from "../helpers/db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const order = (items: Array<{ productId: string; quantity: number }>, over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  type: "pickup",
  tableLabel: null,
  customerName: "Ana Pérez",
  customerPhone: "999 888 777",
  deliveryAddress: null,
  notes: null,
  items,
  idempotencyKey: randomUUID(),
  ...over,
});

async function setup(over = {}) {
  const owner = await makeUser(t.db);
  const biz = await makeBusiness(t.db, owner.id, over);
  const menu = await makeMenu(t.db, biz.id);
  return { owner, biz, ...menu };
}

describe("pedido: el servidor calcula todo", () => {
  it("usa los precios de la base de datos y suma el subtotal y el total", async () => {
    const { biz, ceviche, chicha } = await setup();
    const r = await placeOrder(t.db, biz.slug, order([{ productId: ceviche.id, quantity: 2 }, { productId: chicha.id, quantity: 3 }]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = await getOrderDetail(t.db, biz.id, r.data.id);
    expect(d?.order.subtotalCents).toBe(2 * 3500 + 3 * 800);
    expect(d?.order.totalCents).toBe(2 * 3500 + 3 * 800); // recojo: sin delivery
    expect(d?.items.map((i) => [i.productName, i.unitPriceCents, i.quantity, i.lineTotalCents]).sort()).toEqual(
      [["Ceviche clásico", 3500, 2, 7000], ["Chicha morada", 800, 3, 2400]].sort(),
    );
  });

  it("ignora cualquier precio o total que intente colar el navegador", () => {
    const parsed = placeOrderSchema.parse({
      type: "pickup",
      customerName: "Ana Pérez",
      customerPhone: "999 888 777",
      items: [{ productId: randomUUID(), quantity: 1, price: 1, unitPriceCents: 1, name: "Gratis" }],
      idempotencyKey: randomUUID(),
      total: 1,
      totalCents: 1,
      subtotalCents: 1,
      deliveryFeeCents: 0,
    });
    expect(JSON.stringify(parsed)).not.toMatch(/"price"|unitPriceCents|totalCents|subtotalCents|deliveryFeeCents|Gratis|"total"/);
  });

  it("cobra el delivery solo en pedidos de delivery, con la tarifa del restaurante", async () => {
    const { biz, ceviche } = await setup({ deliveryFee: 650 });
    const pick = await placeOrder(t.db, biz.slug, order([{ productId: ceviche.id, quantity: 1 }]));
    const deliv = await placeOrder(t.db, biz.slug, order([{ productId: ceviche.id, quantity: 1 }], { type: "delivery", deliveryAddress: "Av. Larco 123, Miraflores" }));
    if (!pick.ok || !deliv.ok) throw new Error("fallo inesperado");
    expect(pick.data.totalCents).toBe(3500);
    expect(deliv.data.totalCents).toBe(3500 + 650);
    const d = await getOrderDetail(t.db, biz.id, deliv.data.id);
    expect(d?.order.deliveryFeeCents).toBe(650);
    expect(d?.order.deliveryAddress).toBe("Av. Larco 123, Miraflores");
  });

  it("el listado del panel cuenta las UNIDADES de cada pedido, sin mezclar pedidos", async () => {
    const { biz, ceviche, chicha } = await setup();
    await placeOrder(t.db, biz.slug, order([{ productId: ceviche.id, quantity: 2 }, { productId: chicha.id, quantity: 3 }]));
    await placeOrder(t.db, biz.slug, order([{ productId: ceviche.id, quantity: 1 }]));
    const rows = await listOrders(t.db, biz.id);
    expect(rows.map((r) => [r.number, r.itemCount]).sort()).toEqual([[1, 5], [2, 1]]);
  });

  it("une líneas repetidas del mismo plato", async () => {
    const { biz, ceviche } = await setup();
    const r = await placeOrder(t.db, biz.slug, order([{ productId: ceviche.id, quantity: 2 }, { productId: ceviche.id, quantity: 3 }]));
    if (!r.ok) throw new Error(r.message);
    const d = await getOrderDetail(t.db, biz.id, r.data.id);
    expect(d?.items).toHaveLength(1);
    expect(d?.items[0]?.quantity).toBe(5);
    expect(r.data.totalCents).toBe(5 * 3500);
  });

  it("rechaza platos agotados, no publicados o inexistentes, y avisa cuáles", async () => {
    const { biz, ceviche, chicha, category } = await setup();
    await setProductAvailability(t.db, biz.id, chicha.id, false);
    const hidden = await updateProduct(t.db, biz.id, ceviche.id, productInput(category.id, { name: ceviche.name, price: 3500, isPublished: false }));
    expect(hidden.ok).toBe(true);
    const r = await placeOrder(t.db, biz.slug, order([{ productId: ceviche.id, quantity: 1 }, { productId: chicha.id, quantity: 1 }, { productId: randomUUID(), quantity: 1 }]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("unavailable");
    expect((r.details?.unavailableIds as string[]).length).toBe(3);
    expect(await listOrders(t.db, biz.id)).toHaveLength(0); // no quedó nada a medias
  });

  it("rechaza modalidades que el restaurante no tiene activas y restaurantes no publicados", async () => {
    const { biz, ceviche } = await setup({ acceptsDelivery: false });
    const r = await placeOrder(t.db, biz.slug, order([{ productId: ceviche.id, quantity: 1 }], { type: "delivery", deliveryAddress: "Calle Falsa 123" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("type_not_allowed");
    await updateBusiness(t.db, biz.id, businessInput({ slug: biz.slug, name: biz.name, isPublished: false }));
    const hidden = await placeOrder(t.db, biz.slug, order([{ productId: ceviche.id, quantity: 1 }]));
    expect(hidden.ok).toBe(false);
    if (!hidden.ok) expect(hidden.code).toBe("not_found");
  });

  it("no acepta platos de OTRO restaurante dentro del pedido", async () => {
    const a = await setup();
    const b = await setup();
    const r = await placeOrder(t.db, a.biz.slug, order([{ productId: b.ceviche.id, quantity: 1 }]));
    expect(r.ok).toBe(false);
    expect(await listOrders(t.db, a.biz.id)).toHaveLength(0);
  });

  it("rechaza pedidos de importe absurdo", async () => {
    const { biz, category } = await setup();
    const big = await import("@/server/domain/catalog").then((m) => m.createProduct(t.db, biz.id, productInput(category.id, { name: "Joya", price: 10_000_000 })));
    if (!big.ok) throw new Error(big.message);
    const r = await placeOrder(t.db, biz.slug, order([{ productId: big.data.id, quantity: 99 }]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("too_large");
  });
});

describe("pedido: numeración, idempotencia y concurrencia", () => {
  it("numera de 1 en adelante por restaurante, sin mezclar locales", async () => {
    const a = await setup();
    const b = await setup();
    const n = async (s: typeof a) => {
      const r = await placeOrder(t.db, s.biz.slug, order([{ productId: s.ceviche.id, quantity: 1 }]));
      if (!r.ok) throw new Error(r.message);
      return r.data.number;
    };
    expect([await n(a), await n(a), await n(b), await n(a)]).toEqual([1, 2, 1, 3]);
  });

  it("reenviar la misma clave devuelve el mismo pedido y no crea otro", async () => {
    const { biz, ceviche } = await setup();
    const input = order([{ productId: ceviche.id, quantity: 1 }]);
    const first = await placeOrder(t.db, biz.slug, input);
    const second = await placeOrder(t.db, biz.slug, input);
    if (!first.ok || !second.ok) throw new Error("fallo inesperado");
    expect(second.data.id).toBe(first.data.id);
    expect(first.data.duplicate).toBe(false);
    expect(second.data.duplicate).toBe(true);
    expect(await listOrders(t.db, biz.id)).toHaveLength(1);
  });

  it("10 envíos simultáneos con la MISMA clave generan un solo pedido", async () => {
    const { biz, ceviche } = await setup();
    const input = order([{ productId: ceviche.id, quantity: 1 }]);
    const results = await Promise.all(Array.from({ length: 10 }, () => placeOrder(t.db, biz.slug, input)));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(new Set(results.map((r) => (r.ok ? r.data.id : ""))).size).toBe(1);
    expect(await listOrders(t.db, biz.id)).toHaveLength(1);
  });

  it("20 pedidos simultáneos reciben números distintos y correlativos", async () => {
    const { biz, ceviche } = await setup();
    const results = await Promise.all(Array.from({ length: 20 }, () => placeOrder(t.db, biz.slug, order([{ productId: ceviche.id, quantity: 1 }]))));
    const numbers = results.map((r) => (r.ok ? r.data.number : -1)).sort((x, y) => x - y);
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});

describe("pedido: el historial conserva lo que se vendió", () => {
  it("cambiar el precio o borrar el plato no altera pedidos ya hechos", async () => {
    const { biz, ceviche, category } = await setup();
    const r = await placeOrder(t.db, biz.slug, order([{ productId: ceviche.id, quantity: 2 }]));
    if (!r.ok) throw new Error(r.message);
    await updateProduct(t.db, biz.id, ceviche.id, productInput(category.id, { name: "Ceviche renovado", price: 9900 }));
    let d = await getOrderDetail(t.db, biz.id, r.data.id);
    expect(d?.items[0]).toMatchObject({ productName: "Ceviche clásico", unitPriceCents: 3500, lineTotalCents: 7000 });
    expect(d?.order.totalCents).toBe(7000);
    await deleteProduct(t.db, biz.id, ceviche.id);
    d = await getOrderDetail(t.db, biz.id, r.data.id);
    expect(d?.items[0]).toMatchObject({ productName: "Ceviche clásico", productId: null });
  });

  it("la consulta pública exige slug Y token y no expone datos del cliente", async () => {
    const a = await setup();
    const b = await setup();
    const r = await placeOrder(t.db, a.biz.slug, order([{ productId: a.ceviche.id, quantity: 1 }]));
    if (!r.ok) throw new Error(r.message);
    const view = await getPublicOrder(t.db, a.biz.slug, r.data.token);
    expect(view?.number).toBe(1);
    expect(JSON.stringify(view)).not.toMatch(/999 888 777|Ana Pérez/);
    expect(await getPublicOrder(t.db, b.biz.slug, r.data.token)).toBeNull(); // token de otro local
    expect(await getPublicOrder(t.db, a.biz.slug, "x".repeat(24))).toBeNull(); // token inventado
  });
});

describe("pedido: estados", () => {
  async function pending() {
    const s = await setup();
    const r = await placeOrder(t.db, s.biz.slug, order([{ productId: s.ceviche.id, quantity: 1 }]));
    if (!r.ok) throw new Error(r.message);
    return { ...s, orderId: r.data.id };
  }

  it("recorre el camino completo y deja el historial", async () => {
    const { biz, owner, orderId } = await pending();
    for (const to of ["confirmed", "preparing", "ready", "completed"] as const) {
      const r = await changeOrderStatus(t.db, { businessId: biz.id, orderId, to, actorUserId: owner.id });
      expect(r.ok).toBe(true);
    }
    const d = await getOrderDetail(t.db, biz.id, orderId);
    expect(d?.order.status).toBe("completed");
    expect(d?.events.map((e) => e.toStatus)).toEqual(["pending", "confirmed", "preparing", "ready", "completed"]);
    expect(d?.events[1]?.actorName).toBe(owner.name);
    expect((await countOrdersByStatus(t.db, biz.id)).completed).toBe(1);
  });

  it("rechaza saltos de estado y no cambia nada", async () => {
    const { biz, owner, orderId } = await pending();
    for (const to of ["preparing", "ready", "completed", "pending"] as const) {
      const r = await changeOrderStatus(t.db, { businessId: biz.id, orderId, to, actorUserId: owner.id });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("invalid_transition");
    }
    expect((await getOrderDetail(t.db, biz.id, orderId))?.order.status).toBe("pending");
  });

  it("completado y cancelado son finales", async () => {
    const { biz, owner, orderId } = await pending();
    expect((await changeOrderStatus(t.db, { businessId: biz.id, orderId, to: "cancelled", actorUserId: owner.id })).ok).toBe(true);
    for (const to of ["confirmed", "pending", "completed"] as const) {
      expect((await changeOrderStatus(t.db, { businessId: biz.id, orderId, to, actorUserId: owner.id })).ok).toBe(false);
    }
  });

  it("el MISMO cambio pulsado dos veces a la vez se aplica una sola vez", async () => {
    const { biz, owner, orderId } = await pending();
    await changeOrderStatus(t.db, { businessId: biz.id, orderId, to: "confirmed", actorUserId: owner.id });
    const results = await Promise.all([
      changeOrderStatus(t.db, { businessId: biz.id, orderId, to: "preparing", actorUserId: owner.id }),
      changeOrderStatus(t.db, { businessId: biz.id, orderId, to: "preparing", actorUserId: owner.id }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const d = await getOrderDetail(t.db, biz.id, orderId);
    expect(d?.events.map((e) => e.toStatus)).toEqual(["pending", "confirmed", "preparing"]);
  });

  it("completar y cancelar a la vez: exactamente uno gana, en cualquier orden", async () => {
    const { biz, owner, orderId } = await pending();
    for (const to of ["confirmed", "preparing", "ready"] as const) await changeOrderStatus(t.db, { businessId: biz.id, orderId, to, actorUserId: owner.id });
    const results = await Promise.all([
      changeOrderStatus(t.db, { businessId: biz.id, orderId, to: "completed", actorUserId: owner.id }),
      changeOrderStatus(t.db, { businessId: biz.id, orderId, to: "cancelled", actorUserId: owner.id }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const d = await getOrderDetail(t.db, biz.id, orderId);
    expect(["completed", "cancelled"]).toContain(d?.order.status);
    expect(d?.events).toHaveLength(5); // pending, confirmed, preparing, ready + el que ganó
  });
});
