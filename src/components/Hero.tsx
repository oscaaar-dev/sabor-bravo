import Image from "next/image";
import Link from "next/link";
import { DishPhoto } from "@/components/DishPhoto";
import { TornEdge } from "@/components/graphics";
import { SIGNUP_HREF } from "@/content/nav";

/** Alinea el contenido del hero con el contenedor de 90rem en pantallas anchas. */
const COL_LEFT =
  "wide:max-w-[46%] wide:!mx-0 xl:pl-[max(var(--gutter),calc((100vw-90rem)/2+var(--gutter)))]";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-papel" aria-labelledby="hero-titulo">
      {/*
        Fondo oficial. En panorámico ocupa todo el hero (el logo impreso arriba a la izquierda
        es el logo del hero). En apilado se amplía y se ancla abajo a la derecha: así no se repite
        el logo ni se corta un lema a medias.
      */}
      <div className="absolute inset-x-0 bottom-0 -z-10 h-[62%] overflow-hidden wide:inset-0 wide:h-full">
        <Image
          src="/images/hero/fondo-sabor-bravo.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="origin-bottom-right scale-[1.35] object-cover object-[100%_100%] wide:origin-center wide:scale-100 wide:object-[0%_0%]"
        />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-[120rem] flex-col pt-[calc(var(--nav-h)+1.75rem)] wide:block wide:min-h-[max(100svh,56.3vw)] wide:pt-[calc(max(100svh,56.3vw)*0.265)]">
        {/* Columna editorial: titular, una frase, un botón */}
        <div className={`container-sb relative z-20 ${COL_LEFT}`}>
          <h1
            id="hero-titulo"
            className="sb-rise text-[clamp(2.7rem,11.5vw,4.6rem)] [animation-delay:80ms] wide:text-[clamp(2.8rem,min(5.3vw,7.6svh),6.6rem)]"
          >
            <span className="h-display block">Tu menú</span>
            <span className="h-script relative -ml-1 block -rotate-3 py-[0.04em] text-[1.18em] text-rojo">
              tiene mucho
            </span>
            <span className="h-display block">que decir</span>
          </h1>

          <p className="sb-rise mt-6 max-w-[34rem] text-[1.0625rem] leading-relaxed [animation-delay:180ms] wide:mt-4 wide:max-w-[34rem] wide:text-[clamp(1rem,1.2vw,1.15rem)]">
            Carta digital con QR, pedidos de mesa, recojo o delivery y precios que cambias tú.
            Sin depender de un programador.
          </p>

          <div className="sb-rise mt-7 flex flex-col gap-4 [animation-delay:260ms] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3 wide:mt-5">
            <Link href={SIGNUP_HREF} className="btn-brutal btn-rojo btn-rojo-vivo !text-[1.2rem]">
              Crear mi menú digital
              <span aria-hidden="true">→</span>
            </Link>
            <a
              href="#demos"
              className="text-base font-extrabold underline decoration-rojo decoration-[3px] underline-offset-[6px] hover:decoration-carbon"
            >
              Explorar una demostración
            </a>
          </div>
        </div>

        {/*
          Composición gastronómica: una diagonal de tres platos. El principal (pollo a la brasa) va
          al centro y al frente; el ceviche cierra arriba a la derecha y el lomo saltado abajo a la
          izquierda. Sin formas de fondo: el peso lo llevan los platos y su sombra dura.
        */}
        <div className="relative z-10 mx-auto mt-8 w-full max-w-[40rem] px-2 wide:absolute wide:bottom-[1%] wide:right-[2%] wide:z-30 wide:mt-0 wide:w-[min(52%,calc(100svh*0.98))] wide:max-w-none wide:px-0">
          <div className="relative aspect-[1.1/1] w-full">
            <div className="absolute left-[58%] top-[0%] z-10 aspect-square w-[40%]">
              <DishPhoto slug="ceviche" sizes="(min-width:1024px) 22vw, 40vw" priority />
            </div>
            <div className="absolute left-[0%] top-[52%] z-20 aspect-square w-[40%]">
              <DishPhoto slug="lomo-saltado" sizes="(min-width:1024px) 22vw, 40vw" priority />
            </div>
            <div className="absolute left-[20%] top-[18%] z-30 aspect-square w-[60%]">
              <DishPhoto slug="pollo-brasa" sizes="(min-width:1024px) 32vw, 60vw" priority />
            </div>
          </div>
        </div>

        {/* Banda carbón rasgada: transición hacia la siguiente sección (sin texto) */}
        <div className="relative z-20 mt-auto wide:absolute wide:inset-x-0 wide:bottom-0 wide:mt-0 wide:flex wide:h-[25.5%] wide:flex-col">
          <TornEdge className="block h-[clamp(2rem,5vw,4.5rem)] w-full" />
          <div className="h-10 bg-carbon wide:h-auto wide:flex-1" />
        </div>
      </div>
    </section>
  );
}
