import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/server/db";
import { createSession, destroySession, resolveSession, SESSION_TTL_MS, type SessionUser } from "@/server/auth/session";
import { getBusinessAccess, type BusinessAccess } from "@/server/domain/businesses";
import { can, type Permission } from "@/lib/permissions";

/** En producción la cookie lleva el prefijo __Host-: obliga a Secure, Path=/ y prohíbe el atributo Domain. */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-sb_session" : "sb_session";

/** Persona con sesión válida en esta petición (o null). Se memoriza por petición. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const session = await resolveSession(getDb(), store.get(SESSION_COOKIE)?.value);
  return session?.user ?? null;
});

/** Para páginas privadas: sin sesión → /login conservando a dónde iba. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  return user;
}

export interface BusinessContext extends BusinessAccess {
  readonly user: SessionUser;
}

/**
 * Puerta de TODA página privada de un restaurante: exige sesión, pertenencia y permiso.
 * - No es miembro (o no existe) → 404: no se revela que el restaurante existe.
 * - Es miembro pero su rol no tiene el permiso → vuelve al inicio de su panel.
 */
export async function requireBusiness(slug: string, permission: Permission): Promise<BusinessContext> {
  const user = await requireUser(`/dashboard/${slug}`);
  const access = await getBusinessAccess(getDb(), user.id, slug);
  if (!access) notFound();
  if (!can(access.role, permission)) redirect(`/dashboard/${slug}/pedidos`);
  return { user, ...access };
}

export type ActionAuth = { readonly ok: true; readonly ctx: BusinessContext } | { readonly ok: false; readonly message: string };

/** Variante para acciones de servidor: devuelve un error en vez de redirigir, salvo si no hay sesión. */
export async function authorize(slug: string, permission: Permission): Promise<ActionAuth> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const access = await getBusinessAccess(getDb(), user.id, slug);
  if (!access) return { ok: false, message: "No tienes acceso a este restaurante." };
  if (!can(access.role, permission)) return { ok: false, message: "Tu rol no tiene permiso para hacer esto." };
  return { ok: true, ctx: { user, ...access } };
}

export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await createSession(getDb(), userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  await destroySession(getDb(), store.get(SESSION_COOKIE)?.value);
  // Borrar = reenviar la cookie vacía y caducada CON los mismos atributos. Con `store.delete()` se perdería `Secure`, y los
  // navegadores ignoran el borrado de una cookie con prefijo __Host- que no sea Secure (la cookie vieja se quedaría).
  store.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0, expires: new Date(0) });
}

/** IP del cliente para los límites de intentos. Netlify la fija en x-nf-client-connection-ip (no es falsificable). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
