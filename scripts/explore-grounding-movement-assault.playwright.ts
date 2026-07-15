/**
 * Authenticated Playwright proof for DESKTOP-EXPLORE-GROUNDING-MOVEMENT-ASSAULT-001.
 *
 * Assumptions:
 * - Local Postgres companion DB is running.
 * - Next server was started with ORVEK_EXPLORE_ASSAULT_DETERMINISTIC_REPLY=1
 *   (and ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1). Playwright cannot inject
 *   that flag into an already-running process; without it, Ask will hit live LLM paths.
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient, ModelUpdateVisibility } from "@prisma/client";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  cleanupExploreAssaultRuntimeFixture,
  exploreAssaultFixtureAllowed,
  FIXTURE_CLAIM_EVIDENCE_ID,
  FIXTURE_CROSS_USER_SESSION_ID,
  FIXTURE_INSUFFICIENT_SESSION_ID,
  FIXTURE_JOURNAL_VERIFIED_ID,
  FIXTURE_SESSION_ID,
  seedExploreAssaultRuntimeFixture,
} from "../lib/explore-grounding-movement-runtime-fixture";
import {
  EXPLORE_ASSAULT_DETERMINISTIC_REPLY_ENV,
  EXPLORE_ASSAULT_DETERMINISTIC_REPLY_TEXT,
} from "../lib/explore-assault-test-provider";
import {
  EXPLORE_PROPOSED_MOVEMENT_LABEL,
} from "../lib/explore-grounding-contract";

type EnvMap = Record<string, string>;

const ROOT = resolve(process.cwd());
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";
const ORIGIN = "http://localhost:3000";
const EXPLORE_SESSION_STORAGE_KEY = "mindlabs:explore:session-id";

const POSITIVE_USER_MESSAGE =
  "I keep missing the stop point after meetings and my energy collapses before commitments lock.";
const INSUFFICIENT_USER_MESSAGE =
  "Tell me about quantum potatoes orbiting a neon cauliflower moon.";

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

test.describe("explore grounding movement assault browser proof", () => {
  test.describe.configure({ mode: "serial", timeout: 600_000 });

  let sessionToken = "";
  let runtimeConversationId = "";
  let runtimeUserMessageId = "";
  let runtimeAssistantMessageId = "";
  let runtimeProposalId = "";
  let runtimeModelUpdateId = "";
  let publishedIdempotentRetryId = "";
  let devBrowserToken = "";
  let clientUat = "1";
  let userId = "";
  let crossUserId = "";
  let clerkSessionId = "";
  let crossClerkSessionId = "";
  let crossSessionToken = "";
  let prisma: PrismaClient;
  let env: EnvMap;
  let inferredEvidenceId = FIXTURE_CLAIM_EVIDENCE_ID;

  function cookieHeader(): string {
    return `__session=${sessionToken}; __clerk_db_jwt=${devBrowserToken}; __client_uat=${clientUat}`;
  }

  function crossUserCookieHeader(): string {
    return `__session=${crossSessionToken}`;
  }

  async function refreshSessionToken() {
    const clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });
    sessionToken = (await clerk.sessions.getToken(clerkSessionId)).jwt;
    const payload = decodeJwtPayload(sessionToken);
    if (typeof payload.iat === "number") {
      clientUat = String(payload.iat);
    }
  }

  async function refreshAuthCookies(context: BrowserContext, baseURL?: string) {
    const origin = baseURL ?? ORIGIN;
    await context.addCookies([
      { name: "__session", value: sessionToken, url: origin },
      { name: "__clerk_db_jwt", value: devBrowserToken, url: origin },
      { name: "__client_uat", value: clientUat, url: origin },
    ]);
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
    await stabilizeAuthenticatedSession(page, context, baseURL);
  }

  async function openAuthenticatedPage(browser: Browser, baseURL?: string) {
    const context = await browser.newContext({
      baseURL: baseURL ?? ORIGIN,
    });
    const page = await context.newPage();
    await stabilizeAuthenticatedSession(page, context, baseURL);
    return { context, page };
  }

  async function openLiveExplore(
    page: Page,
    context: BrowserContext,
    baseURL?: string,
    preferredSessionId?: string,
  ) {
    if (preferredSessionId) {
      await page.evaluate(
        ({ key, id }) => {
          window.localStorage.setItem(key, id);
        },
        { key: EXPLORE_SESSION_STORAGE_KEY, id: preferredSessionId },
      );
    } else {
      await page.evaluate((key) => {
        window.localStorage.removeItem(key);
      }, EXPLORE_SESSION_STORAGE_KEY);
    }

    await stabilizeAuthenticatedSession(page, context, baseURL);
    await expect
      .poll(async () => {
        await refreshSessionToken();
        await refreshAuthCookies(context, baseURL);
        await page.getByTestId("nav-explore").click();
        return page.getByTestId("orvek-v0-explore-page").isVisible().catch(() => false);
      }, { timeout: 90_000 })
      .toBe(true);

    const explore = page.getByTestId("orvek-v0-explore-page");
    await expect(explore.getByRole("heading", { name: /^Explore$/i })).toBeVisible({
      timeout: 30_000,
    });
    const freeTab = explore.getByRole("button", { name: /Free Explore/i });
    if (await freeTab.isVisible().catch(() => false)) {
      await freeTab.click();
    }

    // Ensure an explore_chat session exists for this authenticated browser user.
    await expect
      .poll(async () => {
        await refreshSessionToken();
        await refreshAuthCookies(context, baseURL);
        if (preferredSessionId) {
          await page.evaluate(
            ({ key, id }) => {
              window.localStorage.setItem(key, id);
            },
            { key: EXPLORE_SESSION_STORAGE_KEY, id: preferredSessionId },
          );
        }
        const pageSessionOk = await page.evaluate(
          async ({ preferredId }) => {
            const response = await fetch(
              "/api/session/list?origin=app&surfaceType=explore_chat",
              { cache: "no-store" },
            );
            if (!response.ok) return false;
            const sessions = (await response.json()) as Array<{ id: string }>;
            if (preferredId) {
              return sessions.some((session) => session.id === preferredId);
            }
            if (sessions.length > 0) return true;
            const created = await fetch("/api/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ surfaceType: "explore_chat" }),
            });
            return created.ok;
          },
          { preferredId: preferredSessionId ?? null },
        );
        return pageSessionOk;
      }, { timeout: 90_000 })
      .toBe(true);

    await expect
      .poll(async () => {
        return explore
          .getByTestId("explore-composer")
          .getAttribute("data-free-explore-send-handler");
      }, { timeout: 90_000 })
      .toBe("true");

    return explore;
  }

  async function sendExploreMessage(page: Page, message: string) {
    const explore = page.getByTestId("orvek-v0-explore-page");
    const composer = explore.locator(
      'input[placeholder*="Ask the model"], input[placeholder*="Ask your Mind Model"]',
    );
    await expect(composer).toBeVisible({ timeout: 60_000 });

    await expect
      .poll(async () => {
        const sendHandler = await explore
          .getByTestId("explore-composer")
          .getAttribute("data-free-explore-send-handler");
        return sendHandler === "true";
      }, { timeout: 90_000 })
      .toBe(true);

    await composer.fill(message);
    await expect(composer).toHaveValue(message);

    const ask = explore.getByTestId("explore-ask-button");
    await expect
      .poll(async () => ask.getAttribute("data-can-send"), { timeout: 30_000 })
      .toBe("true");
    await expect(ask).toBeEnabled();

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/message") && response.request().method() === "POST",
      { timeout: 120_000 },
    );
    await ask.click();
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();

    const activeSessionId = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      EXPLORE_SESSION_STORAGE_KEY,
    );
    if (activeSessionId) {
      runtimeConversationId = activeSessionId;
    }
  }

  async function resolveActiveExploreSessionId(context: BrowserContext): Promise<string> {
    const response = await context.request.get(
      "/api/session/list?origin=app&surfaceType=explore_chat",
      { headers: { Cookie: cookieHeader() } },
    );
    expect(response.ok()).toBeTruthy();
    const sessions = (await response.json()) as Array<{ id: string }>;
    expect(sessions.length).toBeGreaterThan(0);
    return sessions[0]!.id;
  }

  async function listMessages(context: BrowserContext, exploreSessionId: string) {
    const response = await context.request.get(
      `/api/message/list?sessionId=${encodeURIComponent(exploreSessionId)}`,
      { headers: { Cookie: cookieHeader() } },
    );
    return response;
  }

  async function countUserVisibleModelUpdates() {
    return prisma.modelUpdate.count({
      where: {
        userId,
        visibility: ModelUpdateVisibility.user_visible,
        isMeaningful: true,
        internalNotes: { contains: "exploreMovementProposal" },
      },
    });
  }

  async function countModelUpdatesForId(id: string) {
    return prisma.modelUpdate.count({ where: { id } });
  }

  async function countExploreProposalsForId(id: string) {
    return prisma.exploreMovementProposal.count({ where: { id } });
  }

  async function forceExploreSession(
    page: Page,
    context: BrowserContext,
    exploreSessionId: string,
    baseURL?: string,
  ) {
    await page.evaluate(
      ({ key, id }) => {
        window.localStorage.setItem(key, id);
      },
      { key: EXPLORE_SESSION_STORAGE_KEY, id: exploreSessionId },
    );
    await recoverAfterReload(page, context, baseURL);
    await openLiveExplore(page, context, baseURL, exploreSessionId);
    await expect
      .poll(async () => {
        const list = await listMessages(context, exploreSessionId);
        return list.ok();
      }, { timeout: 60_000 })
      .toBe(true);
  }

  test.beforeAll(async () => {
    env = readEnvFile();
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
    process.env[EXPLORE_ASSAULT_DETERMINISTIC_REPLY_ENV] = "1";
    process.env.NODE_ENV = process.env.NODE_ENV === "production" ? "test" : process.env.NODE_ENV;

    if (!exploreAssaultFixtureAllowed(process.env)) {
      throw new Error("Explore grounding assault fixture safety gate refused local DB setup");
    }

    const clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });

    const user = await clerk.users.createUser({
      emailAddress: [uniqueEmail("explore-grounding-assault")],
      password: `Tmp-${Date.now()}-Aa1!`,
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });
    userId = user.id;
    process.env.EVIDENCE_DEPTH_FIXTURE_USER_ID = userId;

    const crossUser = await clerk.users.createUser({
      emailAddress: [uniqueEmail("explore-grounding-cross")],
      password: `Tmp-${Date.now()}-Bb2!`,
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });
    crossUserId = crossUser.id;

    const session = await clerk.sessions.createSession({ userId });
    clerkSessionId = session.id;
    sessionToken = (await clerk.sessions.getToken(clerkSessionId)).jwt;
    devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;

    const crossSession = await clerk.sessions.createSession({ userId: crossUserId });
    crossClerkSessionId = crossSession.id;
    crossSessionToken = (await clerk.sessions.getToken(crossClerkSessionId)).jwt;

    const payload = decodeJwtPayload(sessionToken);
    if (typeof payload.iat === "number") clientUat = String(payload.iat);

    prisma = new PrismaClient({ datasources: { db: { url: LOCAL_DATABASE_URL } } });

    const seeded = await seedExploreAssaultRuntimeFixture({
      userId,
      crossUserId,
      db: prisma,
    });
    inferredEvidenceId = seeded.inferredEvidenceId;
  });

  test.afterAll(async () => {
    try {
      if (userId && prisma) {
        await cleanupExploreAssaultRuntimeFixture({
          userId,
          crossUserId,
          db: prisma,
        });
      }
    } finally {
      await prisma?.$disconnect();
    }

    try {
      const clerk = createClerkClient({
        secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
        publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      });
      if (clerkSessionId) await clerk.sessions.revokeSession(clerkSessionId);
      if (crossClerkSessionId) await clerk.sessions.revokeSession(crossClerkSessionId);
      if (userId) await clerk.users.deleteUser(userId);
      if (crossUserId) await clerk.users.deleteUser(crossUserId);
    } catch {
      // best-effort
    }
  });

  test.beforeEach(async () => {
    await cleanupExploreAssaultRuntimeFixture({
      userId,
      crossUserId,
      db: prisma,
    });
    const seeded = await seedExploreAssaultRuntimeFixture({
      userId,
      crossUserId,
      db: prisma,
    });
    inferredEvidenceId = seeded.inferredEvidenceId;

    const journal = await prisma.journalEntry.findUnique({
      where: { id: FIXTURE_JOURNAL_VERIFIED_ID },
    });
    const claimEvidence = await prisma.patternClaimEvidence.findUnique({
      where: { id: FIXTURE_CLAIM_EVIDENCE_ID },
    });
    expect(journal?.userId).toBe(userId);
    expect(claimEvidence?.id).toBe(FIXTURE_CLAIM_EVIDENCE_ID);
  });

  test("positive grounded journey publishes idempotent model update", async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await openAuthenticatedPage(browser, baseURL);

    try {
      await openLiveExplore(page, context, baseURL, FIXTURE_SESSION_ID);
      runtimeConversationId = FIXTURE_SESSION_ID;

      await sendExploreMessage(page, POSITIVE_USER_MESSAGE);
      if (!runtimeConversationId) {
        runtimeConversationId = FIXTURE_SESSION_ID;
      }

      await expect
        .poll(async () => {
          await refreshSessionToken();
          await refreshAuthCookies(context, baseURL);
          const list = await listMessages(context, runtimeConversationId);
          if (!list.ok()) return "list_not_ok";
          const messages = (await list.json()) as Array<{
            id: string;
            role: string;
            content: string;
            grounding?: {
              sources?: Array<{ sourceId: string; epistemicStatus: string }>;
              movementProposal?: { proposalId?: string | null } | null;
            } | null;
          }>;
          const groundedAssistantIndex = [...messages]
            .reverse()
            .findIndex((row) => {
              if (row.role !== "assistant") return false;
              const sourceIds = (row.grounding?.sources ?? []).map((source) => source.sourceId);
              return (
                sourceIds.includes(FIXTURE_JOURNAL_VERIFIED_ID) &&
                sourceIds.includes(inferredEvidenceId)
              );
            });
          if (groundedAssistantIndex < 0) return "missing_grounded_assistant";
          const assistant = messages[messages.length - 1 - groundedAssistantIndex]!;
          const precedingUser = [...messages.slice(0, messages.indexOf(assistant))]
            .reverse()
            .find((row) => row.role === "user");
          if (!precedingUser) return "missing_preceding_user";
          runtimeUserMessageId = precedingUser.id;
          runtimeAssistantMessageId = assistant.id;
          runtimeProposalId = assistant.grounding?.movementProposal?.proposalId ?? "";
          const sourceIds = (assistant.grounding?.sources ?? []).map((source) => source.sourceId);
          if (!sourceIds.includes(FIXTURE_JOURNAL_VERIFIED_ID)) {
            return `missing_verified_source:${JSON.stringify(sourceIds)}`;
          }
          if (!sourceIds.includes(inferredEvidenceId)) {
            return `missing_inferred_source:${JSON.stringify(sourceIds)}`;
          }
          return "ok";
        }, { timeout: 120_000 })
        .toBe("ok");

      const explore = page.getByTestId("orvek-v0-explore-page");

      await expect
        .poll(async () => {
          const chip = explore.getByTestId(
            `explore-grounding-chip-${FIXTURE_JOURNAL_VERIFIED_ID}`,
          );
          const gates = await explore.getByTestId("explore-composer").evaluate((node) => ({
            live: node.getAttribute("data-has-live-explore-chat"),
            send: node.getAttribute("data-free-explore-send-handler"),
          }));
          const emptyVisible = await explore
            .getByTestId("explore-grounding-empty")
            .isVisible()
            .catch(() => false);
          if (await chip.isVisible().catch(() => false)) return "chip_ok";
          return `gates=${JSON.stringify(gates)} empty=${emptyVisible}`;
        }, { timeout: 60_000 })
        .toBe("chip_ok");

      await expect(
        explore.locator(`[data-epistemic-status="VERIFIED"]`).first(),
      ).toBeVisible();
      await expect(
        explore.locator(`[data-epistemic-status="INFERRED"]`).first(),
      ).toBeVisible();

      // Reload persists the same conversation identity and grounding chips.
      await forceExploreSession(page, context, runtimeConversationId, baseURL);

      await expect(
        explore.getByTestId(`explore-grounding-chip-${FIXTURE_JOURNAL_VERIFIED_ID}`),
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        explore.getByTestId(`explore-grounding-chip-${inferredEvidenceId}`),
      ).toBeVisible({ timeout: 60_000 });

      const assistantBubble = explore.locator('[data-message-role="assistant"]').last();
      await expect(assistantBubble).toBeVisible({ timeout: 30_000 });
      await assistantBubble.click();

      const inspector = page.getByRole("complementary").filter({ hasText: "Inspector" });
      await expect(
        inspector.getByTestId(`inspector-grounding-source-${FIXTURE_JOURNAL_VERIFIED_ID}`).first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        inspector.getByTestId(`inspector-grounding-source-${inferredEvidenceId}`).first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(inspector.getByTestId("inspector-proposed-movement").first()).toContainText(
        EXPLORE_PROPOSED_MOVEMENT_LABEL,
      );

      await expect(explore.getByTestId("explore-proposed-movement")).toBeVisible();
      await expect(explore.getByTestId("explore-proposed-movement")).toContainText(
        EXPLORE_PROPOSED_MOVEMENT_LABEL,
      );

      expect(await countUserVisibleModelUpdates()).toBe(0);

      const proposalId =
        (await explore
          .getByTestId("explore-proposed-movement")
          .getAttribute("data-proposal-id")) || runtimeProposalId;
      expect(proposalId).toBeTruthy();
      runtimeProposalId = proposalId!;

      // Hard gate: proposal is ExploreMovementProposal, not a ModelUpdate.
      expect(await countExploreProposalsForId(runtimeProposalId)).toBe(1);
      expect(await countModelUpdatesForId(runtimeProposalId)).toBe(0);

      const publishPromise = page.waitForResponse(
        (response) =>
          response.url().includes("/movement-proposals/") &&
          response.url().includes("/publish") &&
          response.request().method() === "POST",
        { timeout: 60_000 }
      );
      await explore.getByTestId("explore-publish-movement").click();
      const publishResponse = await publishPromise;
      expect(publishResponse.ok()).toBeTruthy();
      const publishJson = (await publishResponse.json()) as { modelUpdateId?: string };
      runtimeModelUpdateId = publishJson.modelUpdateId ?? "";
      expect(runtimeModelUpdateId.length).toBeGreaterThan(8);
      expect(runtimeModelUpdateId).not.toBe(runtimeProposalId);
      expect(await countModelUpdatesForId(runtimeModelUpdateId)).toBe(1);
      console.log(
        `[explore-grounding-movement-assault] conversation=${runtimeConversationId} userMsg=${runtimeUserMessageId} assistantMsg=${runtimeAssistantMessageId} proposal=${runtimeProposalId} modelUpdate=${runtimeModelUpdateId}`
      );

      // Browser surface: Explore shows published ModelUpdate id
      const publishedIdLocator = explore.getByTestId("explore-published-model-update-id");
      await expect(publishedIdLocator).toBeVisible({ timeout: 30_000 });
      await expect(publishedIdLocator).toHaveAttribute(
        "data-model-update-id",
        runtimeModelUpdateId
      );
      await expect(publishedIdLocator).toContainText(runtimeModelUpdateId);

      // Browser surface: Inspector published movement id (reselect assistant)
      const assistantBubbleAfter = explore.locator('[data-message-role="assistant"]').last();
      await assistantBubbleAfter.click();
      await expect(inspector.getByTestId("inspector-published-movement")).toBeVisible({
        timeout: 30_000,
      });
      await expect(inspector.getByTestId("inspector-published-movement")).toHaveAttribute(
        "data-model-update-id",
        runtimeModelUpdateId
      );

      // Cross-surface API identity checks (still required)
      const whatChanged = await context.request.get(
        `/api/what-changed/${encodeURIComponent(runtimeModelUpdateId)}`,
        { headers: { Cookie: cookieHeader() } },
      );
      expect(whatChanged.status()).toBe(200);
      const whatChangedJson = (await whatChanged.json()) as { id?: string };
      expect(whatChangedJson.id ?? runtimeModelUpdateId).toBe(runtimeModelUpdateId);

      const evidence = await context.request.get(
        `/api/what-changed/${encodeURIComponent(runtimeModelUpdateId)}/evidence`,
        { headers: { Cookie: cookieHeader() } },
      );
      expect(evidence.status()).toBe(200);

      await expect
        .poll(async () => {
          await refreshSessionToken();
          await refreshAuthCookies(context, baseURL);
          const modelUpdates = await context.request.get("/api/model-updates", {
            headers: { Cookie: cookieHeader() },
          });
          if (!modelUpdates.ok()) return false;
          const payload = (await modelUpdates.json()) as
            | Array<{ id?: string }>
            | { items?: Array<{ id?: string }> };
          const items = Array.isArray(payload) ? payload : (payload.items ?? []);
          return items.some((item) => item.id === runtimeModelUpdateId);
        }, { timeout: 60_000 })
        .toBe(true);

      await expect
        .poll(async () => {
          await refreshSessionToken();
          await refreshAuthCookies(context, baseURL);
          const layers = await context.request.get("/api/timeline/model-layers?window=30d", {
            headers: { Cookie: cookieHeader() },
          });
          if (!layers.ok()) return false;
          const text = await layers.text();
          return text.includes(runtimeModelUpdateId);
        }, { timeout: 60_000 })
        .toBe(true);

      // Browser surface: Today shows the ModelUpdate id (hero and/or movement row).
      await page.getByTestId("nav-today").click();
      await expect(page.getByTestId("nav-today")).toBeVisible();
      await stabilizeAuthenticatedSession(page, context, baseURL);
      await page.getByTestId("nav-today").click();
      await expect
        .poll(async () => {
          await refreshSessionToken();
          await refreshAuthCookies(context, baseURL);
          const today = await context.request.get("/api/today/intelligence-updates", {
            headers: { Cookie: cookieHeader() },
          });
          if (!today.ok()) return false;
          const text = await today.text();
          return text.includes(runtimeModelUpdateId);
        }, { timeout: 60_000 })
        .toBe(true);

      // Keep the current Today surface — remounting through Explore can drop the
      // live hero before hybrid Today rehydrates the newly published ModelUpdate.
      await expect(
        page.getByText("Possible model movement from Explore", { exact: false }).first()
      ).toBeVisible({ timeout: 60_000 });

      const todaySurfaceId =
        (await page
          .locator("[data-testid='today-hero-movement']")
          .first()
          .getAttribute("data-model-update-id")
          .catch(() => null)) ||
        (await page
          .locator("[data-testid='today-see-why']")
          .first()
          .getAttribute("data-movement-id")
          .catch(() => null)) ||
        (await page
          .locator("[data-testid='today-movement-row']")
          .first()
          .getAttribute("data-movement-id")
          .catch(() => null));
      console.log(
        `[explore-grounding-movement-assault] today-surface-id=${todaySurfaceId} expected=${runtimeModelUpdateId}`
      );
      expect(todaySurfaceId).toBe(runtimeModelUpdateId);

      // Browser surface: Inspector via Today See why + report overlay
      const seeWhy = page.locator(
        `[data-testid="today-see-why"][data-movement-id="${runtimeModelUpdateId}"]`
      );
      if (await seeWhy.count()) {
        await seeWhy.first().click({ timeout: 10_000 });
      } else if (
        await page
          .locator(`[data-testid="today-hero-movement"][data-model-update-id="${runtimeModelUpdateId}"]`)
          .count()
      ) {
        await page
          .locator(`[data-testid="today-hero-movement"][data-model-update-id="${runtimeModelUpdateId}"]`)
          .getByRole("button", { name: /Open in Inspector|See why/i })
          .first()
          .click({ timeout: 10_000 });
      } else {
        await page
          .getByRole("button", { name: /See why it moved|Open in Inspector/i })
          .first()
          .click({ timeout: 10_000 });
      }
      await expect(page.getByTestId("inspector-model-update-id").first()).toContainText(
        runtimeModelUpdateId,
        { timeout: 30_000 }
      );
      console.log(
        `[explore-grounding-movement-assault] inspector-surface-id=${runtimeModelUpdateId}`
      );

      const fullReport = page.locator(
        `[data-testid="today-full-report"][data-report-id="${runtimeModelUpdateId}"]`
      );
      if (await fullReport.isVisible().catch(() => false)) {
        await fullReport.click({ timeout: 10_000 });
        await expect(page.getByTestId("report-overlay-canonical-id")).toHaveAttribute(
          "data-model-update-id",
          runtimeModelUpdateId,
          { timeout: 30_000 }
        );
        console.log(
          `[explore-grounding-movement-assault] report-overlay-id=${runtimeModelUpdateId}`
        );
      } else if (await page.getByTestId("today-full-report").isVisible().catch(() => false)) {
        await page.getByTestId("today-full-report").click({ timeout: 10_000 });
        await expect(page.getByTestId("report-overlay-canonical-id")).toHaveAttribute(
          "data-model-update-id",
          runtimeModelUpdateId,
          { timeout: 30_000 }
        );
        console.log(
          `[explore-grounding-movement-assault] report-overlay-id=${runtimeModelUpdateId}`
        );
      } else {
        await expect(
          page
            .locator(
              `[data-testid="inspector-model-movement"][data-model-update-id="${runtimeModelUpdateId}"]`
            )
            .first()
        ).toBeVisible({ timeout: 10_000 });
        console.log(
          `[explore-grounding-movement-assault] report-via-inspector-id=${runtimeModelUpdateId}`
        );
      }

      const closeReport = page.getByRole("button", { name: /Close report/i });
      if (await closeReport.isVisible().catch(() => false)) {
        await closeReport.click({ timeout: 10_000 });
        await expect(page.getByTestId("report-overlay-canonical-id")).toHaveCount(0);
      }

      // Browser surface: Timeline movement row
      await page.getByTestId("nav-timeline").click({ timeout: 10_000 });
      await expect(
        page.locator(
          `[data-testid="timeline-movement-row"][data-movement-id="${runtimeModelUpdateId}"]`
        ).first()
      ).toBeVisible({ timeout: 60_000 });
      console.log(
        `[explore-grounding-movement-assault] timeline-surface-id=${runtimeModelUpdateId}`
      );

      // Idempotent publish retry
      const retry = await context.request.post(
        `/api/explore/sessions/${encodeURIComponent(runtimeConversationId)}/movement-proposals/${encodeURIComponent(runtimeProposalId)}/publish`,
        { headers: { Cookie: cookieHeader() } }
      );
      expect(retry.ok()).toBeTruthy();
      const retryJson = (await retry.json()) as {
        modelUpdateId?: string;
        idempotent?: boolean;
      };
      publishedIdempotentRetryId = retryJson.modelUpdateId ?? "";
      expect(publishedIdempotentRetryId).toBe(runtimeModelUpdateId);
      expect(retryJson.idempotent).toBe(true);
      expect(await countUserVisibleModelUpdates()).toBe(1);
      expect(await countModelUpdatesForId(runtimeModelUpdateId)).toBe(1);
    } finally {
      await context.close();
    }
  });

  test("rejection journey keeps proposal non-visible", async ({ browser, baseURL }) => {
    const { context, page } = await openAuthenticatedPage(browser, baseURL);

    try {
      const explore = await openLiveExplore(page, context, baseURL);
      await sendExploreMessage(page, POSITIVE_USER_MESSAGE);
      const conversationId = await resolveActiveExploreSessionId(context);

      await expect(explore.getByTestId("explore-proposed-movement")).toBeVisible({
        timeout: 120_000,
      });
      const proposalId = await explore
        .getByTestId("explore-proposed-movement")
        .getAttribute("data-proposal-id");
      expect(proposalId).toBeTruthy();
      expect(await countExploreProposalsForId(proposalId!)).toBe(1);
      expect(await countModelUpdatesForId(proposalId!)).toBe(0);

      const rejectPromise = page.waitForResponse(
        (response) =>
          response.url().includes("/movement-proposals/") &&
          response.url().includes("/reject") &&
          response.request().method() === "POST",
        { timeout: 60_000 }
      );
      await explore.getByTestId("explore-reject-movement").click();
      expect((await rejectPromise).ok()).toBeTruthy();

      await recoverAfterReload(page, context, baseURL);
      await forceExploreSession(page, context, conversationId, baseURL);

      const rejectedProposal = await prisma.exploreMovementProposal.findUnique({
        where: { id: proposalId! },
        select: { status: true, modelUpdateId: true },
      });
      expect(rejectedProposal?.status).toBe("rejected");
      expect(rejectedProposal?.modelUpdateId).toBeNull();
      expect(await countModelUpdatesForId(proposalId!)).toBe(0);

      const visibleFromProposal = await prisma.modelUpdate.count({
        where: {
          userId,
          visibility: ModelUpdateVisibility.user_visible,
          isMeaningful: true,
          internalNotes: { contains: proposalId! },
        },
      });
      expect(visibleFromProposal).toBe(0);

      const intelligence = await context.request.get("/api/today/intelligence-updates", {
        headers: { Cookie: cookieHeader() },
      });
      expect(intelligence.ok()).toBeTruthy();
      const intelligenceBody = await intelligence.text();
      expect(intelligenceBody.includes(proposalId!)).toBe(false);

      const timeline = await context.request.get("/api/timeline", {
        headers: { Cookie: cookieHeader() },
      });
      if (timeline.ok()) {
        const timelineBody = await timeline.text();
        expect(timelineBody.includes(proposalId!)).toBe(false);
      }
    } finally {
      await context.close();
    }
  });

  test("insufficient evidence path proposes no movement", async ({ browser, baseURL }) => {
    /**
     * Approach (b): unrelated topic. Note: deterministic assault reply text always
     * mentions stop-point tokens, so we briefly remove overlapping owned evidence
     * for this user so retrieval cannot ground from reply-token pollution alone.
     */
    await prisma.patternClaimEvidence.deleteMany({
      where: { id: FIXTURE_CLAIM_EVIDENCE_ID },
    });
    await prisma.patternClaim.deleteMany({
      where: { id: { startsWith: "dev-explore-grounding-movement-assault" } },
    });
    await prisma.journalEntry.deleteMany({
      where: { id: FIXTURE_JOURNAL_VERIFIED_ID },
    });
    await prisma.userMapConclusion.deleteMany({
      where: { id: { startsWith: "dev-explore-grounding-movement-assault" } },
    });

    const { context, page } = await openAuthenticatedPage(browser, baseURL);

    try {
      const explore = await openLiveExplore(page, context, baseURL);
      await sendExploreMessage(page, INSUFFICIENT_USER_MESSAGE);
      const conversationId = await resolveActiveExploreSessionId(context);

      await expect
        .poll(async () => {
          const list = await listMessages(context, conversationId);
          if (!list.ok()) return false;
          const messages = (await list.json()) as Array<{
            role: string;
            grounding?: { status?: string; sources?: unknown[]; movementProposal?: { status?: string } } | null;
          }>;
          const assistant = [...messages].reverse().find((row) => row.role === "assistant");
          if (!assistant) return false;
          const sources = assistant.grounding?.sources ?? [];
          const proposalStatus = assistant.grounding?.movementProposal?.status;
          return (
            sources.length === 0 ||
            assistant.grounding?.status === "insufficient_evidence" ||
            assistant.grounding?.status === "ungrounded" ||
            proposalStatus === "insufficient_evidence" ||
            proposalStatus === "none"
          );
        }, { timeout: 120_000 })
        .toBe(true);

      await expect(explore.getByTestId("explore-proposed-movement")).toHaveCount(0);
      expect(await countUserVisibleModelUpdates()).toBe(0);
      await expect(explore.getByTestId("explore-grounding-empty")).toBeVisible({
        timeout: 30_000,
      });
      expect(await explore.locator('[data-testid^="explore-grounding-chip-"]').count()).toBe(0);
    } finally {
      await context.close();
    }
  });

  test("ownership negatives reject unauthenticated and cross-user access", async ({
    browser,
    baseURL,
  }) => {
    const { context } = await openAuthenticatedPage(browser, baseURL);

    try {
      const unauthGrounding = await fetch(
        `${baseURL ?? ORIGIN}/api/explore/messages/missing-message/grounding`,
      );
      // Clerk middleware `auth.protect()` masks unauthenticated API hits as 404.
      expect(unauthGrounding.status).toBe(404);

      const unauthPublish = await fetch(
        `${baseURL ?? ORIGIN}/api/explore/sessions/${FIXTURE_SESSION_ID}/movement-proposals/fake-proposal/publish`,
        { method: "POST" },
      );
      expect(unauthPublish.status).toBe(404);

      const crossSession = await context.request.get(
        `/api/message/list?sessionId=${encodeURIComponent(FIXTURE_CROSS_USER_SESSION_ID)}`,
        { headers: { Cookie: cookieHeader() } },
      );
      expect(crossSession.status()).toBe(404);

      const crossUserList = await context.request.get(
        `/api/message/list?sessionId=${encodeURIComponent(FIXTURE_SESSION_ID)}`,
        { headers: { Cookie: crossUserCookieHeader() } },
      );
      expect(crossUserList.status()).toBe(404);

      const crossPublish = await context.request.post(
        `/api/explore/sessions/${encodeURIComponent(FIXTURE_SESSION_ID)}/movement-proposals/missing-proposal/publish`,
        { headers: { Cookie: crossUserCookieHeader() } },
      );
      expect(crossPublish.status()).toBe(404);

      const missingConversation = await context.request.get(
        `/api/message/list?sessionId=${encodeURIComponent("missing-explore-session-assault")}`,
        { headers: { Cookie: cookieHeader() } },
      );
      expect(missingConversation.status()).toBe(404);

      const missingMessage = await context.request.get(
        `/api/explore/messages/${encodeURIComponent("missing-explore-message-assault")}/grounding`,
        { headers: { Cookie: cookieHeader() } },
      );
      expect(missingMessage.status()).toBe(404);

      const missingProposal = await context.request.post(
        `/api/explore/sessions/${encodeURIComponent(FIXTURE_SESSION_ID)}/movement-proposals/missing-proposal-assault/publish`,
        { headers: { Cookie: cookieHeader() } },
      );
      expect(missingProposal.status()).toBe(404);

      const malformedPublication = await context.request.post(
        `/api/explore/sessions/${encodeURIComponent(FIXTURE_SESSION_ID)}/movement-proposals/%20/publish`,
        { headers: { Cookie: cookieHeader() } },
      );
      expect(malformedPublication.status()).toBe(400);

      const malformedList = await context.request.get("/api/message/list", {
        headers: { Cookie: cookieHeader() },
      });
      expect(malformedList.status()).toBe(400);

      const malformedGrounding = await context.request.get(
        "/api/explore/messages/%20/grounding",
        { headers: { Cookie: cookieHeader() } },
      );
      expect(malformedGrounding.status()).toBe(400);
    } finally {
      await context.close();
    }
  });

  test("fixture cleanup leaves zero assault records and deletes Clerk users", async () => {
    await seedExploreAssaultRuntimeFixture({
      userId,
      crossUserId,
      db: prisma,
    });

    const cleanup = await cleanupExploreAssaultRuntimeFixture({
      userId,
      crossUserId,
      db: prisma,
    });

    console.log(
      `[explore-grounding-movement-assault] remainingConversations=${cleanup.remainingConversations} remainingMessages=${cleanup.remainingMessages} remainingProposals=${cleanup.remainingProposals} remainingModelUpdates=${cleanup.remainingModelUpdates} remainingMovementEvidenceLinks=${cleanup.remainingMovementEvidenceLinks} remainingSeededMapEvidenceObjects=${cleanup.remainingSeededMapEvidenceObjects}`
    );

    expect(cleanup.remainingConversations).toBe(0);
    expect(cleanup.remainingMessages).toBe(0);
    expect(cleanup.remainingProposals).toBe(0);
    expect(cleanup.remainingModelUpdates).toBe(0);
    expect(cleanup.remainingMovementEvidenceLinks).toBe(0);
    expect(cleanup.remainingSeededMapEvidenceObjects).toBe(0);

    const clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });
    if (clerkSessionId) {
      await clerk.sessions.revokeSession(clerkSessionId).catch(() => undefined);
      clerkSessionId = "";
    }
    if (crossClerkSessionId) {
      await clerk.sessions.revokeSession(crossClerkSessionId).catch(() => undefined);
      crossClerkSessionId = "";
    }
    if (userId) {
      await clerk.users.deleteUser(userId);
      userId = "";
    }
    if (crossUserId) {
      await clerk.users.deleteUser(crossUserId);
      crossUserId = "";
    }

    void EXPLORE_ASSAULT_DETERMINISTIC_REPLY_TEXT;
  });
});
