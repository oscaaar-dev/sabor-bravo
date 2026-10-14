import QRCode from "qrcode";
import { getCurrentUser } from "@/server/auth/current";
import { getDb } from "@/server/db";
import { getBusinessAccess } from "@/server/domain/businesses";
import { siteUrl } from "@/server/site-url";

/**
 * Código QR del restaurante (PNG o SVG) apuntando a su carta pública real. Solo para miembros del restaurante:
 *   GET /dashboard/<slug>/qr/image?format=png|svg[&download=1]
 */
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("No autorizado", { status: 401, headers: { "Cache-Control": "no-store" } });
  const access = await getBusinessAccess(getDb(), user.id, slug);
  if (!access) return new Response("No encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

  const params = new URL(request.url).searchParams;
  const format = params.get("format") === "svg" ? "svg" : "png";
  const download = params.get("download") === "1";
  const target = `${await siteUrl()}/r/${access.business.slug}`;
  const options = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#202321", light: "#FFFFFF" } };
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": download ? `attachment; filename="qr-${access.business.slug}.${format}"` : "inline",
  };

  if (format === "svg") {
    const svg = await QRCode.toString(target, { ...options, type: "svg" });
    return new Response(svg, { headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" } });
  }
  const png = await QRCode.toBuffer(target, { ...options, type: "png", width: 1024 });
  return new Response(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
}
