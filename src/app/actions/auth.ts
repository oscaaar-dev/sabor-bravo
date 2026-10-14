"use server";

import { redirect } from "next/navigation";
import { clientIp, endSession, startSession } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { authenticate, registerUser } from "@/server/domain/users";
import { hit, LIMITS, waitMessage } from "@/server/rate-limit";
import { safeNext } from "@/lib/safe-next";
import { fieldErrorsOf, formObject, loginSchema, registerSchema } from "@/lib/validation";
import { safeValues, type FormState } from "./types";

export async function registerAction(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const raw = formObject(formData);
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { message: "Revisa los campos marcados.", fieldErrors: fieldErrorsOf(parsed.error), values: safeValues(raw) };

  const db = getDb();
  const limited = await hit(db, `register:ip:${await clientIp()}`, LIMITS.registerPerIp);
  if (!limited.ok) return { message: waitMessage(limited.retryAfterSec), values: safeValues(raw) };

  const result = await registerUser(db, parsed.data);
  if (!result.ok) return { message: result.message, fieldErrors: result.fieldErrors, values: safeValues(raw) };

  await endSession(); // si ya había una sesión abierta en este navegador, se cierra: nunca se reutiliza una sesión anterior
  await startSession(result.data.id);
  redirect("/dashboard/nuevo");
}

export async function loginAction(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  const raw = formObject(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { message: "Revisa los campos marcados.", fieldErrors: fieldErrorsOf(parsed.error), values: safeValues(raw) };

  const db = getDb();
  const ip = await clientIp();
  const [byEmail, byIp] = await Promise.all([
    hit(db, `login:email:${parsed.data.email}`, LIMITS.loginPerEmail),
    hit(db, `login:ip:${ip}`, LIMITS.loginPerIp),
  ]);
  if (!byEmail.ok || !byIp.ok) return { message: waitMessage(Math.max(byEmail.retryAfterSec, byIp.retryAfterSec)), values: safeValues(raw) };

  const user = await authenticate(db, parsed.data.email, parsed.data.password);
  // mismo mensaje exista o no el correo: no se revela qué cuentas existen
  if (!user) return { message: "Correo o contraseña incorrectos.", values: safeValues(raw) };

  await endSession(); // evita arrastrar la sesión anterior (fijación de sesión): siempre se emite un token nuevo
  await startSession(user.id);
  redirect(safeNext(raw.next));
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/");
}
