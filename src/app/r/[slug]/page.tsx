import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StubPage } from "@/components/StubPage";

interface MenuPageProps {
  params: Promise<{ slug: string }>;
}

/** Misma forma que tendrán los slugs de restaurante en la base de datos. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function generateMetadata({ params }: MenuPageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: SLUG_RE.test(slug) ? `Menú de ${slug}` : "Menú" };
}

export default async function PublicMenuPage({ params }: MenuPageProps) {
  const { slug } = await params;
  if (!SLUG_RE.test(slug) || slug.length > 60) notFound();

  return (
    <StubPage title="Menú digital" script={slug}>
      <p>
        Aquí vivirá la carta pública de este restaurante: categorías, productos, variantes,
        carrito y pedido.
      </p>
      <p>
        Se conecta a la base de datos en la Fase 3. Hasta entonces esta dirección no valida que el
        restaurante exista.
      </p>
    </StubPage>
  );
}
