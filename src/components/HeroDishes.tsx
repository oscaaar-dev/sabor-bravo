import Image from "next/image";
import { DishLabel } from "@/components/DishLabel";
import { DishPhoto, hasDishPhoto } from "@/components/DishPhoto";
import { DISHES, type DishSlug } from "@/content/dishes";

/**
 * Composición de platos del hero.
 *
 * - Con las SEIS fotos disponibles: composición de seis círculos con tres disposiciones (celular, tablet/"modo PC"
 *   y panorámico), calculadas para que ningún círculo ni etiqueta se toque (ver docs/ASSETS.md).
 * - Si falta alguna foto: composición clásica de tres círculos, para no mostrar reservas "Foto pendiente" en la portada.
 *   Al añadir las fotos que faltan (npm run assets:dishes) el cambio es automático.
 */

/** Platos de la composición de seis, en orden de lectura. */
const SIX: readonly DishSlug[] = ["pollo-brasa", "ceviche", "lomo-saltado", "arroz-chaufa", "postre", "cafe"];

/** Posición de un plato en una disposición: centro y diámetro del círculo y centro de su etiqueta, en % del ancho de la caja. */
interface Spot {
  readonly cx: number;
  readonly cy: number;
  readonly d: number;
  readonly lx: number;
  readonly ly: number;
}
type Layout = "s" | "m" | "w";
/** Proporción ancho/alto de la caja en cada disposición. */
const ASPECT: Record<Layout, number> = { s: 0.72, m: 1.55, w: 1.1 };

/**
 * s = celular (< 640 px), m = tablet y "modo PC" (≥ 640 px apilado), w = panorámico (hero con fondo del logo).
 * Valores obtenidos con un optimizador (máximo tamaño sin solapes entre círculos, etiquetas y lema); se verifican en
 * navegador a 320, 360, 390, 768, 820, 980, 1100, 1280, 1366, 1440 y 1920 px.
 */
const SPOTS: Record<DishSlug, Record<Layout, Spot> | undefined> = {
  "pollo-brasa": {
    s: { cx: 70.6, cy: 70.2, d: 57.6, lx: 79.1, ly: 94.1 },
    m: { cx: 52.3, cy: 43.9, d: 40.1, lx: 44.3, ly: 59.6 },
    w: { cx: 52.2, cy: 53.5, d: 45.5, lx: 48.9, ly: 73.2 },
  },
  ceviche: {
    s: { cx: 69.2, cy: 19.8, d: 38.4, lx: 59.4, ly: 33.6 },
    m: { cx: 85.9, cy: 16.1, d: 26.7, lx: 83.7, ly: 27.6 },
    w: { cx: 84.2, cy: 20.5, d: 30.3, lx: 85.4, ly: 33.7 },
  },
  "lomo-saltado": {
    s: { cx: 20.8, cy: 82.7, d: 40.3, lx: 32.0, ly: 96.5 },
    m: { cx: 15.4, cy: 47.8, d: 28.0, lx: 14.3, ly: 60.0 },
    w: { cx: 16.6, cy: 73.8, d: 31.8, lx: 26.5, ly: 83.7 },
  },
  cafe: {
    s: { cx: 74.2, cy: 119.0, d: 34.6, lx: 85.9, ly: 128.8 },
    m: { cx: 12.6, cy: 18.4, d: 24.0, lx: 12.8, ly: 28.9 },
    w: { cx: 15.3, cy: 38.1, d: 27.3, lx: 14.6, ly: 50.1 },
  },
  "arroz-chaufa": {
    s: { cx: 19.9, cy: 37.1, d: 36.5, lx: 22.1, ly: 53.0 },
    m: { cx: 86.7, cy: 49.5, d: 25.4, lx: 83.3, ly: 60.1 },
    w: { cx: 84.9, cy: 75.6, d: 28.8, lx: 75.8, ly: 84.4 },
  },
  postre: {
    s: { cx: 34.8, cy: 120.9, d: 34.6, lx: 45.1, ly: 132.1 },
    m: { cx: 38.2, cy: 12.6, d: 24.0, lx: 47.8, ly: 17.1 },
    w: { cx: 53.9, cy: 14.3, d: 27.3, lx: 59.3, ly: 25.0 },
  },
  "chicha-morada": undefined,
  pizza: undefined,
};

const pct = (n: number) => `${+n.toFixed(2)}%`;

/** Variables CSS de un plato: `--s-l`, `--s-t`, `--s-w` (círculo) y `--s-ll`, `--s-lt` (etiqueta), igual para `m` y `w`. */
function spotVars(slug: DishSlug): React.CSSProperties {
  const spots = SPOTS[slug];
  const vars: Record<string, string> = {};
  if (!spots) return vars;
  for (const k of ["s", "m", "w"] as const) {
    const { cx, cy, d, lx, ly } = spots[k];
    const a = ASPECT[k]; // el alto de la caja es 100/a, así que un % vertical = (valor · a)
    vars[`--${k}-l`] = pct(cx - d / 2);
    vars[`--${k}-t`] = pct((cy - d / 2) * a);
    vars[`--${k}-w`] = pct(d);
    vars[`--${k}-ll`] = pct(lx);
    vars[`--${k}-lt`] = pct(ly * a);
  }
  return vars;
}

