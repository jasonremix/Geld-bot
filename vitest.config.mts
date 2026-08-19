import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` ist ein reiner Marker; in Tests wird er neutralisiert.
      "server-only": path.resolve(rootDir, "tests/stubs/server-only.ts"),
      "@prisma-client": path.resolve(rootDir, "generated/prisma/client.ts"),
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["tests/helpers/setup-env.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    hookTimeout: 120_000,
    testTimeout: 60_000,
    // Datenbanktests teilen sich eine Datenbank – daher seriell ausführen.
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
  },
});
