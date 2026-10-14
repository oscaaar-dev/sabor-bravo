const TZ = "America/Lima";

const dateTime = new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: TZ });
const timeOnly = new Intl.DateTimeFormat("es-PE", { timeStyle: "short", timeZone: TZ });
const dateOnly = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: TZ });

export const formatDateTime = (d: Date) => dateTime.format(d);
export const formatTime = (d: Date) => timeOnly.format(d);
export const formatDate = (d: Date) => dateOnly.format(d);

/** "hace 3 min", "hace 2 h"… para listas de pedidos recientes; pasado un día, la fecha. */
export function timeAgo(d: Date, now = new Date()): string {
  const sec = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (sec < 45) return "hace un momento";
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return dateTime.format(d);
}
