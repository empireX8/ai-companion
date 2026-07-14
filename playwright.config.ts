import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  testMatch: /(?:v0-route-smoke|movement-report-completion)\.playwright\.ts/,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
  },
});
