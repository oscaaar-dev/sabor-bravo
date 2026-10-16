import Image from "next/image";

type PreviewKind = "qr" | "catalog" | "orders" | "service" | "promo" | "reports" | "team";

const FEATURES: readonly {
  title: string;
  text: string;
  preview: PreviewKind;
}[] = [
  {
    title: "Menú con QR y dirección propia",
    text: "Comparte una página de tu restaurante y un QR listo para mesas, vitrinas o redes.",
    preview: "qr",
  },
  {
    title: "Catálogo a tu manera",
    text: "Organiza categorías, fotos, variantes y extras según lo que vende tu local.",
    preview: "catalog",
  },
  {
    title: "Carrito y pedidos",
    text: "El cliente elige mesa, recojo o delivery. El sistema calcula el total con tus precios vigentes.",
    preview: "orders",
  },
  {
    title: "Panel para el servicio",
    text: "Recibe pedidos y avanza su estado: pendiente, confirmado, preparación, listo o completado.",
    preview: "service",
  },
  {
    title: "Promociones y disponibilidad",
    text: "Pausa un plato agotado o activa una promoción sin tocar código.",
    preview: "promo",
  },
  {
    title: "Informes y exportación",
    text: "Consulta ventas, pedidos, importe medio y platos más vendidos; exporta los datos en CSV.",
    preview: "reports",
  },
  {
    title: "Equipo y permisos",
    text: "Asigna roles y permisos para que cada persona acceda a lo que necesita.",
    preview: "team",
  },
];

const PREVIEWS: Record<PreviewKind, { src: string; alt: string }> = {
  qr: {
    src: "/images/features/qr-real.webp",
    alt: "Pantalla real de Sabor Bravo con el código QR y la dirección pública de una carta",
  },
  catalog: {
    src: "/images/features/catalog-real.webp",
    alt: "Pantalla real del catálogo con platos, precios, promoción y disponibilidad",
  },
  orders: {
    src: "/images/features/cart-real.webp",
    alt: "Carrito real de la carta móvil con un producto y su precio vigente",
  },
  service: {
    src: "/images/features/service-real.webp",
    alt: "Panel real de pedidos con filtros, importes y estados del servicio",
  },
  promo: {
    src: "/images/features/promo-real.webp",
    alt: "Producto real con precio anterior tachado, precio promocional y descuento del cincuenta por ciento",
  },
  reports: {
    src: "/images/features/reports-real.webp",
    alt: "Informe real con ventas, pedidos completados, ticket promedio y filtros de fecha",
  },
  team: {
    src: "/images/features/team-real.webp",
    alt: "Panel real del equipo con cuentas de propietario y personal y controles de permisos",
  },
};

function FeaturePreview({ kind }: { kind: PreviewKind }) {
  const preview = PREVIEWS[kind];

  return (
    <figure className="mt-auto overflow-hidden rounded-xl border border-petroleo/15 bg-blanco shadow-[0_5px_14px_rgba(32,35,33,0.08)]">
      <div className="flex h-7 items-center gap-1.5 border-b border-petroleo/10 bg-papel px-3">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-coral" />
        <span aria-hidden="true" className="size-1.5 rounded-full bg-mostaza" />
        <span aria-hidden="true" className="size-1.5 rounded-full bg-petroleo/55" />
        <figcaption className="ml-auto text-[0.58rem] font-extrabold uppercase tracking-[0.12em] text-tinta-suave">
          Pantalla real
        </figcaption>
      </div>
      <Image
        src={preview.src}
        alt={preview.alt}
        width={960}
        height={360}
        sizes="(min-width: 1024px) 29vw, (min-width: 640px) 46vw, 88vw"
        className="h-auto w-full"
      />
    </figure>
  );
}

export function Features() {
  return (
    <section id="funcionalidades" className="bg-arena py-[var(--section-y)]" aria-labelledby="func-titulo">
      <div className="container-sb">
        <div className="max-w-3xl">
          <p className="eyebrow text-petroleo">Funcionalidades</p>
          <h2 id="func-titulo" className="mt-3 text-[clamp(2rem,4.2vw,3.5rem)] font-extrabold leading-tight tracking-[-0.04em]">
            Lo esencial para atender desde un solo lugar.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-tinta-suave">
            Menú, pedidos y herramientas para el equipo, conectados sin sumar pasos al servicio.
          </p>
        </div>

        <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <li
              key={feature.title}
              className="relative flex min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-petroleo/10 bg-blanco p-5 shadow-[0_6px_18px_rgba(32,35,33,0.045)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-petroleo/20 hover:shadow-[0_14px_28px_rgba(32,35,33,0.09)] sm:p-6 last:lg:col-start-2"
            >
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-coral/25 text-xs font-extrabold tracking-wide text-tinta">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span aria-hidden="true" className="h-px flex-1 bg-petroleo/10" />
                <span aria-hidden="true" className="size-2 rounded-full bg-petroleo/70" />
              </div>
              <h3 className="mt-4 text-lg font-extrabold leading-snug">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-tinta-suave">{feature.text}</p>
              <FeaturePreview kind={feature.preview} />
            </li>
          ))}
        </ol>

        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-tinta-suave">
          Por ahora no incluye pagos en línea, seguimiento GPS ni facturación electrónica.
        </p>
      </div>
    </section>
  );
}
