/**
 * Authenticated Playwright proof for DESKTOP-DURABLE-ACTIONS-ASSAULT-001.
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  cleanupDurableActionsAssaultRuntimeFixture,
  durableActionsAssaultFixtureAllowed,
  FIXTURE_CORRECTABLE_CONCLUSION_ID,
  FIXTURE_DECISION_ACTION_SURFACE_KEY,
  FIXTURE_FIELDWORK_ASSIGNMENT_ID,
  seedDurableActionsAssaultRuntimeFixture,
} from "../lib/durable-actions-runtime-fixture";

type EnvMap = Record<string, string>;

const ROOT = resolve(process.cwd());
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";
const ORIGIN = "http://localhost:3000";

const FIXTURE_CONCLUSION_TITLE = "Durable actions assault correctable conclusion";
const FIXTURE_ORIGINAL_ASSERTION =
  "Original assertion: energy drops after meetings without a stop point.";
const FIXTURE_CORRECTION_LABEL = "This is wrong";
const FIXTURE_OUTCOME_NOTE = "Durable assault outcome: stop point helped after meetings.";
const FIXTURE_CHECKIN_NOTE = "Durable assault check-in: noticed stop point after 4pm meeting.";
const FIXTURE_DECISION_TITLE =
  "Write the recurring thought down as-is, without trying to resolve it";
const FIXTURE_FIELDWORK_PROMPT = "Watch for stop-point signal after meetings";

function readEnvFile(relativePath = ".env"): EnvMap {
  const file = readFileSync(resolve(ROOT, relativePath), "utf8");
  const env: EnvMap = {};

  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

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
  if (!value) throw new Error(`Missing ${key} in .env`);
  return value;
}

function uniqueEmail(prefix: string): string {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}.${stamp}@example.com`;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

test.describe("durable user actions browser proof", () => {
  test.describe.configure({ mode: "serial" });

  let sessionToken = "";
  let devBrowserToken = "";
  let clientUat = "1";
  let userId = "";
  let sessionId = "";
  let decisionActionId = "";
  let prisma: PrismaClient;
  let env: EnvMap;

  function cookieHeader(): string {
    return `__session=${sessionToken}; __clerk_db_jwt=${devBrowserToken}; __client_uat=${clientUat}`;
  }

  async function refreshSessionToken() {
    const clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });
    sessionToken = (await clerk.sessions.getToken(sessionId)).jwt;
    const payload = decodeJwtPayload(sessionToken);
    if (typeof payload.iat === "number") {
      clientUat = String(payload.iat);
    }
  }

  async function syncSessionFromBrowserCookies(context: BrowserContext, baseURL?: string) {
    const cookies = await context.cookies(baseURL ?? ORIGIN);
    const session = cookies.find((cookie) => cookie.name === "__session");
    const uat = cookies.find((cookie) => cookie.name === "__client_uat");
    if (session?.value) {
      sessionToken = session.value;
    }
    if (uat?.value) {
      clientUat = uat.value;
    }
  }

  async function stabilizeAuthenticatedSession(page: Page, context: BrowserContext, baseURL?: string) {
    await refreshSessionToken();
    await refreshAuthCookies(context, baseURL);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await refreshAuthCookies(context, baseURL);

    if (await page.getByRole("heading", { name: /Sign in/i }).isVisible().catch(() => false)) {
      await refreshSessionToken();
      await refreshAuthCookies(context, baseURL);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await refreshAuthCookies(context, baseURL);
    }

    await expect(page.getByTestId("nav-today")).toBeVisible({ timeout: 90_000 });
    await expect
      .poll(async () => {
        const list = await context.request.get("/api/user-map/conclusions", {
          headers: { Cookie: cookieHeader() },
        });
        return list.ok();
      }, { timeout: 90_000 })
      .toBe(true);

    // Prove the *page* can make authenticated fetches (cookies on document), not only APIRequest.
    await expect
      .poll(async () => {
        await refreshAuthCookies(context, baseURL);
        return page.evaluate(async () => {
          const response = await fetch("/api/user-map/conclusions", { cache: "no-store" });
          return response.ok;
        });
      }, { timeout: 90_000 })
      .toBe(true);
  }

  async function recoverAfterReload(page: Page, context: BrowserContext, baseURL?: string) {
    await refreshSessionToken();
    await refreshAuthCookies(context, baseURL);
    await page.reload({ waitUntil: "domcontentloaded" });
    await refreshAuthCookies(context, baseURL);
    await waitForAuthenticatedShell(page, context, baseURL);
  }

  test.beforeAll(async () => {
    env = readEnvFile();
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
    process.env.NODE_ENV = process.env.NODE_ENV === "production" ? "test" : process.env.NODE_ENV;

    if (!durableActionsAssaultFixtureAllowed(process.env)) {
      throw new Error("Durable actions fixture safety gate refused local DB setup");
    }

    const clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });

    const user = await clerk.users.createUser({
      emailAddress: [uniqueEmail("durable-actions-assault")],
      password: `Tmp-${Date.now()}-Aa1!`,
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });
    userId = user.id;
    process.env.EVIDENCE_DEPTH_FIXTURE_USER_ID = userId;

    const session = await clerk.sessions.createSession({ userId });
    sessionId = session.id;
    sessionToken = (await clerk.sessions.getToken(sessionId)).jwt;
    devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;

    const payload = decodeJwtPayload(sessionToken);
    if (typeof payload.iat === "number") clientUat = String(payload.iat);

    prisma = new PrismaClient({ datasources: { db: { url: LOCAL_DATABASE_URL } } });
  });

  test.afterAll(async () => {
    try {
      if (userId && prisma) {
        await cleanupDurableActionsAssaultRuntimeFixture({ userId, db: prisma });
      }
    } finally {
      await prisma?.$disconnect();
    }

    try {
      const clerk = createClerkClient({
        secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
        publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      });
      if (sessionId) await clerk.sessions.revokeSession(sessionId);
      if (userId) await clerk.users.deleteUser(userId);
    } catch {
      // best-effort
    }
  });

  test.beforeEach(async () => {
    await cleanupDurableActionsAssaultRuntimeFixture({ userId, db: prisma });
    const seeded = await seedDurableActionsAssaultRuntimeFixture({ userId, db: prisma });
    decisionActionId = seeded.decisionActionId;
    const row = await prisma.userMapConclusion.findFirst({
      where: { id: seeded.correctableConclusionId, userId },
    });
    expect(row?.visibility).toBe("user_visible");
  });

  async function refreshAuthCookies(context: BrowserContext, baseURL?: string) {
    const origin = baseURL ?? ORIGIN;
    await context.addCookies([
      { name: "__session", value: sessionToken, url: origin },
      { name: "__clerk_db_jwt", value: devBrowserToken, url: origin },
      { name: "__client_uat", value: clientUat, url: origin },
    ]);
  }

  async function waitForAuthenticatedShell(page: Page, context: BrowserContext, baseURL?: string) {
    await stabilizeAuthenticatedSession(page, context, baseURL);
  }

  async function openAuthenticatedPage(browser: Browser, baseURL?: string) {
    const context = await browser.newContext({
      baseURL: baseURL ?? ORIGIN,
    });
    const page = await context.newPage();
    await waitForAuthenticatedShell(page, context, baseURL);
    return { context, page };
  }

  async function openMapConclusion(page: Page, context: BrowserContext, baseURL?: string) {
    await refreshSessionToken();
    await refreshAuthCookies(context, baseURL);
    await page.getByTestId("nav-map").click();
    await expect
      .poll(async () => {
        const list = await context.request.get("/api/user-map/conclusions", {
          headers: { Cookie: cookieHeader() },
        });
        if (!list.ok()) {
          return false;
        }
        const payload = (await list.json()) as { items?: { id: string }[] };
        return (
          payload.items?.some((item) => item.id === FIXTURE_CORRECTABLE_CONCLUSION_ID) ?? false
        );
      }, { timeout: 30_000 })
      .toBe(true);

    const titleLocator = page.getByRole("button", { name: FIXTURE_CONCLUSION_TITLE }).first();
    if (!(await titleLocator.isVisible().catch(() => false))) {
      await stabilizeAuthenticatedSession(page, context, baseURL);
      await page.getByTestId("nav-map").click();
    }

    await expect(titleLocator).toBeVisible({ timeout: 60_000 });
    await refreshSessionToken();
    await refreshAuthCookies(context, baseURL);
    const detailResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/user-map/conclusions/${FIXTURE_CORRECTABLE_CONCLUSION_ID}`) &&
        response.request().method() === "GET" &&
        response.status() === 200,
      { timeout: 30_000 }
    );
    await titleLocator.click();
    await detailResponsePromise;
  }

  test("correction journey persists through reload and inspector", async ({ browser, baseURL }) => {
    const { context, page } = await openAuthenticatedPage(browser, baseURL);
    const map = page.getByTestId("orvek-v0-map-page");

    try {
      await stabilizeAuthenticatedSession(page, context, baseURL);
      await expect
        .poll(async () => {
          const detail = await context.request.get(
            `/api/user-map/conclusions/${FIXTURE_CORRECTABLE_CONCLUSION_ID}`,
            { headers: { Cookie: cookieHeader() } }
          );
          return detail.ok();
        }, { timeout: 30_000 })
        .toBe(true);

      await openMapConclusion(page, context, baseURL);
      await expect(map.getByTestId("durable-correction-chip-this-is-wrong")).toBeVisible({
        timeout: 30_000,
      });

      await refreshSessionToken();
      await refreshAuthCookies(context, baseURL);

      const patchPromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/user-map/conclusions/${FIXTURE_CORRECTABLE_CONCLUSION_ID}`) &&
          response.request().method() === "PATCH",
        { timeout: 30_000 }
      );

      await map.getByTestId("durable-correction-chip-this-is-wrong").click();
      const patchResponse = await patchPromise;
      expect(patchResponse.status()).toBe(200);

      await expect(map.getByTestId("durable-correction-recorded")).toContainText(
        FIXTURE_CORRECTION_LABEL
      );

      await recoverAfterReload(page, context, baseURL);

      await expect
        .poll(async () => {
          const detailAfterReload = await context.request.get(
            `/api/user-map/conclusions/${FIXTURE_CORRECTABLE_CONCLUSION_ID}`,
            { headers: { Cookie: cookieHeader() } }
          );
          if (!detailAfterReload.ok()) {
            return null;
          }
          const payload = (await detailAfterReload.json()) as {
            item?: { summary?: string; lastUserCorrectionLabel?: string | null };
          };
          return payload.item ?? null;
        }, { timeout: 30_000 })
        .toMatchObject({
          summary: FIXTURE_ORIGINAL_ASSERTION,
          lastUserCorrectionLabel: FIXTURE_CORRECTION_LABEL,
        });

      await openMapConclusion(page, context, baseURL);
      await expect
        .poll(async () => {
          const count = await map.getByTestId("durable-correction-recorded").count();
          return count > 0;
        }, { timeout: 60_000 })
        .toBe(true);
      await expect(map.getByTestId("durable-correction-recorded")).toContainText(
        FIXTURE_CORRECTION_LABEL
      );

      const detail = await context.request.get(
        `/api/user-map/conclusions/${FIXTURE_CORRECTABLE_CONCLUSION_ID}`,
        { headers: { Cookie: cookieHeader() } }
      );
      expect(detail.ok()).toBeTruthy();
      const detailJson = (await detail.json()) as {
        item?: { summary?: string; lastUserCorrectionLabel?: string | null };
      };
      expect(detailJson.item?.summary).toBe(FIXTURE_ORIGINAL_ASSERTION);
      expect(detailJson.item?.lastUserCorrectionLabel).toBe(FIXTURE_CORRECTION_LABEL);
    } finally {
      await context.close();
    }
  });

  test("decision outcome journey persists with stable id and idempotent retry", async ({
    browser,
    baseURL,
  }) => {
    expect(decisionActionId).toBeTruthy();

    const { context, page } = await openAuthenticatedPage(browser, baseURL);
    const decisions = page.getByTestId("orvek-v0-decisions-page");

    try {
      await stabilizeAuthenticatedSession(page, context, baseURL);

      await expect
        .poll(async () => {
          await refreshSessionToken();
          const list = await context.request.get("/api/actions", {
            headers: { Cookie: cookieHeader() },
          });
          if (!list.ok()) {
            return false;
          }
          const payload = (await list.json()) as {
            stabilizeNow?: { id: string; title?: string; note?: string | null }[];
            buildForward?: { id: string; title?: string; note?: string | null }[];
          };
          const actions = [...(payload.stabilizeNow ?? []), ...(payload.buildForward ?? [])];
          const match = actions.find(
            (item) => item.id === decisionActionId || item.title === FIXTURE_DECISION_TITLE
          );
          if (match?.id) {
            decisionActionId = match.id;
            return true;
          }
          return false;
        }, { timeout: 60_000 })
        .toBe(true);

      await refreshSessionToken();
      await refreshAuthCookies(context, baseURL);
      await page.getByTestId("nav-decisions").click();

      await expect
        .poll(async () => {
          const titleVisible = await page
            .getByText(FIXTURE_DECISION_TITLE)
            .first()
            .isVisible()
            .catch(() => false);
          if (titleVisible) {
            return true;
          }
          await refreshSessionToken();
          await refreshAuthCookies(context, baseURL);
          await page.getByTestId("nav-today").click();
          await page.getByTestId("nav-decisions").click();
          return false;
        }, { timeout: 90_000 })
        .toBe(true);

      await page.getByText(FIXTURE_DECISION_TITLE).first().click();
      await expect(decisions.getByTestId("durable-outcome-input")).toBeVisible({
        timeout: 30_000,
      });

      await refreshSessionToken();
      await refreshAuthCookies(context, baseURL);
      await decisions.getByTestId("durable-outcome-input").fill(FIXTURE_OUTCOME_NOTE);

      const patchPromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/actions/${decisionActionId}`) &&
          response.request().method() === "PATCH",
        { timeout: 30_000 }
      );
      await decisions.getByTestId("durable-outcome-submit").click();
      const patchResponse = await patchPromise;
      expect(patchResponse.status()).toBe(200);
      const patchBody = (await patchResponse.json()) as { id?: string; note?: string };
      expect(patchBody.id).toBe(decisionActionId);
      expect(patchBody.note).toBe(FIXTURE_OUTCOME_NOTE);
      console.log(
        `[durable-actions-assault] exact decisionActionId=${decisionActionId} patchBody.id=${patchBody.id}`
      );

      await decisions.getByRole("button", { name: FIXTURE_DECISION_TITLE }).first().click();
      await expect(decisions.getByTestId("durable-outcome-recorded")).toContainText(
        FIXTURE_OUTCOME_NOTE,
        { timeout: 30_000 }
      );

      await recoverAfterReload(page, context, baseURL);
      await refreshSessionToken();
      await refreshAuthCookies(context, baseURL);
      await page.getByTestId("nav-decisions").click();

      await expect
        .poll(async () => {
          const titleVisible = await page
            .getByText(FIXTURE_DECISION_TITLE)
            .first()
            .isVisible()
            .catch(() => false);
          if (titleVisible) {
            return true;
          }
          await refreshSessionToken();
          await refreshAuthCookies(context, baseURL);
          await page.getByTestId("nav-today").click();
          await page.getByTestId("nav-decisions").click();
          return false;
        }, { timeout: 90_000 })
        .toBe(true);
      await page.getByText(FIXTURE_DECISION_TITLE).first().click();
      await expect(decisions.getByTestId("durable-outcome-recorded")).toContainText(
        FIXTURE_OUTCOME_NOTE,
        { timeout: 30_000 }
      );

      const listAfter = await context.request.get("/api/actions", {
        headers: { Cookie: cookieHeader() },
      });
      expect(listAfter.ok()).toBeTruthy();
      const listJson = (await listAfter.json()) as {
        stabilizeNow?: { id: string; note?: string | null; title?: string }[];
        buildForward?: { id: string; note?: string | null; title?: string }[];
      };
      const hydrated = [...(listJson.stabilizeNow ?? []), ...(listJson.buildForward ?? [])].find(
        (item) => item.id === decisionActionId
      );
      expect(hydrated?.id).toBe(decisionActionId);
      expect(hydrated?.note).toBe(FIXTURE_OUTCOME_NOTE);
      expect(hydrated?.title).toBe(FIXTURE_DECISION_TITLE);

      const retry = await context.request.patch(`/api/actions/${decisionActionId}`, {
        headers: { Cookie: cookieHeader(), "Content-Type": "application/json" },
        data: { status: "helped", note: FIXTURE_OUTCOME_NOTE },
      });
      expect(retry.ok()).toBeTruthy();
      const actionCount = await prisma.surfacedAction.count({
        where: { userId, id: decisionActionId },
      });
      expect(actionCount).toBe(1);

      const clerk = createClerkClient({
        secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
        publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      });
      const otherUser = await clerk.users.createUser({
        emailAddress: [uniqueEmail("da-decision-other")],
        password: `Tmp-${Date.now()}-Cc3!`,
        skipPasswordChecks: true,
        skipPasswordRequirement: true,
      });
      const otherSession = await clerk.sessions.createSession({ userId: otherUser.id });
      const otherToken = (await clerk.sessions.getToken(otherSession.id)).jwt;
      const crossUser = await fetch(`${ORIGIN}/api/actions/${decisionActionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `__session=${otherToken}`,
        },
        body: JSON.stringify({ status: "helped", note: "cross-user" }),
      });
      console.log(
        `[durable-actions-assault] exact cross-user decision status=${crossUser.status}`
      );
      expect(crossUser.status).toBe(404);
      await clerk.sessions.revokeSession(otherSession.id);
      await clerk.users.deleteUser(otherUser.id);
    } finally {
      await context.close();
    }
  });

  test("fieldwork check-in journey persists parent linkage through reload", async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await openAuthenticatedPage(browser, baseURL);
    const explore = page.getByTestId("orvek-v0-explore-page");

    try {
      await stabilizeAuthenticatedSession(page, context, baseURL);

      await expect
        .poll(async () => {
          await refreshSessionToken();
          const list = await context.request.get("/api/watch-for", {
            headers: { Cookie: cookieHeader() },
          });
          if (!list.ok()) {
            return false;
          }
          const payload = (await list.json()) as { items?: { id: string }[] };
          return (
            payload.items?.some((item) => item.id === FIXTURE_FIELDWORK_ASSIGNMENT_ID) ?? false
          );
        }, { timeout: 60_000 })
        .toBe(true);

      await expect
        .poll(async () => {
          await refreshSessionToken();
          await refreshAuthCookies(context, baseURL);
          return page.evaluate(async (fixtureId) => {
            const response = await fetch("/api/watch-for", { cache: "no-store" });
            if (!response.ok) {
              return false;
            }
            const payload = (await response.json()) as { items?: { id: string }[] };
            return payload.items?.some((item) => item.id === fixtureId) ?? false;
          }, FIXTURE_FIELDWORK_ASSIGNMENT_ID);
        }, { timeout: 90_000 })
        .toBe(true);

      await refreshSessionToken();
      await refreshAuthCookies(context, baseURL);
      // Bust hybrid fetch caches by remounting after page-auth is proven.
      await recoverAfterReload(page, context, baseURL);
      await page.getByTestId("nav-explore").click();
      await explore.getByRole("button", { name: /Fieldwork Bridge/i }).click();

      await expect
        .poll(async () => {
          const inputVisible = await explore
            .getByTestId("durable-checkin-input")
            .isVisible()
            .catch(() => false);
          const promptVisible = await explore
            .getByText(FIXTURE_FIELDWORK_PROMPT)
            .first()
            .isVisible()
            .catch(() => false);
          if (inputVisible || promptVisible) {
            return true;
          }
          await recoverAfterReload(page, context, baseURL);
          await page.getByTestId("nav-explore").click();
          await explore.getByRole("button", { name: /Fieldwork Bridge/i }).click();
          return false;
        }, { timeout: 90_000 })
        .toBe(true);

      if (await explore.getByText(FIXTURE_FIELDWORK_PROMPT).first().isVisible().catch(() => false)) {
        await explore.getByText(FIXTURE_FIELDWORK_PROMPT).first().click();
      }
      await expect(explore.getByTestId("durable-checkin-input")).toBeVisible({ timeout: 30_000 });
      await expect(explore.getByText(/Generate v0 architecture prototype/i)).toHaveCount(0);

      await refreshSessionToken();
      await refreshAuthCookies(context, baseURL);
      await explore.getByTestId("durable-checkin-input").fill(FIXTURE_CHECKIN_NOTE);
      const patchPromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/fieldwork/${FIXTURE_FIELDWORK_ASSIGNMENT_ID}`) &&
          response.request().method() === "PATCH",
        { timeout: 30_000 }
      );
      await explore.getByTestId("durable-checkin-submit").click();
      const patchResponse = await patchPromise;
      expect(patchResponse.status()).toBe(200);

      await expect(explore.getByTestId("durable-checkin-recorded")).toContainText(
        FIXTURE_CHECKIN_NOTE,
        { timeout: 30_000 }
      );
      await expect(explore.getByText(FIXTURE_FIELDWORK_PROMPT).first()).toBeVisible();

      await explore.getByRole("button", { name: /Open fieldwork/i }).click();
      await expect(page.getByTestId("durable-checkin-recorded").first()).toContainText(
        FIXTURE_CHECKIN_NOTE,
        { timeout: 30_000 }
      );

      await recoverAfterReload(page, context, baseURL);
      await refreshSessionToken();
      await refreshAuthCookies(context, baseURL);
      await page.getByTestId("nav-explore").click();
      await explore.getByRole("button", { name: /Fieldwork Bridge/i }).click();
      await expect
        .poll(async () => {
          return explore.getByText(FIXTURE_FIELDWORK_PROMPT).first().isVisible();
        }, { timeout: 60_000 })
        .toBe(true);
      await explore.getByText(FIXTURE_FIELDWORK_PROMPT).first().click();
      await expect(explore.getByTestId("durable-checkin-recorded")).toContainText(
        FIXTURE_CHECKIN_NOTE,
        { timeout: 30_000 }
      );
      await expect(explore.getByText(/Generate v0 architecture prototype/i)).toHaveCount(0);

      const detail = await context.request.get(`/api/fieldwork/${FIXTURE_FIELDWORK_ASSIGNMENT_ID}`, {
        headers: { Cookie: cookieHeader() },
      });
      expect(detail.ok()).toBeTruthy();
      const detailJson = (await detail.json()) as {
        item?: { id?: string; observationNote?: string | null; status?: string };
      };
      expect(detailJson.item?.id).toBe(FIXTURE_FIELDWORK_ASSIGNMENT_ID);
      expect(detailJson.item?.observationNote).toBe(FIXTURE_CHECKIN_NOTE);
      expect(["assigned", "active"]).toContain(detailJson.item?.status);

      const retry = await context.request.patch(`/api/fieldwork/${FIXTURE_FIELDWORK_ASSIGNMENT_ID}`, {
        headers: { Cookie: cookieHeader(), "Content-Type": "application/json" },
        data: {
          observationNote: FIXTURE_CHECKIN_NOTE,
          status: "active",
        },
      });
      expect(retry.ok()).toBeTruthy();
      const fieldworkCount = await prisma.fieldworkAssignment.count({
        where: { userId, id: FIXTURE_FIELDWORK_ASSIGNMENT_ID },
      });
      expect(fieldworkCount).toBe(1);

      const clerk = createClerkClient({
        secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
        publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      });
      const otherUser = await clerk.users.createUser({
        emailAddress: [uniqueEmail("da-fieldwork-other")],
        password: `Tmp-${Date.now()}-Dd4!`,
        skipPasswordChecks: true,
        skipPasswordRequirement: true,
      });
      const otherSession = await clerk.sessions.createSession({ userId: otherUser.id });
      const otherToken = (await clerk.sessions.getToken(otherSession.id)).jwt;
      const crossUser = await fetch(`${ORIGIN}/api/fieldwork/${FIXTURE_FIELDWORK_ASSIGNMENT_ID}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `__session=${otherToken}`,
        },
        body: JSON.stringify({ observationNote: "cross-user", status: "completed" }),
      });
      console.log(
        `[durable-actions-assault] exact cross-user fieldwork status=${crossUser.status}`
      );
      expect(crossUser.status).toBe(404);
      await clerk.sessions.revokeSession(otherSession.id);
      await clerk.users.deleteUser(otherUser.id);
    } finally {
      await context.close();
    }
  });

  test("negative proof rejects unauthenticated and cross-user writes", async ({ browser, baseURL }) => {
    const unauth = await fetch(
      `${ORIGIN}/api/user-map/conclusions/${FIXTURE_CORRECTABLE_CONCLUSION_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastUserCorrectionLabel: "blocked" }),
      }
    );
    console.log(`[durable-actions-assault] exact unauthenticated correction status=${unauth.status}`);
    expect(unauth.status).toBe(404);

    const missingParent = await fetch(`${ORIGIN}/api/fieldwork/missing-parent-id-assault`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(),
      },
      body: JSON.stringify({ observationNote: "orphaned", status: "completed" }),
    });
    console.log(`[durable-actions-assault] exact missing-parent fieldwork status=${missingParent.status}`);
    expect(missingParent.status).toBe(404);

    const malformed = await fetch(
      `${ORIGIN}/api/user-map/conclusions/${FIXTURE_CORRECTABLE_CONCLUSION_ID}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader(),
        },
        body: "{not-json",
      }
    );
    console.log(`[durable-actions-assault] exact malformed correction status=${malformed.status}`);
    expect(malformed.status).toBe(400);

    const clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });
    const otherUser = await clerk.users.createUser({
      emailAddress: [uniqueEmail("durable-actions-other")],
      password: `Tmp-${Date.now()}-Bb2!`,
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });
    const otherSession = await clerk.sessions.createSession({ userId: otherUser.id });
    const otherToken = (await clerk.sessions.getToken(otherSession.id)).jwt;

    const crossUser = await fetch(
      `${ORIGIN}/api/user-map/conclusions/${FIXTURE_CORRECTABLE_CONCLUSION_ID}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `__session=${otherToken}`,
        },
        body: JSON.stringify({
          lastUserCorrectionLabel: "cross-user",
          lastUserCorrectionAt: new Date().toISOString(),
          correctionCount: 1,
        }),
      }
    );
    expect(crossUser.status).toBe(404);
    console.log(`[durable-actions-assault] exact cross-user correction status=${crossUser.status}`);
    await clerk.sessions.revokeSession(otherSession.id);
    await clerk.users.deleteUser(otherUser.id);

    const { context, page } = await openAuthenticatedPage(browser, baseURL);
    try {
      await stabilizeAuthenticatedSession(page, context, baseURL);
      await openMapConclusion(page, context, baseURL);
      await page.route(`**/api/user-map/conclusions/${FIXTURE_CORRECTABLE_CONCLUSION_ID}`, (route) => {
        if (route.request().method() === "PATCH") {
          return route.fulfill({ status: 500, body: JSON.stringify({ message: "fail" }) });
        }
        return route.continue();
      });
      await page
        .getByTestId("orvek-v0-map-page")
        .getByTestId("durable-correction-chip-confirm")
        .click();
      await expect(
        page.getByTestId("orvek-v0-map-page").getByTestId("durable-action-error")
      ).toBeVisible();
      await expect(
        page.getByTestId("orvek-v0-map-page").getByTestId("durable-correction-recorded")
      ).toHaveCount(0);

      await recoverAfterReload(page, context, baseURL);
      await page.unroute(`**/api/user-map/conclusions/${FIXTURE_CORRECTABLE_CONCLUSION_ID}`);
      await openMapConclusion(page, context, baseURL);
      await expect(
        page.getByTestId("orvek-v0-map-page").getByTestId("durable-correction-recorded")
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("fixture cleanup leaves zero assault records", async () => {
    await seedDurableActionsAssaultRuntimeFixture({ userId, db: prisma });
    const cleanup = await cleanupDurableActionsAssaultRuntimeFixture({ userId, db: prisma });
    console.log(
      `[durable-actions-assault] deletedConclusions=${cleanup.deletedConclusions} deletedActions=${cleanup.deletedActions} deletedFieldwork=${cleanup.deletedFieldwork} remainingConclusions=${cleanup.remainingConclusions} remainingActions=${cleanup.remainingActions} remainingFieldwork=${cleanup.remainingFieldwork}`
    );
    expect(cleanup.remainingConclusions).toBe(0);
    expect(cleanup.remainingActions).toBe(0);
    expect(cleanup.remainingFieldwork).toBe(0);
  });
});
