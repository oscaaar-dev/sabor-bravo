import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/app/AutoRefresh";
import { StatusBadge } from "@/components/app/orders";
import { requireBusiness } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { countOrdersByStatus, listOrders } from "@/server/domain/orders";
import { formatPEN } from "@/lib/money";
import { formatDateTime, timeAgo } from "@/lib/format";
import { isOrderStatus, ORDER_STATUSES, STATUS_LABEL, TYPE_LABEL, type OrderStatus } from "@/lib/order-status";

export const metadata: Metadata = { title: "Pedidos", robots: { index: false } };

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ estado?: string }>;
}

export default async function PedidosPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { estado } = await searchParams;
  const { business } = await requireBusiness(slug, "orders.read");
  const filter: OrderStatus | undefined = estado && isOrderStatus(estado) ? estado : undefined;
  const db = getDb();
  const [counts, rows] = await Promise.all([countOrdersByStatus(db, business.id), listOrders(db, business.id, { status: filter, limit: 200 })]);
  const open = counts.pending + counts.confirmed + counts.preparing + counts.ready;
  const base = `/dashboard/${slug}/pedidos`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl">
          <span className="h-display">Pedidos</span>
        </h1>
        <AutoRefresh />
      </div>

      <p className="text-lg">
        <strong>{open}</strong> {open === 1 ? "pedido en curso" : "pedidos en curso"}
        {counts.pending > 0 ? (
          <>
            {" "}
            · <strong>{counts.pending}</strong> {counts.pending === 1 ? "esperando confirmación" : "esperando confirmación"}
          </>
        ) : null}
      </p>

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        <Link href={base} className="tab" aria-current={!filter ? "page" : undefined}>
          Todos
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={`${base}?estado=${s}`} className="tab" aria-current={filter === s ? "page" : undefined}>
            {STATUS_LABEL[s]} ({counts[s]})
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="panel-brutal p-8 text-center">
          <p className="text-xl font-extrabold">{filter ? `No hay pedidos «${STATUS_LABEL[filter]}»` : "Todavía no hay pedidos"}</p>
          {!filter ? (
            <p className="mt-2 text-tinta-suave">
              Cuando un cliente envíe un pedido desde tu carta aparecerá aquí.{" "}
              <Link href={`/r/${slug}`} target="_blank" className="font-bold underline decoration-coral decoration-2 underline-offset-2">
                Ver mi carta pública
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((o) => (
            <li key={o.id}>
              <Link
                href={`${base}/${o.id}`}
                className="panel-brutal grid items-center gap-x-4 gap-y-2 p-4 transition-transform hover:-translate-y-0.5 sm:grid-cols-[5rem_1fr_auto_auto]"
                data-order-number={o.number}
              >
                <span className="text-3xl font-extrabold">#{o.number}</span>
                <span className="min-w-0">
                  <span className="block truncate font-extrabold">{o.customerName}</span>
                  <span className="block text-sm text-tinta-suave">
                    {TYPE_LABEL[o.orderType]}
                    {o.orderType === "dine_in" && o.tableLabel ? ` · mesa ${o.tableLabel}` : ""} · {o.itemCount} {o.itemCount === 1 ? "producto" : "productos"} ·{" "}
                    <time dateTime={o.createdAt.toISOString()} title={formatDateTime(o.createdAt)}>
                      {timeAgo(o.createdAt)}
                    </time>
                  </span>
                </span>
                <span className="text-xl font-extrabold">{formatPEN(o.totalCents)}</span>
                <StatusBadge status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
