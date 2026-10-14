/**
 * Planes y precios de la página pública.
 *
 * Los importes de cada mercado son precios comerciales definidos POR SEPARADO: los dólares NO se calculan
 * a partir de los soles ni con ningún tipo de cambio. Solo presentación: no hay pasarela de pagos ni suscripciones
 * conectadas a estos valores.
 */
export type MarketId = "PE" | "INT";
export type PlanId = "inicio" | "local" | "cadena";

export interface Market {
  readonly id: MarketId;
  readonly currency: "PEN" | "USD";
  readonly symbol: string;
  readonly flag: string;
  readonly label: string;
  /** Texto para lectores de pantalla cuando cambia el mercado. */
  readonly announce: string;
}

export const MARKETS: readonly Market[] = [
  { id: "PE", currency: "PEN", symbol: "S/", flag: "🇵🇪", label: "Perú · PEN", announce: "Precios mostrados en soles peruanos (PEN)" },
  { id: "INT", currency: "USD", symbol: "US$", flag: "🌎", label: "Internacional · USD", announce: "Precios mostrados en dólares estadounidenses (USD)" },
];

/** Mercado inicial: Perú. No se detecta la ubicación del visitante (no hay un mecanismo fiable); la elige la persona. */
export const DEFAULT_MARKET: MarketId = "PE";

/** Precio mensual entero, por mercado y plan. */
export const MONTHLY_PRICE: Record<MarketId, Record<PlanId, number>> = {
  PE: { inicio: 15, local: 35, cadena: 55 },
  INT: { inicio: 4, local: 10, cadena: 16 },
};

export function isMarketId(v: unknown): v is MarketId {
  return v === "PE" || v === "INT";
}

/** «S/ 15» o «US$ 4». */
export function formatPlanPrice(market: MarketId, plan: PlanId): string {
  const m = MARKETS.find((x) => x.id === market) as Market;
  return `${m.symbol} ${MONTHLY_PRICE[market][plan]}`;
}

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  readonly para: string;
  readonly items: readonly string[];
  readonly featured: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    id: "inicio",
    name: "Inicio",
    para: "Un local que quiere pasar su carta al celular.",
    items: ["1 sucursal", "Menú con QR y URL propia", "Pedidos de mesa, recojo o delivery"],
    featured: false,
  },
  {
    id: "local",
    name: "Local",
    para: "Un negocio con equipo y movimiento diario.",
    items: ["Todo lo de Inicio", "Promociones y disponibilidad", "Informes con exportación CSV", "Equipo con roles"],
    featured: true,
  },
  {
    id: "cadena",
    name: "Cadena",
    para: "Varias sucursales bajo una misma marca.",
    items: ["Todo lo de Local", "Varias sucursales", "Permisos por sucursal"],
    featured: false,
  },
];
