import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/app/ui";

export const metadata: Metadata = { title: "Página no encontrada", robots: { index: false } };

/** 404 real: la dirección no existe, el restaurante no existe o no está publicado. */
export default function NotFound() {
  return (
    <AuthShell title="No encontrado" script="¡se quemó!">
      <p className="text-tinta-suave">La página que buscas no existe, cambió de dirección o el restaurante ya no tiene su carta publicada.</p>
      <Link href="/" className="btn-brutal btn-petroleo mt-6">
        Volver al inicio
      </Link>
    </AuthShell>
  );
}
