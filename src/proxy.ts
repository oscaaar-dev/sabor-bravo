import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Atajo de EXPERIENCIA: quien entra al panel sin cookie de sesión va directo a /login (sin renderizar nada).
 * No es la defensa: la sesión se valida de verdad en el servidor, contra la base de datos, en cada página y acción.
 */
const COOKIES = ["__Host-sb_session", "sb_session"];

export function proxy(request: NextRequest) {
  if (!COOKIES.some((name) => request.cookies.has(name))) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
