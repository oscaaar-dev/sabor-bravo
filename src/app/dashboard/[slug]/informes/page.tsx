import type { Metadata } from "next";
import { Alert } from "@/components/app/ui";
import { requireBusiness } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { salesReport } from "@/server/domain/reports";
import { addDays, limaDay, parseRange } from "@/lib/dates";
import { formatPEN } from "@/lib/money";
import { TYPE_LABEL } from "@/lib/order-status";

export const metadata: Metadata = { title: "Informes", robots: { index: false } };

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}

export default async function InformesPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const { business } = await requireBusiness(slug, "reports.read");
  const range = parseRange(sp.desde, sp.hasta);
  const r = await salesReport(getDb(), business.id, range);
  const maxDay = Math.max(1, ...r.byDay.map((d) => d.revenueCents));
  const today = limaDay(new Date());
  const qs = `desde=${range.desde}&hasta=${range.hasta}`;
  const presets = [
    { label: "Hoy", desde: today, hasta: today },
    { label: "Últimos 7 días", desde: addDays(today, -6), hasta: today },
    { label: "Últimos 30 días", desde: addDays(today, -29), hasta: today },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl">
          <span className="h-display">Informes</span>
        </h1>
        <p className="mt-2 text-tinta-suave">Calculados con tus pedidos guardados. Las ventas cuentan solo los pedidos <strong>completados</strong>, según su fecha de recepción (hora de Lima).</p>
      </div>

      {range.corrected ? <Alert kind="error">El rango de fechas no era válido (máximo 1 año, «desde» antes de «hasta»). Se muestran los últimos 30 días.</Alert> : null}

      <form method="get" className="panel-brutal flex flex-wrap items-end gap-4 p-4" aria-label="Rango de fechas">
        <div>
          <label htmlFor="desde" className="field-label">
            Desde
          </label>
          <input id="desde" name="desde" type="date" defaultValue={range.desde} className="input" />
        </div>
        <div>
          <label htmlFor="hasta" className="field-label">
            Hasta
          </label>
          <input id="hasta" name="hasta" type="date" defaultValue={range.hasta} className="input" />
        </div>
        <button type="submit" className="btn-brutal btn-petroleo">
          Ver informe
        </button>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <a key={p.label} href={`?desde=${p.desde}&hasta=${p.hasta}`} className="tab">
              {p.label}
            </a>
          ))}
        </div>
      </form>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ventas" value={formatPEN(r.revenueCents)} testid="stat-revenue" />
        <Stat label="Pedidos completados" value={String(r.completedCount)} testid="stat-completed" />
        <Stat label="Ticket promedio" value={formatPEN(r.avgTicketCents)} testid="stat-avg" />
        <Stat label="Cancelados" value={String(r.cancelledCount)} testid="stat-cancelled" />
      </section>
      <p className="text-sm text-tinta-suave">
        En curso (aún sin cerrar): {r.openCount} pedidos · Descontado por promociones: {formatPEN(r.discountCents)}
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="panel-brutal p-5" aria-labelledby="por-dia">
          <h2 id="por-dia" className="field-label">
            Ventas por día
          </h2>
          {r.byDay.length === 0 ? (
            <p className="text-tinta-suave">No hay pedidos completados en este rango.</p>
          ) : (
            <ul className="space-y-2">
              {r.byDay.map((d) => (
                <li key={d.day} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
                  <span>{d.day}</span>
                  <span className="h-4 border-2 border-tinta bg-blanco" aria-hidden="true">
                    <span className="block h-full bg-petroleo" style={{ width: `${Math.max(2, Math.round((d.revenueCents / maxDay) * 100))}%` }} />
                  </span>
                  <span className="font-bold">
                    {formatPEN(d.revenueCents)} <span className="font-normal text-tinta-suave">({d.count})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-8">
          <section className="panel-brutal p-5" aria-labelledby="por-tipo">
            <h2 id="por-tipo" className="field-label">
              Por modalidad
            </h2>
            {r.byType.length === 0 ? (
              <p className="text-tinta-suave">Sin datos.</p>
            ) : (
              <table className="w-full text-left">
                <thead className="sr-only">
                  <tr>
                    <th>Modalidad</th>
                    <th>Pedidos</th>
                    <th>Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byType.map((t) => (
                    <tr key={t.type} className="border-b-2 border-tinta/15">
                      <td className="py-2 font-bold">{TYPE_LABEL[t.type]}</td>
                      <td className="py-2">{t.count} pedidos</td>
                      <td className="py-2 text-right font-bold">{formatPEN(t.revenueCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel-brutal p-5" aria-labelledby="top">
            <h2 id="top" className="field-label">
              Platos más vendidos
            </h2>
            {r.topProducts.length === 0 ? (
              <p className="text-tinta-suave">Sin datos.</p>
            ) : (
              <ol className="space-y-1">
                {r.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-baseline justify-between gap-3 border-b-2 border-tinta/15 py-1.5">
                    <span>
                      <strong>{i + 1}.</strong> {p.name}
                    </span>
                    <span className="text-right">
                      <strong>{p.quantity}</strong> u. · {formatPEN(p.revenueCents)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <section className="panel-brutal p-5" aria-labelledby="csv">
        <h2 id="csv" className="field-label">
          Exportar (CSV para Excel)
        </h2>
        <p className="mb-3 text-sm text-tinta-suave">Incluye todos los estados dentro del rango elegido. Los pedidos contienen datos de tus clientes (nombre, teléfono, dirección): trátalos con cuidado.</p>
        <div className="flex flex-wrap gap-3">
          <a href={`/dashboard/${slug}/informes/csv?tipo=pedidos&${qs}`} className="btn-brutal btn-coral" data-testid="csv-orders">
            Descargar pedidos
          </a>
          <a href={`/dashboard/${slug}/informes/csv?tipo=productos&${qs}`} className="btn-brutal btn-blanco" data-testid="csv-items">
            Descargar productos vendidos
          </a>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div className="panel-brutal p-4">
      <p className="field-label !mb-1">{label}</p>
      <p className="text-3xl font-extrabold" data-testid={testid}>
        {value}
      </p>
    </div>
  );
}
