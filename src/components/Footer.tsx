import Image from "next/image";
import Link from "next/link";
import { LOGIN_HREF, NAV_LINKS, SIGNUP_HREF } from "@/content/nav";

export function Footer() {
  return (
    <footer className="border-t-[3px] border-tinta bg-blanco">
      <div className="container-sb grid gap-10 py-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <Image
            src="/images/brands/sabor-bravo-horizontal.png"
            alt="Sabor Bravo"
            width={185}
            height={96}
            className="h-24 w-auto"
          />
          <p className="mt-4 max-w-xs text-tinta-suave">
            Menús digitales y pedidos para restaurantes del Perú.
          </p>
        </div>

        <nav aria-label="Pie de página" className="md:col-span-4">
          <p className="eyebrow">Explorar</p>
          <ul className="mt-3 space-y-2 font-bold">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="underline-offset-4 hover:underline">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="md:col-span-3">
          <p className="eyebrow">Tu cuenta</p>
          <ul className="mt-3 space-y-2 font-bold">
            <li>
              <Link href={LOGIN_HREF} className="underline-offset-4 hover:underline">
                Iniciar sesión
              </Link>
            </li>
            <li>
              <Link href={SIGNUP_HREF} className="underline-offset-4 hover:underline">
                Crear cuenta
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t-2 border-tinta/15">
        <p className="container-sb py-4 text-sm text-tinta-suave">
          © 2026 Sabor Bravo · Versión preliminar en desarrollo.
        </p>
      </div>
    </footer>
  );
}
