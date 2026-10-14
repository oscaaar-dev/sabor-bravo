import type { FieldErrors } from "@/lib/validation";

export type Ok<T> = { readonly ok: true; readonly data: T };
export type Fail = {
  readonly ok: false;
  readonly message: string;
  readonly fieldErrors?: FieldErrors;
  readonly code?: string;
  /** Datos extra para la interfaz (p. ej. ids de productos que ya no están disponibles). */
  readonly details?: Record<string, unknown>;
};
export type Result<T> = Ok<T> | Fail;

export const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
export const fail = (message: string, extra: { fieldErrors?: FieldErrors; code?: string; details?: Record<string, unknown> } = {}): Fail => ({ ok: false, message, ...extra });

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Extrae el código SQLSTATE y la restricción de un error de Postgres (Drizzle lo envuelve en `cause`). */
export function pgError(e: unknown): { code?: string; constraint?: string } {
  for (const candidate of [e, (e as { cause?: unknown } | null)?.cause]) {
    if (candidate && typeof candidate === "object" && "code" in candidate) {
      const c = candidate as { code?: unknown; constraint_name?: unknown; constraint?: unknown };
      return {
        code: typeof c.code === "string" ? c.code : undefined,
        constraint: typeof c.constraint_name === "string" ? c.constraint_name : typeof c.constraint === "string" ? c.constraint : undefined,
      };
    }
  }
  return {};
}

export const UNIQUE_VIOLATION = "23505";
