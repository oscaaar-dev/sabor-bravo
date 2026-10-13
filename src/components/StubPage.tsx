import Image from "next/image";
import Link from "next/link";

interface StubPageProps {
  title: string;
  script: string;
  children: React.ReactNode;
}

/** Página provisoria de una ruta que existe en la estructura pero aún no está implementada. */
export function StubPage({ title, script, children }: StubPageProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-papel px-4 py-16">
      <div className="panel-brutal w-full max-w-xl p-8">
        <Link href="/" aria-label="Volver al inicio de Sabor Bravo">
          <Image
            src="/images/brands/sabor-bravo-compacto.png"
            alt="Sabor Bravo"
            width={118}
            height={56}
            className="h-14 w-auto"
          />
        </Link>
        <p className="sticker mt-6 bg-naranja">En construcción</p>
        <h1 className="mt-4 text-4xl">
          <span className="h-display block">{title}</span>
          <span className="h-script block -rotate-2 text-[1.2em] text-rojo">{script}</span>
        </h1>
        <div className="mt-5 space-y-3 text-carbon-suave">{children}</div>
        <Link href="/" className="btn-brutal btn-carbon mt-8">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
