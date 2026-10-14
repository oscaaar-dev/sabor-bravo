import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { updateProduct } from "@/server/domain/catalog";
import { changeOrderStatus, placeOrder } from "@/server/domain/orders";
import { exportItems, exportOrders, salesReport } from "@/server/domain/reports";
import { centsToDecimal, csvCell, toCsv } from "@/lib/csv";
import { addDays, isValidDay, limaDay, parseRange } from "@/lib/dates";
import type { OrderStatus } from "@/lib/order-status";
import type { PlaceOrderInput } from "@/lib/validation";
import { createTestDb, makeBusiness, makeMenu, makeUser, productInput, type TestDb } from "../helpers/db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const mk = (items: PlaceOrderInput["items"], over: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
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

const PATH: OrderStatus[] = ["confirmed", "preparing", "ready", "completed"];

async function world() {
  const owner = await makeUser(t.db);
  const biz = await makeBusiness(t.db, owner.id, { deliveryFee: 500 });
  const menu = await makeMenu(t.db, biz.id);
  const place = async (items: PlaceOrderInput["items"], over: Partial<PlaceOrderInput> = {}, upTo?: OrderStatus, at?: string) => {
    const r = await placeOrder(t.db, biz.slug, mk(items, over));
    if (!r.ok) throw new Error(r.message);
    if (upTo === "cancelled") await changeOrderStatus(t.db, { businessId: biz.id, orderId: r.data.id, to: "cancelled", actorUserId: owner.id });
    else if (upTo) for (const s of PATH.slice(0, PATH.indexOf(upTo) + 1)) await changeOrderStatus(t.db, { businessId: biz.id, orderId: r.data.id, to: s, actorUserId: owner.id });
    if (at) await t.sql`update orders set created_at = ${at}::timestamptz where id = ${r.data.id}`;
    return r.data;
  };
  return { owner, biz, ...menu, place };
}

const WIDE = { from: new Date("2000-01-01T00:00:00Z"), to: new Date("2100-01-01T00:00:00Z") };

describe("informe de ventas", () => {
  it("suma solo pedidos completados y separa cancelados y en curso", async () => {
    const w = await world();
    const c = w.ceviche.id;
    await w.place([{ productId: c, quantity: 2 }], {}, "completed"); // 70.00
    await w.place([{ productId: c, quantity: 1 }], { type: "delivery", deliveryAddress: "Av. Larco 123, Miraflores" }, "completed"); // 35.00 + 5.00
    await w.place([{ productId: c, quantity: 5 }], {}, "cancelled");
    await w.place([{ productId: c, quantity: 3 }], {}, "preparing");
    await w.place([{ productId: c, quantity: 1 }]); // pendiente
    const r = await salesReport(t.db, w.biz.id, WIDE);
    expect(r.completedCount).toBe(2);
    expect(r.revenueCents).toBe(7000 + 4000);
    expect(r.avgTicketCents).toBe(5500);
    expect(r.cancelledCount).toBe(1);
    expect(r.openCount).toBe(2);
    expect(r.byType.map((x) => [x.type, x.count, x.revenueCents]).sort()).toEqual([["delivery", 1, 4000], ["pickup", 1, 7000]].sort());
    expect(r.topProducts[0]).toEqual({ name: "Ceviche clásico", quantity: 3, revenueCents: 10500 }); // solo completados: 2 + 1
  });

  it("agrupa por DÍA EN HORA DE LIMA y respeta los límites del rango", async () => {
    const w = await world();
    const c = [{ productId: w.ceviche.id, quantity: 1 }];
    await w.place(c, {}, "completed", "2026-10-10T03:30:00Z"); // 09/10 22:30 en Lima
    await w.place(c, {}, "completed", "2026-10-10T05:30:00Z"); // 10/10 00:30 en Lima
    await w.place(c, {}, "completed", "2026-10-11T04:59:59Z"); // 10/10 23:59:59 en Lima (último segundo del día 10)
    await w.place(c, {}, "completed", "2026-10-11T05:00:00Z"); // 11/10 00:00:00 en Lima (ya es el día 11)
    const all = await salesReport(t.db, w.biz.id, parseRange("2026-10-09", "2026-10-11"));
    expect(all.byDay.map((d) => [d.day, d.count])).toEqual([["2026-10-09", 1], ["2026-10-10", 2], ["2026-10-11", 1]]);
    const only10 = await salesReport(t.db, w.biz.id, parseRange("2026-10-10", "2026-10-10"));
    expect(only10.completedCount).toBe(2);
    expect(only10.revenueCents).toBe(7000);
  });

  it("calcula lo descontado por promociones a partir del precio de lista guardado", async () => {
    const w = await world();
    await updateProduct(t.db, w.biz.id, w.ceviche.id, productInput(w.category.id, { name: w.ceviche.name, price: 3500, promoPercent: 20 }));
    await w.place([{ productId: w.ceviche.id, quantity: 3 }], {}, "completed"); // 3 × (35.00 − 28.00)
    const r = await salesReport(t.db, w.biz.id, WIDE);
    expect(r.revenueCents).toBe(3 * 2800);
    expect(r.discountCents).toBe(3 * 700);
  });

  it("no mezcla restaurantes: cada informe solo ve sus propios pedidos", async () => {
    const a = await world();
    const b = await world();
    await a.place([{ productId: a.ceviche.id, quantity: 1 }], {}, "completed");
    await b.place([{ productId: b.ceviche.id, quantity: 4 }], {}, "completed");
    expect((await salesReport(t.db, a.biz.id, WIDE)).revenueCents).toBe(3500);
    expect((await salesReport(t.db, b.biz.id, WIDE)).revenueCents).toBe(14000);
    expect((await exportOrders(t.db, a.biz.id, WIDE)).rows).toHaveLength(1);
    expect((await exportItems(t.db, b.biz.id, WIDE)).rows).toHaveLength(1);
  });

  it("sin pedidos devuelve ceros, no errores", async () => {
    const w = await world();
    const r = await salesReport(t.db, w.biz.id, WIDE);
    expect(r).toMatchObject({ completedCount: 0, revenueCents: 0, avgTicketCents: 0, cancelledCount: 0, openCount: 0, discountCents: 0, byDay: [], topProducts: [] });
  });
});

