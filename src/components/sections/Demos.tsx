import Link from "next/link";
import { DishPhoto } from "@/components/DishPhoto";
import type { DishSlug } from "@/content/dishes";

interface Demo {
  readonly slug: string;
  readonly nombre: string;
  readonly especialidad: string;
  readonly dish: DishSlug;
  readonly surface: string;
  readonly offset: string;
}

/** Restaurantes de demostración: nombres de ejemplo, NO son negocios reales. */
const DEMOS: readonly Demo[] = [
  { slug: "la-mar-cevicheria", nombre: "La Mar Cevichería", especialidad: "Cevichería", dish: "ceviche", surface: "bg-papel text-carbon", offset: "" },
  { slug: "el-gallo-bravo", nombre: "El Gallo Bravo", especialidad: "Pollería", dish: "pollo-brasa", surface: "bg-naranja text-carbon", offset: "lg:mt-14" },
  { slug: "cafe-del-valle", nombre: "Café del Valle", especialidad: "Cafetería", dish: "cafe", surface: "bg-carbon text-crema", offset: "lg:mt-4" },
  { slug: "sabor-criollo", nombre: "Sabor Criollo", especialidad: "Comida criolla", dish: "lomo-saltado", surface: "bg-rojo-oscuro text-crema", offset: "lg:mt-20" },
];

const OTRAS = ["Chifas", "Pizzerías y pastas", "Hamburgueserías", "Juguerías", "Pastelerías"] as const;

export function Demos() {
  return (
    <section id="demos" className="bg-crema py-[var(--section-y)]" aria-labelledby="demos-titulo">
      <div className="container-sb">
        <div className="max-w-3xl">
          <p className="eyebrow text-rojo-oscuro">Restaurantes de demostración</p>
          <h2 id="demos-titulo" className="mt-4 text-[clamp(2.2rem,5vw,4.4rem)]">
            <span className="h-display">Una plataforma.</span>{" "}
            <span className="h-script text-[1.2em] text-rojo">Todas las cocinas.</span>
          </h2>
          <p className="mt-5 max-w-xl">
            Cada negocio arma su carta con sus propias categorías, variantes y colores. Estos
            nombres son ejemplos de demostración, no negocios reales.
          </p>
        </div>

        <ul className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {DEMOS.map((d, i) => (
            <li key={d.slug} className={d.offset}>
              <Link
                href={`/r/${d.slug}`}
                className={`group block border-[3px] border-carbon p-4 shadow-brutal transition-transform hover:-translate-y-1 ${d.surface} ${
                  i % 2 === 0 ? "-rotate-1" : "rotate-1"
                }`}
              >
                <div className="relative mx-auto aspect-square w-full">
                  <DishPhoto slug={d.dish} sizes="(min-width:1024px) 22vw, (min-width:640px) 44vw, 90vw" />
                </div>
                <p className="h-script mt-3 text-3xl leading-none">{d.nombre}</p>
                <p className="mt-2 flex items-center justify-between gap-2">
                  <span className="sticker !bg-crema !text-carbon">{d.especialidad}</span>
                  <span className="text-sm font-extrabold underline decoration-[3px] underline-offset-4 group-hover:decoration-naranja">
                    Ver demo
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-16 flex flex-wrap items-center gap-x-3 gap-y-2 font-bold">
          <span className="eyebrow">También para</span>
          {OTRAS.map((o) => (
            <span key={o} className="border-b-[3px] border-naranja">
              {o}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
