"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { createCategory, createProduct, deleteCategory, deleteProduct, renameCategory, setProductAvailability, updateProduct } from "@/server/domain/catalog";
import { isUuid } from "@/server/domain/result";
import { categorySchema, fieldErrorsOf, formObject, productSchema } from "@/lib/validation";
import type { FormState } from "./types";

const refresh = (slug: string) => revalidatePath(`/dashboard/${slug}/carta`);

export async function createCategoryAction(slug: string, _prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const auth = await authorize(slug, "menu.write");
  if (!auth.ok) return { message: auth.message };
  const raw = formObject(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { message: "Revisa el nombre.", fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  const r = await createCategory(getDb(), auth.ctx.business.id, parsed.data.name);
  if (!r.ok) return { message: r.message, values: raw };
  refresh(slug);
  return { ok: true, message: `Categoría «${r.data.name}» creada.` };
}

export async function renameCategoryAction(slug: string, categoryId: string, _prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const auth = await authorize(slug, "menu.write");
  if (!auth.ok) return { message: auth.message };
  if (!isUuid(categoryId)) return { message: "Categoría no válida." };
  const raw = formObject(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { message: "Revisa el nombre.", fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  const r = await renameCategory(getDb(), auth.ctx.business.id, categoryId, parsed.data.name);
  if (!r.ok) return { message: r.message, values: raw };
  refresh(slug);
  return { ok: true, message: "Nombre actualizado." };
}

export async function deleteCategoryAction(slug: string, categoryId: string): Promise<void> {
  const auth = await authorize(slug, "menu.write");
  if (!auth.ok || !isUuid(categoryId)) return;
  await deleteCategory(getDb(), auth.ctx.business.id, categoryId);
  refresh(slug);
}

/** Crea (productId = null) o edita un plato. */
export async function saveProductAction(slug: string, productId: string | null, _prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const auth = await authorize(slug, "menu.write");
  if (!auth.ok) return { message: auth.message };
  const raw = formObject(formData);
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return { message: "Revisa los campos marcados.", fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  const db = getDb();
  if (productId !== null && !isUuid(productId)) return { message: "Plato no válido." };
  const r = productId === null ? await createProduct(db, auth.ctx.business.id, parsed.data) : await updateProduct(db, auth.ctx.business.id, productId, parsed.data);
  if (!r.ok) return { message: r.message, fieldErrors: r.fieldErrors, values: raw };
  refresh(slug);
  return { ok: true, message: productId === null ? `«${r.data.name}» añadido a la carta.` : "Plato actualizado." };
}

export async function toggleAvailabilityAction(slug: string, productId: string, available: boolean): Promise<void> {
  const auth = await authorize(slug, "menu.write");
  if (!auth.ok || !isUuid(productId)) return;
  await setProductAvailability(getDb(), auth.ctx.business.id, productId, available);
  refresh(slug);
}

export async function deleteProductAction(slug: string, productId: string): Promise<void> {
  const auth = await authorize(slug, "menu.write");
  if (!auth.ok || !isUuid(productId)) return;
  await deleteProduct(getDb(), auth.ctx.business.id, productId);
  refresh(slug);
}
