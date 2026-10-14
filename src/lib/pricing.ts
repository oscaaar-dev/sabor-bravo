/**
 * Precio efectivo de un plato: aplica la promoción vigente (porcentaje, con fecha de fin opcional).
 * El MISMO cálculo se usa para mostrar la carta y para cobrar el pedido en el servidor.
 */
export interface Priceable {
  readonly priceCents: number;
  readonly promoPercent: number | null;
  readonly promoEndsAt: Date | null;
}

export function promoActive(p: Pick<Priceable, "promoPercent" | "promoEndsAt">, now: Date = new Date()): boolean {
  return p.promoPercent !== null && p.promoPercent >= 1 && p.promoPercent <= 90 && (p.promoEndsAt === null || p.promoEndsAt.getTime() > now.getTime());
}

/** Precio a cobrar ahora (céntimos enteros, redondeado al céntimo más cercano). */
export function effectivePriceCents(p: Priceable, now: Date = new Date()): number {
  if (!promoActive(p, now)) return p.priceCents;
  return Math.round((p.priceCents * (100 - (p.promoPercent as number))) / 100);
}
