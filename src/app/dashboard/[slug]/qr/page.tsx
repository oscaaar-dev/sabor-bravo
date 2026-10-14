import type { Metadata } from "next";
import { requireBusiness } from "@/server/auth/current";
import { siteUrl } from "@/server/site-url";

export const metadata: Metadata = { title: "Código QR", robots: { index: false } };

export default async function QrPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business } = await requireBusiness(slug, "orders.read");
  const url = `${await siteUrl()}/r/${business.slug}`;
  const img = `/dashboard/${business.slug}/qr/image`;

  return (
    <div className="space-y-6">
      <h1 className="text-4xl">
        <span className="h-display block">Código QR</span>
        <span className="h-script block -rotate-1 text-[1.1em] text-petroleo">de tu carta</span>
      </h1>
      <div className="grid gap-8 md:grid-cols-[auto_1fr]">
        <div className="panel-brutal w-fit bg-white p-4">
          {/* El QR lo genera el servidor; se pide como imagen protegida (solo miembros del restaurante). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${img}?format=png`} alt={`Código QR que abre ${url}`} width={288} height={288} className="size-72" data-testid="qr-image" />
        </div>
        <div className="space-y-4">
          <p>
            Al escanearlo, tus clientes abren tu carta y pueden pedir desde su celular:
          </p>
          <p className="break-all text-lg font-extrabold" data-testid="qr-url">
            {url}
          </p>
          {!business.isPublished ? <p className="alert alert-error">Tu carta está oculta: el QR llevará a una página «no encontrado» hasta que la publiques en Ajustes.</p> : null}
          <div className="flex flex-wrap gap-3">
            <a href={`${img}?format=png&download=1`} className="btn-brutal btn-coral" data-testid="qr-download-png">
              Descargar PNG
            </a>
            <a href={`${img}?format=svg&download=1`} className="btn-brutal btn-blanco" data-testid="qr-download-svg">
              Descargar SVG
            </a>
          </div>
          <p className="text-sm text-tinta-suave">
            El PNG sirve para imprimir en mesas y vitrinas. El SVG se puede ampliar sin perder calidad (ideal para afiches). El código lleva a la dirección actual de tu carta: si cambias la dirección en Ajustes, descarga el QR de nuevo.
          </p>
        </div>
      </div>
    </div>
  );
}
