import { NextResponse } from "next/server";
import { clientIp } from "@/server/auth/current";
import { buildAuthUrl, getGoogleConfig, pkceChallenge, randomToken } from "@/server/auth/oauth/google";
import { OAUTH_STATE_COOKIE, setFlowCookie } from "@/server/auth/oauth/flow";
import { getDb } from "@/server/db";
import { createOAuthState } from "@/server/domain/oauth";
import { hit } from "@/server/rate-limit";
import { safeNext } from "@/lib/safe-next";
import { siteUrl } from "@/server/site-url";

/**
 * Inicio del flujo «Continuar con Google»: genera `state` (anti-CSRF), `nonce` y un verificador PKCE, los guarda en el
 * servidor (solo el hash del state) y redirige a Google. El destino posterior (`next`) se valida contra redirecciones abiertas.
 */
export async function GET(request: Request) {
  const base = await siteUrl();
  const back = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, base), 303);
  const cfg = getGoogleConfig(base);
  if (!cfg) return back("google_no_configurado");

  const db = getDb();
  const limited = await hit(db, `oauth:start:${await clientIp()}`, { limit: 20, windowSec: 10 * 60 });
  if (!limited.ok) return back("google_demasiados");

  const verifier = randomToken(32);
  const nonce = randomToken(16);
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const state = await createOAuthState(db, { verifier, nonce, next });
  await setFlowCookie(OAUTH_STATE_COOKIE, state); // une el flujo a ESTE navegador
  return NextResponse.redirect(buildAuthUrl(cfg, { state, nonce, challenge: pkceChallenge(verifier) }), 303);
}
