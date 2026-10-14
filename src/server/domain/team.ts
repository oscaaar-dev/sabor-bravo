import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { memberships, users } from "@/server/db/schema";
import { isRole, type Role } from "@/lib/permissions";
import { fail, isUuid, ok, type Result } from "./result";

/** Máximo de personas por restaurante (freno contra abuso). */
export const MAX_TEAM_SIZE = 20;

export interface Member {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly createdAt: Date;
}

const ROLE_ORDER = sql`case ${memberships.role} when 'owner' then 0 when 'admin' then 1 else 2 end`;

export async function listMembers(db: Db, businessId: string): Promise<Member[]> {
  const rows = await db
    .select({ userId: users.id, name: users.name, email: users.email, role: memberships.role, createdAt: memberships.createdAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.businessId, businessId))
    .orderBy(ROLE_ORDER, asc(users.name));
  return rows as Member[];
}

/**
 * Añade al equipo a una persona que YA tiene cuenta (se busca por correo). Solo se puede asignar administrador o personal:
 * el rol de propietario no se concede por esta vía.
 */
export async function addMember(db: Db, businessId: string, input: { email: string; role: string }): Promise<Result<Member>> {
  if (!isRole(input.role) || input.role === "owner") return fail("Elige un rol válido (administrador o personal).", { fieldErrors: { role: ["Elige un rol válido"] } });
  return db.transaction(async (tx) => {
    const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(memberships).where(eq(memberships.businessId, businessId));
    if (n >= MAX_TEAM_SIZE) return fail(`El equipo ya tiene el máximo de ${MAX_TEAM_SIZE} personas.`);
    const user = (await tx.select().from(users).where(eq(users.email, input.email)).limit(1))[0];
    if (!user) {
      return fail("Esa persona todavía no tiene cuenta. Pídele que se registre en /registro con ese correo y vuelve a intentarlo.", {
        fieldErrors: { email: ["No hay ninguna cuenta con ese correo"] },
      });
    }
    const existing = (await tx.select().from(memberships).where(and(eq(memberships.userId, user.id), eq(memberships.businessId, businessId))).limit(1))[0];
    if (existing) return fail("Esa persona ya forma parte del equipo.", { fieldErrors: { email: ["Ya forma parte del equipo"] } });
    const inserted = await tx.insert(memberships).values({ userId: user.id, businessId, role: input.role }).returning();
    return ok({ userId: user.id, name: user.name, email: user.email, role: input.role as Role, createdAt: inserted[0]?.createdAt ?? new Date() });
  });
}

/** Cambia el rol de un miembro (administrador ↔ personal). Un propietario no se puede modificar. */
export async function changeMemberRole(db: Db, businessId: string, userId: string, role: string): Promise<Result<null>> {
  if (!isUuid(userId)) return fail("Persona no encontrada.");
  if (!isRole(role) || role === "owner") return fail("Elige un rol válido (administrador o personal).");
  const rows = await db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.userId, userId), eq(memberships.businessId, businessId), sql`${memberships.role} <> 'owner'`))
    .returning({ userId: memberships.userId });
  return rows.length === 1 ? ok(null) : fail("No se puede cambiar el rol de esa persona (no es parte del equipo o es propietaria).");
}

/** Quita a alguien del equipo. Un propietario no se puede quitar. Pierde el acceso de inmediato (se valida en cada petición). */
export async function removeMember(db: Db, businessId: string, userId: string): Promise<Result<null>> {
  if (!isUuid(userId)) return fail("Persona no encontrada.");
  const rows = await db
    .delete(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.businessId, businessId), sql`${memberships.role} <> 'owner'`))
    .returning({ userId: memberships.userId });
  return rows.length === 1 ? ok(null) : fail("No se puede quitar a esa persona (no es parte del equipo o es propietaria).");
}
