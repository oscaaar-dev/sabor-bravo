import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Panel", robots: { index: false } };

export default function DashboardPage() {
  return (
    <StubPage title="Panel del restaurante" script="en camino">
      <p>
        Pedidos, productos, categorías, promociones, sucursales, informes, ajustes y equipo
        (/dashboard/…).
      </p>
      <p>
        Esta ruta todavía NO está protegida: no contiene datos. La autenticación y la comprobación
        de permisos en el servidor llegan en la Fase 2, antes de añadir cualquier dato.
      </p>
    </StubPage>
  );
}
