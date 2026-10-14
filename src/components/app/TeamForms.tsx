"use client";

import { useActionState } from "react";
import { addMemberAction } from "@/app/actions/team";
import { Alert, Field, Select } from "./ui";
import { SubmitButton } from "./SubmitButton";

export function AddMemberForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(addMemberAction.bind(null, slug), undefined);
  return (
    <form action={action} className="space-y-4" noValidate data-form="member-new">
      {state?.message ? <Alert kind={state.ok ? "ok" : "error"}>{state.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
        <Field idPrefix="team-" label="Correo de la persona" name="email" type="email" inputMode="email" required defaultValue={state?.ok ? "" : state?.values?.email} errors={state?.fieldErrors} hint="Debe haberse registrado antes en Sabor Bravo con ese correo." />
        <Select
          idPrefix="team-"
          label="Rol"
          name="role"
          required
          defaultValue={state?.values?.role ?? "staff"}
          errors={state?.fieldErrors}
          options={[
            { value: "staff", label: "Personal (solo pedidos)" },
            { value: "admin", label: "Administrador" },
          ]}
        />
      </div>
      <SubmitButton pendingText="Añadiendo…" className="btn-brutal btn-coral">
        Añadir al equipo
      </SubmitButton>
    </form>
  );
}
