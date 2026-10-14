"use client";

import Link from "next/link";
import { useActionState } from "react";
import { linkGoogleAction, loginAction, registerAction } from "@/app/actions/auth";
import { Alert, Field } from "./ui";
import { GoogleButton, OrDivider } from "./GoogleButton";
import { SubmitButton } from "./SubmitButton";

export function RegisterForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(registerAction, undefined);
  return (
    <div className="space-y-5">
      {notice ? <Alert kind="error">{notice}</Alert> : null}
      <GoogleButton />
      <OrDivider />
      <form action={action} className="space-y-5" noValidate>
        {state?.message && !state.ok ? <Alert kind="error">{state.message}</Alert> : null}
        <Field label="Tu nombre" name="name" autoComplete="name" required defaultValue={state?.values?.name} errors={state?.fieldErrors} maxLength={80} />
        <Field label="Correo" name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={state?.values?.email} errors={state?.fieldErrors} maxLength={254} />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          errors={state?.fieldErrors}
          hint="Mínimo 10 caracteres. Mejor una frase larga que una palabra con símbolos."
          maxLength={128}
        />
        <SubmitButton pendingText="Creando cuenta…" className="btn-brutal btn-coral w-full">
          Crear cuenta
        </SubmitButton>
        <p className="text-center text-sm">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-extrabold underline decoration-coral decoration-[3px] underline-offset-4">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  );
}

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <div className="space-y-5">
      {notice ? <Alert kind="error">{notice}</Alert> : null}
      <GoogleButton next={next && next !== "/dashboard" ? next : undefined} />
      <OrDivider />
      <form action={action} className="space-y-5" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        {state?.message && !state.ok ? <Alert kind="error">{state.message}</Alert> : null}
        <Field label="Correo" name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={state?.values?.email} errors={state?.fieldErrors} />
        <Field label="Contraseña" name="password" type="password" autoComplete="current-password" required errors={state?.fieldErrors} />
        <SubmitButton pendingText="Entrando…" className="btn-brutal btn-coral w-full">
          Iniciar sesión
        </SubmitButton>
        <p className="text-center text-sm">
          ¿Aún no tienes cuenta?{" "}
          <Link href="/registro" className="font-extrabold underline decoration-coral decoration-[3px] underline-offset-4">
            Regístrate gratis
          </Link>
        </p>
      </form>
    </div>
  );
}

/** Pantalla de vinculación: el correo de Google coincide con una cuenta con contraseña, que hay que confirmar. */
export function LinkGoogleForm({ email }: { email: string }) {
  const [state, action] = useActionState(linkGoogleAction, undefined);
  return (
    <form action={action} className="space-y-5" noValidate data-form="link-google">
      <p>
        Ya existe una cuenta de Sabor Bravo con <strong>{email}</strong>. Para vincularla con tu cuenta de Google y no duplicarla, confirma que es tuya escribiendo su contraseña.
      </p>
      {state?.message ? <Alert kind="error">{state.message}</Alert> : null}
      <Field label="Contraseña de tu cuenta" name="password" type="password" autoComplete="current-password" required errors={state?.fieldErrors} />
      <SubmitButton pendingText="Vinculando…" className="btn-brutal btn-coral w-full">
        Vincular con Google
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login" className="font-extrabold underline decoration-coral decoration-[3px] underline-offset-4">
          Cancelar y volver
        </Link>
      </p>
    </form>
  );
}
