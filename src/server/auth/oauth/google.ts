import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";

/**
 * Google OpenID Connect — flujo de código de autorización con PKCE (S256), `state` y `nonce`, SIN librerías externas.
 * El secreto del cliente y los tokens solo existen en el servidor: nunca viajan al navegador ni se registran.
 *
 * Endpoints: los de Google. Para las pruebas automáticas se pueden sustituir por un servidor LOCAL falso solo si
 * OAUTH_TEST_MODE=1 y todas las URLs apuntan a localhost (nunca se usa así en producción).
 */
export interface GoogleConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly authUrl: string;
  readonly tokenUrl: string;
  readonly jwksUrl: string;
}

const GOOGLE = {
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
};
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

const isLocalUrl = (u: string) => {
  try {
    const h = new URL(u).hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
};

/** null si faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (el acceso con Google aún no está configurado). */
export function getGoogleConfig(siteUrl: string, env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  let { authUrl, tokenUrl, jwksUrl } = GOOGLE;
  if (env.OAUTH_TEST_MODE === "1") {
    const t = { authUrl: env.OAUTH_TEST_AUTH_URL, tokenUrl: env.OAUTH_TEST_TOKEN_URL, jwksUrl: env.OAUTH_TEST_JWKS_URL };
    if (t.authUrl && t.tokenUrl && t.jwksUrl && isLocalUrl(t.authUrl) && isLocalUrl(t.tokenUrl) && isLocalUrl(t.jwksUrl)) ({ authUrl, tokenUrl, jwksUrl } = t as typeof GOOGLE);
  }
  return { clientId, clientSecret, redirectUri: `${siteUrl.replace(/\/+$/, "")}/auth/google/callback`, authUrl, tokenUrl, jwksUrl };
}

const b64url = (buf: Buffer) => buf.toString("base64url");
export const randomToken = (bytes = 32) => b64url(randomBytes(bytes));
export const pkceChallenge = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());

export function buildAuthUrl(cfg: GoogleConfig, p: { state: string; nonce: string; challenge: string }): string {
  const u = new URL(cfg.authUrl);
  u.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return u.toString();
}

/** Intercambia el código por tokens (solo servidor a servidor). Devuelve el id_token; el access_token se descarta. */
export async function exchangeCode(cfg: GoogleConfig, code: string, verifier: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code_verifier: verifier,
    }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`token_endpoint_${res.status}`); // sin cuerpo: podría contener detalles sensibles
  const json = (await res.json()) as { id_token?: unknown };
  if (typeof json.id_token !== "string" || json.id_token.length > 8192) throw new Error("token_sin_id_token");
  return json.id_token;
}

// ───────────────────────── Verificación del id_token ─────────────────────────

export interface Jwk {
  readonly kid?: string;
  readonly kty: string;
  readonly n?: string;
  readonly e?: string;
  readonly alg?: string;
  readonly use?: string;
}
export type JwksProvider = (opts: { forceRefresh: boolean }) => Promise<Jwk[]>;

let jwksCache: { url: string; keys: Jwk[]; at: number } | null = null;
/** Claves públicas de Google (caché de 1 h; se refresca una vez si aparece un `kid` desconocido). */
export function jwksFromUrl(url: string, fetchImpl: typeof fetch = fetch): JwksProvider {
  return async ({ forceRefresh }) => {
    if (!forceRefresh && jwksCache && jwksCache.url === url && Date.now() - jwksCache.at < 3_600_000) return jwksCache.keys;
    const res = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`jwks_${res.status}`);
    const keys = ((await res.json()) as { keys?: Jwk[] }).keys ?? [];
    jwksCache = { url, keys, at: Date.now() };
    return keys;
  };
}

export interface GoogleClaims {
  readonly sub: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string | null;
}

export class IdTokenError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

function decode(part: string): Record<string, unknown> {
  try {
    const v = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as unknown;
    if (v && typeof v === "object") return v as Record<string, unknown>;
  } catch {
    /* cae abajo */
  }
  throw new IdTokenError("formato");
}

/**
 * Valida el id_token: firma RS256 contra las claves de Google, emisor, audiencia (nuestro client_id), caducidad y nonce.
 * No devuelve nada si algo falla (lanza IdTokenError con un motivo genérico, nunca con el contenido del token).
 */
export async function verifyIdToken(idToken: string, opts: { clientId: string; nonce: string; jwks: JwksProvider; now?: number }): Promise<GoogleClaims> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new IdTokenError("formato");
  const [h, p, s] = parts as [string, string, string];
  const header = decode(h);
  if (header.alg !== "RS256") throw new IdTokenError("algoritmo"); // rechaza "none" y HS256 (confusión de algoritmo)
  const signed = Buffer.from(`${h}.${p}`);
  const sig = Buffer.from(s, "base64url");

  const tryKeys = async (forceRefresh: boolean) => {
    const keys = (await opts.jwks({ forceRefresh })).filter((k) => k.kty === "RSA" && (!header.kid || k.kid === header.kid));
    return keys.some((k) => {
      try {
        return verify("RSA-SHA256", signed, createPublicKey({ key: k as never, format: "jwk" }), sig);
      } catch {
        return false;
      }
    });
  };
  if (!(await tryKeys(false)) && !(await tryKeys(true))) throw new IdTokenError("firma");

  const c = decode(p);
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  const skew = 60;
  if (typeof c.iss !== "string" || !ISSUERS.has(c.iss)) throw new IdTokenError("emisor");
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(opts.clientId)) throw new IdTokenError("audiencia");
  if (typeof c.exp !== "number" || c.exp + skew < now) throw new IdTokenError("caducado");
  if (typeof c.iat === "number" && c.iat - skew > now) throw new IdTokenError("emitido_en_el_futuro");
  if (typeof c.nonce !== "string" || c.nonce !== opts.nonce) throw new IdTokenError("nonce");
  if (typeof c.sub !== "string" || c.sub.length === 0 || c.sub.length > 255) throw new IdTokenError("sub");
  if (typeof c.email !== "string" || !c.email.includes("@") || c.email.length > 254) throw new IdTokenError("correo");
  return { sub: c.sub, email: c.email.trim().toLowerCase(), emailVerified: c.email_verified === true, name: typeof c.name === "string" ? c.name.trim() : null };
}