/** `sizes` de next/image para un plato de la composición de seis. */
function sizesFor(slug: DishSlug): string {
  const s = SPOTS[slug];
  if (!s) return "30vw";
  return `(min-width:1024px) ${Math.round(s.w.d * 0.5)}vw, (min-width:640px) ${Math.round(s.m.d * 8.3)}px, ${Math.round(s.s.d)}vw`;
}

const WRAP = "relative z-10 mx-auto mb-8 mt-8 w-full px-2 wide:mb-0 wide:absolute wide:bottom-[11.5%] wide:right-[3%] wide:z-30 wide:mt-0 wide:w-[min(50%,calc((100svh*0.86-5.25rem)*1.1))] wide:max-w-none wide:px-0";

export function HeroDishes() {
  const full = SIX.every(hasDishPhoto);
  return full ? <HeroSix /> : <HeroClassic />;
}

function HeroSix() {
  return (
    <div className={`${WRAP} max-w-[40rem] sm:max-w-[52rem]`}>
      <div className="@container relative aspect-[0.72/1] w-full sm:aspect-[1.55/1] wide:aspect-[1.1/1]">
        <Image
          data-kind="tagline"
          src="/images/hero/lema-buena-comida.png"
          alt="Buena comida, mejores momentos."
          width={280}
          height={150}
          sizes="20vw"
          className="absolute left-0 top-0 hidden w-[38%] wide:block"
        />

        {SIX.map((slug, i) => (
          <div
            key={slug}
            data-kind="plate"
            style={spotVars(slug)}
            className="absolute aspect-square left-(--s-l) top-(--s-t) w-(--s-w) sm:left-(--m-l) sm:top-(--m-t) sm:w-(--m-w) wide:left-(--w-l) wide:top-(--w-t) wide:w-(--w-w)"
          >
            <DishPhoto slug={slug} sizes={sizesFor(slug)} priority={i < 3} />
          </div>
        ))}

        {SIX.map((slug) => (
          <DishLabel
            key={slug}
            style={spotVars(slug)}
            className="left-(--s-ll) top-(--s-lt) -translate-x-1/2 -translate-y-1/2 sm:left-(--m-ll) sm:top-(--m-lt) wide:left-(--w-ll) wide:top-(--w-lt)"
            textClass="text-[max(0.72rem,4.3cqw)] sm:text-[max(0.72rem,2.6cqw)] wide:text-[max(0.72rem,3.1cqw)]"
          >
            {DISHES[slug].label}
          </DishLabel>
        ))}
      </div>
    </div>
  );
}

/*
  Composición clásica de tres círculos, SEPARADOS entre sí (ningún solape), en diagonal. Pollo a la brasa grande al
  centro; ceviche arriba a la derecha; lomo saltado abajo a la izquierda. El lema oficial ocupa el hueco libre de
  arriba a la izquierda. Medidas en % del ancho de la composición (alto = ancho / 1,1); las etiquetas escalan con ella
  (cqw). Su tamaño sale de la altura de la ventana: siempre cabe completa y por encima de la banda petróleo.
*/
function HeroClassic() {
  return (
    <div className={`${WRAP} max-w-[40rem]`}>
      <div className="@container relative aspect-[1.1/1] w-full">
        <Image
          data-kind="tagline"
          src="/images/hero/lema-buena-comida.png"
          alt="Buena comida, mejores momentos."
          width={280}
          height={150}
          sizes="22vw"
          className="absolute left-0 top-0 hidden w-[46%] wide:block"
        />

        <div data-kind="plate" className="absolute left-[70%] top-0 aspect-square w-[30%]">
          <DishPhoto slug="ceviche" sizes="(min-width:1024px) 16vw, 30vw" priority />
        </div>
        <div data-kind="plate" className="absolute left-[29%] top-[30.8%] aspect-square w-[48%]">
          <DishPhoto slug="pollo-brasa" sizes="(min-width:1024px) 26vw, 48vw" priority />
        </div>
        <div data-kind="plate" className="absolute left-0 top-[64.9%] aspect-square w-[32%]">
          <DishPhoto slug="lomo-saltado" sizes="(min-width:1024px) 17vw, 32vw" priority />
        </div>

        <DishLabel className="right-0 top-[22.5%]">Ceviche peruano</DishLabel>
        <DishLabel className="left-[62%] top-[72.6%]">Pollo a la brasa</DishLabel>
        <DishLabel className="left-[12%] top-[88%]">Lomo saltado</DishLabel>
      </div>
    </div>
  );
}
