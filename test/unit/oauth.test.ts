import { createHmac, createSign, generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticate } from "@/server/domain/users";
import { buildAuthUrl, exchangeCode, getGoogleConfig, IdTokenError, pkceChallenge, verifyIdToken, type Jwk, type JwksProvider } from "@/server/auth/oauth/google";
import { consumeOAuthState, createOAuthState, getPendingLink, linkWithPassword, OAUTH_TTL_MS, signInWithGoogle } from "@/server/domain/oauth";
import { getBusinessAccess, homePathFor } from "@/server/domain/businesses";
import { createTestDb, makeBusiness, makeUser, type TestDb } from "../helpers/db";

// ───────────────────────── Utilidades: un "Google" falso con clave RSA propia ─────────────────────────
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk: Jwk = { ...(publicKey.export({ format: "jwk" }) as Jwk), kid: "k1", alg: "RS256", use: "sig" };
const jwks: JwksProvider = async () => [jwk];
const CLIENT_ID = "cliente-de-prueba.apps.googleusercontent.com";
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

function sign(payload: Record<string, unknown>, opts: { alg?: string; kid?: string; key?: typeof privateKey; hmacSecret?: string } = {}): string {
  const head = b64({ alg: opts.alg ?? "RS256", kid: opts.kid ?? "k1", typ: "JWT" });
  const data = `${head}.${b64(payload)}`;
  if (opts.alg === "none") return `${data}.`;
  if (opts.alg === "HS256") return `${data}.${createHmac("sha256", opts.hmacSecret ?? "x").update(data).digest("base64url")}`;
  const s = createSign("RSA-SHA256").update(data).sign(opts.key ?? privateKey);
  return `${data}.${s.toString("base64url")}`;
}
const NOW = 1_800_000_000;
const good = (over: Record<string, unknown> = {}) => ({
  iss: "https://accounts.google.com", aud: CLIENT_ID, sub: "1234567890", email: "Ana@Gmail.com", email_verified: true, name: "Ana Pérez", nonce: "n-1", iat: NOW - 10, exp: NOW + 3600, ...over,
});
const verifyWith = (token: string, nonce = "n-1") => verifyIdToken(token, { clientId: CLIENT_ID, nonce, jwks, now: NOW * 1000 });
const reason = async (p: Promise<unknown>) => p.then(() => "OK", (e) => (e instanceof IdTokenError ? e.reason : `otro:${String(e)}`));

describe("PKCE y URL de autorización", () => {
  it("S256 cumple el vector de prueba del RFC 7636", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  it("la URL pide código + PKCE S256 + state + nonce + ámbito mínimo y no lleva el secreto", () => {
    const cfg = getGoogleConfig("https://sabor-bravo.netlify.app/", { GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: "super-secreto" })!;
    const u = new URL(buildAuthUrl(cfg, { state: "st", nonce: "no", challenge: "ch" }));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      client_id: CLIENT_ID, response_type: "code", scope: "openid email profile", state: "st", nonce: "no", code_challenge: "ch", code_challenge_method: "S256",
      redirect_uri: "https://sabor-bravo.netlify.app/auth/google/callback",
    });
    expect(u.toString()).not.toContain("super-secreto");
  });
  it("sin credenciales no hay configuración (el botón responde «aún no disponible»)", () => {
    expect(getGoogleConfig("https://x.pe", {})).toBeNull();
    expect(getGoogleConfig("https://x.pe", { GOOGLE_CLIENT_ID: "a" })).toBeNull();
    expect(getGoogleConfig("https://x.pe", { GOOGLE_CLIENT_SECRET: "b" })).toBeNull();
  });
  it("los endpoints de prueba se ignoran salvo OAUTH_TEST_MODE=1 y solo si son de localhost", () => {
    const base = { GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", OAUTH_TEST_AUTH_URL: "http://127.0.0.1:1/a", OAUTH_TEST_TOKEN_URL: "http://127.0.0.1:1/t", OAUTH_TEST_JWKS_URL: "http://127.0.0.1:1/j" };
    expect(getGoogleConfig("https://x.pe", base)!.tokenUrl).toBe("https://oauth2.googleapis.com/token");
    expect(getGoogleConfig("https://x.pe", { ...base, OAUTH_TEST_MODE: "1" })!.tokenUrl).toBe("http://127.0.0.1:1/t");
    expect(getGoogleConfig("https://x.pe", { ...base, OAUTH_TEST_MODE: "1", OAUTH_TEST_TOKEN_URL: "https://malo.com/t" })!.tokenUrl).toBe("https://oauth2.googleapis.com/token");
  });
});

