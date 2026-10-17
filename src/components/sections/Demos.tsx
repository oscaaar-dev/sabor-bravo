import Link from "next/link";
import { DishPhoto } from "@/components/DishPhoto";
import type { DishSlug } from "@/content/dishes";

interface Demo {
  readonly slug: string;
  readonly nombre: string;
  readonly especialidad: string;
  readonly dish: DishSlug;
}

/** Restaurantes de demostración: nombres de ejemplo, NO son negocios reales. */
const DEMOS: readonly Demo[] = [
  { slug: "la-mar-cevicheria", nombre: "La Mar Cevichería", especialidad: "Cevichería", dish: "ceviche" },
  { slug: "el-gallo-bravo", nombre: "El Gallo Bravo", especialidad: "Pollería", dish: "pollo-brasa" },
  { slug: "cafe-del-valle", nombre: "Café del Valle", especialidad: "Cafetería", dish: "cafe" },
  { slug: "sabor-criollo", nombre: "Sabor Criollo", especialidad: "Comida criolla", dish: "lomo-saltado" },
];

const OTRAS = ["chifas", "pizzerías", "hamburgueserías", "juguerías", "pastelerías"] as const;

export function Demos() {
  return (
    <section id="demos" className="bg-papel py-[var(--section-y)]" aria-labelledby="demos-titulo">
      <div className="container-sb">
        <div className="max-w-3xl">
          <p className="eyebrow text-petroleo">Restaurantes de demostración</p>
          <h2 id="demos-titulo" className="mt-3 text-[clamp(2rem,4.2vw,3.5rem)] font-extrabold leading-tight tracking-[-0.04em]">
            Mira cómo se adapta a cada negocio.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-tinta-suave">
            Explora menús de ejemplo con distintos productos y categorías. Son demostraciones, no negocios reales.
          </p>
        </div>

        <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4">
          {DEMOS.map((demo) => (
            <li key={demo.slug}>
              <Link
                href={`/r/${demo.slug}`}
                className="group block h-full overflow-hidden rounded-2xl border border-petroleo/10 bg-blanco shadow-[0_6px_18px_rgba(32,35,33,0.05)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-petroleo/20 hover:shadow-[0_16px_32px_rgba(32,35,33,0.12)]"
              >
                <div className="relative aspect-square overflow-hidden bg-[radial-gradient(circle_at_50%_30%,#fff9ed_0%,#f1dfbb_100%)] p-2.5 sm:p-3">
                  <DishPhoto
                    slug={demo.dish}
                    sizes="(min-width:1024px) 22vw, (min-width:640px) 44vw, 90vw"
                    shape="tile"
                    fit="contain"
                    surfaceClassName="rounded-xl bg-blanco"
                    className="transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-petroleo/10 px-2.5 py-1 text-[0.58rem] font-extrabold uppercase tracking-[0.1em] text-petroleo">Menú demo</span>
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-coral text-base font-extrabold text-tinta shadow-sm transition-transform group-hover:rotate-45">
                      ↗
                    </span>
                  </div>
                  <p className="mt-4 text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-petroleo">{demo.especialidad}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <h3 className="font-extrabold leading-snug">{demo.nombre}</h3>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-petroleo">
                    Explorar menú <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                  </span>
                  <span className="sr-only">Ver menú de demostración</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm leading-relaxed text-tinta-suave">
          También funciona para {OTRAS.join(", ")} y otros negocios gastronómicos.
        </p>
      </div>
    </section>
  );
}
