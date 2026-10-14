import type { Metadata } from "next";
import { BusinessForm } from "@/components/app/BusinessForm";
import { Alert } from "@/components/app/ui";
import { updateBusinessAction } from "@/app/actions/business";
import { requireBusiness } from "@/server/auth/current";
import { siteUrl } from "@/server/site-url";
import { centsToInput } from "@/lib/money";

export const metadata: Metadata = { title: "Ajustes", robots: { index: false } };

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ guardado?: string }>;
}

export default async function AjustesPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { guardado } = await searchParams;
  const { business } = await requireBusiness(slug, "settings.write");
  const base = await siteUrl();

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-4xl">
        <span className="h-display">Ajustes</span>
      </h1>
      {guardado ? <Alert kind="ok">Cambios guardados. La dirección de tu carta ahora es /r/{business.slug}: descarga el QR de nuevo.</Alert> : null}
      <div className="panel-brutal p-6">
        <BusinessForm
          mode="edit"
          action={updateBusinessAction.bind(null, slug)}
          submitLabel="Guardar cambios"
          siteUrl={base}
          defaults={{
            name: business.name,
            slug: business.slug,
            description: business.description ?? "",
            phone: business.phone ?? "",
            address: business.address ?? "",
            acceptsDineIn: business.acceptsDineIn,
            acceptsPickup: business.acceptsPickup,
            acceptsDelivery: business.acceptsDelivery,
            deliveryFee: centsToInput(business.deliveryFeeCents),
            isPublished: business.isPublished,
          }}
        />
      </div>
    </div>
  );
}
