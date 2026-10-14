import type { Metadata } from "next";
import { AddMemberForm } from "@/components/app/TeamForms";
import { DeleteButton } from "@/components/app/CartaForms";
import { SubmitButton } from "@/components/app/SubmitButton";
import { changeMemberRoleAction, removeMemberAction } from "@/app/actions/team";
import { requireBusiness } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { listMembers } from "@/server/domain/team";
import { formatDate } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/permissions";

export const metadata: Metadata = { title: "Equipo", robots: { index: false } };

export default async function EquipoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { business, user } = await requireBusiness(slug, "team.manage");
  const members = await listMembers(getDb(), business.id);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-4xl">
          <span className="h-display">Equipo</span>
        </h1>
        <p className="mt-2 text-tinta-suave">
          <strong>Administrador:</strong> carta, pedidos, informes y ajustes. <strong>Personal:</strong> solo ver y atender pedidos. Solo el propietario gestiona el equipo. Los permisos se comprueban en el servidor en cada acción.
        </p>
      </div>

      <section className="panel-brutal p-5" aria-labelledby="miembros">
        <h2 id="miembros" className="field-label">
          Personas con acceso ({members.length})
        </h2>
        <ul className="divide-y-2 divide-tinta/15">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 py-3" data-member={m.email}>
              <div className="min-w-0">
                <p className="font-extrabold">
                  {m.name} {m.userId === user.id ? <span className="badge badge-gris">Tú</span> : null}
                </p>
                <p className="text-sm text-tinta-suave">
                  {m.email} · desde {formatDate(m.createdAt)}
                </p>
              </div>
              {m.role === "owner" ? (
                <span className="badge badge-petroleo">{ROLE_LABEL.owner}</span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge">{ROLE_LABEL[m.role]}</span>
                  <form action={changeMemberRoleAction.bind(null, slug, m.userId, m.role === "admin" ? "staff" : "admin")}>
                    <SubmitButton pendingText="…" className="btn-brutal btn-blanco btn-sm">
                      Cambiar a {m.role === "admin" ? "personal" : "administrador"}
                    </SubmitButton>
                  </form>
                  <DeleteButton action={removeMemberAction.bind(null, slug, m.userId)} label="Quitar" question="¿Quitar del equipo?" />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-brutal p-5" aria-labelledby="nuevo">
        <h2 id="nuevo" className="field-label">
          Añadir a alguien
        </h2>
        <AddMemberForm slug={slug} />
      </section>
    </div>
  );
}
