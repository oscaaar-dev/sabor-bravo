import Image from "next/image";
import Link from "next/link";
import { DishPhoto } from "@/components/DishPhoto";
import { BrushSplash, Burst, HandArrow, TornEdge } from "@/components/graphics";
import { SIGNUP_HREF } from "@/content/nav";

const FEATURE_STRIP = [
  { title: "Menú con QR", text: "Tus clientes lo abren desde el celular" },
  { title: "Mesa, recojo o delivery", text: "Tú eliges qué atiendes" },
  { title: "Panel de pedidos", text: "Cada pedido con su estado" },
] as const;

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
          className="origin-bottom-right scale-[1.35] object-[100%_100%] wide:origin-center wide:scale-100 wide:object-[0%_0%]"
        />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-[120rem] flex-col pt-[calc(var(--nav-h)+1.75rem)] wide:block wide:min-h-[max(100svh,56.3vw)] wide:pt-[calc(max(100svh,56.3vw)*0.235)]">
        {/* Columna editorial */}
        <div className={`container-sb relative z-20 ${COL_LEFT}`}>
          <p className="sb-rise sticker -rotate-2 bg-rojo !text-[0.66rem] text-crema sm:!text-[0.8rem] [animation-delay:60ms]">
            Plataforma digital para restaurantes
          </p>

          <h1
            id="hero-titulo"
            className="sb-rise mt-4 text-[clamp(2.7rem,11.5vw,4.6rem)] [animation-delay:140ms] wide:text-[clamp(2.8rem,min(5.3vw,7.6svh),6.6rem)]"
          >
            <span className="h-display block">Tu menú</span>
            <span className="h-script relative -ml-1 block -rotate-3 py-[0.04em] text-[1.18em] text-rojo">
              tiene mucho
            </span>
            <span className="h-display block">que decir</span>
          </h1>

          <p className="sb-rise mt-6 max-w-[34rem] text-[1.0625rem] leading-relaxed [animation-delay:220ms] wide:mt-4 wide:max-w-[34rem] wide:text-[clamp(1rem,1.2vw,1.15rem)]">
            Carta digital con QR, pedidos de mesa, recojo o delivery y precios que cambias tú.
            Sin depender de un programador.
          </p>

          <div className="sb-rise mt-7 flex flex-col gap-4 [animation-delay:300ms] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3 wide:mt-5">
            <Link href={SIGNUP_HREF} className="btn-brutal btn-rojo !text-[1.2rem]">
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

        {/* Composición gastronómica */}
        <div className="relative z-10 mx-auto mt-8 w-full max-w-[40rem] px-2 wide:absolute wide:bottom-[1%] wide:right-[-1%] wide:z-30 wide:mt-0 wide:w-[min(52%,calc(100svh*0.98))] wide:max-w-none wide:px-0">
          <div className="relative aspect-[1.1/1] w-full">
            <BrushSplash className="absolute inset-[-4%_-6%_0_-4%] h-[104%] w-[110%]" />

            {/* Anotación */}
            <p className="h-script absolute left-[14%] top-[-3%] z-30 w-[34%] -rotate-6 text-[clamp(1rem,2.2vw,1.9rem)] leading-[1.05]">
              Deliciosos platos, más clientes
            </p>
            <HandArrow className="absolute left-[40%] top-[3%] z-30 h-[9%] w-auto" />
            <Burst className="absolute left-[2%] top-[18%] z-30 h-[11%] w-auto" />

            {/* Platos: cada contenedor define el tamaño; DishPhoto rellena */}
            <div className="absolute left-[50%] top-[2%] z-10 aspect-square w-[47%]">
              <DishPhoto slug="ceviche" sizes="(min-width:1024px) 28vw, 50vw" priority />
            </div>
            <div className="absolute left-[7%] top-[20%] z-20 aspect-square w-[56%]">
              <DishPhoto slug="pollo-brasa" sizes="(min-width:1024px) 32vw, 58vw" priority />
            </div>
            <div className="absolute left-[80%] top-[24%] z-20 aspect-[3/5] w-[18%]">
              <DishPhoto slug="chicha-morada" sizes="(min-width:1024px) 11vw, 18vw" priority />
            </div>
            <div className="absolute left-[46%] top-[44%] z-30 aspect-square w-[50%]">
              <DishPhoto slug="lomo-saltado" sizes="(min-width:1024px) 29vw, 52vw" priority />
            </div>

            {/* Sticker */}
            <p className="h-script absolute bottom-[2%] right-[-1%] z-40 max-w-[44%] -rotate-[11deg] border-[3px] border-carbon bg-rojo px-4 py-3 text-center text-[clamp(0.95rem,1.9vw,1.55rem)] leading-[1.1] text-crema shadow-brutal-sm">
              Cualquier antojo, en un solo lugar
            </p>
          </div>
        </div>

        {/* Banda carbón rasgada: transición hacia la siguiente sección */}
        <div className="relative z-20 mt-auto wide:absolute wide:inset-x-0 wide:bottom-0 wide:mt-0 wide:flex wide:h-[25.5%] wide:flex-col">
          <TornEdge className="block h-[clamp(2rem,5vw,4.5rem)] w-full" />
          <div className="relative overflow-hidden bg-carbon pb-8 pt-2 text-crema wide:flex-1 wide:pt-5">
            <span
              aria-hidden="true"
              className="ghost-word absolute -bottom-[0.18em] -left-[0.04em] text-[clamp(6rem,17vw,15rem)] text-crema/[0.07]"
            >
              Sabor Bravo
            </span>
            <ul className={`container-sb relative grid gap-5 sm:grid-cols-3 ${COL_LEFT}`}>
              {FEATURE_STRIP.map((f) => (
                <li key={f.title} className="border-l-[3px] border-naranja pl-3">
                  <p className="text-[0.95rem] font-extrabold leading-tight">{f.title}</p>
                  <p className="mt-0.5 text-[0.8rem] leading-snug text-crema/80">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
