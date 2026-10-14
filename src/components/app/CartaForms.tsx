"use client";

import { useActionState, useState } from "react";
import { createCategoryAction, renameCategoryAction, saveProductAction } from "@/app/actions/catalog";
import { Alert, Check, Field, Select } from "./ui";
import { SubmitButton } from "./SubmitButton";

export function CategoryCreateForm({ slug }: { slug: string }) {
  const p = "cat-new-";
  const [state, action] = useActionState(createCategoryAction.bind(null, slug), undefined);
  return (
    <form action={action} className="space-y-3" noValidate>
      <div className="flex flex-wrap items-end gap-3">
        <Field idPrefix={p} label="Nueva categoría" name="name" required maxLength={60} placeholder="Ej. Entradas, Platos de fondo, Bebidas" defaultValue={state?.ok ? "" : state?.values?.name} errors={state?.fieldErrors} className="min-w-[14rem] flex-1" />
        <SubmitButton pendingText="Creando…" className="btn-brutal btn-coral">
          Crear categoría
        </SubmitButton>
      </div>
      {state?.message ? <Alert kind={state.ok ? "ok" : "error"}>{state.message}</Alert> : null}
    </form>
  );
}

export function CategoryRenameForm({ slug, categoryId, name }: { slug: string; categoryId: string; name: string }) {
  const p = `cat-${categoryId}-`;
  const [state, action] = useActionState(renameCategoryAction.bind(null, slug, categoryId), undefined);
  return (
    <form action={action} className="space-y-2" noValidate>
      <div className="flex flex-wrap items-end gap-3">
        <Field idPrefix={p} label="Nombre de la categoría" name="name" required maxLength={60} defaultValue={state?.values?.name ?? name} errors={state?.fieldErrors} className="min-w-[12rem] flex-1" />
        <SubmitButton pendingText="Guardando…" className="btn-brutal btn-petroleo btn-sm">
          Guardar nombre
        </SubmitButton>
      </div>
      {state?.message ? <Alert kind={state.ok ? "ok" : "error"}>{state.message}</Alert> : null}
    </form>
  );
}

export interface ProductDefaults {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  isAvailable: boolean;
  isPublished: boolean;
  promoPercent: string;
  promoEndsAt: string;
}

interface ProductFormProps {
  slug: string;
  categories: Array<{ id: string; name: string }>;
  product?: ProductDefaults;
  defaultCategoryId?: string;
}

export function ProductForm({ slug, categories, product, defaultCategoryId }: ProductFormProps) {
  const [state, action] = useActionState(saveProductAction.bind(null, slug, product?.id ?? null), undefined);
  const v = state?.values;
  const p = `prod-${product?.id ?? `new-${defaultCategoryId ?? "x"}`}-`;
  const clear = state?.ok && !product; // tras crear un plato, el formulario queda vacío
  const flag = (key: string, fallback: boolean) => (v ? v[key] === "on" : fallback);
  const val = (key: string, fallback: string) => (clear ? "" : (v?.[key] ?? fallback));
  return (
    <form action={action} className="space-y-4" noValidate data-form={product ? "product-edit" : "product-new"}>
      {state?.message ? <Alert kind={state.ok ? "ok" : "error"}>{state.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field idPrefix={p} label="Nombre del plato" name="name" required maxLength={100} defaultValue={val("name", product?.name ?? "")} errors={state?.fieldErrors} />
        <Field idPrefix={p} label="Precio (S/)" name="price" required inputMode="decimal" placeholder="25.90" defaultValue={val("price", product?.price ?? "")} errors={state?.fieldErrors} />
      </div>
      <Select
        idPrefix={p}
        label="Categoría"
        name="categoryId"
        required
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        defaultValue={v?.categoryId ?? product?.categoryId ?? defaultCategoryId ?? categories[0]?.id}
        errors={state?.fieldErrors}
      />
      <Field idPrefix={p} label="Descripción" name="description" textarea rows={2} maxLength={400} defaultValue={val("description", product?.description ?? "")} errors={state?.fieldErrors} />
      <fieldset className="grid gap-4 border-[3px] border-tinta p-4 sm:grid-cols-2">
        <legend className="field-label px-2">Promoción (opcional)</legend>
        <Field idPrefix={p} label="Descuento (%)" name="promoPercent" inputMode="numeric" placeholder="20" maxLength={2} defaultValue={val("promoPercent", product?.promoPercent ?? "")} errors={state?.fieldErrors} hint="Entre 1 y 90. Vacío = sin promoción." />
        <Field idPrefix={p} label="Vale hasta (fecha)" name="promoEndsAt" type="date" defaultValue={val("promoEndsAt", product?.promoEndsAt ?? "")} errors={state?.fieldErrors} hint="Opcional. Hasta el final de ese día (hora de Lima)." />
      </fieldset>
      <Field
        idPrefix={p}
        label="Imagen (dirección https://…)"
        name="imageUrl"
        type="url"
        inputMode="url"
        maxLength={500}
        placeholder="https://…/foto.jpg"
        defaultValue={val("imageUrl", product?.imageUrl ?? "")}
        errors={state?.fieldErrors}
        hint="Opcional. Pega la dirección de una imagen ya subida a internet; la subida de archivos aún no está disponible."
      />
      <div className="flex flex-wrap gap-x-8 gap-y-1">
        <Check name="isAvailable" label="Disponible" hint="Desmárcalo cuando se agote." defaultChecked={flag("isAvailable", product?.isAvailable ?? true)} />
        <Check name="isPublished" label="Visible en la carta" hint="Desmárcalo para ocultarlo sin borrarlo." defaultChecked={flag("isPublished", product?.isPublished ?? true)} />
      </div>
      <SubmitButton pendingText="Guardando…" className="btn-brutal btn-coral">
        {product ? "Guardar cambios" : "Añadir plato"}
      </SubmitButton>
    </form>
  );
}

/** Eliminar con confirmación en dos pasos (sin ventanas emergentes del navegador). `action` es una acción de servidor ya enlazada. */
export function DeleteButton({ action, label, question }: { action: () => Promise<void>; label: string; question: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-brutal btn-blanco btn-sm">
        {label}
      </button>
    );
  }
  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <span className="text-sm font-bold">{question}</span>
      <SubmitButton pendingText="Eliminando…" className="btn-brutal btn-petroleo btn-sm">
        Sí, eliminar
      </SubmitButton>
      <button type="button" onClick={() => setConfirming(false)} className="btn-brutal btn-blanco btn-sm">
        No
      </button>
    </form>
  );
}

/**
 * Panel desplegable que conserva su estado: se abre al principio solo si `initiallyOpen`, y NO se cierra solo cuando el
 * servidor vuelve a pintar la página (así se pueden añadir varios platos seguidos y se ve el mensaje de éxito).
 */
export function Collapsible({ summary, initiallyOpen = false, className = "", children }: { summary: React.ReactNode; initiallyOpen?: boolean; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className={className}>
      <summary className="cursor-pointer text-lg font-extrabold">{summary}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
