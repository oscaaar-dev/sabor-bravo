"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface TabItem {
  readonly href: string;
  readonly label: string;
}

/** Pestañas del panel; la activa se marca con aria-current. (La autorización real se comprueba en el servidor.) */
export function DashTabs({ base, tabs }: { base: string; tabs: TabItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones del panel" className="flex gap-2">
      {tabs.map((t) => {
        const href = `${base}/${t.href}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={t.href} href={href} className="tab" aria-current={active ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
