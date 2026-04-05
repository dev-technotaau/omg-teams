import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",

  migrations: {
    path: "./prisma/migrations",
    seed: "npx tsx prisma/seeds/seed.ts",
  },

  datasource: {
    // Prisma CLI needs the DIRECT connection (not pooler) for DDL operations.
    // At runtime the pg Pool is configured in src/config/database.ts.
    // Use session-mode pooler for CLI (DDL needs session mode, not transaction mode)
    url: (process.env.DATABASE_URL ?? "").replace(":6543/", ":5432/").replace("?pgbouncer=true", ""),
    ...(process.env.DATABASE_SHADOW_URL ? { shadowDatabaseUrl: process.env.DATABASE_SHADOW_URL } : {}),
  },
});
