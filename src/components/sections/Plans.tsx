"use client";

import Link from "next/link";
import { useState } from "react";
import { SIGNUP_HREF } from "@/content/nav";
import { DEFAULT_MARKET, formatPlanPrice, MARKETS, PLANS, type MarketId } from "@/content/plans";

export function Plans() {
  // Perú por defecto: no se detecta la ubicación (no hay un mecanismo fiable); la elige la persona y el cambio es solo en el navegador.
  const [market, setMarket] = useState<MarketId>(DEFAULT_MARKET);
  const choose = (id: MarketId) => setMarket(id);

  const current = MARKETS.find((m) => m.id === market) ?? MARKETS[0]!;

  return (
    <section id="planes" className="bg-arena py-[var(--section-y)]" aria-labelledby="planes-titulo">
      <div className="container-sb">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 id="planes-titulo" className="text-[clamp(2.2rem,5vw,4.4rem)]">
            <span className="h-display">Planes para</span>{" "}
            <span className="h-script text-[1.2em] text-petroleo">cada tamaño</span>
          </h2>

          <fieldset className="min-w-0 max-w-full">
            <legend className="eyebrow mb-2">Mercado y moneda</legend>
            <div className="inline-flex max-w-full flex-wrap border-[3px] border-tinta bg-blanco shadow-brutal-sm">
              {MARKETS.map((m) => (
                <label key={m.id} className="relative flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="mercado"
                    value={m.id}
                    checked={market === m.id}
                    onChange={() => choose(m.id)}
                    data-testid={`mercado-${m.id}`}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-12 items-center justify-center gap-2 whitespace-nowrap px-4 text-sm font-extrabold peer-checked:bg-petroleo peer-checked:text-blanco peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:-outline-offset-[6px] peer-focus-visible:outline-coral">
                    <span aria-hidden="true">{m.flag}</span>
                    {m.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <p className="mt-4 max-w-xl">Precio mensual de cada plan. Elige tu mercado para ver el importe en soles o en dólares.</p>
        <p className="sr-only" role="status" aria-live="polite">
          {current.announce}
        </p>

        <ul className="mt-12 grid items-stretch gap-8 md:grid-cols-3">
          {PLANS.map((p) => (
            <li
              key={p.id}
              data-plan={p.id}
              className={`flex flex-col border-[3px] border-tinta p-6 ${
                p.featured ? "bg-petroleo text-blanco shadow-brutal-coral md:-mt-4 md:mb-4" : "bg-blanco shadow-brutal"
              }`}
            >
              <h3 className="h-script text-4xl">{p.name}</h3>
              <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                <span data-testid={`precio-${p.id}`} className="h-display text-[clamp(2.4rem,4vw,3.2rem)]">
                  {formatPlanPrice(market, p.id)}
                </span>
                <span className={`font-bold ${p.featured ? "text-blanco/80" : "text-tinta-suave"}`}>al mes</span>
              </p>
              <p className={`mt-2 ${p.featured ? "text-blanco/80" : "text-tinta-suave"}`}>{p.para}</p>
              <ul className="mt-5 flex-1 space-y-2 font-bold">
                {p.items.map((it) => (
                  <li key={it} className="flex gap-2">
                    <span aria-hidden="true" className={p.featured ? "text-coral-claro" : "text-petroleo"}>
                      ▸
                    </span>
                    {it}
                  </li>
                ))}
              </ul>
              <Link href={SIGNUP_HREF} className={`btn-brutal mt-7 ${p.featured ? "btn-blanco" : "btn-petroleo"}`}>
                Empezar con {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
