import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    // Order matters: Vite matches string aliases by prefix and uses the first
    // hit, so the specific `@generated/prisma` must precede `@`, otherwise `@`
    // rewrites `@generated/prisma/...` into `src/generated/prisma/...`.
    // Vite does not read tsconfig paths, hence the duplication.
    alias: {
      "@generated/prisma": path.resolve(root, "./prisma/generated"),
      "@": path.resolve(root, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "prisma/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
