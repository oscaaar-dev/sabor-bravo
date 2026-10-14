import { BrushUnderline } from "@/components/graphics";

const STEPS = [
  {
    n: "1",
    title: "Crea tu cuenta",
    text: "Registra tu restaurante: nombre, logo, horarios, contacto y los tipos de pedido que atiendes.",
  },
  {
    n: "2",
    title: "Arma tu carta",
    text: "Categorías, productos con foto, variantes y extras. Cambia precios o pausa platos cuando quieras.",
  },
  {
    n: "3",
    title: "Comparte tu QR",
    text: "Tus clientes piden desde el celular y tú ves cada pedido en el panel, con su estado.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-coral py-[var(--section-y)] text-tinta" aria-labelledby="como-titulo">
      <div className="container-sb">
        <h2 id="como-titulo" className="max-w-3xl text-[clamp(2.2rem,5vw,4.4rem)]">
          <span className="h-display">Del menú al primer pedido</span>
          <span className="relative ml-3 inline-block">
            <span className="h-script text-[1.2em]">en tres pasos</span>
            <BrushUnderline className="absolute -bottom-2 left-0 h-3 w-full" fill="var(--color-petroleo)" />
          </span>
        </h2>

        <ol className="mt-14 grid gap-10 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className={`relative border-t-[3px] border-tinta pt-5 ${
                i === 1 ? "md:mt-10" : i === 2 ? "md:mt-20" : ""
              }`}
            >
              <span aria-hidden="true" className="h-script block text-[7rem] leading-[0.8] text-tinta">
                {s.n}
              </span>
              <h3 className="mt-3 text-2xl font-extrabold">{s.title}</h3>
              <p className="mt-2 max-w-sm font-bold">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
