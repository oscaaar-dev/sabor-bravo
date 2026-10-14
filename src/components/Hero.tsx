import Image from "next/image";
import Link from "next/link";
import { DishLabel } from "@/components/DishLabel";
import { DishPhoto } from "@/components/DishPhoto";
import { TornEdge } from "@/components/graphics";
import { SIGNUP_HREF } from "@/content/nav";

/**
 * En panorámico el titular se alinea con el borde izquierdo de la llama del logo del fondo
 * (≈5 % del ancho del fondo mostrado, que es min(ancho, alto × 1,777)).
 */
const COL_LEFT = "wide:max-w-[46%] wide:!mx-0 wide:!pl-[calc(min(100vw,177.7svh)*0.05)] wide:!pr-4";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-papel" aria-labelledby="hero-titulo">
      {/*
        Fondo oficial LIMPIO (ver scripts/build-hero-bg.mjs): solo el logo con su pincelada y la
        marca de agua. Solo en panorámico, donde el logo impreso hace de logo del hero. `contain`
        anclado arriba a la izquierda: nunca se recorta y el resto es papel del mismo color.
        En pantallas apiladas la barra ya lleva el logo, así que el fondo se omite.
      */}
      <div className="absolute inset-0 -z-10 hidden wide:block">
        <Image
          src="/images/hero/fondo-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-contain object-[0%_0%]"
        />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-[120rem] flex-col pt-[calc(var(--nav-h)+1.75rem)] wide:block wide:min-h-[100svh] wide:pt-[calc(var(--d)*0.34)] [--d:min(100svh,56.3vw)]">
        {/* Columna editorial: titular, una frase, un botón */}
        <div className={`container-sb relative z-20 ${COL_LEFT}`}>
          <h1
            id="hero-titulo"
            className="sb-rise font-hero text-[clamp(3.4rem,14.5vw,5.8rem)] font-bold leading-[0.92] [animation-delay:80ms] wide:text-[clamp(2.8rem,min(6.8vw,calc(var(--d)*0.11)),8.8rem)]"
          >
            <span className="block">Tu menú</span>
            <span className="relative -ml-1 block -rotate-2 text-[1.12em] text-rojo">tiene mucho</span>
            <span className="block">que decir</span>
          </h1>

          <p className="sb-rise mt-5 max-w-[34rem] font-hero text-[1.5rem] font-semibold leading-[1.12] [animation-delay:180ms] wide:mt-[calc(var(--d)*0.018)] wide:max-w-[34rem] wide:text-[clamp(1.25rem,calc(var(--d)*0.027),1.8rem)]">
            Carta digital con QR, pedidos de mesa, recojo o delivery y precios que cambias tú.
            Sin depender de un programador.
          </p>

          <div className="sb-rise mt-7 flex flex-col gap-4 [animation-delay:260ms] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3 wide:mt-[calc(var(--d)*0.015)] wide:gap-x-[calc(var(--d)*0.03)] wide:gap-y-2 wide:flex-wrap">
            <Link href={SIGNUP_HREF} className="btn-brutal btn-rojo btn-rojo-vivo !font-hero !text-[clamp(1.3rem,calc(var(--d)*0.03),1.75rem)] !font-bold whitespace-nowrap">
              Crear mi menú digital
              <span aria-hidden="true">→</span>
            </Link>
            <a
              href="#demos"
              className="font-hero text-[1.5rem] font-bold underline decoration-rojo wide:text-[clamp(1.15rem,calc(var(--d)*0.027),1.5rem)] whitespace-nowrap decoration-[3px] underline-offset-[6px] hover:decoration-carbon"
            >
              Explorar una demostración
            </a>
          </div>
        </div>

        {/*
          Composición gastronómica: tres fotos en marco circular, SEPARADAS entre sí (ningún solape),
          en diagonal. Pollo a la brasa grande al centro; ceviche arriba a la derecha; lomo saltado
          abajo a la izquierda. El lema oficial ocupa el hueco libre de arriba a la izquierda.
          Medidas en % del ancho de la composición (alto = ancho / 1,1); las etiquetas escalan con
          ella (cqw). Su tamaño sale de la altura de la ventana: siempre cabe completa y por encima
          de la banda carbón.
        */}
        <div className="relative z-10 mx-auto mt-8 w-full max-w-[40rem] px-2 wide:absolute wide:bottom-[11.5%] wide:right-[3%] wide:z-30 wide:mt-0 wide:w-[min(50%,calc((100svh*0.86-5.25rem)*1.1))] wide:max-w-none wide:px-0">
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

        {/* Banda carbón rasgada: transición hacia la siguiente sección (sin texto) */}
        <div className="relative z-20 mt-auto wide:absolute wide:inset-x-0 wide:bottom-0 wide:mt-0 wide:flex wide:h-[10%] wide:flex-col">
          <TornEdge className="block h-[clamp(2rem,5vw,4.5rem)] w-full" />
          <div className="h-10 bg-carbon wide:h-auto wide:flex-1" />
        </div>
      </div>
    </section>
  );
}
