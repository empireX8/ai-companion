import { defineConfig } from "@playwright/test";

const DESKTOP_PARITY_BASE_URL =
  process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3100";
const DESKTOP_PARITY_PORT = new URL(DESKTOP_PARITY_BASE_URL).port || "3100";
const DESKTOP_PARITY_READY_URL = `${DESKTOP_PARITY_BASE_URL}/sign-in`;

export default defineConfig({
  testDir: "./scripts",
  testMatch: /(?:v0-route-smoke|movement-report-completion|durable-actions-assault|explore-grounding-movement-assault|explore-send-readiness-isolated|investigations-production-assault|desktop-production-parity-closure|desktop-frozen-reference-inspector-restoration|contradiction-final-production-audit|orvek-canonical-model-authority-phase6)\.playwright\.ts/,
  timeout: process.env.PHASE6_MANAGE_SERVER === "1" ? 1_200_000 : 300_000,
  retries: 0,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: DESKTOP_PARITY_BASE_URL,
    trace: "off",
  },
  // Phase 6 final acceptance manages its own server when PHASE6_MANAGE_SERVER=1.
  ...(process.env.PHASE6_MANAGE_SERVER === "1"
    ? {}
    : {
        webServer: {
          command: `NODE_OPTIONS=--max-old-space-size=8192 npm run build && PORT=${DESKTOP_PARITY_PORT} npm run start`,
          url: DESKTOP_PARITY_READY_URL,
          reuseExistingServer: true,
          timeout: 600_000,
          env: {
            ...process.env,
            DATABASE_URL:
              process.env.DATABASE_URL ??
              "postgresql://user@127.0.0.1:5432/companion_canonical_authority_test",
            CANONICAL_AUTHORITY_DB_TEST_URL:
              process.env.CANONICAL_AUTHORITY_DB_TEST_URL ??
              "postgresql://user@127.0.0.1:5432/companion_canonical_authority_test",
          },
        },
      }),
});
