import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegistroPage() {
  return (
    <StubPage title="Crear cuenta" script="muy pronto">
      <p>El registro de restaurantes se implementa en la Fase 2 (autenticación y roles).</p>
      <p>Esta página no recoge ni envía datos todavía.</p>
    </StubPage>
  );
}
