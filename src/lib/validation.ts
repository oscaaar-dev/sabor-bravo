import { z } from "zod";
import { parsePriceToCents } from "@/lib/money";
import { ORDER_TYPES } from "@/lib/order-status";
import { ROLES } from "@/lib/permissions";

/**
 * Validación de TODAS las entradas. Se ejecuta en el servidor (acciones y rutas); el navegador solo la usa para
 * avisar antes. Nunca se confía en importes, totales ni disponibilidad que envía el cliente.
 */

export type FieldErrors = Record<string, string[]>;

/** Convierte un FormData en un objeto de texto (ignora archivos y claves no esperadas por el esquema). */
export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v));

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "true");

const priceField = (label: string) =>
  z.string().transform((v, ctx) => {
    const cents = parsePriceToCents(v);
    if (cents === null) {
      ctx.issues.push({ code: "custom", message: `${label}: escribe un importe válido, por ejemplo 12.50`, input: v });
      return z.NEVER;
    }
    return cents;
  });

/** Nombres reservados: chocarían con rutas de la aplicación. */
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "dashboard", "login", "logout", "registro", "r", "static", "public", "www", "soporte", "ayuda", "nuevo", "demo",
]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "La dirección debe tener al menos 3 caracteres")
  .max(60, "La dirección admite hasta 60 caracteres")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Usa solo letras minúsculas, números y guiones (sin espacios ni tildes)")
  .refine((v) => !RESERVED_SLUGS.has(v), "Esa dirección está reservada, elige otra");

/** Propone una dirección a partir del nombre ("La Mar Cevichería" → "la-mar-cevicheria"). */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ───────────── Cuenta ─────────────
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "El correo es demasiado largo")
  .pipe(z.email("Escribe un correo válido"));

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Escribe tu nombre (mínimo 2 caracteres)").max(80, "Máximo 80 caracteres"),
    email: emailSchema,
    password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres").max(128, "Máximo 128 caracteres"),
  })
  .refine((v) => v.password.toLowerCase() !== v.email, { path: ["password"], message: "La contraseña no puede ser tu correo" });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escribe tu contraseña").max(128),
});

// ───────────── Restaurante ─────────────
export const businessSchema = z
  .object({
    name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(80, "Máximo 80 caracteres"),
    slug: slugSchema,
    description: optionalText(300, "Descripción"),
    phone: optionalText(30, "Teléfono"),
    address: optionalText(160, "Dirección"),
    acceptsDineIn: checkbox,
    acceptsPickup: checkbox,
    acceptsDelivery: checkbox,
    deliveryFee: priceField("Costo de delivery").optional(),
    isPublished: checkbox,
  })
  .refine((v) => v.acceptsDineIn || v.acceptsPickup || v.acceptsDelivery, {
    path: ["acceptsDineIn"],
    message: "Activa al menos una modalidad de pedido (mesa, recojo o delivery)",
  });
export type BusinessInput = z.output<typeof businessSchema>;

// ───────────── Carta ─────────────
export const categorySchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre de la categoría").max(60, "Máximo 60 caracteres"),
});

/** Solo https:// (o una ruta propia /...): nunca http, javascript:, data: ni nada ejecutable. */
const imageUrl = z
  .string()
  .trim()
  .max(500, "La dirección de la imagen es demasiado larga")
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : v))
  .refine((v) => v === null || /^https:\/\/[^\s"'<>]+$/.test(v) || /^\/[^\s/"'<>][^\s"'<>]*$/.test(v), {
    message: "Usa una dirección de imagen que empiece por https://",
  });

/** Descuento entero de 1 a 90 (vacío o 0 = sin promoción). */
const promoPercent = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const t = (v ?? "").trim();
    if (t === "" || t === "0") return null;
    const n = Number(t);
    if (!/^\d{1,2}$/.test(t) || n < 1 || n > 90) {
      ctx.issues.push({ code: "custom", message: "Descuento: un número entero entre 1 y 90", input: v });
      return z.NEVER;
    }
    return n;
  });

/** Fecha de fin (AAAA-MM-DD): la promoción vale hasta el final de ese día, hora de Lima (UTC−5, sin horario de verano). */
const promoEndsAt = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const t = (v ?? "").trim();
    if (t === "") return null;
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    // calendario estricto: Date "corrige" 2026-02-31 a marzo, así que se comprueba que el día exista de verdad
    const real = parts ? new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))) : null;
    const valid = parts && real && real.getUTCFullYear() === Number(parts[1]) && real.getUTCMonth() === Number(parts[2]) - 1 && real.getUTCDate() === Number(parts[3]);
    const d = valid ? new Date(`${t}T23:59:59-05:00`) : null;
    if (!d || Number.isNaN(d.getTime())) {
      ctx.issues.push({ code: "custom", message: "Fecha no válida", input: v });
      return z.NEVER;
    }
    return d;
  });

export const productSchema = z
  .object({
    categoryId: z.uuid("Elige una categoría"),
    name: z.string().trim().min(1, "Escribe el nombre del plato").max(100, "Máximo 100 caracteres"),
    description: optionalText(400, "Descripción"),
    price: priceField("Precio"),
    imageUrl,
    isAvailable: checkbox,
    isPublished: checkbox,
    promoPercent,
    promoEndsAt,
  })
  .superRefine((v, ctx) => {
    if (v.promoEndsAt && v.promoPercent === null) ctx.addIssue({ code: "custom", path: ["promoPercent"], message: "Indica el porcentaje de descuento o borra la fecha" });
  });
export type ProductInput = z.output<typeof productSchema>;

// ───────────── Pedido (JSON desde el carrito) ─────────────
const phone = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{5,30}$/, "Escribe un teléfono válido (solo números, espacios, + o guiones)");

export const placeOrderSchema = z
  .object({
    type: z.enum(ORDER_TYPES, { error: "Elige cómo quieres recibir tu pedido" }),
    tableLabel: optionalText(20, "Mesa"),
    customerName: z.string().trim().min(2, "Escribe tu nombre").max(80, "Máximo 80 caracteres"),
    customerPhone: phone,
    deliveryAddress: optionalText(200, "Dirección de entrega"),
    notes: optionalText(300, "Notas"),
    items: z
      .array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(99) }))
      .min(1, "Tu carrito está vacío")
      .max(50, "Máximo 50 productos distintos por pedido"),
    idempotencyKey: z.uuid(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "dine_in" && !v.tableLabel) ctx.addIssue({ code: "custom", path: ["tableLabel"], message: "Indica tu número de mesa" });
    if (v.type === "delivery" && (!v.deliveryAddress || v.deliveryAddress.length < 5))
      ctx.addIssue({ code: "custom", path: ["deliveryAddress"], message: "Escribe la dirección de entrega (mínimo 5 caracteres)" });
  });
export type PlaceOrderInput = z.output<typeof placeOrderSchema>;

// ───────────── Equipo ─────────────
export const memberSchema = z.object({
  email: emailSchema,
  role: z.enum(ROLES.filter((r) => r !== "owner") as ["admin", "staff"], { error: "Elige un rol" }),
});
