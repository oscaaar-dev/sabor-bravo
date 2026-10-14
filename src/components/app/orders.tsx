import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

const STYLE: Record<OrderStatus, string> = {
  pending: "badge-coral",
  confirmed: "",
  preparing: "",
  ready: "badge-petroleo",
  completed: "badge-gris",
  cancelled: "badge-gris line-through",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}
