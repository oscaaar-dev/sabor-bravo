const FLOW = [
  {
    role: "01 · CONFIGURA",
    title: "Arma tu menú",
    text: "Organiza categorías, platos, precios y las modalidades de atención de tu local.",
  },
  {
    role: "02 · COMPARTE",
    title: "Publica tu QR",
    text: "Tus clientes abren el menú desde el celular y envían el pedido que necesitan.",
  },
  {
    role: "03 · SIGUE",
    title: "Coordina el servicio",
    text: "El pedido llega al panel y el equipo actualiza su avance hasta completarlo.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-petroleo py-[var(--section-y)] text-blanco" aria-labelledby="como-titulo">
      <div className="container-sb">
        <div className="grid gap-5 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="eyebrow text-coral-claro">Cómo funciona</p>
            <h2 id="como-titulo" className="mt-3 text-[clamp(2rem,4.2vw,3.5rem)] font-extrabold leading-tight tracking-[-0.04em]">
              De tu menú al servicio, en tres pasos.
            </h2>
          </div>
          <p className="max-w-lg leading-relaxed text-blanco/80 lg:col-span-4">
            Una herramienta para que el cliente pida con claridad y el equipo atienda con orden.
          </p>
        </div>

        <ol className="mt-9 grid gap-3 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3">
          {FLOW.map((step) => (
            <li key={step.role} className="flex min-h-56 flex-col rounded-xl border border-blanco/15 bg-white/5 p-5 sm:p-6">
              <p className="text-xs font-extrabold tracking-[0.12em] text-coral-claro">{step.role}</p>
              <h3 className="mt-5 text-xl font-extrabold leading-snug sm:text-2xl">{step.title}</h3>
              <p className="mt-3 leading-relaxed text-blanco/80">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
