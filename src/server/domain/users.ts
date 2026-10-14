import { eq } from "drizzle-orm";
import type { Db } from "@/server/db";
import { users } from "@/server/db/schema";
import { dummyHash, hashPassword, verifyPassword } from "@/server/auth/password";
import { fail, ok, pgError, UNIQUE_VIOLATION, type Result } from "./result";

export interface PublicUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

/** Crea una cuenta. El correo ya llega en minúsculas y validado; la contraseña se guarda solo como hash scrypt. */
export async function registerUser(db: Db, input: { name: string; email: string; password: string }): Promise<Result<PublicUser>> {
  const passwordHash = await hashPassword(input.password);
  try {
    const rows = await db.insert(users).values({ name: input.name, email: input.email, passwordHash }).returning({ id: users.id, email: users.email, name: users.name });
    const user = rows[0];
    if (!user) return fail("No se pudo crear la cuenta. Inténtalo de nuevo.");
    return ok(user);
  } catch (e) {
    if (pgError(e).code === UNIQUE_VIOLATION) return fail("Ya existe una cuenta con ese correo.", { fieldErrors: { email: ["Ya existe una cuenta con ese correo"] } });
    throw e;
  }
}

/** Verifica credenciales. Tarda lo mismo exista o no el correo (compara contra un hash de relleno). */
export async function authenticate(db: Db, email: string, password: string): Promise<PublicUser | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const row = rows[0];
  // Cuenta inexistente O creada con Google (sin contraseña): se compara contra un hash de relleno, mismo tiempo y mismo resultado.
  const hash = row?.passwordHash ?? (await dummyHash());
  const valid = await verifyPassword(password, hash);
  if (!row || !row.passwordHash || !valid) return null;
  return { id: row.id, email: row.email, name: row.name };
}

export async function findUserByEmail(db: Db, email: string): Promise<PublicUser | null> {
  const rows = await db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}
