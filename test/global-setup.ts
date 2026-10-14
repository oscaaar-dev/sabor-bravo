import postgres from "postgres";
import type { TestProject } from "vitest/node";
import { migrate } from "../src/server/db/migrate";
import { startPostgres } from "./helpers/embedded";

declare module "vitest" {
  export interface ProvidedContext {
    pgPort: number;
  }
}

const PORT = 54391;

/**
 * Arranca UN PostgreSQL real, prepara la base plantilla `sb_template` (con todas las migraciones aplicadas) y la
 * comparte con las pruebas. Cada archivo de prueba clona la plantilla en su propia base: aislados y en paralelo.
 */
export default async function setup(project: TestProject) {
  const pg = await startPostgres({ port: PORT });
  const admin = postgres(pg.adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe("create database sb_template");
  await admin.end();
  await migrate(`postgres://postgres:postgres@127.0.0.1:${PORT}/sb_template`);
  project.provide("pgPort", PORT);
  return async () => {
    await pg.stop();
  };
}
