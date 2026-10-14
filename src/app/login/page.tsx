import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/app/ui";
import { LoginForm } from "@/components/app/AuthForms";
import { getCurrentUser } from "@/server/auth/current";
import { GOOGLE_ERRORS } from "@/server/auth/oauth/flow";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Iniciar sesión", robots: { index: false } };

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, error } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next));
  return (
    <AuthShell title="Bienvenido" script="de vuelta">
      <LoginForm next={safeNext(next)} notice={error ? GOOGLE_ERRORS[error] : undefined} />
    </AuthShell>
  );
}
