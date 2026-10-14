import Link from "next/link";
import { SIGNUP_HREF } from "@/content/nav";

/**
 * Propuesta PRELIMINAR. Los límites y precios de cada plan son una decisión comercial
 * pendiente; más adelante se leerán de la tabla de planes que gestiona la superadministración.
 */
const PLANS = [
  {
    name: "Inicio",
    para: "Un local que quiere pasar su carta al celular.",
    items: ["1 sucursal", "Menú con QR y URL propia", "Pedidos de mesa, recojo o delivery"],
    featured: false,
  },
  {
    name: "Local",
    para: "Un negocio con equipo y movimiento diario.",
    items: [
      "Todo lo de Inicio",
      "Promociones y disponibilidad",
      "Informes con exportación CSV",
      "Equipo con roles",
    ],
    featured: true,
  },
  {
    name: "Cadena",
    para: "Varias sucursales bajo una misma marca.",
    items: ["Todo lo de Local", "Varias sucursales", "Permisos por sucursal"],
    featured: false,
  },
] as const;

export function Plans() {
  return (
    <section id="planes" className="bg-arena py-[var(--section-y)]" aria-labelledby="planes-titulo">
      <div className="container-sb">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 id="planes-titulo" className="text-[clamp(2.2rem,5vw,4.4rem)]">
            <span className="h-display">Planes para</span>{" "}
            <span className="h-script text-[1.2em] text-petroleo">cada tamaño</span>
          </h2>
          <p className="sticker bg-coral">Precios por anunciar</p>
        </div>
        <p className="mt-4 max-w-xl">
          Esta es la estructura prevista. Los límites y precios definitivos se publicarán antes del
          lanzamiento.
        </p>

        <ul className="mt-12 grid items-stretch gap-8 md:grid-cols-3">
          {PLANS.map((p) => (
            <li
              key={p.name}
              className={`flex flex-col border-[3px] border-tinta p-6 ${
                p.featured
                  ? "bg-petroleo text-blanco shadow-brutal-coral md:-mt-4 md:mb-4"
                  : "bg-blanco shadow-brutal"
              }`}
            >
              <h3 className="h-script text-4xl">{p.name}</h3>
              <p className={`mt-2 ${p.featured ? "text-blanco/80" : "text-tinta-suave"}`}>{p.para}</p>
              <ul className="mt-5 flex-1 space-y-2 font-bold">
                {p.items.map((it) => (
                  <li key={it} className="flex gap-2">
                    <span aria-hidden="true" className={p.featured ? "text-coral-claro" : "text-petroleo"}>
                      ▸
                    </span>
                    {it}
                  </li>
                ))}
              </ul>
              <Link
                href={SIGNUP_HREF}
                className={`btn-brutal mt-7 ${p.featured ? "btn-blanco" : "btn-petroleo"}`}
              >
                Empezar con {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
