import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/app/AutoRefresh";
import { StatusBadge } from "@/components/app/orders";
import { StatusButtons } from "@/components/app/StatusButtons";
import { requireBusiness } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { getOrderDetail } from "@/server/domain/orders";
import { formatPEN } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { isOrderStatus, STATUS_LABEL, TRANSITIONS, TYPE_LABEL, type OrderStatus, type OrderType } from "@/lib/order-status";

export const metadata: Metadata = { title: "Detalle del pedido", robots: { index: false } };

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function PedidoDetallePage({ params }: PageProps) {
  const { slug, id } = await params;
  const { business, role } = await requireBusiness(slug, "orders.read");
  const detail = await getOrderDetail(getDb(), business.id, id);
  if (!detail) notFound();
  const { order, items, events } = detail;
  const status = order.status as OrderStatus;
  const type = order.orderType as OrderType;
  const allowed = can(role, "orders.update") && isOrderStatus(status) ? [...TRANSITIONS[status]] : [];

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/${slug}/pedidos`} className="inline-block font-bold underline decoration-coral decoration-[3px] underline-offset-4">
        ← Volver a pedidos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex flex-wrap items-center gap-4 text-4xl">
          <span className="h-display">Pedido #{order.number}</span>
          <StatusBadge status={status} />
        </h1>
        <AutoRefresh intervalMs={10000} />
      </div>

      <section className="panel-brutal p-5" aria-labelledby="acciones">
        <h2 id="acciones" className="field-label">
          Acciones
        </h2>
        <StatusButtons slug={slug} orderId={order.id} allowed={allowed} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="panel-brutal p-5" aria-labelledby="detalle">
          <h2 id="detalle" className="field-label">
            Productos
          </h2>
          <ul className="divide-y-2 divide-tinta/15">
            {items.map((i) => (
              <li key={i.id} className="flex items-baseline justify-between gap-4 py-3">
                <span>
                  <strong>{i.quantity} ×</strong> {i.productName}
                  <span className="block text-sm text-tinta-suave">{formatPEN(i.unitPriceCents)} c/u</span>
                </span>
                <span className="font-bold">{formatPEN(i.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t-[3px] border-tinta pt-3">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatPEN(order.subtotalCents)}</dd>
            </div>
            {order.deliveryFeeCents > 0 ? (
              <div className="flex justify-between">
                <dt>Delivery</dt>
                <dd>{formatPEN(order.deliveryFeeCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-2xl font-extrabold">
              <dt>Total</dt>
              <dd data-testid="order-total">{formatPEN(order.totalCents)}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          <section className="panel-brutal p-5" aria-labelledby="cliente">
            <h2 id="cliente" className="field-label">
              Cliente y entrega
            </h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-tinta-suave">Modalidad</dt>
                <dd className="font-bold">
                  {TYPE_LABEL[type]}
                  {type === "dine_in" && order.tableLabel ? ` · mesa ${order.tableLabel}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-tinta-suave">Nombre</dt>
                <dd className="font-bold">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-sm text-tinta-suave">Teléfono</dt>
                <dd className="font-bold">
                  <a href={`tel:${order.customerPhone.replace(/[^0-9+]/g, "")}`} className="underline decoration-coral decoration-2 underline-offset-2">
                    {order.customerPhone}
                  </a>
                </dd>
              </div>
              {order.deliveryAddress ? (
                <div>
                  <dt className="text-sm text-tinta-suave">Dirección de entrega</dt>
                  <dd className="font-bold">{order.deliveryAddress}</dd>
                </div>
              ) : null}
              {order.notes ? (
                <div>
                  <dt className="text-sm text-tinta-suave">Notas del cliente</dt>
                  <dd className="font-bold">{order.notes}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-sm text-tinta-suave">Recibido</dt>
                <dd>{formatDateTime(order.createdAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="panel-brutal p-5" aria-labelledby="historial">
            <h2 id="historial" className="field-label">
              Historial
            </h2>
            <ol className="space-y-2 text-sm">
              {events.map((e, i) => (
                <li key={i}>
                  <strong>{STATUS_LABEL[e.toStatus as OrderStatus] ?? e.toStatus}</strong> · {formatDateTime(e.createdAt)}
                  <span className="block text-tinta-suave">{e.actorName ? `por ${e.actorName}` : "el cliente envió el pedido"}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
