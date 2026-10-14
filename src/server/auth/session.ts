import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";

/**
 * Sesiones de servidor: la cookie lleva un token aleatorio de 256 bits y la base de datos solo guarda su SHA-256.
 * Aunque se filtrara la tabla `sessions`, no se podrían reconstruir cookies válidas. Cerrar sesión borra la fila.
 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** La sesión se renueva (ventana deslizante) cuando le queda menos de la mitad de su vida. */
const RENEW_BELOW_MS = SESSION_TTL_MS / 2;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

export async function createSession(db: Db, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  // limpieza oportunista de sesiones caducadas (barata gracias al índice por expires_at)
  if (Math.random() < 0.02) await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

export async function resolveSession(db: Db, token: string | undefined): Promise<{ user: SessionUser; renewedUntil: Date | null } | null> {
  if (!token || token.length < 32 || token.length > 128) return null;
  const rows = await db
    .select({ id: sessions.id, expiresAt: sessions.expiresAt, userId: users.id, email: users.email, name: users.name })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  let renewedUntil: Date | null = null;
  if (row.expiresAt.getTime() - Date.now() < RENEW_BELOW_MS) {
    renewedUntil = new Date(Date.now() + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt: renewedUntil, lastSeenAt: new Date() }).where(eq(sessions.id, row.id));
  }
  return { user: { id: row.userId, email: row.email, name: row.name }, renewedUntil };
}

export async function destroySession(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Cierra TODAS las sesiones de una persona (p. ej. tras cambiar la contraseña). */
export async function destroyAllSessions(db: Db, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
