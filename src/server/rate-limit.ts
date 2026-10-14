import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Db } from "@/server/db";

export interface RateLimit {
  /** Máximo de intentos dentro de la ventana. */
  readonly limit: number;
  /** Duración de la ventana en segundos. */
  readonly windowSec: number;
}

export interface RateResult {
  readonly ok: boolean;
  /** Segundos que faltan para que se libere (0 si ok). */
  readonly retryAfterSec: number;
}

/**
 * Límite de intentos con ventana fija, atómico en la base de datos (funciona igual con varias instancias serverless).
 * Cada llamada cuenta como un intento. La clave se guarda con hash para no almacenar correos ni IP en claro.
 */
export async function hit(db: Db, rawKey: string, { limit, windowSec }: RateLimit): Promise<RateResult> {
  const key = createHash("sha256").update(rawKey).digest("hex");
  const rows = await db.execute<{ hits: number; elapsed: number }>(sql`
    insert into rate_limits as r (key, window_start, hits) values (${key}, now(), 1)
    on conflict (key) do update set
      window_start = case when r.window_start < now() - make_interval(secs => ${windowSec}) then now() else r.window_start end,
      hits = case when r.window_start < now() - make_interval(secs => ${windowSec}) then 1 else r.hits + 1 end
    returning hits, extract(epoch from (now() - window_start))::int as elapsed
  `);
  const row = rows[0];
  if (!row) return { ok: true, retryAfterSec: 0 };
  if (Math.random() < 0.01) await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
  const ok = row.hits <= limit;
  return { ok, retryAfterSec: ok ? 0 : Math.max(1, windowSec - row.elapsed) };
}

export function waitMessage(retryAfterSec: number): string {
  const minutes = Math.ceil(retryAfterSec / 60);
  return minutes <= 1 ? "Demasiados intentos. Espera un minuto e inténtalo de nuevo." : `Demasiados intentos. Espera ${minutes} minutos e inténtalo de nuevo.`;
}

/** Límites de la aplicación (un solo sitio para ajustarlos). */
export const LIMITS = {
  loginPerEmail: { limit: 8, windowSec: 15 * 60 },
  loginPerIp: { limit: 30, windowSec: 15 * 60 },
  registerPerIp: { limit: 6, windowSec: 60 * 60 },
  orderPerIp: { limit: 12, windowSec: 10 * 60 },
} as const satisfies Record<string, RateLimit>;
