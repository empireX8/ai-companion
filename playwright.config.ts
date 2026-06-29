import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  testMatch: /v0-route-smoke\.spec\.ts/,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
  },
});
