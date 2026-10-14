"use server";

import { redirect } from "next/navigation";
import { authorize, requireUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { createBusiness, updateBusiness } from "@/server/domain/businesses";
import { businessSchema, fieldErrorsOf, formObject } from "@/lib/validation";
import type { FormState } from "./types";

export async function createBusinessAction(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const user = await requireUser("/dashboard/nuevo");
  const raw = formObject(formData);
  const parsed = businessSchema.safeParse(raw);
  if (!parsed.success) return { message: "Revisa los campos marcados.", fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  const result = await createBusiness(getDb(), user.id, parsed.data);
  if (!result.ok) return { message: result.message, fieldErrors: result.fieldErrors, values: raw };
  redirect(`/dashboard/${result.data.slug}/carta`);
}

export async function updateBusinessAction(slug: string, _prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const auth = await authorize(slug, "settings.write");
  if (!auth.ok) return { message: auth.message };
  const raw = formObject(formData);
  const parsed = businessSchema.safeParse(raw);
  if (!parsed.success) return { message: "Revisa los campos marcados.", fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  const result = await updateBusiness(getDb(), auth.ctx.business.id, parsed.data);
  if (!result.ok) return { message: result.message, fieldErrors: result.fieldErrors, values: raw };
  if (result.data.slug !== slug) redirect(`/dashboard/${result.data.slug}/ajustes?guardado=1`);
  return { ok: true, message: "Cambios guardados.", values: raw };
}
