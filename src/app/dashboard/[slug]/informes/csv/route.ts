import { getCurrentUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { getBusinessAccess } from "@/server/domain/businesses";
import { exportItems, exportOrders } from "@/server/domain/reports";
import { toCsv } from "@/lib/csv";
import { parseRange } from "@/lib/dates";
import { can } from "@/lib/permissions";

/**
 * Exportación CSV de pedidos o de líneas de pedido (contiene datos de clientes): exige sesión, pertenencia al restaurante
 * Y el permiso `reports.read` (propietario o administrador; el personal recibe 403).
 *   GET /dashboard/<slug>/informes/csv?tipo=pedidos|productos&desde=AAAA-MM-DD&hasta=AAAA-MM-DD
 */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const noStore = { "Cache-Control": "private, no-store" };
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401, headers: noStore });
  const db = getDb();
  const access = await getBusinessAccess(db, user.id, slug);
  if (!access) return new Response("No encontrado", { status: 404, headers: noStore });
  if (!can(access.role, "reports.read")) return new Response("No tienes permiso para exportar informes", { status: 403, headers: noStore });

  const q = new URL(request.url).searchParams;
  const range = parseRange(q.get("desde") ?? undefined, q.get("hasta") ?? undefined);
  const tipo = q.get("tipo") === "productos" ? "productos" : "pedidos";
  const data = tipo === "productos" ? await exportItems(db, access.business.id, range) : await exportOrders(db, access.business.id, range);

  return new Response(toCsv(data.header, data.rows), {
    headers: {
      ...noStore,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${access.business.slug}-${tipo}-${range.desde}_${range.hasta}.csv"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
