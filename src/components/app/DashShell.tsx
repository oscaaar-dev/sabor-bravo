import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { DashTabs, type TabItem } from "./DashTabs";

interface TopBarProps {
  userName: string;
  /** Restaurante activo (si lo hay): muestra su nombre y enlaces. */
  business?: { slug: string; name: string; isPublished: boolean };
  tabs?: TabItem[];
}

/** Barra superior del panel: marca, restaurante activo, enlace a la carta pública y cierre de sesión. */
export function TopBar({ userName, business, tabs }: TopBarProps) {
  return (
    <header className="border-b-[3px] border-tinta bg-blanco">
      <div className="container-sb flex flex-wrap items-center gap-x-6 gap-y-3 py-3">
        <Link href="/dashboard" aria-label="Sabor Bravo, ir al panel" className="shrink-0">
          <Image src="/images/brands/sabor-bravo-compacto.png" alt="Sabor Bravo" width={118} height={56} className="h-10 w-auto" priority />
        </Link>
        {business ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold">{business.name}</p>
            <p className="text-sm text-tinta-suave">
              {business.isPublished ? (
                <>
                  Carta pública:{" "}
                  <Link href={`/r/${business.slug}`} target="_blank" className="font-bold underline decoration-coral decoration-2 underline-offset-2">
                    /r/{business.slug}
                  </Link>
                </>
              ) : (
                <span className="font-bold">Carta oculta: los clientes no pueden verla ni pedir</span>
              )}
            </p>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex items-center gap-3">
          <span className="hidden text-sm font-bold sm:inline">{userName}</span>
          <form action={logoutAction}>
            <button type="submit" className="btn-brutal btn-blanco btn-sm">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
      {tabs && business ? (
        <div className="container-sb overflow-x-auto pb-3">
          <DashTabs base={`/dashboard/${business.slug}`} tabs={tabs} />
        </div>
      ) : null}
    </header>
  );
}
