import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/app/DashShell";
import { requireUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listUserBusinesses, MAX_BUSINESSES_PER_USER } from "@/server/domain/businesses";
import { ROLE_LABEL } from "@/lib/permissions";

export const metadata: Metadata = { title: "Mi panel", robots: { index: false } };

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const list = await listUserBusinesses(getDb(), user.id);
  if (list.length === 0) redirect("/dashboard/nuevo");
  const ownedCount = list.filter((b) => b.role === "owner").length;

  return (
    <>
      <TopBar userName={user.name} />
      <main className="container-sb py-10">
        <h1 className="text-4xl">
          <span className="h-display">Tus restaurantes</span>
        </h1>
        <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <li key={b.id} className="panel-brutal p-5">
              <h2 className="text-2xl font-extrabold">{b.name}</h2>
              <p className="mt-1 flex flex-wrap gap-2">
                <span className="badge badge-gris">{ROLE_LABEL[b.role]}</span>
                <span className={`badge ${b.isPublished ? "badge-petroleo" : "badge-gris"}`}>{b.isPublished ? "Publicado" : "Oculto"}</span>
              </p>
              <p className="mt-1 text-sm text-tinta-suave">/r/{b.slug}</p>
              <Link href={`/dashboard/${b.slug}/pedidos`} className="btn-brutal btn-petroleo mt-5 w-full">
                Abrir panel
              </Link>
            </li>
          ))}
        </ul>
        {ownedCount < MAX_BUSINESSES_PER_USER ? (
          <Link href="/dashboard/nuevo" className="btn-brutal btn-blanco mt-8">
            + Crear otro restaurante
          </Link>
        ) : null}
      </main>
    </>
  );
}
