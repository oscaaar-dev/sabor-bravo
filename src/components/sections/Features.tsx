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
    title: "Equipo y sucursales",
    text: "Asigna roles y permisos para que cada persona acceda a lo que necesita.",
    preview: "team",
  },
];

function FeaturePreview({ kind }: { kind: PreviewKind }) {
  const frame = "mt-auto rounded-xl border border-petroleo/10 bg-papel/80 p-3";
  const label = "text-[0.58rem] font-extrabold uppercase tracking-[0.12em] text-tinta-suave";
  const chip = "rounded-full border border-petroleo/10 bg-blanco px-2.5 py-1 text-[0.62rem] font-bold text-petroleo";

  switch (kind) {
    case "qr":
      return (
        <div aria-hidden="true" className={frame}>
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-petroleo text-xs font-extrabold tracking-wide text-blanco">QR</span>
            <div className="min-w-0 flex-1">
              <p className={label}>Tu carta digital</p>
              <p className="mt-0.5 text-xs font-bold">Lista para compartir</p>
            </div>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-coral/25 text-sm font-extrabold text-tinta">↗</span>
          </div>
        </div>
      );

    case "catalog":
      return (
        <div aria-hidden="true" className={frame}>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full bg-petroleo px-2.5 py-1 text-[0.62rem] font-bold text-blanco">Entradas</span>
            <span className={chip}>Fondos</span>
            <span className={chip}>Bebidas</span>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-tinta/5 bg-blanco p-2">
              <span className="size-7 shrink-0 rounded-md bg-coral/25" />
              <span className="text-[0.62rem] font-bold leading-tight">Ceviche<br />clásico</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-tinta/5 bg-blanco p-2">
              <span className="size-7 shrink-0 rounded-md bg-petroleo/15" />
              <span className="text-[0.62rem] font-bold leading-tight">Pollo a<br />la brasa</span>
            </div>
          </div>
        </div>
      );

    case "orders":
      return (
        <div aria-hidden="true" className={frame}>
          <p className={label}>Modalidad del pedido</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-lg bg-petroleo px-2.5 py-1.5 text-[0.62rem] font-bold text-blanco">Mesa</span>
            <span className={chip}>Recojo</span>
            <span className={chip}>Delivery</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between rounded-lg border border-tinta/5 bg-blanco px-2.5 py-2">
            <span className="text-[0.65rem] font-semibold">Pedido #124 · 2 platos</span>
            <span className="text-[0.62rem] font-extrabold text-petroleo">Total calculado</span>
          </div>
        </div>
      );

    case "service":
      return (
        <div aria-hidden="true" className={frame}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className={label}>Pedido #124</p>
              <p className="mt-0.5 text-xs font-bold">Mesa 06 · 2 platos</p>
            </div>
            <span className="rounded-full bg-coral/25 px-2.5 py-1 text-[0.6rem] font-extrabold text-tinta">En cocina</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="h-1.5 flex-1 rounded-full bg-petroleo" />
            <span className="h-1.5 flex-1 rounded-full bg-coral" />
            <span className="h-1.5 flex-1 rounded-full bg-tinta/10" />
            <span className="ml-1 text-[0.58rem] font-semibold text-tinta-suave">Listo</span>
          </div>
        </div>
      );

    case "promo":
      return (
        <div aria-hidden="true" className={frame}>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-coral/25 text-base">✦</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-extrabold">Pollo a la brasa</p>
              <p className="mt-0.5 text-[0.62rem] text-tinta-suave">Promoción del día</p>
            </div>
            <span className="rounded-full bg-petroleo/10 px-2 py-1 text-[0.58rem] font-extrabold text-petroleo">Activa</span>
          </div>
        </div>
      );

    case "reports":
      return (
        <div aria-hidden="true" className={frame}>
          <div className="flex items-center justify-between">
            <p className={label}>Resumen de ventas</p>
            <span className="rounded-full bg-blanco px-2 py-0.5 text-[0.58rem] font-bold text-tinta-suave">Semana</span>
          </div>
          <div className="mt-2 flex h-11 items-end gap-1.5 rounded-lg border border-tinta/5 bg-blanco px-3 pt-2">
            {[38, 55, 44, 76, 61, 88, 69].map((height, index) => (
              <span
                key={index}
                className={`flex-1 rounded-t-sm ${index === 5 ? "bg-coral" : "bg-petroleo/55"}`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
      );

    case "team":
      return (
        <div aria-hidden="true" className={frame}>
          <div className="flex items-center gap-2">
            {[
              ["A", "bg-petroleo text-blanco"],
              ["S", "bg-coral text-tinta"],
              ["C", "bg-arena text-tinta"],
            ].map(([initial, tone]) => (
              <span key={initial} className={`grid size-8 place-items-center rounded-full text-[0.62rem] font-extrabold ring-2 ring-papel ${tone}`}>
                {initial}
              </span>
            ))}
            <div className="ml-1 min-w-0">
              <p className="text-xs font-extrabold">Accesos del equipo</p>
              <p className="text-[0.62rem] text-tinta-suave">Permisos según cada rol</p>
            </div>
          </div>
        </div>
      );
  }
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
