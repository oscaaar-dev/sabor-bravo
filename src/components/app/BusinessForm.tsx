"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/types";
import { slugify } from "@/lib/validation";
import { Alert, Check, Field } from "./ui";
import { SubmitButton } from "./SubmitButton";

export interface BusinessDefaults {
  name: string;
  slug: string;
  description: string;
  phone: string;
  address: string;
  acceptsDineIn: boolean;
  acceptsPickup: boolean;
  acceptsDelivery: boolean;
  deliveryFee: string;
  isPublished: boolean;
}

const EMPTY: BusinessDefaults = {
  name: "",
  slug: "",
  description: "",
  phone: "",
  address: "",
  acceptsDineIn: true,
  acceptsPickup: true,
  acceptsDelivery: false,
  deliveryFee: "0.00",
  isPublished: true,
};

interface BusinessFormProps {
  action: (prev: FormState | undefined, formData: FormData) => Promise<FormState>;
  defaults?: BusinessDefaults;
  submitLabel: string;
  mode: "create" | "edit";
  siteUrl: string;
}

export function BusinessForm({ action, defaults = EMPTY, submitLabel, mode, siteUrl }: BusinessFormProps) {
  const [state, formAction] = useActionState(action, undefined);
  const v = state?.values;
  const [name, setName] = useState(v?.name ?? defaults.name);
  const [slug, setSlug] = useState(v?.slug ?? defaults.slug);
  // en el alta, la dirección se propone a partir del nombre hasta que la persona la edite
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const flag = (key: string, fallback: boolean) => (v ? v[key] === "on" : fallback);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state?.message ? <Alert kind={state.ok ? "ok" : "error"}>{state.message}</Alert> : null}

      <Field
        label="Nombre del restaurante"
        name="name"
        required
        maxLength={80}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
        errors={state?.fieldErrors}
      />
      <div>
        <Field
          label="Dirección web de tu carta"
          name="slug"
          required
          maxLength={60}
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
          errors={state?.fieldErrors}
          hint={`Tus clientes verán: ${siteUrl}/r/${slug || "tu-restaurante"}${mode === "edit" ? ". Si la cambias, el código QR impreso dejará de funcionar." : ""}`}
        />
      </div>
      <Field label="Descripción corta" name="description" textarea rows={2} maxLength={300} defaultValue={v?.description ?? defaults.description} errors={state?.fieldErrors} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Teléfono" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} defaultValue={v?.phone ?? defaults.phone} errors={state?.fieldErrors} />
        <Field label="Dirección del local" name="address" maxLength={160} defaultValue={v?.address ?? defaults.address} errors={state?.fieldErrors} />
      </div>

      <fieldset className="space-y-2 border-[3px] border-tinta p-4">
        <legend className="field-label px-2">¿Cómo reciben pedidos?</legend>
        <Check name="acceptsDineIn" label="En mesa" hint="El cliente indica su número de mesa." defaultChecked={flag("acceptsDineIn", defaults.acceptsDineIn)} errors={state?.fieldErrors} />
        <Check name="acceptsPickup" label="Recojo en el local" defaultChecked={flag("acceptsPickup", defaults.acceptsPickup)} />
        <Check name="acceptsDelivery" label="Delivery" hint="El cliente indica su dirección. No incluye pagos online." defaultChecked={flag("acceptsDelivery", defaults.acceptsDelivery)} />
        <Field label="Costo de delivery (S/)" name="deliveryFee" inputMode="decimal" defaultValue={v?.deliveryFee ?? defaults.deliveryFee} errors={state?.fieldErrors} hint="Se suma al total solo en pedidos de delivery." className="pt-2" />
      </fieldset>

      <Check
        name="isPublished"
        label="Carta publicada"
        hint="Si la desactivas, la carta deja de verse y de aceptar pedidos."
        defaultChecked={flag("isPublished", defaults.isPublished)}
      />

      <SubmitButton pendingText="Guardando…" className="btn-brutal btn-coral">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
