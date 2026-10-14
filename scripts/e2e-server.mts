/**
 * Arranca la app compilada (npm run build) en el puerto 3108 lista para el recorrido e2e, con un «Google» LOCAL falso
 * (lo levanta test/e2e/journey.mts en el puerto 4455). Las credenciales de aquí son inventadas y solo valen para este servidor
 * de pruebas: OAUTH_TEST_MODE=1 solo admite endpoints de localhost y NUNCA debe ponerse en producción.
 *
 *   npm run build && npm run e2e:server      (en otra terminal)  npm run test:e2e
 */
import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3108"], {
  stdio: "inherit",
  env: {
    ...process.env,
    SITE_URL: "http://localhost:3108",
    GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    OAUTH_TEST_MODE: "1",
    OAUTH_TEST_AUTH_URL: "http://127.0.0.1:4455/authorize",
    OAUTH_TEST_TOKEN_URL: "http://127.0.0.1:4455/token",
    OAUTH_TEST_JWKS_URL: "http://127.0.0.1:4455/jwks",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
