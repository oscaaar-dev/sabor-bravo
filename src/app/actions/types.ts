import type { FieldErrors } from "@/lib/validation";

/** Estado que devuelven las acciones de formulario (para `useActionState`). Nunca incluye contraseñas. */
export interface FormState {
  readonly ok?: boolean;
  readonly message?: string;
  readonly fieldErrors?: FieldErrors;
  /** Valores enviados, para volver a rellenar el formulario si hay errores. */
  readonly values?: Record<string, string>;
}

/** Quita campos sensibles antes de devolver los valores al navegador. */
export function safeValues(raw: Record<string, string>): Record<string, string> {
  const { password: _password, ...rest } = raw;
  void _password;
  return rest;
}
