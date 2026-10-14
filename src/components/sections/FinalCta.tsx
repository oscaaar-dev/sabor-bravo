import Link from "next/link";
import { SIGNUP_HREF } from "@/content/nav";

export function FinalCta() {
  return (
    <section className="bg-petroleo py-[var(--section-y)] text-blanco" aria-labelledby="cta-titulo">
      <div className="container-sb flex flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
        <h2 id="cta-titulo" className="text-[clamp(2.4rem,6vw,5.4rem)]">
          <span className="h-display block">Que tu carta</span>
          <span className="h-script block -rotate-2 text-[1.25em]">empiece a hablar</span>
        </h2>
        <Link href={SIGNUP_HREF} className="btn-brutal btn-blanco !text-[1.2rem]">
          Crear mi menú digital
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
