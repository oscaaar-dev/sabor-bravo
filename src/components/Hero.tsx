import Image from "next/image";
import Link from "next/link";
import { Montserrat } from "next/font/google";
import { SIGNUP_HREF } from "@/content/nav";
import { DishPhoto } from "@/components/DishPhoto";
import { TornEdge } from "@/components/graphics";

const heroFont = Montserrat({
  weight: "900",
  style: "italic",
  subsets: ["latin"],
  display: "swap",
});

const SAMPLE_ORDERS = [
  { id: "#124", channel: "Mesa 06", detail: "2 platos · hace 1 min", status: "En cocina", tone: "bg-arena text-tinta" },
  { id: "#125", channel: "Recojo", detail: "Pedido confirmado", status: "Nuevo pedido", tone: "bg-coral/20 text-tinta" },
  { id: "#126", channel: "Delivery", detail: "3 platos · pago al recibir", status: "Listo", tone: "bg-petroleo/10 text-petroleo" },
] as const;

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-papel" aria-labelledby="hero-titulo">
      <div className="pointer-events-none absolute left-0 top-0 -z-10 hidden aspect-[1672/941] w-[min(70vw,70rem,130vh)] xl:block">
        <Image
          src="/images/hero/fondo-hero.png"
          alt=""
          fill
          priority
          sizes="70vw"
          className="object-contain object-left-top"
          style={{ maskImage: "linear-gradient(to bottom, #000 0%, #000 38%, transparent 44%)" }}
        />
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[clamp(2rem,5vw,4.5rem)]">
        <TornEdge className="block size-full" />
      </div>

      <div className="container-sb relative z-10 mx-auto grid min-h-[100svh] max-w-[120rem] items-center gap-10 pb-20 pt-[calc(var(--nav-h)+2rem)] sm:gap-12 xl:grid-cols-12 xl:items-start xl:gap-8 xl:pb-16 xl:pt-[clamp(10.5rem,24vh,12.25rem)]">
        <div className="xl:col-span-7">
          <div className="relative max-w-[38rem] pb-3 pl-3 pt-5 sm:pl-4 sm:pt-7">
            <h1
              id="hero-titulo"
              className={`${heroFont.className} relative w-fit origin-bottom-left -rotate-[3deg] text-[clamp(1.65rem,8.8vw,3.25rem)] leading-[0.98] tracking-[-0.05em] sm:-rotate-[4deg] sm:text-[clamp(3.25rem,6.6vw,4.25rem)] xl:text-[clamp(3rem,4.2vw,4.5rem)]`}
            >
              <span className="block whitespace-nowrap">Tu restaurante</span>{" "}
              <span className="block whitespace-nowrap">evoluciona</span>{" "}
              <span className="block whitespace-nowrap">
                con un <span className="relative inline-block text-petroleo">
                  menú QR
                  <svg aria-hidden="true" viewBox="0 0 200 10" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 -bottom-[0.07em] h-[0.12em] w-full fill-petroleo/45">
                    <path d="M1 6 Q85 0 199 3 L196 6 Q92 5 2 10Z" />
                  </svg>
                </span>
              </span>{" "}
              <span className="relative block w-fit whitespace-nowrap text-petroleo">
                inteligente.
                <svg aria-hidden="true" viewBox="0 0 160 16" preserveAspectRatio="none" className="pointer-events-none absolute -bottom-[0.18em] right-[0.08em] h-[0.2em] w-[43%] fill-coral">
                  <path d="M1 7 Q70 1 159 2 L157 6 Q77 7 7 11Z M26 13 Q73 8 121 10 L118 13 Q71 12 26 16Z" />
                </svg>
              </span>
            </h1>
          </div>

          <p className="mt-5 max-w-[42rem] font-sans text-base leading-relaxed text-tinta-suave sm:text-lg">
            Unifica tus flujos de salón, recojo y delivery. Tu menú siempre actualizado y pedidos
            controlados desde una sola pantalla.
          </p>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-[auto_minmax(0,1fr)] xl:flex xl:flex-wrap xl:items-center">
            <Link href={SIGNUP_HREF} className="site-btn site-btn-primary w-full whitespace-nowrap sm:w-auto">
              Crear mi menú gratis <span aria-hidden="true">→</span>
            </Link>

            <form action={SIGNUP_HREF} method="get" className="flex min-w-0 w-full sm:min-w-[14rem] xl:w-auto xl:flex-1 xl:max-w-[16rem]">
              <label htmlFor="hero-email" className="sr-only">Ingresa tu correo para empezar</label>
              <input
                id="hero-email"
                className="min-h-12 min-w-0 flex-1 rounded-[0.65rem] border border-tinta/15 bg-blanco px-3 text-sm text-tinta outline-none placeholder:text-tinta-suave focus:border-petroleo focus:ring-2 focus:ring-petroleo/20"
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Ingresa tu email para empezar"
                required
              />
              <button type="submit" className="sr-only">Continuar con correo</button>
            </form>

            <a href="#demos" className="site-btn site-btn-secondary w-full whitespace-nowrap sm:col-span-2 xl:w-auto">
              Ver menús de ejemplo
            </a>
          </div>

          <div className="mt-6 border-t border-tinta/10 pt-4">
            <p className="text-xs font-semibold text-tinta-suave">Ideal para:</p>
            <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-tinta">
              <li>Pollerías</li>
              <li aria-hidden="true" className="text-coral">·</li>
              <li>Cevicherías</li>
              <li aria-hidden="true" className="text-coral">·</li>
              <li>Restaurantes</li>
            </ul>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl xl:col-span-5 xl:max-w-[36rem] xl:justify-self-end" aria-hidden="true">
          <div className="mb-4 flex items-center justify-center gap-4 xl:hidden">
            <div className="relative size-14"><DishPhoto slug="pollo-brasa" sizes="56px" /></div>
            <div className="relative size-[4.5rem]"><DishPhoto slug="ceviche" sizes="72px" /></div>
            <div className="relative size-14"><DishPhoto slug="lomo-saltado" sizes="56px" /></div>
          </div>

          <div className="absolute -left-[8.5rem] top-12 z-20 hidden size-28 xl:block">
            <DishPhoto slug="pollo-brasa" sizes="112px" className="drop-shadow-[0_10px_18px_rgba(32,35,33,0.18)]" />
          </div>
          <div className="absolute -top-16 right-[20%] z-20 hidden size-26 xl:block">
            <DishPhoto slug="ceviche" sizes="104px" className="drop-shadow-[0_10px_18px_rgba(32,35,33,0.18)]" />
          </div>
          <div className="absolute -left-[7rem] top-44 z-20 hidden size-20 xl:block">
            <DishPhoto slug="lomo-saltado" sizes="80px" className="drop-shadow-[0_10px_18px_rgba(32,35,33,0.18)]" />
          </div>

          <div className="relative z-10 rounded-[1.5rem] border border-black/70 bg-[#191a19] p-2 shadow-[0_22px_42px_rgba(32,35,33,0.24)] sm:rounded-[1.9rem] sm:p-2.5">
            <div className="relative rounded-[1.1rem] bg-blanco p-4 sm:rounded-[1.4rem] sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-tinta/10 pb-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Image
                    src="/images/brands/sabor-bravo-icono.png"
                    alt=""
                    width={48}
                    height={48}
                    className="size-9 shrink-0 object-contain"
                    priority
                  />
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-tinta-suave">Panel de pedidos</p>
                    <p className="mt-0.5 truncate text-sm font-extrabold">Servicio de hoy</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-petroleo/10 px-2.5 py-1 text-[0.68rem] font-bold text-petroleo sm:text-xs">
                  <span className="size-1.5 rounded-full bg-petroleo" />
                  Activo
                </span>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-tinta-suave">Pedidos activos</p>
                  <p className="mt-0.5 text-3xl font-extrabold leading-none tracking-tight">03</p>
                </div>
                <p className="pb-0.5 text-right text-xs font-semibold text-petroleo sm:text-sm">Cocina + salón en un lugar</p>
              </div>

              <div className="mt-3 space-y-2.5">
                {SAMPLE_ORDERS.map((order) => (
                  <div key={order.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1.5 rounded-xl border border-petroleo/10 bg-papel/55 px-3 py-2.5 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:gap-3">
                    <span className="text-xs font-extrabold text-tinta-suave">{order.id}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{order.channel}</p>
                      <p className="truncate text-[0.7rem] leading-tight text-tinta-suave">{order.detail}</p>
                    </div>
                    <span className={`col-start-2 justify-self-start rounded-full px-2.5 py-1 text-center text-[0.65rem] font-bold leading-tight sm:col-start-auto sm:justify-self-auto ${order.tone}`}>
                      {order.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2 border-t border-tinta/10 pt-3 text-[0.7rem] font-semibold leading-snug text-tinta-suave">
                <span className="size-2 shrink-0 rounded-full bg-coral" />
                La cocina y el salón comparten el mismo estado
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
