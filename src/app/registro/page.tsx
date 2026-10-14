import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/app/ui";
import { RegisterForm } from "@/components/app/AuthForms";
import { getCurrentUser } from "@/server/auth/current";
import { GOOGLE_ERRORS } from "@/server/auth/oauth/flow";

export const metadata: Metadata = { title: "Crear cuenta", robots: { index: false } };

export default async function RegistroPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <AuthShell title="Crea tu cuenta" script="en un minuto">
      <p className="mb-5 text-tinta-suave">Después podrás crear tu restaurante, armar la carta y recibir pedidos.</p>
      <RegisterForm notice={error ? GOOGLE_ERRORS[error] : undefined} />
    </AuthShell>
  );
}