describe("intercambio del código", () => {
  const cfg = getGoogleConfig("https://x.pe", { GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: "secreto-del-cliente" })!;
  it("envía código, verificador PKCE y secreto al endpoint de Google (servidor a servidor) y devuelve solo el id_token", async () => {
    let seen: { url: string; body: URLSearchParams } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      seen = { url, body: new URLSearchParams(String(init.body)) };
      return new Response(JSON.stringify({ id_token: "a.b.c", access_token: "NO-SE-USA" }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await exchangeCode(cfg, "codigo-123", "verificador-xyz", fake)).toBe("a.b.c");
    expect(seen!.url).toBe("https://oauth2.googleapis.com/token");
    expect(Object.fromEntries(seen!.body)).toMatchObject({ grant_type: "authorization_code", code: "codigo-123", code_verifier: "verificador-xyz", client_id: CLIENT_ID, client_secret: "secreto-del-cliente" });
  });
  it("si Google rechaza el código lanza un error SIN el cuerpo de la respuesta ni secretos", async () => {
    const fake = (async () => new Response('{"error":"invalid_grant","error_description":"Bad Request SECRETO"}', { status: 400 })) as unknown as typeof fetch;
    const err = await exchangeCode(cfg, "x", "y", fake).catch((e: Error) => e);
    expect((err as Error).message).toBe("token_endpoint_400");
    expect(String((err as Error).message)).not.toMatch(/SECRETO|secreto-del-cliente/);
  });
  it("rechaza respuestas sin id_token", async () => {
    const fake = (async () => new Response(JSON.stringify({ access_token: "x" }), { status: 200 })) as unknown as typeof fetch;
    await expect(exchangeCode(cfg, "x", "y", fake)).rejects.toThrow("token_sin_id_token");
  });
});

describe("validación del id_token", () => {
  it("acepta un token correcto y normaliza el correo", async () => {
    expect(await verifyWith(sign(good()))).toEqual({ sub: "1234567890", email: "ana@gmail.com", emailVerified: true, name: "Ana Pérez" });
    expect((await verifyWith(sign(good({ aud: ["otro", CLIENT_ID] })))).sub).toBe("1234567890");
    expect((await verifyWith(sign(good({ iss: "accounts.google.com" })))).sub).toBe("1234567890");
  });
  it("informa si el correo NO está verificado (la ruta lo rechaza)", async () => {
    expect((await verifyWith(sign(good({ email_verified: false })))).emailVerified).toBe(false);
    expect((await verifyWith(sign(good({ email_verified: "true" })))).emailVerified).toBe(false); // solo el booleano true cuenta
  });
  it.each([
    ["nonce distinto (token de otro flujo)", good({ nonce: "otro" }), {}, "nonce"],
    ["sin nonce", (() => { const g = good(); delete (g as Record<string, unknown>).nonce; return g; })(), {}, "nonce"],
    ["audiencia de otro cliente", good({ aud: "otro-cliente" }), {}, "audiencia"],
    ["emisor falso", good({ iss: "https://accounts.google.com.malo.com" }), {}, "emisor"],
    ["caducado", good({ exp: NOW - 120 }), {}, "caducado"],
    ["emitido en el futuro", good({ iat: NOW + 600 }), {}, "emitido_en_el_futuro"],
    ["sin sub", good({ sub: "" }), {}, "sub"],
    ["sin correo", good({ email: undefined }), {}, "correo"],
    ["firmado con otra clave", good(), { key: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey }, "firma"],
    ["kid desconocido", good(), { kid: "no-existe" }, "firma"],
    ["alg none (sin firma)", good(), { alg: "none" }, "algoritmo"],
    ["HS256 con la clave pública como secreto (confusión de algoritmo)", good(), { alg: "HS256", hmacSecret: JSON.stringify(jwk) }, "algoritmo"],
  ])("rechaza: %s", async (_n, payload, opts, why) => {
    expect(await reason(verifyWith(sign(payload, opts as never)))).toBe(why);
  });
  it("rechaza un payload manipulado tras firmar y basura sin formato", async () => {
    const [h, , s] = sign(good()).split(".");
    const tampered = `${h}.${b64(good({ email: "victima@gmail.com", sub: "otro" }))}.${s}`;
    expect(await reason(verifyWith(tampered))).toBe("firma");
    for (const junk of ["", "abc", "a.b", "a.b.c.d", "....", "%%%.%%%.%%%"]) expect(["formato", "algoritmo", "firma"]).toContain(await reason(verifyWith(junk)));
  });
});

// ───────────────────────── Base de datos: estado y cuentas ─────────────────────────
let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const claims = (over: Partial<{ sub: string; email: string; emailVerified: boolean; name: string | null }> = {}) => ({
  sub: `g-${Math.random().toString(36).slice(2)}`, email: `g${Math.random().toString(36).slice(2)}@gmail.test`, emailVerified: true, name: "Gloria Google", ...over,
});

describe("estado del flujo (state + PKCE + nonce)", () => {
  it("se consume UNA sola vez y devuelve verificador, nonce y destino", async () => {
    const state = await createOAuthState(t.db, { verifier: "ver", nonce: "non", next: "/dashboard/x/pedidos" });
    expect(await consumeOAuthState(t.db, state)).toEqual({ verifier: "ver", nonce: "non", next: "/dashboard/x/pedidos" });
    expect(await consumeOAuthState(t.db, state)).toBeNull(); // repetir un state ya usado
  });
  it("rechaza states inventados, vacíos y caducados; la base solo guarda su hash", async () => {
    expect(await consumeOAuthState(t.db, "x".repeat(43))).toBeNull();
    expect(await consumeOAuthState(t.db, "")).toBeNull();
    const state = await createOAuthState(t.db, { verifier: "v", nonce: "n", next: "/dashboard" });
    const rows = await t.sql`select state_hash from oauth_states`;
    expect(rows.some((r) => r.state_hash === state)).toBe(false);
    await t.sql`update oauth_states set expires_at = now() - interval '1 minute'`;
    expect(await consumeOAuthState(t.db, state)).toBeNull();
    expect(OAUTH_TTL_MS).toBe(600_000);
  });
  it("10 usos simultáneos del mismo state: solo uno gana", async () => {
    const state = await createOAuthState(t.db, { verifier: "v", nonce: "n", next: "/dashboard" });
    const all = await Promise.all(Array.from({ length: 10 }, () => consumeOAuthState(t.db, state)));
    expect(all.filter(Boolean)).toHaveLength(1);
  });
});

describe("primer acceso con Google", () => {
  it("crea una cuenta SIN contraseña, con correo verificado, sin restaurantes ni permisos especiales", async () => {
    const c = claims();
    const r = await signInWithGoogle(t.db, c);
    expect(r.ok && r.data.kind === "signed_in" && r.data.isNew).toBe(true);
    if (!r.ok || r.data.kind !== "signed_in") return;
    const u = (await t.sql`select name, email, password_hash, email_verified_at from users where id = ${r.data.userId}`)[0];
    expect(u).toMatchObject({ name: "Gloria Google", email: c.email, password_hash: null });
    expect(u?.email_verified_at).not.toBeNull();
    expect((await t.sql`select count(*)::int as n from memberships where user_id = ${r.data.userId}`)[0]?.n).toBe(0);
    expect(await homePathFor(t.db, r.data.userId)).toBe("/dashboard/nuevo"); // nuevo → crear su restaurante
  });
  it("no se puede entrar a esa cuenta con correo y contraseña (no tiene contraseña)", async () => {
    const c = claims();
    await signInWithGoogle(t.db, c);
    for (const pw of ["", "x", "una-clave-larga-123", "scrypt$1$1$1$a$b", c.email]) expect(await authenticate(t.db, c.email, pw)).toBeNull();
  });
  it("usa el correo como nombre si Google no da uno y recorta nombres larguísimos", async () => {
    const a = await signInWithGoogle(t.db, claims({ name: null, email: "sin.nombre@gmail.test" }));
    const b = await signInWithGoogle(t.db, claims({ name: "N".repeat(200) }));
    for (const [r, expected] of [[a, "sin.nombre"], [b, "N".repeat(80)]] as const) {
      if (!r.ok || r.data.kind !== "signed_in") throw new Error("fallo");
      expect((await t.sql`select name from users where id = ${r.data.userId}`)[0]?.name).toBe(expected);
    }
  });
  it("rechaza un correo no verificado y no crea nada", async () => {
    const c = claims({ emailVerified: false });
    const r = await signInWithGoogle(t.db, c);
    expect(r.ok).toBe(false);
    expect((await t.sql`select count(*)::int as n from users where email = ${c.email}`)[0]?.n).toBe(0);
  });
  it("5 primeras visitas simultáneas con el mismo Google crean UNA sola cuenta", async () => {
    const c = claims();
    const rs = await Promise.all(Array.from({ length: 5 }, () => signInWithGoogle(t.db, c)));
    const ids = new Set(rs.map((r) => (r.ok && r.data.kind === "signed_in" ? r.data.userId : "x")));
    expect(ids.size).toBe(1);
    expect((await t.sql`select count(*)::int as n from users where email = ${c.email}`)[0]?.n).toBe(1);
    expect((await t.sql`select count(*)::int as n from oauth_identities where subject = ${c.sub}`)[0]?.n).toBe(1);
  });
});

describe("accesos posteriores", () => {
  it("el mismo Google recupera el MISMO perfil y sus restaurantes, aunque cambie su correo en Google", async () => {
    const c = claims();
    const first = await signInWithGoogle(t.db, c);
    if (!first.ok || first.data.kind !== "signed_in") throw new Error("fallo");
    const biz = await makeBusiness(t.db, first.data.userId);
    const again = await signInWithGoogle(t.db, { ...c, email: "cambiado@gmail.test" });
    expect(again.ok && again.data.kind === "signed_in" && again.data.userId === first.data.userId && !again.data.isNew).toBe(true);
    expect((await getBusinessAccess(t.db, first.data.userId, biz.slug))?.role).toBe("owner");
    expect(await homePathFor(t.db, first.data.userId)).toBe(`/dashboard/${biz.slug}/pedidos`); // con un restaurante → su panel
    await makeBusiness(t.db, first.data.userId);
    expect(await homePathFor(t.db, first.data.userId)).toBe("/dashboard"); // con varios → la lista
  });
});

describe("cuenta existente con contraseña (vinculación segura)", () => {
  async function conCuenta() {
    const owner = await makeUser(t.db);
    const biz = await makeBusiness(t.db, owner.id);
    return { owner, biz, google: claims({ email: owner.email }) };
  }

  it("el mismo correo NO vincula ni crea duplicado: queda un enlace pendiente y no hay sesión", async () => {
    const { owner, google } = await conCuenta();
    const r = await signInWithGoogle(t.db, google);
    expect(r.ok && r.data.kind).toBe("needs_password_link");
    expect((await t.sql`select count(*)::int as n from users where email = ${owner.email}`)[0]?.n).toBe(1);
    expect((await t.sql`select count(*)::int as n from oauth_identities where user_id = ${owner.id}`)[0]?.n).toBe(0);
    if (r.ok && r.data.kind === "needs_password_link") {
      const stored = await t.sql`select token_hash from oauth_pending_links where user_id = ${owner.id}`;
      expect(stored[0]?.token_hash).not.toBe(r.data.pendingToken); // solo se guarda el hash
    }
  });

  it("una contraseña incorrecta no vincula; la correcta sí, y conserva restaurantes y rol", async () => {
    const { owner, biz, google } = await conCuenta();
    const r = await signInWithGoogle(t.db, google);
    if (!r.ok || r.data.kind !== "needs_password_link") throw new Error("fallo");
    const token = r.data.pendingToken;
    expect((await getPendingLink(t.db, token))?.email).toBe(owner.email);
    for (const bad of ["", "incorrecta-12345", "una-clave-larga-12"]) {
      const f = await linkWithPassword(t.db, token, bad);
      expect(f.ok).toBe(false);
    }
    expect((await t.sql`select count(*)::int as n from oauth_identities where user_id = ${owner.id}`)[0]?.n).toBe(0);
    const ok = await linkWithPassword(t.db, token, "una-clave-larga-123");
    expect(ok.ok && ok.data.userId).toBe(owner.id);
    expect((await getBusinessAccess(t.db, owner.id, biz.slug))?.role).toBe("owner"); // no pierde su restaurante
    expect((await t.sql`select email_verified_at from users where id = ${owner.id}`)[0]?.email_verified_at).not.toBeNull();
    // desde ahora entra directo con Google, sin pedir contraseña
    const next = await signInWithGoogle(t.db, google);
    expect(next.ok && next.data.kind === "signed_in" && next.data.userId === owner.id).toBe(true);
    // y el correo/contraseña sigue funcionando
    expect((await authenticate(t.db, owner.email, "una-clave-larga-123"))?.id).toBe(owner.id);
  });

  it("el enlace pendiente es de UN solo uso, caduca y no sirve con otro token", async () => {
    const { google } = await conCuenta();
    const r = await signInWithGoogle(t.db, google);
    if (!r.ok || r.data.kind !== "needs_password_link") throw new Error("fallo");
    const token = r.data.pendingToken;
    expect((await linkWithPassword(t.db, token, "una-clave-larga-123")).ok).toBe(true);
    const again = await linkWithPassword(t.db, token, "una-clave-larga-123");
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.code).toBe("expired");
    expect(await getPendingLink(t.db, "x".repeat(43))).toBeNull();
    const c2 = await conCuenta();
    const r2 = await signInWithGoogle(t.db, c2.google);
    if (!r2.ok || r2.data.kind !== "needs_password_link") throw new Error("fallo");
    await t.sql`update oauth_pending_links set expires_at = now() - interval '1 minute' where user_id = ${c2.owner.id}`;
    expect((await linkWithPassword(t.db, r2.data.pendingToken, "una-clave-larga-123")).ok).toBe(false);
  });

  it("no se puede secuestrar: la contraseña de OTRA cuenta no sirve, y dos Google no se enlazan a la misma cuenta", async () => {
    const a = await conCuenta();
    const b = await conCuenta();
    const r = await signInWithGoogle(t.db, a.google);
    if (!r.ok || r.data.kind !== "needs_password_link") throw new Error("fallo");
    await t.sql`update users set password_hash = (select password_hash from users where id = ${b.owner.id}) where id = ${b.owner.id}`; // (sin cambios: ambas usan la misma clave de prueba)
    // misma clave de prueba en ambas cuentas, pero el enlace pendiente solo puede completarse sobre la cuenta A:
    expect((await linkWithPassword(t.db, r.data.pendingToken, "una-clave-larga-123")).ok).toBe(true);
    expect((await t.sql`select count(*)::int as n from oauth_identities where user_id = ${b.owner.id}`)[0]?.n).toBe(0);
    // un segundo Google distinto con el mismo correo ya no puede vincularse a una cuenta que ya tiene Google
    const second = await signInWithGoogle(t.db, claims({ email: a.owner.email }));
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("identity_conflict");
  });
});

