import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBusinessAccess, listUserBusinesses, updateBusiness } from "@/server/domain/businesses";
import { createProduct, deleteCategory, deleteProduct, listCatalog, renameCategory, setProductAvailability, updateProduct } from "@/server/domain/catalog";
import { changeOrderStatus, getOrderDetail, getPublicOrder, listOrders, placeOrder } from "@/server/domain/orders";
import { can } from "@/lib/permissions";
import type { PlaceOrderInput } from "@/lib/validation";
import { businessInput, createTestDb, makeBusiness, makeMenu, makeUser, productInput, type TestDb } from "../helpers/db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const order = (productId: string): PlaceOrderInput => ({
  type: "pickup",
  tableLabel: null,
  customerName: "Cliente Uno",
  customerPhone: "999 111 222",
  deliveryAddress: null,
  notes: null,
  items: [{ productId, quantity: 1 }],
  idempotencyKey: randomUUID(),
});

/** Dos restaurantes de dos dueños distintos, cada uno con carta y un pedido. */
async function twoTenants() {
  const ownerA = await makeUser(t.db, "Dueña A");
  const ownerB = await makeUser(t.db, "Dueño B");
  const a = await makeBusiness(t.db, ownerA.id);
  const b = await makeBusiness(t.db, ownerB.id);
  const menuA = await makeMenu(t.db, a.id);
  const menuB = await makeMenu(t.db, b.id);
  const oa = await placeOrder(t.db, a.slug, order(menuA.ceviche.id));
  const ob = await placeOrder(t.db, b.slug, order(menuB.ceviche.id));
  if (!oa.ok || !ob.ok) throw new Error("no se pudieron crear los pedidos de prueba");
  return { ownerA, ownerB, a, b, menuA, menuB, orderA: oa.data, orderB: ob.data };
}

describe("aislamiento: acceso al panel", () => {
  it("una persona solo ve sus restaurantes", async () => {
    const { ownerA, ownerB, a, b } = await twoTenants();
    expect((await listUserBusinesses(t.db, ownerA.id)).map((x) => x.slug)).toEqual([a.slug]);
    expect((await listUserBusinesses(t.db, ownerB.id)).map((x) => x.slug)).toEqual([b.slug]);
  });

  it("no hay acceso al restaurante de otra persona (y no se revela que existe)", async () => {
    const { ownerA, ownerB, a, b } = await twoTenants();
    expect(await getBusinessAccess(t.db, ownerA.id, b.slug)).toBeNull();
    expect(await getBusinessAccess(t.db, ownerB.id, a.slug)).toBeNull();
    expect(await getBusinessAccess(t.db, ownerA.id, "no-existe-nada")).toBeNull();
    expect((await getBusinessAccess(t.db, ownerA.id, a.slug))?.role).toBe("owner");
  });
});

