import Link from "next/link";
import { SIGNUP_HREF } from "@/content/nav";

export function FinalCta() {
  return (
    <section className="bg-arena py-[var(--section-y)]" aria-labelledby="cta-titulo">
      <div className="container-sb flex flex-col items-start gap-6 rounded-2xl bg-petroleo p-6 text-blanco sm:p-10 lg:flex-row lg:items-center lg:justify-between lg:p-12">
        <div className="max-w-2xl">
          <p className="eyebrow text-coral-claro">Sabor Bravo</p>
          <h2 id="cta-titulo" className="mt-3 text-[clamp(2rem,4vw,3.5rem)] font-extrabold leading-tight tracking-[-0.04em]">
            Dale orden a cada pedido.
          </h2>
          <p className="mt-3 max-w-xl leading-relaxed text-blanco/80">
            Crea tu menú, compártelo con un QR y coordina el servicio desde un solo panel.
          </p>
        </div>
        <Link href={SIGNUP_HREF} className="site-btn site-btn-primary shrink-0">
          Crear mi menú digital <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
