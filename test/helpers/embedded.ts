import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * PostgreSQL real (17.x) embebido, solo para pruebas y desarrollo local. Es un servidor de verdad
 * (varias conexiones, transacciones, restricciones), no una emulación.
 */
export interface RunningPg {
  readonly port: number;
  readonly adminUrl: string;
  stop(): Promise<void>;
}

export async function startPostgres(opts: { port: number; dataDir?: string }): Promise<RunningPg> {
  const persistent = Boolean(opts.dataDir);
  const dataDir = opts.dataDir ?? mkdtempSync(path.join(tmpdir(), "sb-pg-"));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port: opts.port,
    persistent,
    // UTF-8 siempre: en Windows initdb usaría WIN1252 y rechazaría emojis y caracteres de otros idiomas (Supabase es UTF-8).
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: () => {},
  });
  if (!existsSync(path.join(dataDir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  return {
    port: opts.port,
    adminUrl: `postgres://postgres:postgres@127.0.0.1:${opts.port}/postgres`,
    async stop() {
      await pg.stop();
      if (!persistent) rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
