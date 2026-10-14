import { and, eq, gt, lt } from "drizzle-orm";
import type { Db } from "@/server/db";
import { oauthIdentities, oauthPendingLinks, oauthStates, users } from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/password";
import { hashToken } from "@/server/auth/session";
import { randomToken, type GoogleClaims } from "@/server/auth/oauth/google";
import { fail, ok, pgError, UNIQUE_VIOLATION, type Result } from "./result";

/** Un flujo OAuth o un enlace pendiente caducan a los 10 minutos. */
export const OAUTH_TTL_MS = 10 * 60 * 1000;

// ───────────────────────── Estado del flujo (CSRF + PKCE + nonce) ─────────────────────────

/** Guarda verificador PKCE, nonce y destino; devuelve el `state` (aleatorio) que viaja a Google y a la cookie. Solo se guarda su hash. */
export async function createOAuthState(db: Db, p: { verifier: string; nonce: string; next: string }): Promise<string> {
  const state = randomToken(32);
  await db.insert(oauthStates).values({ stateHash: hashToken(state), codeVerifier: p.verifier, nonce: p.nonce, nextPath: p.next, expiresAt: new Date(Date.now() + OAUTH_TTL_MS) });
  if (Math.random() < 0.05) await db.delete(oauthStates).where(lt(oauthStates.expiresAt, new Date()));
  return state;
}

/** Consume el estado: SOLO UN USO (se borra al leerlo) y solo si no ha caducado. Un `state` repetido o inventado devuelve null. */
export async function consumeOAuthState(db: Db, state: string): Promise<{ verifier: string; nonce: string; next: string } | null> {
  if (state.length < 20 || state.length > 128) return null;
  const rows = await db
    .delete(oauthStates)
    .where(and(eq(oauthStates.stateHash, hashToken(state)), gt(oauthStates.expiresAt, new Date())))
    .returning({ verifier: oauthStates.codeVerifier, nonce: oauthStates.nonce, next: oauthStates.nextPath });
  return rows[0] ?? null;
}

// ───────────────────────── Inicio de sesión con Google ─────────────────────────

export type GoogleSignIn =
  | { readonly kind: "signed_in"; readonly userId: string; readonly isNew: boolean }
  /** El correo coincide con una cuenta con contraseña: NO se vincula sola; hace falta confirmar con la contraseña. */
  | { readonly kind: "needs_password_link"; readonly pendingToken: string; readonly email: string };

function displayName(claims: GoogleClaims): string {
  const base = (claims.name ?? "").replace(/\s+/g, " ").trim() || claims.email.split("@")[0] || "Usuario";
  const name = base.slice(0, 80);
  return name.length >= 2 ? name : `${name}_`.slice(0, 80);
}

/**
 * Decide qué hacer con una identidad de Google ya verificada:
 *  1. Si ese `sub` ya está enlazado → es la misma cuenta de siempre (mismo perfil, mismos restaurantes).
 *  2. Si el correo coincide con otra cuenta → NO se enlaza ni se crea un duplicado: queda un enlace PENDIENTE que solo se
 *     completa demostrando la contraseña de esa cuenta.
 *  3. Si no existe nada → se crea una cuenta nueva (sin contraseña, correo verificado, sin ningún permiso especial).
 * El correo debe estar verificado por Google (se comprueba antes de llamar aquí).
 */
