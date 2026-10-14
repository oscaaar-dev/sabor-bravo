import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroyAllSessions, destroySession, hashToken, resolveSession, SESSION_TTL_MS } from "@/server/auth/session";
import { hit } from "@/server/rate-limit";
import { authenticate, registerUser } from "@/server/domain/users";
import { createTestDb, makeUser, type TestDb } from "../helpers/db";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

describe("contraseñas", () => {
  it("se guardan con scrypt y sal distinta, nunca en claro", async () => {
    const h1 = await hashPassword("mi-clave-segura-2026");
    const h2 = await hashPassword("mi-clave-segura-2026");
    expect(h1).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(h1).not.toContain("mi-clave-segura-2026");
    expect(h1).not.toBe(h2);
    expect(await verifyPassword("mi-clave-segura-2026", h1)).toBe(true);
    expect(await verifyPassword("mi-clave-segura-2027", h1)).toBe(false);
    expect(await verifyPassword("", h1)).toBe(false);
  });

  it("un hash manipulado o con formato raro no verifica ni lanza", async () => {
    const h = await hashPassword("clave-larga-123");
    const parts = h.split("$");
    parts[5] = Buffer.from("otra-cosa-distinta-de-32-bytes!!!!").toString("base64");
    expect(await verifyPassword("clave-larga-123", parts.join("$"))).toBe(false);
    expect(await verifyPassword("x", "basura")).toBe(false);
    expect(await verifyPassword("x", "scrypt$1$2$3$a$b")).toBe(false);
  });
});

describe("registro y acceso", () => {
  it("registra, guarda solo el hash y permite entrar con la clave correcta", async () => {
    const email = "dueno@restaurante.pe";
    const r = await registerUser(t.db, { name: "Rosa Quispe", email, password: "clave-muy-larga-1" });
    expect(r.ok).toBe(true);
    const row = (await t.sql`select password_hash from users where email = ${email}`)[0];
    expect(row?.password_hash).toMatch(/^scrypt\$/);
    expect(row?.password_hash).not.toContain("clave-muy-larga-1");
    expect((await authenticate(t.db, email, "clave-muy-larga-1"))?.name).toBe("Rosa Quispe");
    expect(await authenticate(t.db, email, "clave-incorrecta-1")).toBeNull();
    expect(await authenticate(t.db, "nadie@restaurante.pe", "clave-muy-larga-1")).toBeNull();
  });

  it("rechaza el correo repetido con un mensaje útil", async () => {
    await registerUser(t.db, { name: "Uno", email: "repetido@x.pe", password: "clave-muy-larga-1" });
    const again = await registerUser(t.db, { name: "Dos", email: "repetido@x.pe", password: "otra-clave-larga-2" });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.fieldErrors?.email?.[0]).toMatch(/Ya existe/);
  });

  it("la base impide correos con mayúsculas (se normalizan antes de guardar)", async () => {
    await expect(t.sql`insert into users (email, name, password_hash) values ('Mayus@X.pe', 'Nombre', 'x')`).rejects.toMatchObject({ code: "23514" });
  });
});

describe("sesiones", () => {
  it("la cookie lleva un token aleatorio y la base solo guarda su SHA-256", async () => {
    const u = await makeUser(t.db);
    const { token } = await createSession(t.db, u.id);
    expect(token.length).toBeGreaterThanOrEqual(43);
    const rows = await t.sql`select token_hash from sessions where user_id = ${u.id}`;
    expect(rows[0]?.token_hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(rows[0]?.token_hash).not.toBe(token);
    expect(hashToken(token)).toBe(rows[0]?.token_hash);
    const s = await resolveSession(t.db, token);
    expect(s?.user.id).toBe(u.id);
  });

  it("rechaza tokens falsos, vacíos, caducados y cerrados", async () => {
    const u = await makeUser(t.db);
    const { token } = await createSession(t.db, u.id);
    expect(await resolveSession(t.db, undefined)).toBeNull();
    expect(await resolveSession(t.db, "")).toBeNull();
    expect(await resolveSession(t.db, "a".repeat(43))).toBeNull();
    await t.sql`update sessions set expires_at = now() - interval '1 minute' where user_id = ${u.id}`;
    expect(await resolveSession(t.db, token)).toBeNull();
    const second = await createSession(t.db, u.id);
    expect(await resolveSession(t.db, second.token)).not.toBeNull();
    await destroySession(t.db, second.token);
    expect(await resolveSession(t.db, second.token)).toBeNull();
  });

  it("renueva la ventana cuando queda menos de la mitad y cerrar todas las sesiones funciona", async () => {
    const u = await makeUser(t.db);
    const a = await createSession(t.db, u.id);
    const b = await createSession(t.db, u.id);
    expect((await resolveSession(t.db, a.token))?.renewedUntil).toBeNull();
    await t.sql`update sessions set expires_at = now() + interval '5 days' where token_hash = ${hashToken(a.token)}`;
    const renewed = await resolveSession(t.db, a.token);
    expect(renewed?.renewedUntil).not.toBeNull();
    expect(renewed!.renewedUntil!.getTime()).toBeGreaterThan(Date.now() + SESSION_TTL_MS - 60_000);
    await destroyAllSessions(t.db, u.id);
    expect(await resolveSession(t.db, a.token)).toBeNull();
    expect(await resolveSession(t.db, b.token)).toBeNull();
  });
});

describe("límite de intentos", () => {
  it("permite hasta el límite, bloquea el siguiente y se libera al acabar la ventana", async () => {
    const rule = { limit: 3, windowSec: 60 };
    const key = "prueba:ip:1.2.3.4";
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await hit(t.db, key, rule));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false, false]);
    expect(results[4]?.retryAfterSec).toBeGreaterThan(0);
    // otra clave no se ve afectada
    expect((await hit(t.db, "prueba:ip:9.9.9.9", rule)).ok).toBe(true);
    // al vencer la ventana vuelve a empezar
    await t.sql`update rate_limits set window_start = now() - interval '2 minutes'`;
    expect((await hit(t.db, key, rule)).ok).toBe(true);
  });

  it("no guarda la clave en claro (correo o IP)", async () => {
    await hit(t.db, "login:email:secreto@restaurante.pe", { limit: 5, windowSec: 60 });
    const keys = (await t.sql`select key from rate_limits`).map((r) => String(r.key));
    expect(keys.some((k) => k.includes("secreto@restaurante.pe"))).toBe(false);
    expect(keys.every((k) => /^[0-9a-f]{64}$/.test(k))).toBe(true);
  });

  it("20 intentos simultáneos cuentan exactamente 20", async () => {
    const rule = { limit: 100, windowSec: 60 };
    await Promise.all(Array.from({ length: 20 }, () => hit(t.db, "carrera:contador", rule)));
    const last = await hit(t.db, "carrera:contador", rule);
    const row = (await t.sql`select hits from rate_limits order by hits desc limit 1`)[0];
    expect(row?.hits).toBe(21);
    expect(last.ok).toBe(true);
  });
});
