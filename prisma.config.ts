import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // The upgrade guide's example points this at DIRECT_URL, which separates a
    // direct connection from a pooled one. This project has a single
    // DATABASE_URL, so the config reads that instead.
    url: env("DATABASE_URL"),
  },
});