export async function signInWithGoogle(db: Db, claims: GoogleClaims, attempt = 0): Promise<Result<GoogleSignIn>> {
  if (!claims.emailVerified) return fail("El correo de tu cuenta de Google no está verificado.", { code: "email_not_verified" });
  try {
    return await db.transaction(async (tx) => {
      const identity = (await tx.select().from(oauthIdentities).where(and(eq(oauthIdentities.provider, "google"), eq(oauthIdentities.subject, claims.sub))).limit(1))[0];
      if (identity) {
        await tx.update(oauthIdentities).set({ lastLoginAt: new Date() }).where(eq(oauthIdentities.id, identity.id));
        return ok<GoogleSignIn>({ kind: "signed_in", userId: identity.userId, isNew: false });
      }

      const existing = (await tx.select().from(users).where(eq(users.email, claims.email)).limit(1))[0];
      if (existing) {
        if (!existing.passwordHash) return fail("Ese correo ya está asociado a otra cuenta de Google.", { code: "identity_conflict" });
        const other = (await tx.select({ id: oauthIdentities.id }).from(oauthIdentities).where(and(eq(oauthIdentities.userId, existing.id), eq(oauthIdentities.provider, "google"))).limit(1))[0];
        if (other) return fail("Esa cuenta ya está vinculada a otra cuenta de Google.", { code: "identity_conflict" });
        await tx.delete(oauthPendingLinks).where(eq(oauthPendingLinks.userId, existing.id));
        const token = randomToken(32);
        await tx.insert(oauthPendingLinks).values({ tokenHash: hashToken(token), userId: existing.id, provider: "google", subject: claims.sub, email: claims.email, expiresAt: new Date(Date.now() + OAUTH_TTL_MS) });
        return ok<GoogleSignIn>({ kind: "needs_password_link", pendingToken: token, email: claims.email });
      }

      const created = await tx.insert(users).values({ name: displayName(claims), email: claims.email, passwordHash: null, emailVerifiedAt: new Date() }).returning({ id: users.id });
      const userId = created[0]?.id;
      if (!userId) return fail("No se pudo crear la cuenta.");
      await tx.insert(oauthIdentities).values({ userId, provider: "google", subject: claims.sub, email: claims.email });
      return ok<GoogleSignIn>({ kind: "signed_in", userId, isNew: true });
    });
  } catch (e) {
    // dos primeras visitas simultáneas con el mismo Google: la segunda choca con una restricción única; se reintenta una vez
    if (pgError(e).code === UNIQUE_VIOLATION && attempt === 0) return signInWithGoogle(db, claims, 1);
    throw e;
  }
}

// ───────────────────────── Vincular con contraseña ─────────────────────────

export interface PendingLink {
  readonly userId: string;
  readonly email: string;
}

export async function getPendingLink(db: Db, token: string): Promise<PendingLink | null> {
  if (token.length < 20 || token.length > 128) return null;
  const row = (await db.select({ userId: oauthPendingLinks.userId, email: oauthPendingLinks.email }).from(oauthPendingLinks).where(and(eq(oauthPendingLinks.tokenHash, hashToken(token)), gt(oauthPendingLinks.expiresAt, new Date()))).limit(1))[0];
  return row ?? null;
}

/**
 * Completa el enlace: exige la CONTRASEÑA de la cuenta existente (prueba de que la persona es su dueña) y, si es correcta,
 * enlaza esa identidad de Google a la cuenta. El enlace pendiente es de un solo uso. Devuelve el id de la cuenta.
 */
export async function linkWithPassword(db: Db, token: string, password: string): Promise<Result<{ userId: string }>> {
  const pending = await getPendingLink(db, token);
  if (!pending) return fail("El enlace caducó. Vuelve a pulsar «Continuar con Google».", { code: "expired" });
  const user = (await db.select().from(users).where(eq(users.id, pending.userId)).limit(1))[0];
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) return fail("Contraseña incorrecta.", { code: "bad_password", fieldErrors: { password: ["Contraseña incorrecta"] } });
  try {
    await db.transaction(async (tx) => {
      const row = (await tx.delete(oauthPendingLinks).where(eq(oauthPendingLinks.tokenHash, hashToken(token))).returning())[0];
      if (!row) throw new Error("pendiente_consumido"); // otro intento simultáneo ya lo usó
      await tx.insert(oauthIdentities).values({ userId: pending.userId, provider: row.provider, subject: row.subject, email: row.email });
      // Google garantizó que controla ese correo y la persona demostró ser dueña de la cuenta: el correo queda verificado
      await tx.update(users).set({ emailVerifiedAt: new Date() }).where(and(eq(users.id, pending.userId)));
    });
  } catch (e) {
    if (pgError(e).code === UNIQUE_VIOLATION) return fail("Esa cuenta de Google ya está vinculada a otra cuenta.", { code: "identity_conflict" });
    if (e instanceof Error && e.message === "pendiente_consumido") return fail("El enlace ya se usó o caducó. Vuelve a pulsar «Continuar con Google».", { code: "expired" });
    throw e;
  }
  return ok({ userId: pending.userId });
}
