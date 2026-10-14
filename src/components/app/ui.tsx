import Image from "next/image";
import Link from "next/link";
import type { FieldErrors } from "@/lib/validation";

interface FieldProps {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  errors?: FieldErrors;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url";
  rows?: number;
  textarea?: boolean;
  disabled?: boolean;
  className?: string;
  /** Prefijo del id del campo: necesario cuando hay varios formularios en la misma página. */
  idPrefix?: string;
  /** Para campos controlados (solo desde componentes de cliente). */
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
}

/** Campo de formulario accesible: etiqueta visible, ayuda y errores enlazados (aria-describedby / aria-invalid). */
export function Field({ label, name, type = "text", defaultValue, errors, hint, required, autoComplete, maxLength, placeholder, inputMode, rows, textarea, disabled, className = "", idPrefix = "", value, onChange }: FieldProps) {
  const errs = errors?.[name];
  const id = `${idPrefix}${name}`;
  const describedBy = [hint ? `${id}-hint` : null, errs?.length ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name,
    required,
    disabled,
    autoComplete,
    maxLength,
    placeholder,
    inputMode,
    ...(value !== undefined ? { value, onChange } : { defaultValue: defaultValue ?? undefined }),
    "aria-invalid": errs?.length ? (true as const) : undefined,
    "aria-describedby": describedBy,
    className: "input",
  };
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {textarea ? <textarea {...common} rows={rows ?? 3} /> : <input {...common} type={type} />}
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-tinta-suave">
          {hint}
        </p>
      ) : null}
      {errs?.length ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {errs[0]}
        </p>
      ) : null}
    </div>
  );
}

interface SelectProps {
  label: string;
  name: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  defaultValue?: string;
  errors?: FieldErrors;
  required?: boolean;
  className?: string;
  idPrefix?: string;
}

export function Select({ label, name, options, defaultValue, errors, required, className = "", idPrefix = "" }: SelectProps) {
  const errs = errors?.[name];
  const id = `${idPrefix}${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} required={required} className="input" aria-invalid={errs?.length ? true : undefined} aria-describedby={errs?.length ? `${id}-error` : undefined}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errs?.length ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {errs[0]}
        </p>
      ) : null}
    </div>
  );
}

/** Casilla con texto. Se envía como "on" cuando está marcada. */
export function Check({ name, label, defaultChecked, hint, errors }: { name: string; label: string; defaultChecked?: boolean; hint?: string; errors?: FieldErrors }) {
  const errs = errors?.[name];
  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 font-bold">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 size-5 shrink-0 accent-petroleo" />
        <span>
          {label}
          {hint ? <span className="block text-sm font-normal text-tinta-suave">{hint}</span> : null}
        </span>
      </label>
      {errs?.length ? (
        <p className="field-error" role="alert">
          {errs[0]}
        </p>
      ) : null}
    </div>
  );
}

export function Alert({ kind, children }: { kind: "error" | "ok"; children: React.ReactNode }) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`alert ${kind === "error" ? "alert-error" : "alert-ok"}`}>
      {children}
    </div>
  );
}

interface AuthShellProps {
  title: string;
  script: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

/** Marco de las pantallas de acceso y alta: mismo lenguaje visual que el resto de la marca. */
export function AuthShell({ title, script, children, footer, wide }: AuthShellProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-arena px-4 py-12">
      <div className={`panel-brutal w-full p-6 sm:p-8 ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <Link href="/" aria-label="Volver al inicio de Sabor Bravo">
          <Image src="/images/brands/sabor-bravo-compacto.png" alt="Sabor Bravo" width={118} height={56} className="h-12 w-auto" priority />
        </Link>
        <h1 className="mt-5 text-4xl">
          <span className="h-display block">{title}</span>
          <span className="h-script block -rotate-2 text-[1.15em] text-petroleo">{script}</span>
        </h1>
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-6 border-t-[3px] border-tinta pt-4 text-sm">{footer}</div> : null}
      </div>
    </main>
  );
}
