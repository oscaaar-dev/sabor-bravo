import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
/** Cliente de transacción de Drizzle: acepta lo mismo que `Db` para consultas. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Crea una conexión nueva (tests, scripts). En la aplicación usa `getDb()`. */
export function createDb(url: string, opts: { max?: number } = {}): { db: Db; close: () => Promise<void> } {
  // `prepare: false` es obligatorio con el pooler en modo transacción de Supabase (pgbouncer).
  // Bases remotas (Supabase): TLS obligatorio. En local (localhost / 127.0.0.1) no hace falta.
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  const client = postgres(url, { max: opts.max ?? 5, prepare: false, idle_timeout: 20, connect_timeout: 15, ssl: local ? false : "require", onnotice: () => {} });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}

const globalForDb = globalThis as unknown as { __sbDb?: { db: Db; url: string } };

/** Conexión compartida de la aplicación (se reutiliza entre recargas en desarrollo y entre invocaciones calientes). */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL. Copia .env.example a .env.local y arranca la base local con `npm run db:dev`.");
  }
  if (!globalForDb.__sbDb || globalForDb.__sbDb.url !== url) {
    // En serverless cada instancia abre pocas conexiones: el pooler de Supabase multiplexa.
    globalForDb.__sbDb = { db: createDb(url, { max: process.env.NODE_ENV === "production" ? 3 : 5 }).db, url };
  }
  return globalForDb.__sbDb.db;
}

export * from "./schema";
