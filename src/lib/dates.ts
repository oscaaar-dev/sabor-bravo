/** Fechas de negocio: Perú usa UTC−5 todo el año (sin horario de verano), así que "día" = día en hora de Lima. */
export const LIMA_OFFSET = "-05:00";

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ¿Es un día real del calendario en formato AAAA-MM-DD? (rechaza 2026-02-31) */
export function isValidDay(s: string): boolean {
  const m = DAY_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Día (AAAA-MM-DD) de un instante, en hora de Lima. */
export function limaDay(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Lima" });
}

/** Suma días a un día AAAA-MM-DD (calendario puro, sin zonas horarias). */
export function addDays(day: string, n: number): string {
  const m = DAY_RE.exec(day);
  if (!m) throw new Error("día no válido");
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
  return d.toISOString().slice(0, 10);
}

export interface DayRange {
  /** Primer día incluido (AAAA-MM-DD, Lima). */
  readonly desde: string;
  /** Último día incluido. */
  readonly hasta: string;
  /** Inicio del primer día (instante). */
  readonly from: Date;
  /** Inicio del día SIGUIENTE al último (límite exclusivo). */
  readonly to: Date;
}

export const MAX_RANGE_DAYS = 366;

/**
 * Rango de informes a partir de los parámetros de la URL. Por defecto, los últimos 30 días (hoy incluido).
 * Si algo no es válido (fecha inexistente, desde > hasta, más de un año) devuelve el rango por defecto y `corrected: true`.
 */
export function parseRange(desde: string | undefined, hasta: string | undefined, now: Date = new Date()): DayRange & { corrected: boolean } {
  const today = limaDay(now);
  const fallback = { desde: addDays(today, -29), hasta: today };
  let d = fallback.desde;
  let h = fallback.hasta;
  let corrected = false;
  if (desde || hasta) {
    if (desde && hasta && isValidDay(desde) && isValidDay(hasta) && desde <= hasta && addDays(desde, MAX_RANGE_DAYS) > hasta) {
      d = desde;
      h = hasta;
    } else corrected = true;
  }
  return { desde: d, hasta: h, from: new Date(`${d}T00:00:00${LIMA_OFFSET}`), to: new Date(`${addDays(h, 1)}T00:00:00${LIMA_OFFSET}`), corrected };
}
