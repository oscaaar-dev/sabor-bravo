import "server-only";
import { headers } from "next/headers";

/**
 * URL pública del sitio, sin barra final. Prioriza SITE_URL (configurada en el hosting); si falta, usa el dominio de la
 * petición, validado para que una cabecera Host manipulada no pueda meter caracteres raros en el QR ni en los enlaces.
 */
export async function siteUrl(): Promise<string> {
  const fromEnv = process.env.SITE_URL?.trim();
  if (fromEnv && /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(fromEnv.replace(/\/+$/, ""))) return fromEnv.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") === "https" || (!host.startsWith("localhost") && !host.startsWith("127.")) ? "https" : "http";
  return `${proto}://${host}`;
}
