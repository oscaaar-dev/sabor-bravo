/**
 * Comprobación de SOLO LECTURA de una base de datos: conecta, lista las tablas y las migraciones aplicadas y cuenta filas.
 * No modifica nada y nunca imprime la URL (lleva la contraseña): solo el servidor.
 *
 *   npm run db:check              → usa DATABASE_URL de .env.local (base local)
 *   npm run db:check:prod         → usa DATABASE_URL de .env.production.local (Supabase)
 */
import postgres from "postgres";
import { isLocalDatabaseUrl } from "../src/server/db/migrate";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "(URL no válida)";
  }
})();
const sql = postgres(url, { max: 1, prepare: false, ssl: isLocalDatabaseUrl(url) ? false : "require", connect_timeout: 20, onnotice: () => {} });
try {
  const [v] = await sql<{ version: string }[]>`select version()`;
  console.log(`Conectado a ${host}${isLocalDatabaseUrl(url) ? " (local)" : " (remota)"} · ${v?.version.split(",")[0]}`);
  const [enc] = await sql<{ e: string }[]>`select pg_encoding_to_char(encoding) as e from pg_database where datname = current_database()`;
  console.log(`Codificación: ${enc?.e}`);
  const migs = await sql<{ name: string }[]>`select name from schema_migrations order by name`.catch(() => []);
  console.log(`Migraciones aplicadas: ${migs.map((m) => m.name).join(", ") || "(ninguna)"}`);
  const tables = await sql<{ table_name: string }[]>`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`;
  for (const t of tables) {
    const [c] = await sql.unsafe<{ n: string }[]>(`select count(*)::text as n from "${t.table_name}"`);
    console.log(`  · ${t.table_name.padEnd(18)} ${c?.n} filas`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
