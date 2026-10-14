import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/** Cookies del flujo (HttpOnly, SameSite=Lax, 10 min). En producción llevan el prefijo __Host- (Secure, Path=/, sin Domain). */
const prod = process.env.NODE_ENV === "production";
export const OAUTH_STATE_COOKIE = prod ? "__Host-sb_oauth" : "sb_oauth";
export const OAUTH_LINK_COOKIE = prod ? "__Host-sb_oauth_link" : "sb_oauth_link";

export async function setFlowCookie(name: string, value: string): Promise<void> {
  const store = await cookies();
  store.set(name, value, { httpOnly: true, secure: prod, sameSite: "lax", path: "/", maxAge: 600 });
}

/** Borra la cookie reenviándola caducada CON los mismos atributos (ver nota en endSession: __Host- exige Secure también al borrar). */
export async function clearFlowCookie(name: string): Promise<void> {
  (await cookies()).set(name, "", { httpOnly: true, secure: prod, sameSite: "lax", path: "/", maxAge: 0, expires: new Date(0) });
}

export async function readFlowCookie(name: string): Promise<string | undefined> {
  return (await cookies()).get(name)?.value;
}

/** Comparación en tiempo constante de dos textos (el `state` del navegador contra el de la cookie). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Mensajes para el usuario según el código de error (nunca incluyen datos técnicos ni tokens). */
export const GOOGLE_ERRORS: Record<string, string> = {
  google_no_configurado: "El acceso con Google todavía no está disponible. Usa tu correo y contraseña por ahora.",
  google_cancelado: "Cancelaste el acceso con Google. Puedes intentarlo de nuevo o usar tu correo.",
  google_estado: "La sesión de acceso con Google caducó o no es válida. Vuelve a pulsar «Continuar con Google».",
  google_correo_no_verificado: "Tu cuenta de Google no tiene el correo verificado, así que no podemos usarla.",
  google_conflicto: "Esa cuenta ya está vinculada a otra cuenta de Sabor Bravo. Entra con el método que usaste al registrarte.",
  google_demasiados: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  google_fallo: "No se pudo completar el acceso con Google. Inténtalo de nuevo en un momento.",
};
