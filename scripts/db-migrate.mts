/**
 * Aplica las migraciones SQL (db/migrations) a la base indicada por DATABASE_URL.
 *
 *   npm run db:migrate                       → solo bases LOCALES (localhost / 127.0.0.1)
 *   npm run db:migrate -- --allow-remote     → también bases remotas (p. ej. Supabase). Hazlo tú, con intención.
 *
 * Nunca imprime la URL completa (lleva la contraseña).
 */
import { isLocalDatabaseUrl, migrate } from "../src/server/db/migrate";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL (define la variable o crea .env.local).");
  process.exit(1);
}
if (url.includes("PEGA_AQUI")) {
  console.error("DATABASE_URL todavía tiene el marcador de la plantilla: abre .env.production.local y pega ahí tu cadena de conexión de Supabase.");
  process.exit(1);
}
const allowRemote = process.argv.includes("--allow-remote");
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "(URL no válida)";
  }
})();

if (!isLocalDatabaseUrl(url) && !allowRemote) {
  console.error(
    `Rechazado: la base apunta a "${host}", que no es local. Esto evita migrar producción por error.\n` +
      "Si es lo que quieres, vuelve a ejecutar con: npm run db:migrate -- --allow-remote",
  );
  process.exit(2);
}

console.log(`Migrando la base en ${host}${isLocalDatabaseUrl(url) ? " (local)" : " (REMOTA, autorizada con --allow-remote)"}…`);
const applied = await migrate(url);
console.log(applied.length ? `Aplicadas: ${applied.join(", ")}` : "Nada que aplicar: la base ya está al día.");
