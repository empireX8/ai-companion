/**
 * Issue #187 — authenticated browser regression for live canonical Explore proposals.
 *
 * Requires `PHASE6_MANAGE_SERVER=1` because the allowlisted Clerk user id is
 * created dynamically before the app server starts. This regression must use
 * the normal `/api/message` path: no seeded proposal rows, no test headers,
 * and no deterministic reply seam.
 *
 * Example:
 *
 *   PHASE6_MANAGE_SERVER=1 \
 *   DESKTOP_PARITY_BASE_URL=http://localhost:3100 \
 *   CANONICAL_AUTHORITY_DB_TEST_URL='postgresql://user@127.0.0.1:5432/companion_canonical_authority_test' \
 *   DATABASE_URL='postgresql://user@127.0.0.1:5432/companion_canonical_authority_test' \
 *   npx playwright test scripts/live-canonical-explore-proposal.playwright.ts
 */

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { createClerkClient } from "@clerk/backend";
import { ExploreMovementAuthorityMode, PrismaClient } from "@prisma/client";
import {
  chromium,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import { buildCanonicalModelPromptBlock } from "../lib/canonical-model-ai-context";
import {
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV,
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV,
} from "../lib/canonical-model-authority-flag";
import { readCanonicalModelProjection } from "../lib/canonical-model-projection";
import {
  LIVE_TEA_CORRECTION_MESSAGE,
  LIVE_TEA_JOURNAL_TITLE,
  LIVE_TEA_UMC_SUMMARY,
  LIVE_TEA_UMC_TITLE,
  seedLiveTeaMapUnderstanding,
} from "../lib/__tests__/helpers/live-tea-explore-proposal-fixture";

type EnvMap = Record<string, string>;
type AuthState = {
  userId: string;
  email: string;
  password: string;
  sessionId: string;
  sessionToken: string;
  clientUat: string;
  devBrowserToken: string;
};

const ROOT = resolve(process.cwd());
const DISPOSABLE_DB =
  process.env.CANONICAL_AUTHORITY_DB_TEST_URL ??
  "postgresql://user@127.0.0.1:5432/companion_canonical_authority_test";
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3100";
const PORT = new URL(ORIGIN).port || "3100";
const EXPLORE_SESSION_STORAGE_KEY = "mindlabs:explore:session-id";
const MANAGE_SERVER = process.env.PHASE6_MANAGE_SERVER === "1";

function readEnvFile(): EnvMap {
  const candidates = [resolve(ROOT, ".env"), "/Users/user/ai-companion/.env"];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const file = readFileSync(path, "utf8");
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
  throw new Error("Missing .env with Clerk + OpenAI keys");
}

function requireEnv(env: EnvMap, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

async function createAuth(
  clerk: ReturnType<typeof createClerkClient>,
  prefix: string,
): Promise<AuthState> {
  const email = `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = `Tmp-${Date.now()}-Aa1!`;
  const user = await clerk.users.createUser({
    emailAddress: [email],
    password,
    skipPasswordChecks: true,
    skipPasswordRequirement: true,
  });
  const session = await clerk.sessions.createSession({ userId: user.id });
  const token = await clerk.sessions.getToken(session.id);
  const payload = decodeJwtPayload(token.jwt);
  const testingToken = await clerk.testingTokens.createTestingToken();
  return {
    userId: user.id,
    email,
    password,
    sessionId: session.id,
    sessionToken: token.jwt,
    clientUat: typeof payload.iat === "number" ? String(payload.iat) : "1",
    devBrowserToken: testingToken.token,
  };
}

function cookieHeader(auth: AuthState): string {
  return `__session=${auth.sessionToken}; __clerk_db_jwt=${auth.devBrowserToken}; __client_uat=${auth.clientUat}`;
}

async function applyAuthCookies(context: BrowserContext, auth: AuthState): Promise<void> {
  await context.addCookies([
    {
      name: "__session",
      value: auth.sessionToken,
      url: ORIGIN,
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "__clerk_db_jwt",
      value: auth.devBrowserToken,
      url: ORIGIN,
      httpOnly: false,
      sameSite: "Lax",
    },
    {
      name: "__client_uat",
      value: auth.clientUat,
      url: ORIGIN,
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
}

async function refreshAuthCookies(
  context: BrowserContext,
  auth: AuthState,
  clerk: ReturnType<typeof createClerkClient>,
): Promise<void> {
  const refreshed = await clerk.sessions.getToken(auth.sessionId);
  auth.sessionToken = refreshed.jwt;
  auth.devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;
  const payload = decodeJwtPayload(refreshed.jwt);
  auth.clientUat = typeof payload.iat === "number" ? String(payload.iat) : auth.clientUat;
  await context.clearCookies();
  await applyAuthCookies(context, auth);
}

async function maybePasswordSignIn(page: Page, auth: AuthState): Promise<void> {
  if (!page.url().includes("/sign-in")) return;
  const email = page
    .locator(
      '#identifier-field, input[name="identifier"], input[autocomplete="username"], input[type="email"]',
    )
    .first();
  await expect(email).toBeVisible({ timeout: 30_000 });
  await email.fill(auth.email);
  await page
    .locator(
      '#password-field, input[name="password"], input[autocomplete="current-password"], input[type="password"]',
    )
    .first()
    .fill(auth.password);
  await page.getByRole("button", { name: /^Continue$/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), {
    timeout: 90_000,
  });
}

async function openAuthenticatedPage(
  browser: Browser,
  auth: AuthState,
  path: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: ORIGIN });
  await applyAuthCookies(context, auth);
  const page = await context.newPage();
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await maybePasswordSignIn(page, auth);
  await expect(
    page.getByTestId("nav-today").or(page.getByRole("button", { name: /^Today$/i })),
  ).toBeVisible({
    timeout: 60_000,
  });
  return { context, page };
}

async function openExplore(page: Page, auth?: AuthState): Promise<void> {
  const nav = page.getByTestId("nav-explore");
  if (await nav.isVisible().catch(() => false)) {
    await nav.click();
  } else if (
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /^Explore$/i })
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByRole("navigation").getByRole("button", { name: /^Explore$/i }).click();
  } else {
    await page.goto(`${ORIGIN}/explore`, { waitUntil: "domcontentloaded" });
  }
  if (auth) {
    await maybePasswordSignIn(page, auth);
    if (page.url().includes("/sign-in")) {
      await page.goto(`${ORIGIN}/explore`, { waitUntil: "domcontentloaded" });
      await maybePasswordSignIn(page, auth);
    }
  }
  await expect(page.getByRole("heading", { name: "Explore", level: 1 })).toBeVisible({
    timeout: 60_000,
  });
}

async function openMap(page: Page, auth?: AuthState): Promise<void> {
  const nav = page.getByTestId("nav-map");
  if (await nav.isVisible().catch(() => false)) {
    await nav.click();
  } else if (
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /^Map$/i })
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByRole("navigation").getByRole("button", { name: /^Map$/i }).click();
  } else {
    await page.goto(`${ORIGIN}/your-map`, { waitUntil: "domcontentloaded" });
  }
  if (auth) {
    await maybePasswordSignIn(page, auth);
    if (page.url().includes("/sign-in")) {
      await page.goto(`${ORIGIN}/your-map`, { waitUntil: "domcontentloaded" });
      await maybePasswordSignIn(page, auth);
    }
  }
  await expect(page.getByRole("heading", { name: "Map", level: 1 })).toBeVisible({
    timeout: 60_000,
  });
}

async function gotoWhatChanged(
  page: Page,
  context: BrowserContext,
  auth: AuthState,
  clerk: ReturnType<typeof createClerkClient>,
): Promise<void> {
  await refreshAuthCookies(context, auth, clerk);
  await page.goto(`${ORIGIN}/what-changed`, { waitUntil: "domcontentloaded" });
  await maybePasswordSignIn(page, auth);
  if (page.url().includes("/sign-in")) {
    await page.goto(`${ORIGIN}/what-changed`, { waitUntil: "domcontentloaded" });
  }
  await expect(page.getByTestId("orvek-v0-what-changed-page")).toBeVisible({
    timeout: 60_000,
  });
  expect(page.url()).toContain("/what-changed");
}

async function forceExploreSession(page: Page, sessionId: string): Promise<void> {
  await page.evaluate(
    ({ key, id }) => {
      window.localStorage.setItem(key, id);
      window.sessionStorage.setItem(key, id);
    },
    { key: EXPLORE_SESSION_STORAGE_KEY, id: sessionId },
  );
}

async function awaitExploreComposerReady(
  page: Page,
  context: BrowserContext,
  auth: AuthState,
  clerk: ReturnType<typeof createClerkClient>,
  sessionId: string,
): Promise<ReturnType<Page["getByPlaceholder"]>> {
  await page.goto(`${ORIGIN}/explore`, { waitUntil: "domcontentloaded" });
  await refreshAuthCookies(context, auth, clerk);
  await forceExploreSession(page, sessionId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await maybePasswordSignIn(page, auth);
  await openExplore(page, auth);
  await forceExploreSession(page, sessionId);

  const freeTab = page.getByRole("button", { name: /^Free Explore$/i });
  if (await freeTab.isVisible().catch(() => false)) {
    await freeTab.click();
  }

  const composer = page.getByPlaceholder(/Ask the model anything/i);
  const composerChrome = page.locator('[data-shell-slot="explore-composer"]');
  const send = page.locator('[data-shell-item="explore-send-action"]');
  await expect(composer).toBeVisible({ timeout: 60_000 });

  await expect
    .poll(
      async () => {
        await refreshAuthCookies(context, auth, clerk);
        const sessionState = await page.evaluate(async ({ preferredId }) => {
          const response = await fetch("/api/session/list?origin=app&surfaceType=explore_chat", {
            cache: "no-store",
          });
          if (!response.ok) {
            return { state: "session-list-not-ok", hasPreferredSession: false };
          }
          const sessions = (await response.json()) as Array<{ id: string }>;
          return {
            state: "session-list-ok",
            hasPreferredSession: preferredId
              ? sessions.some((session) => session.id === preferredId)
              : sessions.length > 0,
          };
        }, { preferredId: sessionId });
        if (sessionState.state !== "session-list-ok") {
          return "session-list-not-ok";
        }
        const gateState = await composerChrome.evaluate((node) => ({
          sendHandler: node.getAttribute("data-free-explore-send-handler"),
          hasOnSend: node.getAttribute("data-has-send-handler"),
          booting: node.getAttribute("data-explore-booting"),
          error: node.getAttribute("data-explore-error"),
        }));
        const composerEnabled = await composer.isEnabled().catch(() => false);
        const sendEnabled = await send.isEnabled().catch(() => false);
        if (
          !sessionState.hasPreferredSession ||
          !composerEnabled ||
          gateState.sendHandler !== "true" ||
          gateState.hasOnSend !== "true" ||
          gateState.booting === "true" ||
          sendEnabled !== true
        ) {
          await forceExploreSession(page, sessionId);
          await page.reload({ waitUntil: "domcontentloaded" });
          await openExplore(page, auth);
          const tab = page.getByRole("button", { name: /^Free Explore$/i });
          if (await tab.isVisible().catch(() => false)) {
            await tab.click();
          }
        }
        return JSON.stringify({
          hasPreferredSession: sessionState.hasPreferredSession,
          composerEnabled,
          sendEnabled,
          ...gateState,
        });
      },
      { timeout: 180_000, intervals: [2_000, 3_000, 5_000] },
    )
    .toContain('"sendEnabled":true');

  await expect(send).toBeEnabled({ timeout: 30_000 });

  return composer;
}

async function waitForServer(url: string, timeoutMs = 900_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status > 0) return;
    } catch {
      // retry
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
  }
  throw new Error(`Server not ready at ${url}`);
}

async function startNextServer(env: EnvMap, allowlistUserId: string): Promise<ChildProcess> {
  const skipBuild =
    process.env.PHASE6_SKIP_BUILD === "1" && existsSync(resolve(ROOT, ".next/BUILD_ID"));
  const command = skipBuild
    ? `PORT=${PORT} npm run start`
    : `NODE_OPTIONS=--max-old-space-size=8192 npm run build && PORT=${PORT} npm run start`;
  const child = spawn("bash", ["-lc", command], {
    cwd: ROOT,
    env: {
      ...process.env,
      ...env,
      OPENAI_API_KEY: requireEnv(env, "OPENAI_API_KEY"),
      DATABASE_URL: DISPOSABLE_DB,
      CANONICAL_AUTHORITY_DB_TEST_URL: DISPOSABLE_DB,
      [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "1",
      [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV]: allowlistUserId,
      ORVEK_CANONICAL_AI_REQUEST_CAPTURE: "0",
      ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY: "0",
      ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED: "",
      PORT,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr?.on("data", (buf) => {
    const text = String(buf);
    process.stderr.write(`[issue187-server-err] ${text.slice(0, 2000)}`);
  });
  child.stdout?.on("data", (buf) => {
    const text = String(buf);
    if (
      text.includes("Ready") ||
      text.includes("started") ||
      text.includes("Local:") ||
      text.includes("MESSAGE_POST") ||
      text.includes("CHAT_TIMING") ||
      text.includes("EXPLORE_MOVEMENT")
    ) {
      process.stdout.write(`[issue187-server] ${text.slice(0, 2000)}`);
    }
  });
  await waitForServer(`${ORIGIN}/sign-in`);
  return child;
}

async function stopServer(child: ChildProcess | null): Promise<void> {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 2_000));
  if (!child.killed) child.kill("SIGKILL");
}

async function openTeaOnMap(page: Page, auth?: AuthState): Promise<void> {
  await openMap(page, auth);
  const row = page.getByRole("button", { name: new RegExp(LIVE_TEA_UMC_TITLE, "i") }).first();
  const loadingHeading = page.getByRole("heading", {
    name: "Loading current understanding…",
    level: 2,
  });
  await expect
    .poll(
      async () =>
        JSON.stringify({
          rowVisible: await row.isVisible().catch(() => false),
          stillLoading: await loadingHeading.isVisible().catch(() => false),
        }),
      { timeout: 120_000, intervals: [1_000, 2_000, 5_000] },
    )
    .toContain('"rowVisible":true');
  await row.click();
}

test.describe("live canonical Explore proposal browser regression", () => {
  test.describe.configure({ mode: "serial", timeout: 600_000 });

  let env: EnvMap;
  let clerk: ReturnType<typeof createClerkClient>;
  let prisma: PrismaClient;
  let auth: AuthState;
  let browser: Browser;
  let server: ChildProcess | null = null;
  let conversationId = "";

  test.beforeAll(async () => {
    if (!MANAGE_SERVER) {
      throw new Error(
        "PHASE6_MANAGE_SERVER=1 is required for the live canonical Explore proposal browser regression",
      );
    }

    env = readEnvFile();
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: DISPOSABLE_DB },
      stdio: "pipe",
    });

    clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });
    auth = await createAuth(clerk, "issue187");

    server = await startNextServer(env, auth.userId);

    prisma = new PrismaClient({ datasources: { db: { url: DISPOSABLE_DB } } });
    await prisma.$connect();
    browser = await chromium.launch({ headless: true });

    const seeded = await seedLiveTeaMapUnderstanding({
      userId: auth.userId,
      db: prisma,
    });
    conversationId = seeded.conversationId;
  });

  test.afterAll(async () => {
    await browser?.close().catch(() => undefined);
    await stopServer(server);
    await prisma?.$disconnect().catch(() => undefined);
    if (auth?.sessionId) {
      await clerk.sessions.revokeSession(auth.sessionId).catch(() => undefined);
    }
    if (auth?.userId) {
      await clerk.users.deleteUser(auth.userId).catch(() => undefined);
    }
  });

  test("creates, surfaces, publishes, and rehydrates a canonical Explore proposal without seeded proposal rows or special headers", async () => {
    expect(
      await prisma.exploreMovementProposal.count({ where: { userId: auth.userId } }),
    ).toBe(0);
    expect(
      await prisma.referenceItem.count({
        where: { userId: auth.userId, statement: LIVE_TEA_UMC_SUMMARY },
      }),
    ).toBe(1);
    expect(await prisma.userMapConclusion.count({ where: { userId: auth.userId } })).toBe(0);
    expect(await prisma.canonicalConcept.count({ where: { userId: auth.userId } })).toBe(0);
    expect(await prisma.modelUpdate.count({ where: { userId: auth.userId } })).toBe(0);

    const { context, page } = await openAuthenticatedPage(browser, auth, "/your-map");
    try {
      await refreshAuthCookies(context, auth, clerk);
      await openTeaOnMap(page, auth);

      const currentUnderstanding = page.locator(
        '[data-shell-slot="map-current-understanding"]',
      );
      await expect(currentUnderstanding).toContainText(LIVE_TEA_UMC_SUMMARY);

      const composer = await awaitExploreComposerReady(
        page,
        context,
        auth,
        clerk,
        conversationId,
      );
      await composer.fill(LIVE_TEA_CORRECTION_MESSAGE);

      const messageResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/message") &&
          response.request().method() === "POST",
        { timeout: 300_000 },
      );
      const send = page.locator('[data-shell-item="explore-send-action"]');
      await expect(send).toBeEnabled({ timeout: 30_000 });
      await send.click({ force: true });
      const messageResponse = await messageResponsePromise;
      if (!messageResponse.ok()) {
        throw new Error(
          `POST /api/message failed status=${messageResponse.status()} body=${(
            await messageResponse.text()
          ).slice(0, 800)}`,
        );
      }

      await expect
        .poll(
          async () =>
            prisma.exploreMovementProposal.count({
              where: { userId: auth.userId },
            }),
          { timeout: 300_000, intervals: [2_000, 3_000, 5_000] },
        )
        .toBe(1);

      await expect
        .poll(
          async () =>
            prisma.userMapConclusion.count({
              where: { userId: auth.userId, summary: LIVE_TEA_UMC_SUMMARY },
            }),
          { timeout: 120_000, intervals: [1_000, 2_000, 3_000] },
        )
        .toBe(1);
      await expect
        .poll(
          async () =>
            prisma.canonicalConcept.count({
              where: { userId: auth.userId },
            }),
          { timeout: 120_000, intervals: [1_000, 2_000, 3_000] },
        )
        .toBe(1);

      await awaitExploreComposerReady(
        page,
        context,
        auth,
        clerk,
        conversationId,
      );

      const proposalCard = page.getByTestId("explore-proposed-movement");
      const publishButton = page.getByTestId("explore-publish-movement");
      await expect(proposalCard).toBeVisible({ timeout: 60_000 });
      await expect(proposalCard).toContainText(LIVE_TEA_UMC_SUMMARY);
      await expect(page.getByTestId("explore-proposal-rationale")).toBeVisible();
      await expect(page.getByTestId("explore-proposal-evidence")).toContainText(
        LIVE_TEA_JOURNAL_TITLE,
      );
      await expect(publishButton).toBeVisible();
      await expect(publishButton).toBeEnabled({ timeout: 60_000 });
      await expect(page.locator('[data-shell-slot="explore-detection"]')).toContainText(
        "A proposed model update is ready for review.",
      );

      const proposal = await prisma.exploreMovementProposal.findFirstOrThrow({
        where: { userId: auth.userId },
      });
      expect(proposal.authorityMode).toBe(ExploreMovementAuthorityMode.canonical_v1);
      expect(proposal.status).toBe("proposed");
      expect(proposal.modelUpdateId).toBeNull();
      expect(proposal.canonicalConceptId).toBeTruthy();

      const publishResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/movement-proposals/${encodeURIComponent(proposal.id)}/publish`) &&
          response.request().method() === "POST",
        { timeout: 120_000 },
      );
      await publishButton.click({ force: true });
      const publishResponse = await publishResponsePromise;
      if (!publishResponse.ok()) {
        throw new Error(
          `Publish failed status=${publishResponse.status()} body=${(
            await publishResponse.text()
          ).slice(0, 800)}`,
        );
      }

      const publishJson = (await publishResponse.json()) as { modelUpdateId?: string };
      const modelUpdateId = publishJson.modelUpdateId;
      if (!modelUpdateId) {
        throw new Error("Publish response did not return modelUpdateId");
      }

      await expect
        .poll(
          async () =>
            prisma.modelUpdate.findUnique({
              where: { id: modelUpdateId! },
              select: { id: true },
            }),
          { timeout: 120_000, intervals: [1_000, 2_000, 3_000] },
        )
        .not.toBeNull();

      const modelUpdate = await prisma.modelUpdate.findUniqueOrThrow({
        where: { id: modelUpdateId },
      });
      if (!modelUpdate.canonicalConceptId || !modelUpdate.afterSummary || !modelUpdate.resultingRevisionId) {
        throw new Error("Published canonical model update is missing required canonical identity fields");
      }
      expect(modelUpdate.afterSummary).not.toBe(LIVE_TEA_UMC_SUMMARY);

      const expectedSummary = modelUpdate.afterSummary;
      const conceptId = modelUpdate.canonicalConceptId;
      const resultingRevisionId = modelUpdate.resultingRevisionId;

      const canonicalConceptApi = await page.request.get(
        `${ORIGIN}/api/current-understanding/canonical-concepts/${encodeURIComponent(conceptId)}`,
        {
          headers: {
            Cookie: cookieHeader(auth),
          },
        },
      );
      expect(canonicalConceptApi.status()).toBe(200);
      const conceptBody = (await canonicalConceptApi.json()) as {
        conceptId: string;
        currentRevisionId: string;
        version: number;
        summary: string;
      };
      expect(conceptBody.conceptId).toBe(conceptId);
      expect(conceptBody.currentRevisionId).toBe(resultingRevisionId);
      expect(conceptBody.version).toBe(2);
      expect(conceptBody.summary).toBe(expectedSummary);

      const whatChangedDetailApi = await page.request.get(
        `${ORIGIN}/api/what-changed/${encodeURIComponent(modelUpdateId)}`,
        {
          headers: {
            Cookie: cookieHeader(auth),
          },
        },
      );
      if (!whatChangedDetailApi.ok()) {
        throw new Error(
          `What Changed detail failed status=${whatChangedDetailApi.status()} body=${(
            await whatChangedDetailApi.text()
          ).slice(0, 800)}`,
        );
      }
      const whatChangedDetailBody = (await whatChangedDetailApi.json()) as {
        item?: { id?: string; userFacingSummary?: string };
        report?: { modelMovement?: { before?: string | null; after?: string | null } };
      };
      expect(whatChangedDetailBody.item?.id).toBe(modelUpdateId);
      expect(whatChangedDetailBody.item?.userFacingSummary).toBe(modelUpdate.userFacingSummary);
      expect(whatChangedDetailBody.report?.modelMovement?.before).toBe(LIVE_TEA_UMC_SUMMARY);
      expect(whatChangedDetailBody.report?.modelMovement?.after).toBe(expectedSummary);

      await page
        .getByTestId("nav-timeline")
        .or(page.getByRole("navigation").getByRole("button", { name: /^Timeline$/i }))
        .click();
      await expect(page.getByRole("heading", { name: "Timeline", level: 1 })).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText(expectedSummary).first()).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(LIVE_TEA_UMC_SUMMARY).first()).toBeVisible({
        timeout: 60_000,
      });

      await gotoWhatChanged(page, context, auth, clerk);
      const movementCard = page.getByTestId("what-changed-primary-movement");
      await expect(movementCard).toBeVisible({ timeout: 60_000 });
      await expect(movementCard).toHaveAttribute("data-model-update-id", modelUpdateId!);
      await expect(movementCard).toContainText(expectedSummary);
      await expect(movementCard).toContainText(LIVE_TEA_UMC_SUMMARY);
      await page.getByRole("button", { name: /Open in inspector/i }).first().click();
      const inspectorMovement = page.getByRole("complementary").getByTestId("inspector-model-movement").first();
      await expect(inspectorMovement).toBeVisible({ timeout: 60_000 });
      await expect(inspectorMovement).toHaveAttribute("data-model-update-id", modelUpdateId!);
      await expect(inspectorMovement).toContainText(expectedSummary);
      await expect(inspectorMovement).toContainText(LIVE_TEA_UMC_SUMMARY);

      const projection = await readCanonicalModelProjection({
        userId: auth.userId,
        db: prisma,
      });
      const canonicalPromptBlock = buildCanonicalModelPromptBlock({ projection });
      expect(canonicalPromptBlock).toContain(`summary: ${expectedSummary}`);
      expect(canonicalPromptBlock).not.toContain(`summary: ${LIVE_TEA_UMC_SUMMARY}`);
      expect(canonicalPromptBlock).toContain(`latest_model_update_id: ${modelUpdateId}`);

      await page.goto(`${ORIGIN}/your-map`, { waitUntil: "domcontentloaded" });
      await openTeaOnMap(page, auth);
      await expect(currentUnderstanding).toContainText(expectedSummary);

      await page.reload({ waitUntil: "domcontentloaded" });
      await openTeaOnMap(page, auth);
      await expect(currentUnderstanding).toContainText(expectedSummary);

      await page
        .getByTestId("nav-today")
        .or(page.getByRole("navigation").getByRole("button", { name: /^Today$/i }))
        .click();
      await openTeaOnMap(page, auth);
      await expect(currentUnderstanding).toContainText(expectedSummary);
    } finally {
      await context.close();
    }
  });
});
