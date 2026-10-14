import { NextResponse } from "next/server";
import { clientIp, endSession, startSession } from "@/server/auth/current";
import { exchangeCode, getGoogleConfig, jwksFromUrl, verifyIdToken } from "@/server/auth/oauth/google";
import { clearFlowCookie, OAUTH_LINK_COOKIE, OAUTH_STATE_COOKIE, readFlowCookie, safeEqual, setFlowCookie } from "@/server/auth/oauth/flow";
import { getDb } from "@/server/db";
import { homePathFor } from "@/server/domain/businesses";
import { consumeOAuthState, signInWithGoogle } from "@/server/domain/oauth";
import { hit } from "@/server/rate-limit";
import { safeNext } from "@/lib/safe-next";
import { siteUrl } from "@/server/site-url";

/**
 * Retorno de Google. Orden de comprobaciones (cualquier fallo → /login?error=… sin detalles técnicos):
 *  1. `state` del navegador == `state` de la cookie (el flujo empezó en ESTE navegador) y existe en el servidor (un solo uso).
 *  2. El código se intercambia servidor a servidor con el verificador PKCE y el secreto del cliente.
 *  3. El id_token se valida: firma RS256 de Google, emisor, audiencia, caducidad y nonce.
 *  4. El correo debe estar verificado por Google.
 *  5. Se aplica la política de cuentas (ver domain/oauth.ts) y se emite LA MISMA sesión que usa el correo/contraseña.
 */
export async function GET(request: Request) {
  const base = await siteUrl();
  const go = (path: string) => NextResponse.redirect(new URL(path, base), 303);
  const fail = async (code: string) => {
    await clearFlowCookie(OAUTH_STATE_COOKIE);
    return go(`/login?error=${code}`);
  };

  const cfg = getGoogleConfig(base);
  if (!cfg) return fail("google_no_configurado");
  const q = new URL(request.url).searchParams;
  const providerError = q.get("error");
  if (providerError) return fail(providerError === "access_denied" ? "google_cancelado" : "google_fallo");

  const code = q.get("code");
  const state = q.get("state");
  const cookieState = await readFlowCookie(OAUTH_STATE_COOKIE);
  if (!code || !state || !cookieState || !safeEqual(state, cookieState)) return fail("google_estado");

  const db = getDb();
  const limited = await hit(db, `oauth:cb:${await clientIp()}`, { limit: 30, windowSec: 10 * 60 });
  if (!limited.ok) return fail("google_demasiados");

  const saved = await consumeOAuthState(db, state); // se borra al leerlo: un state no se puede reutilizar
  await clearFlowCookie(OAUTH_STATE_COOKIE);
  if (!saved) return go("/login?error=google_estado");

  let claims;
  try {
    const idToken = await exchangeCode(cfg, code, saved.verifier);
    claims = await verifyIdToken(idToken, { clientId: cfg.clientId, nonce: saved.nonce, jwks: jwksFromUrl(cfg.jwksUrl) });
  } catch {
    return go("/login?error=google_fallo"); // sin registrar el error: podría arrastrar fragmentos del token
  }
  if (!claims.emailVerified) return go("/login?error=google_correo_no_verificado");

  const result = await signInWithGoogle(db, claims);
  if (!result.ok) return go(`/login?error=${result.code === "identity_conflict" ? "google_conflicto" : "google_fallo"}`);

  if (result.data.kind === "needs_password_link") {
    await setFlowCookie(OAUTH_LINK_COOKIE, result.data.pendingToken);
    return go("/login/vincular");
  }
  await endSession(); // nunca se reutiliza una sesión anterior de este navegador
  await startSession(result.data.userId);
  // cuenta nueva → crear su restaurante; cuenta existente → su panel (o el destino concreto que pidió, ya validado)
  const wanted = safeNext(saved.next);
  return go(result.data.isNew || wanted === "/dashboard" ? await homePathFor(db, result.data.userId) : wanted);
}
