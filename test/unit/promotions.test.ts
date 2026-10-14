import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProduct, getPublicMenu, updateProduct } from "@/server/domain/catalog";
import { getOrderDetail, placeOrder } from "@/server/domain/orders";
import { effectivePriceCents, promoActive } from "@/lib/pricing";
import { productSchema, type PlaceOrderInput } from "@/lib/validation";
import { createTestDb, makeBusiness, makeMenu, makeUser, productInput, type TestDb } from "../helpers/db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const order = (productId: string, quantity = 1): PlaceOrderInput => ({
  type: "pickup",
  tableLabel: null,
  customerName: "Ana Pérez",
  customerPhone: "999 888 777",
  deliveryAddress: null,
  notes: null,
  items: [{ productId, quantity }],
  idempotencyKey: randomUUID(),
});

describe("precio efectivo (puro)", () => {
  const base = { priceCents: 3500, promoPercent: null, promoEndsAt: null };
  it("sin promoción cobra el precio de lista", () => expect(effectivePriceCents(base)).toBe(3500));
  it("aplica el porcentaje y redondea al céntimo", () => {
    expect(effectivePriceCents({ ...base, promoPercent: 20 })).toBe(2800);
    expect(effectivePriceCents({ priceCents: 999, promoPercent: 33, promoEndsAt: null })).toBe(669); // 669.33 → 669
    expect(effectivePriceCents({ priceCents: 1, promoPercent: 90, promoEndsAt: null })).toBe(0); // 0.1 → 0
  });
  it("una promoción vencida no se aplica; una vigente hasta mañana sí", () => {
    const now = new Date("2026-10-14T12:00:00-05:00");
    expect(promoActive({ promoPercent: 20, promoEndsAt: new Date("2026-10-13T23:59:59-05:00") }, now)).toBe(false);
    expect(promoActive({ promoPercent: 20, promoEndsAt: new Date("2026-10-15T23:59:59-05:00") }, now)).toBe(true);
    expect(promoActive({ promoPercent: null, promoEndsAt: null }, now)).toBe(false);
    expect(promoActive({ promoPercent: 95, promoEndsAt: null }, now)).toBe(false); // fuera de rango: nunca se aplica
  });
});

describe("promociones en el servidor", () => {
  async function setup() {
    const owner = await makeUser(t.db);
    const biz = await makeBusiness(t.db, owner.id);
    return { biz, ...(await makeMenu(t.db, biz.id)) };
  }

  it("cobra el precio con descuento y guarda el precio de lista en la línea", async () => {
    const { biz, ceviche, category } = await setup();
    await updateProduct(t.db, biz.id, ceviche.id, productInput(category.id, { name: ceviche.name, price: 3500, promoPercent: 20 }));
    const r = await placeOrder(t.db, biz.slug, order(ceviche.id, 2));
    if (!r.ok) throw new Error(r.message);
    expect(r.data.totalCents).toBe(2 * 2800);
    const d = await getOrderDetail(t.db, biz.id, r.data.id);
    expect(d?.items[0]).toMatchObject({ unitPriceCents: 2800, listPriceCents: 3500, lineTotalCents: 5600 });
  });

  it("una promoción vencida se ignora y no deja precio de lista en la línea", async () => {
    const { biz, ceviche, category } = await setup();
    await updateProduct(t.db, biz.id, ceviche.id, productInput(category.id, { name: ceviche.name, price: 3500, promoPercent: 50, promoEndsAt: new Date(Date.now() - 60_000) }));
    const r = await placeOrder(t.db, biz.slug, order(ceviche.id));
    if (!r.ok) throw new Error(r.message);
    expect(r.data.totalCents).toBe(3500);
    expect((await getOrderDetail(t.db, biz.id, r.data.id))?.items[0]?.listPriceCents).toBeNull();
  });

  it("la carta pública entrega promoPercent para mostrarla y el panel conserva el original", async () => {
    const { biz, category } = await setup();
    const p = await createProduct(t.db, biz.id, productInput(category.id, { name: "Oferta", price: 1000, promoPercent: 10 }));
    expect(p.ok).toBe(true);
    const menu = await getPublicMenu(t.db, biz.id);
    expect(menu[0]?.products.find((x) => x.name === "Oferta")).toMatchObject({ priceCents: 1000, promoPercent: 10 });
  });

  it("la base de datos rechaza descuentos fuera de rango y fechas de promoción sin porcentaje", async () => {
    const { biz, ceviche } = await setup();
    for (const bad of [0, 91, 100, -5]) {
      await expect(t.sql`update products set promo_percent = ${bad} where id = ${ceviche.id}`).rejects.toMatchObject({ code: "23514" });
    }
    await expect(t.sql`update products set promo_percent = null, promo_ends_at = now() where id = ${ceviche.id}`).rejects.toMatchObject({ code: "23514" });
    expect(biz.id).toBeTruthy();
  });

  it("el precio de lista de una línea no puede ser menor que el cobrado", async () => {
    const { biz, ceviche } = await setup();
    const r = await placeOrder(t.db, biz.slug, order(ceviche.id));
    if (!r.ok) throw new Error(r.message);
    await expect(t.sql`update order_items set list_price_cents = 100 where order_id = ${r.data.id}`).rejects.toMatchObject({ code: "23514" });
  });
});

describe("validación del formulario de promoción", () => {
  const base = { categoryId: randomUUID(), name: "Lomo", price: "25" };
  it("acepta descuento y fecha, y los convierte", () => {
    const r = productSchema.safeParse({ ...base, promoPercent: "15", promoEndsAt: "2026-12-31" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.promoPercent).toBe(15);
      expect(r.data.promoEndsAt?.toISOString()).toBe("2027-01-01T04:59:59.000Z"); // 23:59:59 en Lima = 04:59:59 UTC del día siguiente
    }
  });
  it("vacío o 0 significa sin promoción", () => {
    for (const v of ["", "0", "  "]) {
      const r = productSchema.safeParse({ ...base, promoPercent: v });
      expect(r.success && r.data.promoPercent).toBeNull();
    }
  });
  it("rechaza porcentajes inválidos y una fecha sin descuento", () => {
    for (const v of ["91", "100", "-5", "abc", "12.5", "1e1"]) expect(productSchema.safeParse({ ...base, promoPercent: v }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, promoEndsAt: "2026-12-31" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, promoPercent: "10", promoEndsAt: "31/12/2026" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, promoPercent: "10", promoEndsAt: "2026-02-31" }).success).toBe(false);
  });
});
