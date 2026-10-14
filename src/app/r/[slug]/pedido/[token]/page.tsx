import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/app/AutoRefresh";
import { StatusBadge } from "@/components/app/orders";
import { getDb } from "@/server/db";
import { getPublicOrder } from "@/server/domain/orders";
import { formatPEN } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABEL, TYPE_LABEL, type OrderStatus } from "@/lib/order-status";

export const metadata: Metadata = { title: "Estado de tu pedido", robots: { index: false } };

interface PageProps {
  params: Promise<{ slug: string; token: string }>;
}

const FLOW: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "completed"];

export default async function PedidoPublicoPage({ params }: PageProps) {
  const { slug, token } = await params;
  const order = await getPublicOrder(getDb(), slug, token);
  if (!order) notFound();
  const closed = order.status === "completed" || order.status === "cancelled";
  const step = FLOW.indexOf(order.status);

  return (
    <div className="min-h-svh bg-arena px-4 py-8">
      <div className="mx-auto max-w-xl space-y-6">
        <header>
          <p className="font-bold">{order.businessName}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-4xl">
            <span className="h-display">Pedido #{order.number}</span>
            <StatusBadge status={order.status} />
          </h1>
          <p className="mt-1 text-sm text-tinta-suave">
            {TYPE_LABEL[order.orderType]} · {formatDateTime(order.createdAt)}
          </p>
        </header>

        {order.status === "cancelled" ? (
          <p className="alert alert-error">El restaurante canceló este pedido. Si tienes dudas, comunícate directamente con el local.</p>
        ) : (
          <ol className="panel-brutal space-y-2 p-5" aria-label="Progreso del pedido">
            {FLOW.map((s, i) => (
              <li key={s} className={`flex items-center gap-3 ${i <= step ? "font-extrabold" : "text-tinta-suave"}`} aria-current={i === step ? "step" : undefined}>
                <span className={`grid size-7 place-items-center border-[3px] border-tinta text-sm ${i < step ? "bg-petroleo text-blanco" : i === step ? "bg-coral" : "bg-blanco"}`}>{i < step ? "✓" : i + 1}</span>
                {STATUS_LABEL[s]}
              </li>
            ))}
          </ol>
        )}

        <section className="panel-brutal p-5" aria-labelledby="items">
          <h2 id="items" className="field-label">
            Tu pedido
          </h2>
          <ul className="divide-y-2 divide-tinta/15">
            {order.items.map((i, n) => (
              <li key={n} className="flex justify-between gap-3 py-2">
                <span>
                  <strong>{i.quantity} ×</strong> {i.name}
                </span>
                <span className="font-bold">{formatPEN(i.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          {order.deliveryFeeCents > 0 ? (
            <p className="mt-2 flex justify-between">
              <span>Delivery</span>
              <span>{formatPEN(order.deliveryFeeCents)}</span>
            </p>
          ) : null}
          <p className="mt-2 flex justify-between border-t-[3px] border-tinta pt-2 text-2xl font-extrabold">
            <span>Total</span>
            <span data-testid="public-total">{formatPEN(order.totalCents)}</span>
          </p>
        </section>

        {!closed ? <AutoRefresh intervalMs={8000} label="Estado actualizado" /> : null}
        <Link href={`/r/${slug}`} className="btn-brutal btn-blanco">
          ← Volver a la carta
        </Link>
        <p className="text-xs text-tinta-suave">Guarda esta página: es tu enlace para seguir el estado de tu pedido.</p>
      </div>
    </div>
  );
}
