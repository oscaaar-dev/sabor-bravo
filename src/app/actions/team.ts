"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { addMember, changeMemberRole, removeMember } from "@/server/domain/team";
import { hit } from "@/server/rate-limit";
import { fieldErrorsOf, formObject, memberSchema } from "@/lib/validation";
import type { FormState } from "./types";

const refresh = (slug: string) => revalidatePath(`/dashboard/${slug}/equipo`);

/** Solo el propietario (permiso team.manage). Limitado para frenar el sondeo de correos registrados. */
export async function addMemberAction(slug: string, _prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const auth = await authorize(slug, "team.manage");
  if (!auth.ok) return { message: auth.message };
  const raw = formObject(formData);
  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) return { message: "Revisa los campos marcados.", fieldErrors: fieldErrorsOf(parsed.error), values: raw };
  const db = getDb();
  const limited = await hit(db, `team:add:${auth.ctx.user.id}`, { limit: 20, windowSec: 60 * 60 });
  if (!limited.ok) return { message: "Demasiados intentos. Espera un rato e inténtalo de nuevo.", values: raw };
  const r = await addMember(db, auth.ctx.business.id, parsed.data);
  if (!r.ok) return { message: r.message, fieldErrors: r.fieldErrors, values: raw };
  refresh(slug);
  return { ok: true, message: `${r.data.name} se unió al equipo como ${r.data.role === "admin" ? "administrador" : "personal"}.` };
}

export async function changeMemberRoleAction(slug: string, userId: string, role: string): Promise<void> {
  const auth = await authorize(slug, "team.manage");
  if (!auth.ok) return;
  await changeMemberRole(getDb(), auth.ctx.business.id, userId, role);
  refresh(slug);
}

export async function removeMemberAction(slug: string, userId: string): Promise<void> {
  const auth = await authorize(slug, "team.manage");
  if (!auth.ok) return;
  await removeMember(getDb(), auth.ctx.business.id, userId);
  refresh(slug);
}
