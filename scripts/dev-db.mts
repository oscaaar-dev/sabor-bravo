/**
 * Base de datos de DESARROLLO local: PostgreSQL real embebido, con datos persistentes en .data/pg (ignorado por git).
 * No es Supabase. Úsala para trabajar y probar sin servicios externos:
 *
 *   npm run db:dev      → deja el servidor corriendo en el puerto 54329, aplica las migraciones e imprime DATABASE_URL
 *
 * Después, en otra terminal: `npm run dev`. Detén la base con Ctrl+C.
 */
import path from "node:path";
import postgres from "postgres";
import { migrate } from "../src/server/db/migrate";
import { startPostgres } from "../test/helpers/embedded";

const PORT = Number(process.env.DEV_PG_PORT ?? 54329);
const dataDir = path.resolve(process.cwd(), ".data", "pg");

const pg = await startPostgres({ port: PORT, dataDir });
const root = postgres(pg.adminUrl, { max: 1, onnotice: () => {} });
const exists = await root`select 1 from pg_database where datname = 'sabor'`;
if (exists.length === 0) await root.unsafe("create database sabor");
await root.end();

const url = `postgres://postgres:postgres@127.0.0.1:${PORT}/sabor`;
const applied = await migrate(url);
console.log(`Migraciones aplicadas ahora: ${applied.join(", ") || "(ninguna: ya estaba al día)"}`);
console.log(`DATABASE_URL=${url}`);
console.log("Postgres de desarrollo listo. Ctrl+C para detenerlo.");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
