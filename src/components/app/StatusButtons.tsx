"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeOrderStatusAction } from "@/app/actions/orders";
import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

const ACTION_LABEL: Record<OrderStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmar pedido",
  preparing: "Empezar a preparar",
  ready: "Marcar como listo",
  completed: "Marcar como completado",
  cancelled: "Cancelar pedido",
};

interface StatusButtonsProps {
  slug: string;
  orderId: string;
  /** Solo las transiciones válidas desde el estado actual (el servidor las vuelve a comprobar). */
  allowed: OrderStatus[];
}

export function StatusButtons({ slug, orderId, allowed }: StatusButtonsProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const change = (to: OrderStatus) =>
    start(async () => {
      setError(null);
      const r = await changeOrderStatusAction(slug, orderId, to);
      if (!r.ok) setError(r.message ?? "No se pudo cambiar el estado.");
      setConfirmCancel(false);
      router.refresh();
    });

  if (allowed.length === 0) return <p className="font-bold">Este pedido está cerrado: ya no admite cambios de estado.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {allowed
          .filter((s) => s !== "cancelled")
          .map((s) => (
            <button key={s} type="button" disabled={pending} onClick={() => change(s)} className="btn-brutal btn-coral" data-status-action={s}>
              {ACTION_LABEL[s]}
            </button>
          ))}
        {allowed.includes("cancelled") ? (
          confirmCancel ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="font-bold">¿Cancelar este pedido?</span>
              <button type="button" disabled={pending} onClick={() => change("cancelled")} className="btn-brutal btn-petroleo btn-sm" data-status-action="cancelled-confirm">
                Sí, cancelar
              </button>
              <button type="button" onClick={() => setConfirmCancel(false)} className="btn-brutal btn-blanco btn-sm">
                No
              </button>
            </span>
          ) : (
            <button type="button" disabled={pending} onClick={() => setConfirmCancel(true)} className="btn-brutal btn-blanco" data-status-action="cancelled">
              {STATUS_LABEL.cancelled}
            </button>
          )
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
