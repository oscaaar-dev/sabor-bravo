import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/app/ui";
import { LinkGoogleForm } from "@/components/app/AuthForms";
import { OAUTH_LINK_COOKIE, readFlowCookie } from "@/server/auth/oauth/flow";
import { getDb } from "@/server/db";
import { getPendingLink } from "@/server/domain/oauth";

export const metadata: Metadata = { title: "Vincular Google", robots: { index: false } };

/** Solo se llega aquí desde el callback de Google, con una cookie de enlace pendiente (10 min, un solo uso). */
export default async function VincularPage() {
  const token = await readFlowCookie(OAUTH_LINK_COOKIE);
  const pending = token ? await getPendingLink(getDb(), token) : null;
  if (!pending) redirect("/login?error=google_estado");
  return (
    <AuthShell title="Vincula tu cuenta" script="con Google">
      <LinkGoogleForm email={pending.email} />
    </AuthShell>
  );
}
