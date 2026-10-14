import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBusinessAccess } from "@/server/domain/businesses";
import { changeOrderStatus, placeOrder } from "@/server/domain/orders";
import { addMember, changeMemberRole, listMembers, MAX_TEAM_SIZE, removeMember } from "@/server/domain/team";
import { can } from "@/lib/permissions";
import type { PlaceOrderInput } from "@/lib/validation";
import { createTestDb, makeBusiness, makeMenu, makeUser, type TestDb } from "../helpers/db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

async function team() {
  const owner = await makeUser(t.db, "Dueña");
  const biz = await makeBusiness(t.db, owner.id);
  const admin = await makeUser(t.db, "Admin");
  const staff = await makeUser(t.db, "Mozo");
  expect((await addMember(t.db, biz.id, { email: admin.email, role: "admin" })).ok).toBe(true);
  expect((await addMember(t.db, biz.id, { email: staff.email, role: "staff" })).ok).toBe(true);
  return { owner, biz, admin, staff };
}

describe("equipo y roles", () => {
  it("lista primero al propietario, luego administradores y personal", async () => {
    const { biz } = await team();
    expect((await listMembers(t.db, biz.id)).map((m) => m.role)).toEqual(["owner", "admin", "staff"]);
  });

  it("cada rol obtiene en el acceso exactamente los permisos de su matriz", async () => {
    const { biz, owner, admin, staff } = await team();
    const roleOf = async (u: { id: string }) => (await getBusinessAccess(t.db, u.id, biz.slug))?.role;
    expect([await roleOf(owner), await roleOf(admin), await roleOf(staff)]).toEqual(["owner", "admin", "staff"]);
    // el personal puede atender pedidos pero no tocar carta, ajustes, informes ni equipo
    const s = (await roleOf(staff))!;
    expect(["orders.read", "orders.update"].every((p) => can(s, p as "orders.read"))).toBe(true);
    expect(["menu.write", "settings.write", "reports.read", "team.manage"].some((p) => can(s, p as "menu.write"))).toBe(false);
    // el administrador gestiona todo menos el equipo
    const a = (await roleOf(admin))!;
    expect(["orders.update", "menu.write", "settings.write", "reports.read"].every((p) => can(a, p as "menu.write"))).toBe(true);
    expect(can(a, "team.manage")).toBe(false);
  });

  it("el personal puede cambiar el estado de pedidos de SU restaurante", async () => {
    const { biz, staff } = await team();
    const menu = await makeMenu(t.db, biz.id);
    const input: PlaceOrderInput = { type: "pickup", tableLabel: null, customerName: "Cliente", customerPhone: "999 000 111", deliveryAddress: null, notes: null, items: [{ productId: menu.ceviche.id, quantity: 1 }], idempotencyKey: randomUUID() };
    const o = await placeOrder(t.db, biz.slug, input);
    if (!o.ok) throw new Error(o.message);
    expect((await changeOrderStatus(t.db, { businessId: biz.id, orderId: o.data.id, to: "confirmed", actorUserId: staff.id })).ok).toBe(true);
  });

  it("rechaza correos sin cuenta, miembros repetidos y roles inválidos (incluido propietario)", async () => {
    const { biz, admin } = await team();
    const unknown = await addMember(t.db, biz.id, { email: "nadie@sin-cuenta.pe", role: "staff" });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.message).toMatch(/todavía no tiene cuenta/);
    const dup = await addMember(t.db, biz.id, { email: admin.email, role: "staff" });
    expect(dup.ok).toBe(false);
    const other = await makeUser(t.db);
    for (const role of ["owner", "root", "", "ADMIN"]) expect((await addMember(t.db, biz.id, { email: other.email, role })).ok).toBe(false);
    expect((await listMembers(t.db, biz.id)).some((m) => m.userId === other.id)).toBe(false);
  });

  it("el propietario no se puede degradar ni quitar", async () => {
    const { biz, owner } = await team();
    expect((await changeMemberRole(t.db, biz.id, owner.id, "staff")).ok).toBe(false);
    expect((await removeMember(t.db, biz.id, owner.id)).ok).toBe(false);
    expect((await getBusinessAccess(t.db, owner.id, biz.slug))?.role).toBe("owner");
  });

  it("cambiar de rol surte efecto y quitar a alguien le retira el acceso al instante", async () => {
    const { biz, staff } = await team();
    expect((await changeMemberRole(t.db, biz.id, staff.id, "admin")).ok).toBe(true);
    expect((await getBusinessAccess(t.db, staff.id, biz.slug))?.role).toBe("admin");
    expect((await changeMemberRole(t.db, biz.id, staff.id, "owner")).ok).toBe(false);
    expect((await removeMember(t.db, biz.id, staff.id)).ok).toBe(true);
    expect(await getBusinessAccess(t.db, staff.id, biz.slug)).toBeNull();
  });

  it("no se puede gestionar a miembros de OTRO restaurante usando el id de uno propio", async () => {
    const a = await team();
    const b = await team();
    expect((await changeMemberRole(t.db, b.biz.id, a.staff.id, "admin")).ok).toBe(false); // a.staff no es de b
    expect((await removeMember(t.db, b.biz.id, a.admin.id)).ok).toBe(false);
    expect((await getBusinessAccess(t.db, a.staff.id, a.biz.slug))?.role).toBe("staff");
    expect((await getBusinessAccess(t.db, a.admin.id, a.biz.slug))?.role).toBe("admin");
    // y quien es miembro de A no tiene acceso a B
    expect(await getBusinessAccess(t.db, a.staff.id, b.biz.slug)).toBeNull();
  });

  it("respeta el tamaño máximo del equipo", async () => {
    const owner = await makeUser(t.db);
    const biz = await makeBusiness(t.db, owner.id);
    for (let i = 0; i < MAX_TEAM_SIZE - 1; i++) {
      const u = await makeUser(t.db);
      expect((await addMember(t.db, biz.id, { email: u.email, role: "staff" })).ok).toBe(true);
    }
    const extra = await makeUser(t.db);
    const r = await addMember(t.db, biz.id, { email: extra.email, role: "staff" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/máximo/);
  });
});
