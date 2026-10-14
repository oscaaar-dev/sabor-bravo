/**
 * Destino tras iniciar sesión (parámetro `next`): solo rutas internas del panel. Evita redirecciones abiertas
 * (https://malo.com, //malo.com, /\malo.com, javascript:…) y cualquier ruta fuera de /dashboard.
 */
export function safeNext(value: string | null | undefined): string {
  if (typeof value === "string" && value.length <= 200 && /^\/dashboard(\/[A-Za-z0-9\-_/]*)?$/.test(value) && !value.includes("//")) return value;
  return "/dashboard";
}
