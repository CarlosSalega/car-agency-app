import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
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
    // Both projects declare `extends: true` so the `esbuild.jsx` and
    // `resolve.alias` settings above keep applying to them.
    projects: [
      {
        extends: true,
        test: {
          name: "app",
          // The application's tests render React components and touch `window`.
          environment: "jsdom",
          // `src/modules/**` is the copy-pasteable image-uploads module, owned by
          // the `image-uploads-module` project below.
          exclude: [...configDefaults.exclude, "src/modules/**"],
          include: ["src/**/*.test.{ts,tsx}", "prisma/**/*.test.ts"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "image-uploads-module",
          // The module's tests are written for a plain Node runtime (`File`,
          // `arrayBuffer`, real `Request`) and jsdom replaces those globals with
          // DOM-only versions. The module also must not depend on
          // `vitest.setup.ts`, so this project loads no setup files.
          environment: "node",
          include: ["src/modules/**/*.test.ts"],
        },
      },
    ],
  },
});
