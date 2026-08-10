import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Default 5000ms is occasionally too tight for this suite's first Prisma
    // query when pnpm -r cold-starts all services' clients against the same
    // Postgres container in parallel (seen under `pnpm test:all`).
    testTimeout: 10000,
  },
});
