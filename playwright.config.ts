import { defineConfig } from "@playwright/test";

const DESKTOP_PARITY_BASE_URL =
  process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3100";
const DESKTOP_PARITY_PORT = new URL(DESKTOP_PARITY_BASE_URL).port || "3100";
const DESKTOP_PARITY_READY_URL = `${DESKTOP_PARITY_BASE_URL}/sign-in`;

export default defineConfig({
  testDir: "./scripts",
  testMatch: /(?:v0-route-smoke|movement-report-completion|durable-actions-assault|explore-grounding-movement-assault|explore-send-readiness-isolated|investigations-production-assault|desktop-production-parity-closure|desktop-frozen-reference-inspector-restoration)\.playwright\.ts/,
  timeout: 300_000,
  retries: 0,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: DESKTOP_PARITY_BASE_URL,
    trace: "off",
  },
  webServer: {
    command: `NODE_OPTIONS=--max-old-space-size=8192 npm run build && PORT=${DESKTOP_PARITY_PORT} npm run start`,
    url: DESKTOP_PARITY_READY_URL,
    reuseExistingServer: true,
    timeout: 600_000,
  },
});
