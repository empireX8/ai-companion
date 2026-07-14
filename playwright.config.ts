import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  testMatch: /(?:v0-route-smoke|movement-report-completion|durable-actions-assault)\.playwright\.ts/,
  timeout: 300_000,
  retries: 0,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
  },
});
