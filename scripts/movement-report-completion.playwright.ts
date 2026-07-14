/**
 * Authenticated Playwright proof for DESKTOP-MOVEMENT-REPORT-COMPLETION-001.
 *
 * Uses Clerk testing tokens (dev-only) + local Postgres fixture seed/cleanup.
 * Never enables a production auth bypass.
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  FIXTURE_SOURCE_TEXT,
  FIXTURE_AUTHORED_RATIONALE,
} from "../lib/live-evidence-depth-runtime-fixture";
import {
  cleanupMovementAssaultRuntimeFixture,
  movementAssaultFixtureAllowed,
  publishMovementAssaultClaimFixture,
  seedMovementAssaultRuntimeFixture,
  seedSparseOnlyMovementAssaultFixture,
  FIXTURE_SPARSE_UPDATE_ID,
} from "../lib/model-movement-runtime-fixture";
import {
  LIVE_MODEL_UPDATE_REPORT_PROVENANCE_LABEL,
  REFERENCE_SAMPLE_REPORT_PROVENANCE_LABEL,
} from "../lib/model-movement-report-provenance";

type EnvMap = Record<string, string>;

const ROOT = resolve(process.cwd());
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";

function readEnvFile(relativePath = ".env"): EnvMap {
  const file = readFileSync(resolve(ROOT, relativePath), "utf8");
  const env: EnvMap = {};

  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function requireEnv(env: EnvMap, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing ${key} in .env`);
  }
  return value;
}

function uniqueEmail(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return `${prefix}-${stamp}@example.com`;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) {
    return {};
  }

  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);

  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

test.describe("movement report completion browser proof", () => {
  let sessionToken = "";
  let devBrowserToken = "";
  let clientUat = "1";
  let userId = "";
  let sessionId = "";
  let claimModelUpdateId = "";
  let prisma: PrismaClient;
  let env: EnvMap;

  test.beforeAll(async () => {
    env = readEnvFile();
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
    process.env.NODE_ENV = process.env.NODE_ENV === "production" ? "test" : process.env.NODE_ENV;

    if (!movementAssaultFixtureAllowed(process.env)) {
      throw new Error("Movement fixture safety gate refused local DB fixture setup");
    }

    const clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });

    const user = await clerk.users.createUser({
      emailAddress: [uniqueEmail("movement-report-completion")],
      password: `Tmp-${Date.now()}-Aa1!`,
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });
    userId = user.id;
    process.env.EVIDENCE_DEPTH_FIXTURE_USER_ID = userId;

    const session = await clerk.sessions.createSession({ userId });
    sessionId = session.id;
    const token = await clerk.sessions.getToken(sessionId);
    sessionToken = token.jwt;

    const testingToken = await clerk.testingTokens.createTestingToken();
    devBrowserToken = testingToken.token;

    const payload = decodeJwtPayload(sessionToken);
    if (typeof payload.iat === "number") {
      clientUat = String(payload.iat);
    }

    prisma = new PrismaClient({
      datasources: { db: { url: LOCAL_DATABASE_URL } },
    });
  });

  test.afterAll(async () => {
    try {
      if (userId && prisma) {
        await cleanupMovementAssaultRuntimeFixture({ userId, db: prisma });
      }
    } finally {
      await prisma?.$disconnect();
    }

    try {
      const clerk = createClerkClient({
        secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
        publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      });
      if (sessionId) {
        await clerk.sessions.revokeSession(sessionId);
      }
      if (userId) {
        await clerk.users.deleteUser(userId);
      }
    } catch {
      // best-effort Clerk teardown
    }
  });

  test("positive authenticated journey — one ModelUpdate ID across surfaces", async ({
    browser,
    baseURL,
  }) => {
    const seeded = await seedMovementAssaultRuntimeFixture({
      userId,
      db: prisma,
      includeSparse: false,
    });
    claimModelUpdateId = seeded.claimModelUpdateId;
    console.log(
      `[movement-report-completion] seeded claimModelUpdateId=${claimModelUpdateId} conclusionModelUpdateId=${seeded.conclusionModelUpdateId}`,
    );
    await publishMovementAssaultClaimFixture({
      userId,
      db: prisma,
      modelUpdateId: claimModelUpdateId,
    });

    const published = await prisma.modelUpdate.findUnique({
      where: { id: claimModelUpdateId },
      select: {
        id: true,
        userId: true,
        visibility: true,
        isMeaningful: true,
        beforeSummary: true,
        afterSummary: true,
        userFacingSummary: true,
      },
    });
    expect(published?.userId).toBe(userId);
    expect(published?.visibility).toBe("user_visible");
    expect(published?.isMeaningful).toBe(true);
    expect(published?.beforeSummary).toBeTruthy();
    expect(published?.afterSummary).toBeTruthy();

    const context = await browser.newContext({
      baseURL: baseURL ?? "http://localhost:3000",
    });
    const page = await context.newPage();
    const origin = baseURL ?? "http://localhost:3000";

    try {
      await context.addCookies([
        { name: "__session", value: sessionToken, url: origin },
        { name: "__clerk_db_jwt", value: devBrowserToken, url: origin },
        { name: "__client_uat", value: clientUat, url: origin },
      ]);

      await page.goto("/");
      // Wait for authenticated production fetches before asserting live Today.
      // Cold Next compiles can briefly 404 APIs via Clerk protect until ready.
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/today/intelligence-updates") &&
            response.request().method() === "GET" &&
            response.status() === 200,
          { timeout: 90_000 },
        ),
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/today/movement-depth") &&
            response.request().method() === "GET" &&
            response.status() === 200,
          { timeout: 90_000 },
        ),
      ]).catch(async () => {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForResponse(
          (response) =>
            response.url().includes("/api/today/movement-depth") && response.status() === 200,
          { timeout: 90_000 },
        );
      });

      await expect(page.getByTestId("today-full-report")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("today-full-report")).toHaveAttribute(
        "data-report-id",
        claimModelUpdateId,
      );

      await expect(page.getByTestId("reference-sample-report-control")).toHaveCount(0);
      await expect(page.getByText("rep-weekly")).toHaveCount(0);

      const seeWhy = page.getByTestId("today-see-why").first();
      await expect(seeWhy).toBeVisible();
      await expect(seeWhy).toHaveAttribute("data-movement-id", claimModelUpdateId);

      await page.getByTestId("today-full-report").click();

      const provenance = page.getByTestId("report-overlay-provenance");
      await expect(provenance).toBeVisible();
      await expect(provenance).toHaveText(LIVE_MODEL_UPDATE_REPORT_PROVENANCE_LABEL);
      await expect(provenance).toHaveAttribute("data-report-provenance", "live_model_update");
      await expect(page.getByTestId("report-overlay-canonical-id")).toHaveText(claimModelUpdateId);
      await expect(page.getByTestId("report-overlay-before")).toBeVisible();
      await expect(page.getByTestId("report-overlay-after")).toBeVisible();
      await expect(page.getByTestId("report-overlay-rationale")).toContainText(FIXTURE_AUTHORED_RATIONALE);
      await expect(page.getByTestId("report-overlay-evidence")).toContainText(FIXTURE_SOURCE_TEXT);
      await expect(page.getByText(REFERENCE_SAMPLE_REPORT_PROVENANCE_LABEL)).toHaveCount(0);
      await expect(page.getByText("rep-weekly")).toHaveCount(0);

      await page.getByRole("button", { name: /Close report/i }).click();
      await expect(page.getByTestId("report-overlay-provenance")).toHaveCount(0);
      await page.getByTestId("today-see-why").first().click();
      await expect(page.getByTestId("inspector-model-update-id").first()).toHaveText(
        claimModelUpdateId,
        { timeout: 30_000 },
      );

      // Overlay → Inspector handoff with the same selected ModelUpdate id.
      await page.getByTestId("today-full-report").click();
      await expect(page.getByTestId("report-overlay-canonical-id")).toHaveText(claimModelUpdateId);
      await page
        .locator(".o-sheet")
        .filter({ has: page.getByTestId("report-overlay-provenance") })
        .getByRole("button", { name: /^Open in Inspector$/i })
        .click();
      await expect(page.getByTestId("inspector-model-update-id").first()).toHaveText(
        claimModelUpdateId,
        { timeout: 30_000 },
      );
      await expect(page.getByTestId("report-overlay-provenance")).toHaveCount(0);

      await page.getByTestId("nav-timeline").click();
      const timelineExact = page.locator(
        `[data-testid="timeline-movement-row"][data-movement-id="${claimModelUpdateId}"]`,
      );
      await expect(timelineExact).toBeVisible({ timeout: 30_000 });
      await timelineExact.click();
      await expect(page.getByTestId("inspector-model-update-id").first()).toHaveText(
        claimModelUpdateId,
      );

      const cookieHeader = `__session=${sessionToken}; __clerk_db_jwt=${devBrowserToken}; __client_uat=${clientUat}`;
      const intelligence = await context.request.get("/api/today/intelligence-updates", {
        headers: { Cookie: cookieHeader },
      });
      expect(intelligence.ok(), `intelligence-updates ${intelligence.status()}`).toBeTruthy();
      const intelJson = (await intelligence.json()) as { items?: Array<{ id: string }> };
      expect((intelJson.items ?? []).map((item) => item.id)).toContain(claimModelUpdateId);

      const depth = await context.request.get("/api/today/movement-depth", {
        headers: { Cookie: cookieHeader },
      });
      expect(depth.ok()).toBeTruthy();
      const depthJson = (await depth.json()) as {
        items?: Array<{ id: string; evidenceQuotes?: string[] }>;
      };
      const claimDepth = (depthJson.items ?? []).find((item) => item.id === claimModelUpdateId);
      expect(claimDepth).toBeTruthy();
      expect((claimDepth?.evidenceQuotes?.length ?? 0) > 0).toBe(true);

      const detail = await context.request.get(`/api/what-changed/${claimModelUpdateId}`, {
        headers: { Cookie: cookieHeader },
      });
      expect(detail.ok()).toBeTruthy();
      expect(((await detail.json()) as { item?: { id?: string } }).item?.id).toBe(claimModelUpdateId);

      const evidence = await context.request.get(`/api/what-changed/${claimModelUpdateId}/evidence`, {
        headers: { Cookie: cookieHeader },
      });
      expect(evidence.ok()).toBeTruthy();
    } finally {
      await context.close();
      const cleanup = await cleanupMovementAssaultRuntimeFixture({
        userId,
        db: prisma,
        modelUpdateIds: [claimModelUpdateId, seeded.conclusionModelUpdateId],
      });
      console.log(
        `[movement-report-completion] cleanup deletedModelUpdates=${cleanup.deletedModelUpdates} deletedLinks=${cleanup.deletedLinks} remainingModelUpdates=${cleanup.remainingModelUpdates} remainingLinks=${cleanup.remainingLinks}`,
      );
      expect(cleanup.remainingModelUpdates).toBe(0);
      expect(cleanup.remainingLinks).toBe(0);
    }
  });

  test("negative sparse journey — withhold See Why / full report / LIVE label", async ({
    browser,
    baseURL,
  }) => {
    await cleanupMovementAssaultRuntimeFixture({ userId, db: prisma });
    const sparse = await seedSparseOnlyMovementAssaultFixture({ userId, db: prisma });

    const context = await browser.newContext({
      baseURL: baseURL ?? "http://localhost:3000",
    });
    const page = await context.newPage();
    const origin = baseURL ?? "http://localhost:3000";

    try {
      await context.addCookies([
        { name: "__session", value: sessionToken, url: origin },
        { name: "__clerk_db_jwt", value: devBrowserToken, url: origin },
        { name: "__client_uat", value: clientUat, url: origin },
      ]);

      await page.goto("/");
      await expect(page.getByRole("heading", { name: /current state|what matters now/i })).toBeVisible({
        timeout: 45_000,
      });

      await expect(
        page.locator(`[data-testid="today-see-why"][data-movement-id="${sparse.sparseModelUpdateId}"]`),
      ).toHaveCount(0);
      await expect(
        page.locator(`[data-testid="today-full-report"][data-report-id="${sparse.sparseModelUpdateId}"]`),
      ).toHaveCount(0);
      await expect(page.getByTestId("today-full-report")).toHaveCount(0);
      await expect(page.getByTestId("report-overlay-provenance")).toHaveCount(0);
      await expect(page.getByText(LIVE_MODEL_UPDATE_REPORT_PROVENANCE_LABEL)).toHaveCount(0);
      await expect(page.getByText("rep-weekly")).toHaveCount(0);
      await expect(page.getByTestId("reference-sample-report-control")).toHaveCount(0);

      await expect(
        page.locator(`[data-testid="today-movement-row"][data-movement-id="${FIXTURE_SPARSE_UPDATE_ID}"]`),
      ).toHaveCount(0);
    } finally {
      await context.close();
      const cleanup = await cleanupMovementAssaultRuntimeFixture({
        userId,
        db: prisma,
        modelUpdateIds: [sparse.sparseModelUpdateId],
      });
      expect(cleanup.remainingModelUpdates).toBe(0);
      expect(cleanup.remainingLinks).toBe(0);
    }
  });

  test("reference route still labels sample report as REFERENCE / SAMPLE", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL: baseURL ?? "http://localhost:3000",
    });
    const page = await context.newPage();
    const origin = baseURL ?? "http://localhost:3000";

    try {
      await context.addCookies([
        { name: "__session", value: sessionToken, url: origin },
        { name: "__clerk_db_jwt", value: devBrowserToken, url: origin },
        { name: "__client_uat", value: clientUat, url: origin },
      ]);

      await page.goto("/dev/orvek-v0-reference");
      await expect(page.getByTestId("orvek-v0-reference-route")).toBeVisible({ timeout: 30_000 });
      const sampleControl = page.getByTestId("reference-sample-report-control");
      await expect(sampleControl).toBeVisible();
      await expect(sampleControl).toContainText(REFERENCE_SAMPLE_REPORT_PROVENANCE_LABEL);
      await sampleControl.click();
      await expect(page.getByTestId("report-overlay-provenance")).toHaveText(
        REFERENCE_SAMPLE_REPORT_PROVENANCE_LABEL,
      );
      await expect(page.getByTestId("report-overlay-provenance")).toHaveAttribute(
        "data-report-provenance",
        "reference_sample",
      );
      await expect(page.getByText(LIVE_MODEL_UPDATE_REPORT_PROVENANCE_LABEL)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
