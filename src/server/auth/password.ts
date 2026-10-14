import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Contraseñas con scrypt (node:crypto, sin dependencias): sal aleatoria de 16 bytes por contraseña y costo N=2^15.
 * Formato guardado: scrypt$N$r$p$sal(base64)$hash(base64). Se puede subir el costo en el futuro: cada hash
 * lleva sus propios parámetros, así que los antiguos siguen verificándose.
 */
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 32;
const MAXMEM = 128 * N * R * 2; // margen sobre los 128·N·r bytes que necesita scrypt

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  const opts: ScryptOptions = { N: n, r, p, maxmem: Math.max(MAXMEM, 128 * n * r * 2) };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEYLEN, opts, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts as [string, string, string, string, string, string];
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  if (expected.length !== KEYLEN) return false;
  const actual = await derive(password, salt, Number(n), Number(r), Number(p));
  return timingSafeEqual(actual, expected);
}

/** Hash de relleno: se verifica contra él cuando el correo no existe, para que el tiempo de respuesta no delate cuentas. */
let dummy: Promise<string> | undefined;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword("contraseña-de-relleno-que-nadie-usa");
  return dummy;
}
