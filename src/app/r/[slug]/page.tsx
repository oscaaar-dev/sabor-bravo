import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { MenuClient } from "@/components/app/MenuClient";
import { getDb } from "@/server/db";
import { getPublicBusiness } from "@/server/domain/businesses";
import { getPublicMenu } from "@/server/domain/catalog";
import { formatPEN } from "@/lib/money";
import { effectivePriceCents, promoActive } from "@/lib/pricing";
import { TYPE_LABEL } from "@/lib/order-status";

interface MenuPageProps {
  params: Promise<{ slug: string }>;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Una sola lectura por petición, compartida entre los metadatos y la página. */
const load = cache(async (slug: string) => {
  if (!SLUG_RE.test(slug) || slug.length > 60) return null;
  const db = getDb();
  const business = await getPublicBusiness(db, slug);
  if (!business) return null;
  return { business, menu: await getPublicMenu(db, business.id) };
});

export async function generateMetadata({ params }: MenuPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Carta no encontrada", robots: { index: false } };
  return { title: `${data.business.name} · Carta`, description: data.business.description ?? `Carta digital de ${data.business.name}. Pide desde tu celular.` };
}

export default async function PublicMenuPage({ params }: MenuPageProps) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound(); // 404 real: el restaurante no existe o no está publicado
  const { business, menu } = data;

  const modes = [business.acceptsDineIn && TYPE_LABEL.dine_in, business.acceptsPickup && TYPE_LABEL.pickup, business.acceptsDelivery && TYPE_LABEL.delivery].filter(Boolean) as string[];

  return (
    <div className="min-h-svh bg-arena">
      <div className="mx-auto max-w-3xl px-4">
        <header className="py-6">
          <Link href="/" aria-label="Sabor Bravo">
            <Image src="/images/brands/sabor-bravo-compacto.png" alt="Sabor Bravo" width={118} height={56} className="h-8 w-auto opacity-90" />
          </Link>
          <h1 className="mt-4 text-4xl sm:text-5xl">
            <span className="h-display block">{business.name}</span>
          </h1>
          {business.description ? <p className="mt-2 max-w-xl text-lg">{business.description}</p> : null}
          <ul className="mt-3 flex flex-wrap gap-2">
            {modes.map((m) => (
              <li key={m} className="badge">
                {m}
              </li>
            ))}
            {business.acceptsDelivery && business.deliveryFeeCents > 0 ? <li className="badge badge-gris">Delivery {formatPEN(business.deliveryFeeCents)}</li> : null}
          </ul>
          {business.address || business.phone ? (
            <p className="mt-3 text-sm text-tinta-suave">
              {business.address}
              {business.address && business.phone ? " · " : ""}
              {business.phone}
            </p>
          ) : null}
        </header>
        <MenuClient
          business={{
            slug: business.slug,
            name: business.name,
            acceptsDineIn: business.acceptsDineIn,
            acceptsPickup: business.acceptsPickup,
            acceptsDelivery: business.acceptsDelivery,
            deliveryFeeCents: business.deliveryFeeCents,
          }}
          menu={menu.map((c) => ({
            id: c.id,
            name: c.name,
            products: c.products.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              priceCents: effectivePriceCents(p),
              listPriceCents: promoActive(p) ? p.priceCents : null,
              imageUrl: p.imageUrl,
            })),
          }))}
        />
      </div>
    </div>
  );
}
