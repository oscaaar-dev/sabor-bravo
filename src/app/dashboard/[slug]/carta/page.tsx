import type { Metadata } from "next";
import { CategoryCreateForm, CategoryRenameForm, Collapsible, DeleteButton, ProductForm } from "@/components/app/CartaForms";
import { SubmitButton } from "@/components/app/SubmitButton";
import { deleteCategoryAction, deleteProductAction, toggleAvailabilityAction } from "@/app/actions/catalog";
import { requireBusiness } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listCatalog } from "@/server/domain/catalog";
import { formatDate } from "@/lib/format";
import { centsToInput, formatPEN } from "@/lib/money";
import { effectivePriceCents, promoActive } from "@/lib/pricing";

export const metadata: Metadata = { title: "Carta", robots: { index: false } };

export default async function CartaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business } = await requireBusiness(slug, "menu.write");
  const catalog = await listCatalog(getDb(), business.id);
  const cats = catalog.map((c) => ({ id: c.id, name: c.name }));
  const total = catalog.reduce((n, c) => n + c.products.length, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl">
          <span className="h-display">Tu carta</span>
        </h1>
        <p className="mt-2 text-tinta-suave">
          {catalog.length} {catalog.length === 1 ? "categoría" : "categorías"} · {total} {total === 1 ? "plato" : "platos"}. Los clientes solo ven los platos visibles y disponibles.
        </p>
      </div>

      <section className="panel-brutal p-5" aria-label="Crear categoría">
        <CategoryCreateForm slug={slug} />
      </section>

      {catalog.length === 0 ? (
        <p className="panel-brutal p-6 text-center text-lg font-bold">Empieza creando una categoría (por ejemplo «Entradas») y luego añade tus platos.</p>
      ) : null}

      {catalog.map((c) => (
        <section key={c.id} className="panel-brutal p-5" aria-labelledby={`cat-${c.id}`} data-category={c.name}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`cat-${c.id}`} className="text-2xl font-extrabold">
              {c.name} <span className="text-base font-bold text-tinta-suave">({c.products.length})</span>
            </h2>
            <DeleteButton
              action={deleteCategoryAction.bind(null, slug, c.id)}
              label="Eliminar categoría"
              question={c.products.length > 0 ? `¿Eliminar la categoría y sus ${c.products.length} platos?` : "¿Eliminar la categoría?"}
            />
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer font-bold underline decoration-coral decoration-2 underline-offset-2">Cambiar nombre</summary>
            <div className="mt-3">
              <CategoryRenameForm slug={slug} categoryId={c.id} name={c.name} />
            </div>
          </details>

          <ul className="mt-4 divide-y-2 divide-tinta/15">
            {c.products.length === 0 ? <li className="py-3 text-tinta-suave">Aún no hay platos en esta categoría.</li> : null}
            {c.products.map((p) => (
              <li key={p.id} className="py-4" data-product={p.name}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-3">
                    {p.imageUrl ? (
                      // Imagen externa elegida por el dueño: <img> simple (sin el optimizador de Next, que exigiría una lista de dominios).
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" width={64} height={64} loading="lazy" referrerPolicy="no-referrer" className="size-16 shrink-0 border-[3px] border-tinta object-cover" />
                    ) : null}
                    <div className="min-w-0">
                      <p className="font-extrabold">
                        {p.name}{" "}
                        {promoActive(p) ? (
                          <span className="font-bold">
                            · <s className="text-tinta-suave">{formatPEN(p.priceCents)}</s> {formatPEN(effectivePriceCents(p))}
                          </span>
                        ) : (
                          <span className="font-bold text-tinta-suave">· {formatPEN(p.priceCents)}</span>
                        )}
                      </p>
                      {p.description ? <p className="text-sm text-tinta-suave">{p.description}</p> : null}
                      <p className="mt-1 flex flex-wrap gap-2">
                        {promoActive(p) ? <span className="badge badge-petroleo">-{p.promoPercent}%{p.promoEndsAt ? ` hasta ${formatDate(p.promoEndsAt)}` : ""}</span> : null}
                        {p.promoPercent !== null && !promoActive(p) ? <span className="badge badge-gris">Promoción vencida</span> : null}
                        {!p.isAvailable ? <span className="badge badge-coral">Agotado</span> : null}
                        {!p.isPublished ? <span className="badge badge-gris">Oculto</span> : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={toggleAvailabilityAction.bind(null, slug, p.id, !p.isAvailable)}>
                      <SubmitButton pendingText="…" className="btn-brutal btn-blanco btn-sm">
                        {p.isAvailable ? "Marcar agotado" : "Marcar disponible"}
                      </SubmitButton>
                    </form>
                    <DeleteButton action={deleteProductAction.bind(null, slug, p.id)} label="Eliminar" question="¿Eliminar este plato?" />
                  </div>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer font-bold underline decoration-coral decoration-2 underline-offset-2">Editar plato</summary>
                  <div className="mt-3 border-t-2 border-tinta/15 pt-4">
                    <ProductForm
                      slug={slug}
                      categories={cats}
                      product={{
                        id: p.id,
                        categoryId: p.categoryId,
                        name: p.name,
                        description: p.description ?? "",
                        price: centsToInput(p.priceCents),
                        imageUrl: p.imageUrl ?? "",
                        isAvailable: p.isAvailable,
                        isPublished: p.isPublished,
                        promoPercent: p.promoPercent === null ? "" : String(p.promoPercent),
                        promoEndsAt: p.promoEndsAt ? p.promoEndsAt.toLocaleDateString("sv-SE", { timeZone: "America/Lima" }) : "",
                      }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>

          <Collapsible className="mt-4 border-t-[3px] border-tinta pt-4" initiallyOpen={c.products.length === 0} summary={<>+ Añadir plato a «{c.name}»</>}>
            <ProductForm slug={slug} categories={cats} defaultCategoryId={c.id} />
          </Collapsible>
        </section>
      ))}
    </div>
  );
}
