/**
 * Lanzador de las pruebas unitarias/de integración (`npm test`).
 *
 * Por qué existe: con el PostgreSQL embebido arrancado en `globalSetup`, `vitest run` termina con código de salida 0
 * aunque haya pruebas fallidas (comprobado: sin globalSetup sale con 1). Un código 0 en falso rompería cualquier
 * integración continua, así que aquí el código de salida se calcula explícitamente a partir del resultado real.
 */
import { startVitest } from "vitest/node";

const filters = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const vitest = await startVitest("test", filters, { run: true, watch: false });
if (!vitest) {
  console.error("No se pudo iniciar Vitest.");
  process.exit(2);
}

const files = vitest.state.getFiles();
const failedFiles = files.filter((f) => f.result?.state === "fail").length;
const failedTests = vitest.state.getCountOfFailedTests();
const errors = vitest.state.getUnhandledErrors().length;
const empty = files.length === 0;
await vitest.close();

const bad = failedFiles > 0 || failedTests > 0 || errors > 0 || empty;
if (bad) console.error(`\nPRUEBAS FALLIDAS: ${failedTests} pruebas en ${failedFiles} archivos · errores no controlados: ${errors}${empty ? " · no se encontraron pruebas" : ""}`);
process.exit(bad ? 1 : 0);
