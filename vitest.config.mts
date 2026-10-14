import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` lanza error fuera de Next.js; en las pruebas se sustituye por un módulo vacío
      "server-only": path.resolve(import.meta.dirname, "test/helpers/server-only-stub.ts"),
    },
  },
  test: {
    globalSetup: ["./test/global-setup.ts"],
    include: ["test/unit/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: true,
  },
});
