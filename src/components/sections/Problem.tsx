const ROWS = [
  {
    hoy: "Una carta en PDF que pesa, se ve diminuta en el celular y nadie termina de leer.",
    con: "Una carta que carga rápido, con fotos, precios y categorías pensadas para el pulgar.",
  },
  {
    hoy: "Precios que cambian en la cocina pero no en la carta impresa.",
    con: "Cambias un precio o pausas un plato agotado desde el panel, sin llamar a nadie.",
  },
  {
    hoy: "Pedidos que llegan por chats distintos y se pierden entre mensajes.",
    con: "Cada pedido en un solo lugar, con su detalle y su estado: de pendiente a completado.",
  },
] as const;

export function Problem() {
  return (
    <section className="bg-crema py-[var(--section-y)]" aria-labelledby="problema-titulo">
      <div className="container-sb grid gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <p className="eyebrow text-rojo-oscuro">El problema de casi toda carta</p>
          <h2
            id="problema-titulo"
            className="mt-4 text-[clamp(2.2rem,5.2vw,4.6rem)]"
          >
            <span className="h-display block">Tus platos</span>
            <span className="h-display block">merecen</span>
            <span className="h-script block -rotate-2 text-[1.3em] text-rojo">más que un PDF</span>
          </h2>
        </div>

        <ul className="lg:col-span-7">
          {ROWS.map((row, i) => (
            <li
              key={row.hoy}
              className={`grid gap-4 border-t-[3px] border-carbon py-7 sm:grid-cols-2 sm:gap-8 ${
                i === ROWS.length - 1 ? "border-b-[3px]" : ""
              }`}
            >
              <div>
                <p className="eyebrow text-carbon-suave">Hoy</p>
                <p className="mt-2 text-carbon-suave line-through decoration-rojo decoration-[3px]">
                  {row.hoy}
                </p>
              </div>
              <div>
                <p className="eyebrow text-rojo-oscuro">Con Sabor Bravo</p>
                <p className="mt-2 font-bold">{row.con}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
