import { TornEdge } from "@/components/graphics";

const FEATURES = [
  {
    title: "Menú con QR y dirección propia",
    text: "Cada restaurante tiene su URL, por ejemplo /r/tu-restaurante, y un QR para ponerlo en mesas, vitrinas y redes.",
  },
  {
    title: "Catálogo a tu manera",
    text: "Categorías, productos con foto, variantes (tamaños) y extras. Una cevichería y una pastelería arman cartas distintas en el mismo sistema.",
  },
  {
    title: "Carrito y pedidos",
    text: "El cliente elige mesa, recojo o delivery según lo que habilites. El total lo calcula el servidor con tus precios vigentes, no el navegador.",
  },
  {
    title: "Panel de pedidos",
    text: "Pendiente, confirmado, en preparación, listo, completado o cancelado. Solo se permiten los cambios de estado que tienen sentido.",
  },
  {
    title: "Promociones y disponibilidad",
    text: "Pausa un plato agotado o activa una promoción sin tocar código.",
  },
  {
    title: "Informes y exportación",
    text: "Ventas por período, pedidos, importe medio, platos más vendidos y exportación en CSV.",
  },
  {
    title: "Equipo y sucursales",
    text: "Roles con permisos distintos para dueños, administradores y personal, por local.",
  },
] as const;

export function Features() {
  return (
    <section id="funcionalidades" className="relative bg-carbon text-crema" aria-labelledby="func-titulo">
      <TornEdge className="absolute inset-x-0 top-0 h-[clamp(1.5rem,4vw,3.5rem)] w-full -translate-y-[99%] rotate-0" />

      <div className="container-sb grid gap-12 py-[var(--section-y)] lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow text-naranja">Funcionalidades</p>
            <h2 id="func-titulo" className="mt-4 text-[clamp(2.1rem,4.4vw,4rem)]">
              <span className="h-display block">Todo entre</span>
              <span className="h-display block">el QR y</span>
              <span className="h-script block -rotate-2 text-[1.3em] text-naranja">la cocina</span>
            </h2>
            <p className="mt-6 max-w-sm text-crema/80">
              Aún no incluye pagos online, seguimiento GPS ni facturación electrónica. Lo que
              prometemos aquí es lo que construimos.
            </p>
          </div>
        </div>

        <ol className="lg:col-span-8">
          {FEATURES.map((f, i) => (
            <li
              key={f.title}
              className="grid grid-cols-[3.2rem_1fr] gap-x-4 border-t-2 border-crema/25 py-6 first:border-t-0 sm:grid-cols-[5rem_1fr] sm:gap-x-6"
            >
              <span aria-hidden="true" className="h-script text-[2.6rem] text-naranja sm:text-[3.6rem]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-xl font-extrabold leading-tight sm:text-2xl">{f.title}</h3>
                <p className="mt-2 max-w-2xl text-crema/80">{f.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