describe("aislamiento: carta", () => {
  it("las operaciones con el businessId de OTRO restaurante no tocan nada", async () => {
    const { a, b, menuA } = await twoTenants();
    // B intenta modificar/borrar recursos de A pasando sus propios ids de negocio
    expect((await updateProduct(t.db, b.id, menuA.ceviche.id, productInput(menuA.category.id, { name: "Hackeado", price: 1 }))).ok).toBe(false);
    expect((await setProductAvailability(t.db, b.id, menuA.ceviche.id, false)).ok).toBe(false);
    expect((await deleteProduct(t.db, b.id, menuA.ceviche.id)).ok).toBe(false);
    expect((await renameCategory(t.db, b.id, menuA.category.id, "Hackeada")).ok).toBe(false);
    expect((await deleteCategory(t.db, b.id, menuA.category.id)).ok).toBe(false);
    const after = await listCatalog(t.db, a.id);
    expect(after).toHaveLength(1);
    expect(after[0]?.name).toBe("Entradas");
    expect(after[0]?.products.map((p) => [p.name, p.priceCents, p.isAvailable]).sort()).toEqual([["Ceviche clásico", 3500, true], ["Chicha morada", 800, true]].sort());
  });

  it("no se puede crear un plato en una categoría de otro restaurante (clave foránea compuesta)", async () => {
    const { b, menuA } = await twoTenants();
    const r = await createProduct(t.db, b.id, productInput(menuA.category.id, { name: "Intruso" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.categoryId).toBeDefined();
    // ni moviendo un plato propio a una categoría ajena
    const menuB = await listCatalog(t.db, b.id);
    const mine = menuB[0]!.products[0]!;
    expect((await updateProduct(t.db, b.id, mine.id, productInput(menuA.category.id, { name: mine.name }))).ok).toBe(false);
  });
});

describe("aislamiento: pedidos", () => {
  it("un restaurante nunca ve, abre ni cambia pedidos de otro", async () => {
    const { a, b, ownerB, orderA, orderB } = await twoTenants();
    expect((await listOrders(t.db, b.id)).map((o) => o.id)).toEqual([orderB.id]);
    expect(await getOrderDetail(t.db, b.id, orderA.id)).toBeNull();
    const r = await changeOrderStatus(t.db, { businessId: b.id, orderId: orderA.id, to: "confirmed", actorUserId: ownerB.id });
    expect(r.ok).toBe(false);
    expect((await getOrderDetail(t.db, a.id, orderA.id))?.order.status).toBe("pending");
  });

  it("la consulta pública con el token de A no funciona bajo el slug de B", async () => {
    const { a, b, orderA } = await twoTenants();
    expect(await getPublicOrder(t.db, a.slug, orderA.token)).not.toBeNull();
    expect(await getPublicOrder(t.db, b.slug, orderA.token)).toBeNull();
  });
});

describe("aislamiento: la propia base de datos lo impide", () => {
  it("rechaza una línea de pedido que mezcle el pedido de A con el business_id de B", async () => {
    const { b, orderA } = await twoTenants();
    await expect(
      t.sql`insert into order_items (order_id, business_id, product_name, unit_price_cents, quantity, line_total_cents)
            values (${orderA.id}, ${b.id}, 'Cuelo', 100, 1, 100)`,
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("rechaza un plato de B apuntando a una categoría de A", async () => {
    const { b, menuA } = await twoTenants();
    await expect(
      t.sql`insert into products (business_id, category_id, name, price_cents) values (${b.id}, ${menuA.category.id}, 'Cuelo', 100)`,
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("rechaza un evento de estado de A en un pedido de B y datos incoherentes", async () => {
    const { a, orderB } = await twoTenants();
    await expect(
      t.sql`insert into order_events (order_id, business_id, from_status, to_status) values (${orderB.id}, ${a.id}, null, 'pending')`,
    ).rejects.toMatchObject({ code: "23503" });
    // total que no cuadra, estado inventado, cantidad fuera de rango, importe negativo
    await expect(t.sql`update orders set total_cents = total_cents + 1 where id = ${orderB.id}`).rejects.toMatchObject({ code: "23514" });
    await expect(t.sql`update orders set status = 'inventado' where id = ${orderB.id}`).rejects.toMatchObject({ code: "23514" });
    await expect(t.sql`update products set price_cents = -5 where business_id = ${a.id}`).rejects.toMatchObject({ code: "23514" });
  });

  it("slug único e inválido a nivel de base de datos", async () => {
    const { a, ownerB } = await twoTenants();
    const dup = await import("@/server/domain/businesses").then((m) => m.createBusiness(t.db, ownerB.id, businessInput({ slug: a.slug })));
    expect(dup.ok).toBe(false);
    await expect(t.sql`update businesses set slug = 'Con Espacios' where id = ${a.id}`).rejects.toMatchObject({ code: "23514" });
  });
});

describe("defensa en profundidad", () => {
  it("TODAS las tablas del esquema público tienen RLS activado (sin políticas: deny-by-default para la API pública)", async () => {
    const rows = await t.sql`
      select c.relname as tabla, c.relrowsecurity as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' order by c.relname`;
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.filter((r) => !r.rls).map((r) => r.tabla)).toEqual([]);
    const policies = await t.sql`select count(*)::int as n from pg_policies where schemaname = 'public'`;
    expect(policies[0]?.n).toBe(0);
  });
});

describe("roles", () => {
  it("la matriz de permisos solo deja al propietario gestionar el equipo y al personal solo los pedidos", () => {
    expect(can("owner", "team.manage")).toBe(true);
    expect(can("admin", "team.manage")).toBe(false);
    expect(can("staff", "team.manage")).toBe(false);
    expect(can("staff", "menu.write")).toBe(false);
    expect(can("staff", "settings.write")).toBe(false);
    expect(can("staff", "reports.read")).toBe(false);
    expect(can("staff", "orders.update")).toBe(true);
    expect(can("admin", "menu.write")).toBe(true);
  });

  it("editar un restaurante ajeno con su id no modifica el original", async () => {
    const { a, b } = await twoTenants();
    // updateBusiness recibe el id ya autorizado: comprobamos que sobre B solo cambia B
    const r = await updateBusiness(t.db, b.id, businessInput({ slug: b.slug, name: "Nombre nuevo de B" }));
    expect(r.ok).toBe(true);
    const sa = await t.sql`select name from businesses where id = ${a.id}`;
    expect(sa[0]?.name).toBe("La Mar de Prueba");
  });
});