describe("exportaciones", () => {
  it("el CSV de pedidos incluye todos los estados con importes decimales y el de líneas el precio de lista", async () => {
    const w = await world();
    await updateProduct(t.db, w.biz.id, w.ceviche.id, productInput(w.category.id, { name: w.ceviche.name, price: 3500, promoPercent: 10 }));
    await w.place([{ productId: w.ceviche.id, quantity: 2 }], { customerName: "Luz Díaz" }, "completed");
    await w.place([{ productId: w.chicha.id, quantity: 1 }], {}, "cancelled");
    const orders = await exportOrders(t.db, w.biz.id, WIDE);
    expect(orders.rows.map((r) => [r[0], r[4], r[8], r[11]])).toEqual([[1, "Luz Díaz", "Completado", "63.00"], [2, "Ana Pérez", "Cancelado", "8.00"]]);
    const items = await exportItems(t.db, w.biz.id, WIDE);
    expect(items.rows[0]).toEqual([1, expect.any(String), "Completado", "Ceviche clásico", 2, "31.50", "35.00", "63.00"]);
  });
});

describe("CSV seguro", () => {
  it("escapa comillas, comas y saltos de línea", () => {
    expect(csvCell('Dijo "hola", y\nse fue')).toBe('"Dijo ""hola"", y\nse fue"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(12)).toBe('"12"');
  });
  it("neutraliza fórmulas (inyección CSV) en datos de clientes", () => {
    for (const evil of ['=HYPERLINK("http://malo","clic")', "+1+1", "-2+3", "@SUM(A1)", "\t=1", "\r=1"]) {
      expect(csvCell(evil).startsWith(`"'`)).toBe(true);
    }
    expect(csvCell("Ana =no es fórmula")).toBe('"Ana =no es fórmula"');
  });
  it("lleva BOM UTF-8 y fin de línea CRLF", () => {
    const csv = toCsv(["A", "B"], [["ñ", 1]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿"A","B"\r\n"ñ","1"\r\n');
  });
  it("los importes salen como decimales sin errores de coma flotante", () => {
    for (const [c, s] of [[0, "0.00"], [5, "0.05"], [1250, "12.50"], [10_000_000, "100000.00"]] as const) expect(centsToDecimal(c)).toBe(s);
  });
});

describe("rangos de fechas", () => {
  const now = new Date("2026-10-14T15:00:00Z"); // 10:00 en Lima
  it("por defecto son los últimos 30 días, hoy incluido, en hora de Lima", () => {
    const r = parseRange(undefined, undefined, now);
    expect([r.desde, r.hasta, r.corrected]).toEqual(["2026-09-15", "2026-10-14", false]);
    expect(r.from.toISOString()).toBe("2026-09-15T05:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-15T05:00:00.000Z");
  });
  it("corrige rangos inválidos: fechas inexistentes, invertidas o de más de un año", () => {
    for (const [d, h] of [["2026-02-31", "2026-03-01"], ["2026-10-10", "2026-10-01"], ["2024-01-01", "2026-01-01"], ["x", "y"], ["2026-10-01", undefined]] as const) {
      expect(parseRange(d, h, now).corrected).toBe(true);
    }
    expect(parseRange("2026-10-01", "2026-10-14", now).corrected).toBe(false);
  });
  it("utilidades de calendario", () => {
    expect(isValidDay("2024-02-29")).toBe(true);
    expect(isValidDay("2026-02-29")).toBe(false);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(limaDay(new Date("2026-10-11T04:59:59Z"))).toBe("2026-10-10");
    expect(limaDay(new Date("2026-10-11T05:00:00Z"))).toBe("2026-10-11");
  });
});
