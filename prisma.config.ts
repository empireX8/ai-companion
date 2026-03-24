// Prisma 6 stops auto-loading .env when prisma.config.ts is present.
// Load it manually so schema.prisma's `url = env("DATABASE_URL")` can resolve.
import { config as loadDotenv } from "dotenv";
loadDotenv();

import { defineConfig } from "prisma/config";

export default defineConfig({
  migrations: {
    /**
     * Seed command — also exposed via `npm run db:seed` in package.json.
     */
    seed: "ts-node --transpile-only --compiler-options '{\"module\":\"CommonJS\",\"moduleResolution\":\"node\"}' prisma/seed.ts",
  },
});
