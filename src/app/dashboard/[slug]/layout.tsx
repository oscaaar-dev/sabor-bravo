import { notFound } from "next/navigation";
import { TopBar } from "@/components/app/DashShell";
import type { TabItem } from "@/components/app/DashTabs";
import { requireUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { getBusinessAccess } from "@/server/domain/businesses";
import { can } from "@/lib/permissions";

interface BusinessLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Marco del panel de un restaurante. OJO: un layout NO se vuelve a ejecutar al navegar entre páginas hermanas, así que
 * aquí solo se decide qué pestañas mostrar; cada página y cada acción comprueban sesión, pertenencia y permiso por su cuenta.
 */
export default async function BusinessLayout({ children, params }: BusinessLayoutProps) {
  const { slug } = await params;
  const user = await requireUser(`/dashboard/${slug}`);
  const access = await getBusinessAccess(getDb(), user.id, slug);
  if (!access) notFound();

  const tabs: TabItem[] = [{ href: "pedidos", label: "Pedidos" }];
  if (can(access.role, "menu.write")) tabs.push({ href: "carta", label: "Carta" });
  tabs.push({ href: "qr", label: "Código QR" });
  if (can(access.role, "reports.read")) tabs.push({ href: "informes", label: "Informes" });
  if (can(access.role, "settings.write")) tabs.push({ href: "ajustes", label: "Ajustes" });
  if (can(access.role, "team.manage")) tabs.push({ href: "equipo", label: "Equipo" });

  return (
    <>
      <TopBar userName={user.name} business={{ slug: access.business.slug, name: access.business.name, isPublished: access.business.isPublished }} tabs={tabs} />
      <main className="container-sb py-8">{children}</main>
    </>
  );
}
