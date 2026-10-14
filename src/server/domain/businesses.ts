import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { businesses, memberships } from "@/server/db/schema";
import { can, type Permission, type Role } from "@/lib/permissions";
import type { BusinessInput } from "@/lib/validation";
import { fail, ok, pgError, UNIQUE_VIOLATION, type Result } from "./result";

export type Business = typeof businesses.$inferSelect;

/** Máximo de restaurantes por cuenta (freno contra abuso). */
export const MAX_BUSINESSES_PER_USER = 5;

export interface BusinessAccess {
  readonly business: Business;
  readonly role: Role;
}

const values = (input: BusinessInput) => ({
  slug: input.slug,
  name: input.name,
  description: input.description,
  phone: input.phone,
  address: input.address,
  acceptsDineIn: input.acceptsDineIn,
  acceptsPickup: input.acceptsPickup,
  acceptsDelivery: input.acceptsDelivery,
  deliveryFeeCents: input.acceptsDelivery ? (input.deliveryFee ?? 0) : 0,
  isPublished: input.isPublished,
});

/** Crea un restaurante y hace propietaria a la persona que lo crea, en una sola transacción. */
export async function createBusiness(db: Db, userId: string, input: BusinessInput): Promise<Result<Business>> {
  try {
    return await db.transaction(async (tx) => {
      const [{ n } = { n: 0 }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(memberships)
        .where(and(eq(memberships.userId, userId), eq(memberships.role, "owner")));
      if (n >= MAX_BUSINESSES_PER_USER) return fail(`Has llegado al máximo de ${MAX_BUSINESSES_PER_USER} restaurantes por cuenta.`);
      const rows = await tx.insert(businesses).values(values(input)).returning();
      const business = rows[0];
      if (!business) return fail("No se pudo crear el restaurante.");
      await tx.insert(memberships).values({ userId, businessId: business.id, role: "owner" });
      return ok(business);
    });
  } catch (e) {
    if (pgError(e).code === UNIQUE_VIOLATION) return fail("Esa dirección ya está en uso.", { fieldErrors: { slug: ["Esa dirección ya está en uso, elige otra"] } });
    throw e;
  }
}

export async function updateBusiness(db: Db, businessId: string, input: BusinessInput): Promise<Result<Business>> {
  try {
    const rows = await db
      .update(businesses)
      .set({ ...values(input), updatedAt: new Date() })
      .where(eq(businesses.id, businessId))
      .returning();
    const business = rows[0];
    return business ? ok(business) : fail("Restaurante no encontrado.");
  } catch (e) {
    if (pgError(e).code === UNIQUE_VIOLATION) return fail("Esa dirección ya está en uso.", { fieldErrors: { slug: ["Esa dirección ya está en uso, elige otra"] } });
    throw e;
  }
}

export async function listUserBusinesses(db: Db, userId: string): Promise<Array<{ id: string; slug: string; name: string; role: Role; isPublished: boolean }>> {
  const rows = await db
    .select({ id: businesses.id, slug: businesses.slug, name: businesses.name, role: memberships.role, isPublished: businesses.isPublished })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(businesses.name));
  return rows as Array<{ id: string; slug: string; name: string; role: Role; isPublished: boolean }>;
}

/**
 * ÚNICA puerta de acceso al panel de un restaurante: devuelve el restaurante y el rol SOLO si la persona es miembro.
 * Si no lo es (o el restaurante no existe) devuelve null: el llamador responde 404, sin revelar que existe.
 */
export async function getBusinessAccess(db: Db, userId: string, slug: string): Promise<BusinessAccess | null> {
  const rows = await db
    .select({ business: businesses, role: memberships.role })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(and(eq(memberships.userId, userId), eq(businesses.slug, slug)))
    .limit(1);
  const row = rows[0];
  return row ? { business: row.business, role: row.role as Role } : null;
}

export function allows(access: BusinessAccess, permission: Permission): boolean {
  return can(access.role, permission);
}

/** Restaurante visible al público: existe y está publicado. */
export async function getPublicBusiness(db: Db, slug: string): Promise<Business | null> {
  const rows = await db.select().from(businesses).where(and(eq(businesses.slug, slug), eq(businesses.isPublished, true))).limit(1);
  return rows[0] ?? null;
}
