/**
 * Prueba de humo contra una base REAL (p. ej. Supabase): ejecuta el flujo completo de la aplicación (cuenta → restaurante →
 * carta → pedido → estados → informe → límite de intentos) DENTRO DE UNA TRANSACCIÓN QUE SE DESHACE AL FINAL, así que no deja
 * ningún dato. Sirve para comprobar que el pooler (modo transacción, sin sentencias preparadas), los bloqueos FOR UPDATE, las
 * restricciones y las consultas SQL crudas funcionan en ese servidor.
 *
 *   npm run db:smoke:prod
 */
import { createDb, type Db } from "../src/server/db";
import { hit } from "../src/server/rate-limit";
import { createBusiness } from "../src/server/domain/businesses";
import { createCategory, createProduct } from "../src/server/domain/catalog";
import { changeOrderStatus, listOrders, placeOrder } from "../src/server/domain/orders";
import { salesReport } from "../src/server/domain/reports";
import { registerUser } from "../src/server/domain/users";
import { parseRange } from "../src/lib/dates";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL");
const host = new URL(url).hostname;
const { db, close } = createDb(url, { max: 2 });

class Rollback extends Error {}
const checks: string[] = [];
const must = (cond: unknown, what: string) => {
  if (!cond) throw new Error(`FALLÓ: ${what}`);
  checks.push(what);
};

try {
  await db.transaction(async (tx) => {
    const t = tx as unknown as Db; // las funciones de dominio aceptan el cliente de transacción (usan savepoints si anidan)
    const stamp = Date.now().toString(36);
    const user = await registerUser(t, { name: "Prueba de humo", email: `humo.${stamp}@prueba.invalid`, password: "una-clave-larga-123" });
    must(user.ok, "registrar usuario (scrypt + insert)");
    if (!user.ok) return;
    const biz = await createBusiness(t, user.data.id, {
      name: "Humo", slug: `humo-${stamp}`, description: null, phone: null, address: null,
      acceptsDineIn: true, acceptsPickup: true, acceptsDelivery: true, deliveryFee: 500, isPublished: true,
    });
    must(biz.ok, "crear restaurante + membresía en una transacción anidada");
    if (!biz.ok) return;
    const cat = await createCategory(t, biz.data.id, "Entradas");
    if (!cat.ok) throw new Error(cat.message);
    const prod = await createProduct(t, biz.data.id, { categoryId: cat.data.id, name: "Ceviche", description: null, price: 3500, imageUrl: null, isAvailable: true, isPublished: true, promoPercent: 10, promoEndsAt: null });
    must(prod.ok, "crear categoría y plato con promoción (clave foránea compuesta)");
    if (!prod.ok) return;
    const order = await placeOrder(t, biz.data.slug, {
      type: "delivery", tableLabel: null, customerName: "Cliente Humo", customerPhone: "999 000 111", deliveryAddress: "Av. Prueba 123", notes: null,
      items: [{ productId: prod.data.id, quantity: 2 }], idempotencyKey: randomUUID(),
    });
    must(order.ok && order.data.totalCents === 2 * 3150 + 500, "pedido: precio con promoción calculado en el servidor + delivery");
    if (!order.ok) return;
    for (const to of ["confirmed", "preparing", "ready", "completed"] as const) {
      const r = await changeOrderStatus(t, { businessId: biz.data.id, orderId: order.data.id, to, actorUserId: user.data.id });
      must(r.ok, `cambio de estado → ${to} (SELECT … FOR UPDATE)`);
    }
    must((await listOrders(t, biz.data.id))[0]?.itemCount === 2, "listado de pedidos con subconsulta de unidades");
    const report = await salesReport(t, biz.data.id, parseRange(undefined, undefined));
    must(report.revenueCents === 6800 && report.completedCount === 1 && report.discountCents === 700, "informe: SQL crudo con fechas ISO y zona horaria de Lima");
    must((await hit(t, `humo:${stamp}`, { limit: 1, windowSec: 60 })).ok, "límite de intentos (upsert atómico con make_interval)");
    must(!(await hit(t, `humo:${stamp}`, { limit: 1, windowSec: 60 })).ok, "límite de intentos: bloquea al pasar el máximo");
    const rls = await tx.execute<{ n: number }>(`select count(*)::int as n from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity` as never);
    must((rls[0]?.n ?? -1) === 0, "RLS activado en todas las tablas públicas");
    throw new Rollback(); // deshacer TODO
  });
} catch (e) {
  if (!(e instanceof Rollback)) {
    console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}`);
    await close();
    process.exit(1);
  }
}
await close();
console.log(`Prueba de humo contra ${host}: ${checks.length} comprobaciones correctas y TODO deshecho (no queda ningún dato).`);
for (const c of checks) console.log(`  ✓ ${c}`);
