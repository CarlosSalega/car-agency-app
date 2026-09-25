import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "prisma/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
