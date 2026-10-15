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
    <section id="faq" className="bg-papel py-[var(--section-y)]" aria-labelledby="faq-titulo">
      <div className="container-sb grid gap-10 lg:grid-cols-12">
        <h2 id="faq-titulo" className="text-[clamp(2rem,4.2vw,3.5rem)] font-extrabold leading-tight tracking-[-0.04em] lg:col-span-4">
          Preguntas frecuentes
        </h2>

        <div className="lg:col-span-8">
          {FAQS.map((f) => (
            <details key={f.q} className="group border-t border-tinta/15 last:border-b">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-bold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden="true" className="shrink-0 text-xl font-normal text-petroleo transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-2xl pb-5 leading-relaxed text-tinta-suave">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
