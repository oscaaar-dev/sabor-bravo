export const ORDER_STATUSES = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TYPES = ["dine_in", "pickup", "delivery"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "En preparación",
  ready: "Listo",
  completed: "Completado",
  cancelled: "Cancelado",
};

export const TYPE_LABEL: Record<OrderType, string> = {
  dine_in: "En mesa",
  pickup: "Recojo",
  delivery: "Delivery",
};

/**
 * Máquina de estados del pedido: SOLO estas transiciones son válidas (se comprueba en el servidor, dentro de una
 * transacción con el pedido bloqueado). Completado y cancelado son finales.
 */
export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Estados que cuentan como venta en los informes (no incluye pendientes, cancelados ni en curso sin cerrar). */
export const REVENUE_STATUSES: readonly OrderStatus[] = ["completed"];
