import { describe, expect, it } from "vitest";
import { DEFAULT_MARKET, formatPlanPrice, isMarketId, MARKETS, MONTHLY_PRICE, PLANS } from "@/content/plans";

describe("planes y precios de la página", () => {
  it.each([
    ["PE", "inicio", "S/ 15"], ["PE", "local", "S/ 35"], ["PE", "cadena", "S/ 55"],
    ["INT", "inicio", "US$ 4"], ["INT", "local", "US$ 10"], ["INT", "cadena", "US$ 16"],
  ] as const)("%s · %s → %s", (market, plan, text) => expect(formatPlanPrice(market, plan)).toBe(text));

  it("los dólares son precios propios, no un cambio de los soles (no hay una razón fija entre mercados)", () => {
    const ratios = PLANS.map((p) => MONTHLY_PRICE.PE[p.id] / MONTHLY_PRICE.INT[p.id]);
    expect(new Set(ratios.map((r) => r.toFixed(3))).size).toBeGreaterThan(1);
  });

  it("cada plan tiene precio en cada mercado y los importes son enteros positivos", () => {
    for (const m of MARKETS) for (const p of PLANS) expect(Number.isInteger(MONTHLY_PRICE[m.id][p.id]) && MONTHLY_PRICE[m.id][p.id] > 0).toBe(true);
  });

  it("conserva los tres planes y sus características sin añadir nada nuevo", () => {
    expect(PLANS.map((p) => p.name)).toEqual(["Inicio", "Local", "Cadena"]);
    expect(PLANS[0]!.items).toEqual(["1 sucursal", "Menú con QR y URL propia", "Pedidos de mesa, recojo o delivery"]);
    expect(PLANS[1]!.items).toEqual(["Todo lo de Inicio", "Promociones y disponibilidad", "Informes con exportación CSV", "Equipo con roles"]);
    expect(PLANS[2]!.items).toEqual(["Todo lo de Local", "Varias sucursales", "Permisos por sucursal"]);
  });

  it("el mercado inicial es Perú y solo se aceptan mercados conocidos (valor guardado manipulado → se ignora)", () => {
    expect(DEFAULT_MARKET).toBe("PE");
    expect(isMarketId("INT")).toBe(true);
    expect(isMarketId("EUR")).toBe(false);
    expect(isMarketId(null)).toBe(false);
  });
});
