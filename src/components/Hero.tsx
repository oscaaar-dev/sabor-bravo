import Image from "next/image";
import Link from "next/link";
import { TornEdge } from "@/components/graphics";
import { HeroDishes } from "@/components/HeroDishes";
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

      <div className="relative mx-auto flex min-h-[min(100svh,52rem)] w-full max-w-[120rem] flex-col pt-[calc(var(--nav-h)+1.75rem)] wide:block wide:min-h-[100svh] wide:pt-[calc(var(--d)*0.34)] [--d:min(100svh,56.3vw)]">
        {/* Columna editorial: titular, una frase, un botón */}
        <div className={`container-sb relative z-20 ${COL_LEFT}`}>
          <h1
            id="hero-titulo"
            className="sb-rise font-hero text-[clamp(3.4rem,14.5vw,5.8rem)] font-bold leading-[0.92] [animation-delay:80ms] wide:text-[clamp(2.8rem,min(7.2vw,calc(var(--d)*0.118)),9.4rem)]"
          >
            <span className="block">Tu menú</span>
            <span className="relative -ml-1 block -rotate-2 text-[1.12em] text-petroleo">tiene mucho</span>
            <span className="block">que decir</span>
          </h1>

          <p className="sb-rise mt-5 max-w-[34rem] font-hero text-[1.5rem] font-semibold leading-[1.12] sm:text-[1.7rem] [animation-delay:180ms] wide:mt-[calc(var(--d)*0.018)] wide:max-w-[34rem] wide:text-[clamp(1.25rem,calc(var(--d)*0.029),1.9rem)]">
            Carta digital con QR, pedidos de mesa, recojo o delivery y precios que cambias tú.
            Sin depender de un programador.
          </p>

          <div className="sb-rise mt-7 flex flex-col gap-4 [animation-delay:260ms] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3 wide:mt-[calc(var(--d)*0.015)] wide:gap-x-[calc(var(--d)*0.03)] wide:gap-y-2 wide:flex-wrap">
            <Link href={SIGNUP_HREF} className="btn-brutal btn-coral !font-hero !text-[clamp(1.3rem,calc(var(--d)*0.032),1.9rem)] !font-bold whitespace-nowrap">
              Crear mi menú digital
              <span aria-hidden="true">→</span>
            </Link>
            <a
              href="#demos"
              className="font-hero text-[1.5rem] font-bold underline decoration-coral wide:text-[clamp(1.15rem,calc(var(--d)*0.029),1.6rem)] whitespace-nowrap decoration-[3px] underline-offset-[6px] hover:decoration-petroleo"
            >
              Explorar una demostración
            </a>
          </div>
        </div>

        {/* Composición de platos: seis círculos (o tres si faltan fotos); ver HeroDishes.tsx */}
        <HeroDishes />

        {/* Banda petróleo rasgada: transición hacia la siguiente sección (sin texto) */}
        <div className="relative z-20 mt-auto wide:absolute wide:inset-x-0 wide:bottom-0 wide:mt-0 wide:flex wide:h-[10%] wide:flex-col">
          <TornEdge className="block h-[clamp(2rem,5vw,4.5rem)] w-full" />
          <div className="h-10 bg-petroleo wide:h-auto wide:flex-1" />
        </div>
      </div>
    </section>
  );
}
