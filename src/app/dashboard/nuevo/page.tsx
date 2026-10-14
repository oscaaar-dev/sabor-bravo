import type { Metadata } from "next";
import { TopBar } from "@/components/app/DashShell";
import { BusinessForm } from "@/components/app/BusinessForm";
import { createBusinessAction } from "@/app/actions/business";
import { requireUser } from "@/server/auth/current";
import { siteUrl } from "@/server/site-url";

export const metadata: Metadata = { title: "Crear restaurante", robots: { index: false } };

export default async function NuevoRestaurantePage() {
  const user = await requireUser("/dashboard/nuevo");
  const base = await siteUrl();
  return (
    <>
      <TopBar userName={user.name} />
      <main className="container-sb max-w-3xl py-10">
        <h1 className="text-4xl">
          <span className="h-display block">Crea tu restaurante</span>
          <span className="h-script block -rotate-1 text-[1.15em] text-petroleo">y su carta digital</span>
        </h1>
        <p className="mt-4 text-tinta-suave">Estos datos se muestran a tus clientes. Podrás cambiarlos cuando quieras.</p>
        <div className="panel-brutal mt-8 p-6">
          <BusinessForm mode="create" action={createBusinessAction} submitLabel="Crear restaurante" siteUrl={base} />
        </div>
      </main>
    </>
  );
}
