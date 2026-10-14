/**
 * Servidor OpenID Connect FALSO que imita a Google, solo para pruebas locales. Comprueba lo mismo que comprobaría Google:
 * client_id, redirect_uri, response_type=code, PKCE S256 (el code_verifier debe coincidir con el code_challenge), secreto del
 * cliente en /token y uso único del código. Firma los id_token con RS256 y publica sus claves en /jwks.
 * NO prueba nada de Google real (consola, pantalla de consentimiento, dominios autorizados): eso sigue pendiente.
 */
import { createHash, createSign, generateKeyPairSync, randomBytes } from "node:crypto";
import http from "node:http";

export interface Persona {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
  /** El id_token llevará un nonce distinto del enviado (ataque de reutilización de token). */
  badNonce?: boolean;
  /** El usuario pulsa «Cancelar» en la pantalla de Google. */
  deny?: boolean;
}

export interface MockGoogle {
  readonly authUrl: string;
  readonly tokenUrl: string;
  readonly jwksUrl: string;
  setPersona(p: Persona): void;
  /** Peticiones recibidas, para comprobar que el flujo cumple PKCE/state/nonce. */
  readonly log: { authorize: URLSearchParams[]; token: URLSearchParams[]; lastCallback: string | null };
  stop(): Promise<void>;
}

export async function startMockGoogle(opts: { port: number; clientId: string; clientSecret: string }): Promise<MockGoogle> {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "mock-1", alg: "RS256", use: "sig" };
  const codes = new Map<string, { challenge: string; nonce: string; redirectUri: string; persona: Persona }>();
  let persona: Persona = { sub: "sub-por-defecto", email: "defecto@gmail.test", name: "Por Defecto", emailVerified: true };
  const log: MockGoogle["log"] = { authorize: [], token: [], lastCallback: null };
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${opts.port}`);
    const bad = (status: number, error: string) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error }));
    };
    if (url.pathname === "/jwks") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ keys: [jwk] }));
    }
    if (url.pathname === "/authorize" && req.method === "GET") {
      const q = url.searchParams;
      log.authorize.push(q);
      const redirectUri = q.get("redirect_uri") ?? "";
      if (q.get("client_id") !== opts.clientId || q.get("response_type") !== "code" || q.get("code_challenge_method") !== "S256" || !q.get("code_challenge") || !q.get("state") || !q.get("nonce") || !(q.get("scope") ?? "").includes("openid")) return bad(400, "invalid_request");
      const back = new URL(redirectUri);
      back.searchParams.set("state", q.get("state") as string);
      if (persona.deny) back.searchParams.set("error", "access_denied");
      else {
        const code = randomBytes(16).toString("hex");
        codes.set(code, { challenge: q.get("code_challenge") as string, nonce: q.get("nonce") as string, redirectUri, persona });
        back.searchParams.set("code", code);
      }
      log.lastCallback = back.toString();
      res.writeHead(302, { Location: back.toString() });
      return res.end();
    }
    if (url.pathname === "/token" && req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
      log.token.push(body);
      const entry = codes.get(body.get("code") ?? "");
      codes.delete(body.get("code") ?? ""); // un código solo vale UNA vez
      const verifier = body.get("code_verifier") ?? "";
      if (!entry || body.get("grant_type") !== "authorization_code" || body.get("client_id") !== opts.clientId || body.get("client_secret") !== opts.clientSecret || body.get("redirect_uri") !== entry.redirectUri) return bad(400, "invalid_grant");
      if (createHash("sha256").update(verifier).digest("base64url") !== entry.challenge) return bad(400, "invalid_grant"); // PKCE
      const now = Math.floor(Date.now() / 1000);
      const p = entry.persona;
      const head = b64({ alg: "RS256", kid: "mock-1", typ: "JWT" });
      const payload = b64({
        iss: "https://accounts.google.com", aud: opts.clientId, sub: p.sub, email: p.email, email_verified: p.emailVerified, name: p.name,
        nonce: p.badNonce ? "nonce-de-otro-flujo" : entry.nonce, iat: now, exp: now + 3600,
      });
      const sig = createSign("RSA-SHA256").update(`${head}.${payload}`).sign(privateKey).toString("base64url");
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ access_token: "token-de-acceso-falso", token_type: "Bearer", expires_in: 3599, id_token: `${head}.${payload}.${sig}` }));
    }
    bad(404, "not_found");
  });
  await new Promise<void>((r) => server.listen(opts.port, "127.0.0.1", r));
  const base = `http://127.0.0.1:${opts.port}`;
  return {
    authUrl: `${base}/authorize`,
    tokenUrl: `${base}/token`,
    jwksUrl: `${base}/jwks`,
    setPersona: (p) => {
      persona = p;
    },
    log,
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}
