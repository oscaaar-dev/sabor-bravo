import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("redirección tras el login (safeNext)", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/mi-local/pedidos", "/dashboard/mi-local/pedidos"],
    ["/dashboard/mi-local/pedidos/3f2a-1b", "/dashboard/mi-local/pedidos/3f2a-1b"],
  ])("acepta %s", (input, out) => expect(safeNext(input)).toBe(out));

  it.each([
    ["https://malo.com"], ["//malo.com"], ["/\\malo.com"], ["javascript:alert(1)"], ["/dashboard//malo.com"], ["/dashboard/../admin"],
    ["/login"], ["/"], [""], [undefined], [null], ["/dashboard?x=https://malo.com"], ["/dashboard/%2e%2e/x"], ["http://localhost/dashboard"], ["/dashboard/" + "a".repeat(250)],
  ])("rechaza %j y devuelve /dashboard", (input) => expect(safeNext(input as string | null | undefined)).toBe("/dashboard"));
});

describe("configuración de seguridad", () => {
  const config = readFileSync(path.resolve(process.cwd(), "next.config.ts"), "utf8");

  it("la CSP usa comillas simples en sus palabras clave (sin ellas 'none' sería un dominio)", () => {
    const csp = /key: "Content-Security-Policy", value: "([^"]+)"/.exec(config)?.[1] ?? "";
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
  });
  it("incluye las cabeceras básicas", () => {
    for (const h of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) expect(config).toContain(h);
  });
  it("el código de la aplicación no registra nada en consola (no hay contraseñas ni secretos en logs)", () => {
    const files = ["src/app/actions/auth.ts", "src/server/auth/session.ts", "src/server/auth/password.ts", "src/server/rate-limit.ts", "src/server/domain/users.ts"];
    for (const f of files) expect(readFileSync(path.resolve(process.cwd(), f), "utf8")).not.toMatch(/console\.(log|info|warn|error|debug)/);
  });
});
