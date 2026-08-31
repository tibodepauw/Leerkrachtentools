import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    pool: "threads",
    exclude: ["**/node_modules/**", "**/.next/**"],
    env: {
      DATABASE_PATH: "./test-leerkrachtentools.db",
      AUTH_SECRET: "test-auth-secret-with-at-least-32-characters",
    },
  },
});
