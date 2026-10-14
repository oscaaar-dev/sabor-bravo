"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Renueva la página cada pocos segundos (solo si la pestaña está visible) para que los pedidos nuevos y los cambios de
 * estado aparezcan sin recargar. Es consulta periódica, no tiempo real: el desfase máximo es `intervalMs`.
 */
export function AutoRefresh({ intervalMs = 8000, label = "Actualizado" }: { intervalMs?: number; label?: string }) {
  const router = useRouter();
  const [last, setLast] = useState<string>("");

  useEffect(() => {
    const stamp = () => setLast(new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    stamp();
    const tick = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        stamp();
      }
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);

  return (
    <p className="text-sm text-tinta-suave" aria-live="off">
      {label}
      {last ? ` a las ${last}` : ""} · se renueva cada {Math.round(intervalMs / 1000)} s
    </p>
  );
}