describe("restricciones de la base de datos", () => {
  it("una cuenta solo puede tener una identidad de Google y un Google solo una cuenta", async () => {
    const u1 = await makeUser(t.db);
    const u2 = await makeUser(t.db);
    await t.sql`insert into oauth_identities (user_id, provider, subject, email) values (${u1.id}, 'google', 'sub-unico', 'a@x.test')`;
    await expect(t.sql`insert into oauth_identities (user_id, provider, subject, email) values (${u2.id}, 'google', 'sub-unico', 'b@x.test')`).rejects.toMatchObject({ code: "23505" });
    await expect(t.sql`insert into oauth_identities (user_id, provider, subject, email) values (${u1.id}, 'google', 'otro-sub', 'a@x.test')`).rejects.toMatchObject({ code: "23505" });
    await expect(t.sql`insert into oauth_identities (user_id, provider, subject, email) values (${u2.id}, 'facebook', 's', 'a@x.test')`).rejects.toMatchObject({ code: "23514" });
  });
  it("el hash de contraseña, si existe, debe tener el formato scrypt (nada de texto plano)", async () => {
    const u = await makeUser(t.db);
    await expect(t.sql`update users set password_hash = 'texto-plano' where id = ${u.id}`).rejects.toMatchObject({ code: "23514" });
    await expect(t.sql`update users set password_hash = null where id = ${u.id}`).resolves.toBeDefined();
  });
  it("RLS sigue activado en las tablas nuevas y sin políticas", async () => {
    const rows = await t.sql`select relname, relrowsecurity from pg_class where relname in ('oauth_identities','oauth_states','oauth_pending_links')`;
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});
