import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

export const MIGRATIONS_DIR = path.resolve(process.cwd(), "db", "migrations");

/** ¿La URL apunta a este mismo equipo? (las migraciones solo se ejecutan aquí salvo orden expresa). */
export function isLocalDatabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Aplica en orden las migraciones SQL de db/migrations, registrando cada una en `schema_migrations`.
 * Cada migración corre en su propia transacción. Devuelve los nombres de las que se aplicaron ahora.
 */
export async function migrate(url: string): Promise<string[]> {
  const sql = postgres(url, { max: 1, prepare: false, ssl: isLocalDatabaseUrl(url) ? false : "require", onnotice: () => {} });
  const applied: string[] = [];
  try {
    await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name));
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const body = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into schema_migrations (name) values (${file})`;
      });
      applied.push(file);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  return applied;
}
