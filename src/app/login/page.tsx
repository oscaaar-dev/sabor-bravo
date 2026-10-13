import type { Metadata } from "next";
import { StubPage } from "@/components/StubPage";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <StubPage title="Iniciar sesión" script="pronto">
      <p>El acceso con cuenta se implementa en la Fase 2 (autenticación y roles).</p>
      <p>Esta página no recoge ni envía credenciales todavía.</p>
    </StubPage>
  );
}
