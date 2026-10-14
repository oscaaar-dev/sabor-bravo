const FAQS = [
  {
    q: "¿Necesito saber programar?",
    a: "No. La carta, los precios, las fotos y las promociones se administran desde un panel. Tú decides qué se publica.",
  },
  {
    q: "¿Cómo accede mi cliente a la carta?",
    a: "Con un código QR o con la dirección web de tu restaurante. Está pensada primero para el celular.",
  },
  {
    q: "¿Se pueden pagar los pedidos en línea?",
    a: "Por ahora no. El pedido llega a tu panel con su detalle y el cobro se acuerda con el cliente en el local o en la entrega.",
  },
  {
    q: "¿Qué tipos de pedido puedo atender?",
    a: "Consumo en mesa, recojo en local y delivery. Cada restaurante activa solo los que ofrece.",
  },
  {
    q: "¿Puedo usar WhatsApp?",
    a: "Está prevista como integración opcional. No reemplaza al sistema de pedidos: los pedidos siempre quedan registrados en el panel.",
  },
  {
    q: "¿Mis datos se mezclan con los de otros restaurantes?",
    a: "No deben. El aislamiento por restaurante es un requisito central del diseño y se comprobará con pruebas antes de abrir el servicio.",
  },
] as const;

export function Faq() {
  return (
    <section id="faq" className="bg-blanco py-[var(--section-y)]" aria-labelledby="faq-titulo">
      <div className="container-sb grid gap-10 lg:grid-cols-12">
        <h2 id="faq-titulo" className="text-[clamp(2.2rem,4.6vw,4rem)] lg:col-span-4">
          <span className="h-display block">Preguntas</span>
          <span className="h-script block -rotate-2 text-[1.3em] text-petroleo">frecuentes</span>
        </h2>

        <div className="lg:col-span-8">
          {FAQS.map((f) => (
            <details key={f.q} className="group border-t-[3px] border-tinta last:border-b-[3px]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-extrabold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center border-[3px] border-tinta bg-coral text-xl leading-none transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-2xl pb-5 text-tinta-suave">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
