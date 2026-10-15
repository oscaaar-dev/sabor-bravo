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
          <h2 id="planes-titulo" className="text-[clamp(2rem,4.2vw,3.5rem)] font-extrabold leading-tight tracking-[-0.04em]">
            Planes para cada tamaño
          </h2>

          <fieldset className="min-w-0 max-w-full">
            <legend className="eyebrow mb-2">Mercado y moneda</legend>
            <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-tinta/10 bg-blanco p-1">
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
                  <span className="flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-bold text-tinta-suave transition-colors peer-checked:bg-petroleo peer-checked:text-blanco peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-petroleo">
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
              className={`flex flex-col rounded-2xl border p-6 ${
                p.featured ? "border-petroleo bg-petroleo/[0.04]" : "border-tinta/10 bg-blanco"
              }`}
            >
              <h3 className="text-2xl font-extrabold">{p.name}</h3>
              <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                <span data-testid={`precio-${p.id}`} className="h-display text-[clamp(2.4rem,4vw,3.2rem)]">
                  {formatPlanPrice(market, p.id)}
                </span>
                <span className="font-semibold text-tinta-suave">al mes</span>
              </p>
              <p className="mt-2 text-tinta-suave">{p.para}</p>
              <ul className="mt-5 flex-1 space-y-2 font-bold">
                {p.items.map((it) => (
                  <li key={it} className="flex items-start gap-2">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-petroleo" />
                    {it}
                  </li>
                ))}
              </ul>
              <Link href={SIGNUP_HREF} className={`site-btn mt-7 w-full ${p.featured ? "site-btn-primary" : "site-btn-secondary"}`}>
                Empezar con {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
