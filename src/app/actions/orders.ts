"use server";

import { revalidatePath } from "next/cache";
import { authorize, clientIp } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { changeOrderStatus, placeOrder } from "@/server/domain/orders";
import { hit, LIMITS, waitMessage } from "@/server/rate-limit";
import { isOrderStatus } from "@/lib/order-status";
import { fieldErrorsOf, placeOrderSchema, type FieldErrors } from "@/lib/validation";

export type PlaceOrderResponse =
  | { readonly ok: true; readonly number: number; readonly token: string; readonly totalCents: number }
  | { readonly ok: false; readonly message: string; readonly fieldErrors?: FieldErrors; readonly unavailableIds?: string[] };

/**
 * Pedido de un CLIENTE (sin cuenta). El navegador envía solo qué productos y cuántas unidades; el servidor valida todo,
 * lee los precios de la base de datos y calcula los importes. Limitado por IP para frenar abusos.
 */
export async function placeOrderAction(slug: string, payload: unknown): Promise<PlaceOrderResponse> {
  if (typeof slug !== "string" || slug.length > 60) return { ok: false, message: "Restaurante no válido." };
  const parsed = placeOrderSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    const first = Object.values(fieldErrors)[0]?.[0];
    return { ok: false, message: first ?? "Revisa los datos del pedido.", fieldErrors };
  }
  const db = getDb();
  const limited = await hit(db, `order:ip:${await clientIp()}:${slug}`, LIMITS.orderPerIp);
  if (!limited.ok) return { ok: false, message: waitMessage(limited.retryAfterSec) };

  const result = await placeOrder(db, slug, parsed.data);
  if (!result.ok) return { ok: false, message: result.message, unavailableIds: (result.details?.unavailableIds as string[] | undefined) };
  revalidatePath(`/dashboard/${slug}/pedidos`);
  return { ok: true, number: result.data.number, token: result.data.token, totalCents: result.data.totalCents };
}

/** Cambio de estado desde el panel: autenticado, autorizado por rol y limitado a transiciones válidas. */
export async function changeOrderStatusAction(slug: string, orderId: string, to: string): Promise<{ ok: boolean; message?: string }> {
  const auth = await authorize(slug, "orders.update");
  if (!auth.ok) return { ok: false, message: auth.message };
  if (!isOrderStatus(to)) return { ok: false, message: "Estado no válido." };
  const result = await changeOrderStatus(getDb(), { businessId: auth.ctx.business.id, orderId, to, actorUserId: auth.ctx.user.id });
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/dashboard/${slug}/pedidos`);
  return { ok: true };
}
