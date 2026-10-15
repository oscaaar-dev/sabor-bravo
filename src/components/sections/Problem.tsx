const ORDER_STEPS = [
  { number: "01", label: "Entra con contexto", detail: "Cada pedido llega con su modalidad: mesa, recojo o delivery." },
  { number: "02", label: "La cocina lo mueve", detail: "El equipo revisa el detalle y actualiza el avance desde el panel." },
  { number: "03", label: "Todos saben qué sigue", detail: "Salón y cocina ven el mismo estado hasta completar la entrega." },
] as const;

export function Problem() {
  return (
    <section className="bg-papel py-[var(--section-y)]" aria-labelledby="problema-titulo">
      <div className="container-sb">
        <div className="max-w-3xl">
          <p className="eyebrow text-petroleo">Del salón a la cocina</p>
          <h2 id="problema-titulo" className="mt-3 text-[clamp(2rem,4.2vw,3.5rem)] font-extrabold leading-tight tracking-[-0.04em]">
            Cada pedido encuentra su siguiente paso.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-tinta-suave">
            La modalidad y el estado acompañan el pedido desde que llega hasta que se entrega.
          </p>
        </div>

        <ol className="mt-10 grid gap-4 md:mt-12 md:grid-cols-3">
          {ORDER_STEPS.map((step) => (
            <li key={step.number} className="rounded-xl border border-tinta/10 bg-arena/70 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-petroleo text-sm font-extrabold text-blanco">
                  {step.number}
                </span>
                <div>
                  <h3 className="font-extrabold leading-snug">{step.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-tinta-suave">{step.detail}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
