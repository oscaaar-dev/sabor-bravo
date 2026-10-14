import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { centsToInput, formatPEN, parsePriceToCents } from "@/lib/money";
import { canTransition, ORDER_STATUSES, TRANSITIONS, type OrderStatus } from "@/lib/order-status";
import { businessSchema, categorySchema, loginSchema, memberSchema, placeOrderSchema, productSchema, registerSchema, slugify, slugSchema } from "@/lib/validation";

describe("importes", () => {
  it.each([
    ["12", 1200], ["12.5", 1250], ["12,50", 1250], ["0", 0], ["0.05", 5], [" 7 ", 700], ["100000", 10_000_000], ["99999.99", 9_999_999],
  ])("acepta %s → %i céntimos", (txt, cents) => expect(parsePriceToCents(txt)).toBe(cents));

  it.each([["abc"], [""], ["-1"], ["1.234"], ["1e3"], ["100000.01"], ["12.5.5"], ["∞"], ["1 2 3 4 5 6 7 8"]])("rechaza %j", (txt) => expect(parsePriceToCents(txt)).toBeNull());

  it("formatea y recorre sin errores de redondeo", () => {
    expect(formatPEN(1250)).toBe("S/ 12.50");
    expect(formatPEN(5)).toBe("S/ 0.05");
    expect(formatPEN(123456789)).toBe("S/ 1 234 567.89");
    expect(centsToInput(1250)).toBe("12.50");
    for (const c of [0, 1, 99, 100, 1999, 10_000_000]) expect(parsePriceToCents(centsToInput(c))).toBe(c);
  });
});

describe("estados del pedido", () => {
  it("la matriz de transiciones coincide con el flujo previsto", () => {
    expect(TRANSITIONS.pending).toEqual(["confirmed", "cancelled"]);
    expect(TRANSITIONS.completed).toEqual([]);
    expect(TRANSITIONS.cancelled).toEqual([]);
    const valid = new Set<string>();
    for (const from of ORDER_STATUSES) for (const to of TRANSITIONS[from]) valid.add(`${from}>${to}`);
    for (const from of ORDER_STATUSES) for (const to of ORDER_STATUSES) expect(canTransition(from as OrderStatus, to as OrderStatus)).toBe(valid.has(`${from}>${to}`));
    // ningún estado puede volver atrás ni quedarse igual
    for (const s of ORDER_STATUSES) expect(canTransition(s, s)).toBe(false);
    expect(canTransition("ready", "pending")).toBe(false);
  });
});

describe("direcciones (slug)", () => {
  it("normaliza nombres con tildes y símbolos", () => {
    expect(slugify("La Mar Cevichería")).toBe("la-mar-cevicheria");
    expect(slugify("  ¡Pollería  El Gallo & Cía.! ")).toBe("polleria-el-gallo-cia");
  });
  it.each([["mi-local"], ["la-mar-2"], ["abc"], ["  Mi-Local  "]])("acepta %j", (s) => expect(slugSchema.safeParse(s).success).toBe(true));
  it.each([["ab"], ["con espacios"], ["tilde-ñ"], ["-empieza"], ["termina-"], ["dos--guiones"], ["a".repeat(61)], ["admin"], ["dashboard"], ["api"], ["login"]])("rechaza %j", (s) =>
    expect(slugSchema.safeParse(s).success).toBe(false),
  );
});

describe("cuenta", () => {
  it("exige contraseña de 10+ caracteres y distinta del correo", () => {
    const ok = registerSchema.safeParse({ name: "Ana", email: "ANA@Correo.PE ", password: "una-clave-larga" });
    expect(ok.success && ok.data.email).toBe("ana@correo.pe");
    expect(registerSchema.safeParse({ name: "Ana", email: "ana@correo.pe", password: "corta" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "A", email: "ana@correo.pe", password: "una-clave-larga" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Ana", email: "no-es-correo", password: "una-clave-larga" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Ana", email: "ana@correo.pe", password: "ana@correo.pe" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "x@y.pe", password: "" }).success).toBe(false);
  });
});

describe("restaurante y carta", () => {
  const base = { name: "La Mar", slug: "la-mar", acceptsDineIn: "on", deliveryFee: "5" };
  it("necesita al menos una modalidad y convierte la tarifa a céntimos", () => {
    const r = businessSchema.safeParse({ ...base, acceptsDelivery: "on" });
    expect(r.success && r.data.deliveryFee).toBe(500);
    expect(businessSchema.safeParse({ name: "La Mar", slug: "la-mar" }).success).toBe(false);
    expect(businessSchema.safeParse({ ...base, deliveryFee: "cinco" }).success).toBe(false);
  });

  it("el plato exige precio válido y solo imágenes https o rutas propias", () => {
    const cat = randomUUID();
    const make = (over: Record<string, string>) => productSchema.safeParse({ categoryId: cat, name: "Lomo", price: "25.90", ...over });
    expect(make({}).success).toBe(true);
    expect(make({ imageUrl: "https://cdn.ejemplo.com/lomo.jpg" }).success).toBe(true);
    expect(make({ imageUrl: "/images/dishes/lomo-saltado.png" }).success).toBe(true);
    for (const bad of ["http://inseguro.com/a.jpg", "javascript:alert(1)", "data:text/html,<script>", "//evil.com/x.png", "https://x.com/a b.png", "https://x.com/\"onerror=1"]) {
      expect(make({ imageUrl: bad }).success).toBe(false);
    }
    expect(make({ price: "gratis" }).success).toBe(false);
    expect(make({ price: "-3" }).success).toBe(false);
    expect(make({ name: "   " }).success).toBe(false);
    expect(productSchema.safeParse({ categoryId: "no-uuid", name: "Lomo", price: "1" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("el equipo no admite el rol propietario", () => {
    expect(memberSchema.safeParse({ email: "a@b.pe", role: "admin" }).success).toBe(true);
    expect(memberSchema.safeParse({ email: "a@b.pe", role: "owner" }).success).toBe(false);
  });
});

describe("pedido del cliente", () => {
  const item = { productId: randomUUID(), quantity: 2 };
  const base = { type: "pickup", customerName: "Ana Pérez", customerPhone: "999 888 777", items: [item], idempotencyKey: randomUUID() };

  it("acepta un recojo válido y normaliza vacíos a null", () => {
    const r = placeOrderSchema.safeParse({ ...base, notes: "   ", tableLabel: "" });
    expect(r.success && r.data.notes).toBeNull();
  });
  it("exige mesa en pedidos en mesa y dirección en delivery", () => {
    expect(placeOrderSchema.safeParse({ ...base, type: "dine_in" }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, type: "dine_in", tableLabel: "12" }).success).toBe(true);
    expect(placeOrderSchema.safeParse({ ...base, type: "delivery" }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, type: "delivery", deliveryAddress: "Av. Arequipa 1234" }).success).toBe(true);
  });
  it("rechaza carritos vacíos, cantidades fuera de rango, ids falsos y teléfonos raros", () => {
    expect(placeOrderSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, items: [{ productId: item.productId, quantity: 0 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, items: [{ productId: item.productId, quantity: 100 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, items: [{ productId: item.productId, quantity: 1.5 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, items: [{ productId: "no-uuid", quantity: 1 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, customerPhone: "<script>" }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, items: Array.from({ length: 51 }, () => ({ productId: randomUUID(), quantity: 1 })) }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...base, idempotencyKey: "123" }).success).toBe(false);
  });
});
