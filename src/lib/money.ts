/** Importes: siempre en céntimos (enteros) de soles peruanos. Nunca se hace aritmética con decimales. */

const MAX_PRICE_CENTS = 10_000_000; // 100 000,00 (coincide con la restricción de la base de datos)

export function formatPEN(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}S/ ${whole}.${(abs % 100).toString().padStart(2, "0")}`;
}

/**
 * Convierte lo que escribe una persona ("12", "12.5", "12,50") en céntimos. Devuelve `null` si no es un importe válido
 * (letras, más de 2 decimales, negativo o fuera de rango). Sin números de coma flotante: se separa la cadena.
 */
export function parsePriceToCents(raw: string): number | null {
  const text = raw.trim().replace(/\s+/g, "").replace(",", ".");
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  return cents <= MAX_PRICE_CENTS ? cents : null;
}

/** Céntimos → texto editable ("12.50") para rellenar formularios. */
export function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${(cents % 100).toString().padStart(2, "0")}`;
}
