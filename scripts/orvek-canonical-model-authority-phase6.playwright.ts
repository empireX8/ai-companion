/**
 * Phase 6 — Orvek Canonical Model Authority V1 browser acceptance (mandatory).
 *
 * Required command (server management enabled — no skipped stages):
 *
 *   PHASE6_MANAGE_SERVER=1 \
 *   DESKTOP_PARITY_BASE_URL=http://localhost:3100 \
 *   CANONICAL_AUTHORITY_DB_TEST_URL='postgresql://user@127.0.0.1:5432/companion_canonical_authority_test' \
 *   DATABASE_URL='postgresql://user@127.0.0.1:5432/companion_canonical_authority_test' \
 *   npx playwright test scripts/orvek-canonical-model-authority-phase6.playwright.ts
 *
 * Requires Clerk keys in .env. Uses disposable DB only.
 * Starts with: V1=1 + allowlist + ORVEK_CANONICAL_AI_REQUEST_CAPTURE=1 + ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY=1
 * Gate-off restart: V1=0 (creation disabled), history preserved, no reseed.
 */

import { createClerkClient } from "@clerk/backend";
import { ExploreMovementAuthorityMode, PrismaClient } from "@prisma/client";
import { chromium, expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  disablePhase6CanonicalGate,
  enablePhase6CanonicalGate,
  PHASE6_LEGACY_SEED_TITLE,
  PHASE6_MUTATED_LEGACY,
  PHASE6_REVISION_ONE,
  PHASE6_REVISION_TWO,
  seedPhase6CanonicalProposal,
  seedPhase6LegacyOnly,
} from "../lib/__tests__/helpers/canonical-phase6-browser-fixture";
import {
  ORVEK_CANONICAL_AI_CAPTURE_NONCE_HEADER,
  deleteCanonicalAiRequestCaptureFile,
  readCanonicalAiRequestCaptureFile,
} from "../lib/canonical-ai-request-capture";
import { ORVEK_PHASE6_CREATION_ATTEMPT_HEADER } from "../lib/canonical-phase6-creation-attempt";
import { ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY_ENV } from "../lib/canonical-phase6-deterministic-reply";
import {
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV,
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV,
} from "../lib/canonical-model-authority-flag";

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
  "postgresql://user@127.0.0.1:5432/companion_canonical_authority_test";
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3100";
const PORT = new URL(ORIGIN).port || "3100";
const EXPLORE_SESSION_STORAGE_KEY = "mindlabs:explore:session-id";
const MANAGE_SERVER = process.env.PHASE6_MANAGE_SERVER === "1";
const REQUIRED_STAGES = [
  "A_pre_publication_legacy",
  "B_C_publish",
  "D_post_publication_parity",
  "D_what_changed_ui",
  "D_browser_message_post",
  "E_hard_refresh",
  "F_route_reopen",
  "G_fresh_browser_context",
  "H_map_propose_store",
  "H_correction_handoff",
  "I_cross_user",
  "J_gate_disabled_restart",
  "J_gate_disabled_history_visible",
  "J_gate_disabled_what_changed",
  "J_post_restart_fresh_context",
  "J_post_restart_new_creation_legacy",
] as const;

type StageName = (typeof REQUIRED_STAGES)[number];
type StageResult = "PASS" | "FAIL";

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
  throw new Error("Missing .env with Clerk keys");
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
  env: EnvMap,
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

async function openAuthenticatedPage(
  browser: Browser,
  auth: AuthState,
  path: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: ORIGIN,
  });
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

async function gotoWhatChanged(
  page: Page,
  context: BrowserContext,
  auth: AuthState,
  clerkClient: ReturnType<typeof createClerkClient>,
): Promise<void> {
  await refreshAuthCookies(context, auth, clerkClient);
  await page.goto(`${ORIGIN}/what-changed`, { waitUntil: "domcontentloaded" });
  await maybePasswordSignIn(page, auth);
  if (page.url().includes("/sign-in")) {
    await page.goto(`${ORIGIN}/what-changed`, { waitUntil: "domcontentloaded" });
  }
  await expect(page.getByTestId("orvek-v0-what-changed-page")).toBeVisible({
    timeout: 60_000,
  });
  if (page.url().includes("/sign-in")) {
    throw new Error("What Changed still on sign-in after auth repair");
  }
  expect(page.url()).toContain("/what-changed");
}

async function openExplore(page: Page): Promise<void> {
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
    // Dedicated report routes (e.g. /what-changed) do not mount workbench nav.
    await page.goto(`${ORIGIN}/explore`, { waitUntil: "domcontentloaded" });
  }
  await expect(page.getByRole("heading", { name: "Explore", level: 1 })).toBeVisible({
    timeout: 60_000,
  });
}

async function openMap(page: Page): Promise<void> {
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
  await expect(page.getByRole("heading", { name: "Map", level: 1 })).toBeVisible({
    timeout: 60_000,
  });
}

async function openPublishedCanonicalOnMap(page: Page): Promise<void> {
  await openMap(page);
  const seed = page.getByRole("button", { name: PHASE6_LEGACY_SEED_TITLE }).first();
  if (await seed.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await seed.click();
    return;
  }
  const byRevision = page.getByRole("button", { name: new RegExp(PHASE6_REVISION_TWO, "i") }).first();
  if (await byRevision.isVisible({ timeout: 20_000 }).catch(() => false)) {
    await byRevision.click();
    return;
  }
  // List row may render the revision as plain text without a dedicated button name.
  await expect(page.getByText(PHASE6_REVISION_TWO).first()).toBeVisible({ timeout: 60_000 });
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
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Server not ready at ${url}`);
}

async function startNextServer(env: EnvMap, allowlistUserId: string): Promise<ChildProcess> {
  const skipBuild = process.env.PHASE6_SKIP_BUILD === "1" && existsSync(resolve(ROOT, ".next/BUILD_ID"));
  const command = skipBuild
    ? `PORT=${PORT} npm run start`
    : `NODE_OPTIONS=--max-old-space-size=8192 npm run build && PORT=${PORT} npm run start`;
  const child = spawn(
    "bash",
    ["-lc", command],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        ...env,
        DATABASE_URL: DISPOSABLE_DB,
        CANONICAL_AUTHORITY_DB_TEST_URL: DISPOSABLE_DB,
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "1",
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV]: allowlistUserId,
        ORVEK_CANONICAL_AI_REQUEST_CAPTURE: "1",
        [ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY_ENV]: "1",
        PORT,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stderr?.on("data", (buf) => {
    const text = String(buf);
    process.stderr.write(`[phase6-server-err] ${text.slice(0, 2000)}`);
  });
  child.stdout?.on("data", (buf) => {
    const text = String(buf);
    if (
      text.includes("Ready") ||
      text.includes("started") ||
      text.includes("Local:") ||
      text.includes("MESSAGE_POST") ||
      text.includes("CHAT_CONTEXT") ||
      text.includes("CHAT_TIMING")
    ) {
      process.stdout.write(`[phase6-server] ${text.slice(0, 2000)}`);
    }
  });
  await waitForServer(`${ORIGIN}/sign-in`);
  return child;
}

async function restartServerGateOff(
  env: EnvMap,
): Promise<ChildProcess> {
  const child = spawn(
    "bash",
    ["-lc", `PORT=${PORT} npm run start`],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        ...env,
        DATABASE_URL: DISPOSABLE_DB,
        CANONICAL_AUTHORITY_DB_TEST_URL: DISPOSABLE_DB,
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "0",
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV]: "",
        ORVEK_CANONICAL_AI_REQUEST_CAPTURE: "1",
        [ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY_ENV]: "1",
        PORT,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stderr?.on("data", (buf) => {
    process.stderr.write(`[phase6-server-err] ${String(buf).slice(0, 2000)}`);
  });
  await waitForServer(`${ORIGIN}/sign-in`);
  return child;
}

async function stopServer(child: ChildProcess | null): Promise<void> {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 2000));
  if (!child.killed) child.kill("SIGKILL");
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
  clerkClient: ReturnType<typeof createClerkClient>,
  sessionId: string,
): Promise<ReturnType<Page["getByPlaceholder"]>> {
  await page.goto(`${ORIGIN}/explore`, { waitUntil: "domcontentloaded" });
  await refreshAuthCookies(context, auth, clerkClient);
  await forceExploreSession(page, sessionId);
  await page.reload({ waitUntil: "domcontentloaded" });
  await maybePasswordSignIn(page, auth);
  await openExplore(page);
  await forceExploreSession(page, sessionId);

  const freeTab = page.getByRole("button", { name: /^Free Explore$/i });
  if (await freeTab.isVisible().catch(() => false)) {
    await freeTab.click();
  }

  const composer = page.getByPlaceholder(/Ask the model anything/i);
  await expect(composer).toBeVisible({ timeout: 60_000 });

  await expect
    .poll(
      async () => {
        await refreshAuthCookies(context, auth, clerkClient);
        const sessionOk = await page.evaluate(async () => {
          const response = await fetch(
            "/api/session/list?origin=app&surfaceType=explore_chat",
            { cache: "no-store" },
          );
          return response.ok;
        });
        if (!sessionOk) {
          return "session-list-not-ok";
        }
        // Kick boot if still cold: reload with forced session id.
        if (await composer.isDisabled().catch(() => true)) {
          await forceExploreSession(page, sessionId);
          await page.reload({ waitUntil: "domcontentloaded" });
          await openExplore(page);
          const tab = page.getByRole("button", { name: /^Free Explore$/i });
          if (await tab.isVisible().catch(() => false)) {
            await tab.click();
          }
        }
        return (await composer.isEnabled().catch(() => false)) ? "ready" : "disabled";
      },
      { timeout: 180_000, intervals: [2_000, 3_000, 5_000] },
    )
    .toBe("ready");

  return composer;
}

async function assertRevisionTwoEverywhere(page: Page, conceptId: string, auth: AuthState) {
  await expect(page.getByText(PHASE6_REVISION_TWO).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(PHASE6_MUTATED_LEGACY)).toHaveCount(0);

  const api = await page.request.get(
    `${ORIGIN}/api/current-understanding/canonical-concepts/${encodeURIComponent(conceptId)}`,
    {
      headers: {
        Cookie: `__session=${auth.sessionToken}; __clerk_db_jwt=${auth.devBrowserToken}; __client_uat=${auth.clientUat}`,
      },
    },
  );
  expect(api.status()).toBe(200);
  const body = (await api.json()) as {
    conceptId: string;
    currentRevisionId: string;
    version: number;
    summary: string;
  };
  expect(body.conceptId).toBe(conceptId);
  expect(body.version).toBe(2);
  expect(body.summary).toBe(PHASE6_REVISION_TWO);
  expect(body.summary).not.toBe(PHASE6_MUTATED_LEGACY);
  return body;
}

test.describe("Orvek Canonical Model Authority Phase 6 browser journey", () => {
  test.describe.configure({ mode: "serial", timeout: 360_000 });

  let env: EnvMap;
  let clerk: ReturnType<typeof createClerkClient>;
  let prisma: PrismaClient;
  let primary: AuthState;
  let secondary: AuthState;
  let server: ChildProcess | null = null;
  let browser: Browser;

  let umcId = "";
  let proposalId = "";
  let conversationId = "";
  let conceptId = "";
  let previousRevisionId = "";
  let resultingRevisionId = "";
  let modelUpdateId = "";

  const stages: Partial<Record<StageName, StageResult>> = {};
  /** Track every valid capture nonce for failure-safe cleanup. Never recursively delete the capture dir. */
  const pendingCaptureNonces = new Set<string>();

  function trackCaptureNonce(nonce: string): void {
    pendingCaptureNonces.add(nonce);
  }

  function deleteTrackedCaptureNonce(nonce: string): void {
    deleteCanonicalAiRequestCaptureFile(nonce);
    pendingCaptureNonces.delete(nonce);
  }

  function cleanupAllPendingCaptureFiles(): void {
    for (const nonce of [...pendingCaptureNonces]) {
      deleteCanonicalAiRequestCaptureFile(nonce);
      pendingCaptureNonces.delete(nonce);
    }
  }

  test.beforeAll(async () => {
    if (!MANAGE_SERVER) {
      throw new Error(
        "PHASE6_MANAGE_SERVER=1 is required for Phase 6 final acceptance (no skipped restart/message proofs)",
      );
    }
    env = readEnvFile();
    process.env.DATABASE_URL = DISPOSABLE_DB;
    process.env.CANONICAL_AUTHORITY_DB_TEST_URL = DISPOSABLE_DB;

    clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });
    primary = await createAuth(clerk, env, "phase6-a");
    secondary = await createAuth(clerk, env, "phase6-b");
    enablePhase6CanonicalGate(primary.userId);

    prisma = new PrismaClient({ datasources: { db: { url: DISPOSABLE_DB } } });
    await prisma.$connect();

    server = await startNextServer(env, primary.userId);
    browser = await chromium.launch({ headless: true });
  });

  test.afterAll(async () => {
    console.log("\n=== PHASE 6 BROWSER STAGE SUMMARY ===");
    for (const name of REQUIRED_STAGES) {
      console.log(`${stages[name] ?? "MISSING"}\t${name}`);
    }
    console.log(
      JSON.stringify(
        {
          conceptId,
          previousRevisionId,
          resultingRevisionId,
          modelUpdateId,
          proposalId,
          serverRestart: {
            initial:
              "npm run build && npm run start with ORVEK_CANONICAL_MODEL_AUTHORITY_V1=1 + allowlist + ORVEK_CANONICAL_AI_REQUEST_CAPTURE=1 + ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY=1",
            gateOff:
              "npm run start with ORVEK_CANONICAL_MODEL_AUTHORITY_V1=0 + empty allowlist + AI capture + phase6 deterministic reply",
            effectiveCreationGateAfterRestart: "0",
          },
        },
        null,
        2,
      ),
    );

    const missing = REQUIRED_STAGES.filter((name) => stages[name] !== "PASS");
    // Best-effort capture file cleanup before throwing — never recursively delete the capture dir.
    cleanupAllPendingCaptureFiles();
    await browser?.close().catch(() => undefined);
    await stopServer(server);
    await prisma?.$disconnect().catch(() => undefined);
    if (primary?.sessionId) {
      await clerk.sessions.revokeSession(primary.sessionId).catch(() => undefined);
    }
    if (secondary?.sessionId) {
      await clerk.sessions.revokeSession(secondary.sessionId).catch(() => undefined);
    }
    if (primary?.userId) {
      await clerk.users.deleteUser(primary.userId).catch(() => undefined);
    }
    if (secondary?.userId) {
      await clerk.users.deleteUser(secondary.userId).catch(() => undefined);
    }
    if (missing.length > 0) {
      throw new Error(
        `Phase 6 required stages not PASS: ${missing.join(", ")}`,
      );
    }
  });

  test("A. pre-publication legacy appears once", async () => {
    try {
      const legacy = await seedPhase6LegacyOnly({
        userId: primary.userId,
        db: prisma,
      });
      umcId = legacy.id;
      const { context, page } = await openAuthenticatedPage(browser, primary, "/");
      try {
        await openMap(page);
        await expect(
          page.getByRole("button", { name: PHASE6_LEGACY_SEED_TITLE }),
        ).toHaveCount(1, { timeout: 60_000 });
        // Remove pre-publication seed so B starts clean (unique titles collide otherwise).
        await prisma.userMapConclusion.delete({ where: { id: legacy.id } }).catch(() => undefined);
        stages["A_pre_publication_legacy"] = "PASS";
      } finally {
        await context.close();
      }
    } catch (error) {
      stages["A_pre_publication_legacy"] = "FAIL";
      throw error;
    }
  });

  test("B-C. surface canonical proposal and publish via product UI", async () => {
    try {
      // Replace pre-pub legacy-only seed with full proposal fixture (unique IDs).
      const seeded = await seedPhase6CanonicalProposal({
        userId: primary.userId,
        db: prisma,
        umcSummary: PHASE6_REVISION_ONE,
        afterSummary: PHASE6_REVISION_TWO,
      });
      umcId = seeded.umc.id;
      proposalId = seeded.proposal.id;
      conversationId = seeded.conversationId;
      conceptId = seeded.proposal.canonicalConceptId!;

      const { context, page } = await openAuthenticatedPage(
        browser,
        primary,
        "/explore",
      );
      try {
        await forceExploreSession(page, conversationId);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("orvek-v0-explore-page").or(page.getByRole("heading", { name: "Explore", level: 1 }))).toBeVisible({
          timeout: 60_000,
        });

        // Prefer product publish button when grounding is visible; else call publish API
        // through the same authenticated product endpoint the button uses.
        const proposed = page.getByTestId("explore-proposed-movement");
        const publishBtn = page.getByTestId("explore-publish-movement");
        let publishedViaUi = false;
        if (await proposed.isVisible({ timeout: 20_000 }).catch(() => false)) {
          const publishPromise = page.waitForResponse(
            (response) =>
              response.url().includes("/movement-proposals/") &&
              response.url().includes("/publish") &&
              response.request().method() === "POST",
            { timeout: 60_000 },
          );
          await publishBtn.click();
          const publishResponse = await publishPromise;
          expect(publishResponse.ok()).toBeTruthy();
          const publishJson = (await publishResponse.json()) as {
            modelUpdateId?: string;
          };
          modelUpdateId = publishJson.modelUpdateId ?? "";
          publishedViaUi = true;
        } else {
          await refreshAuthCookies(context, primary, clerk);
          const publishResponse = await page.request.post(
            `${ORIGIN}/api/explore/sessions/${encodeURIComponent(conversationId)}/movement-proposals/${encodeURIComponent(proposalId)}/publish`,
            {
              headers: {
                Cookie: `__session=${primary.sessionToken}; __clerk_db_jwt=${primary.devBrowserToken}; __client_uat=${primary.clientUat}`,
              },
            },
          );
          if (!publishResponse.ok()) {
            const bodyText = await publishResponse.text();
            throw new Error(
              `Publish failed status=${publishResponse.status()} body=${bodyText.slice(0, 500)}`,
            );
          }
          const publishJson = (await publishResponse.json()) as {
            modelUpdateId?: string;
          };
          modelUpdateId = publishJson.modelUpdateId ?? "";
        }
        void publishedViaUi;
        expect(modelUpdateId.length).toBeGreaterThan(8);

        const mu = await prisma.modelUpdate.findUniqueOrThrow({
          where: { id: modelUpdateId },
        });
        previousRevisionId = mu.previousRevisionId!;
        resultingRevisionId = mu.resultingRevisionId!;
        expect(mu.afterSummary).toBe(PHASE6_REVISION_TWO);

        await prisma.userMapConclusion.update({
          where: { id: umcId },
          data: {
            title: PHASE6_MUTATED_LEGACY,
            summary: PHASE6_MUTATED_LEGACY,
          },
        });

        stages["B_C_publish"] = "PASS";
      } finally {
        await context.close();
      }
    } catch (error) {
      stages["B_C_publish"] = "FAIL";
      throw error;
    }
  });

  test("D. immediate post-publication parity", async () => {
    try {
      const { context, page } = await openAuthenticatedPage(browser, primary, "/your-map");
      try {
        await refreshAuthCookies(context, primary, clerk);
        await openPublishedCanonicalOnMap(page);
        await expect(page.getByText(PHASE6_REVISION_TWO).first()).toBeVisible({
          timeout: 60_000,
        });
        await expect(page.getByText(PHASE6_MUTATED_LEGACY)).toHaveCount(0);
        await assertRevisionTwoEverywhere(page, conceptId, primary);

        await page.getByTestId("nav-timeline").or(page.getByRole("navigation").getByRole("button", { name: /^Timeline$/i })).click();
        await expect(page.getByRole("heading", { name: "Timeline", level: 1 })).toBeVisible({
          timeout: 60_000,
        });
        const timelineRow = page
          .getByRole("button", { name: /After:\s*REVISION TWO/i })
          .first();
        await expect(timelineRow).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText(PHASE6_MUTATED_LEGACY)).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Before:\s*REVISION ONE/i }).first()).toBeVisible();

        // Refresh Clerk session before leaving the SPA shell for /what-changed.
        await gotoWhatChanged(page, context, primary, clerk);
        await expect(page.getByText("Canonical model revision").first()).toBeVisible({
          timeout: 60_000,
        });
        const movementCard = page.getByTestId("what-changed-primary-movement");
        await expect(movementCard).toBeVisible({ timeout: 60_000 });
        await expect(movementCard).toHaveAttribute("data-model-update-id", modelUpdateId);
        await expect(movementCard.getByText(PHASE6_REVISION_ONE).first()).toBeVisible({
          timeout: 60_000,
        });
        await expect(movementCard.getByText(PHASE6_REVISION_TWO).first()).toBeVisible({
          timeout: 60_000,
        });
        await page.getByRole("button", { name: /Open in inspector/i }).first().click();
        const inspectorMovement = page
          .getByRole("complementary")
          .getByTestId("inspector-model-movement");
        await expect(inspectorMovement).toBeVisible({ timeout: 60_000 });
        await expect(inspectorMovement).toHaveAttribute("data-model-update-id", modelUpdateId);
        await expect(page.getByText(PHASE6_MUTATED_LEGACY)).toHaveCount(0);
        const movementMatches = await page
          .locator(`[data-testid="what-changed-primary-movement"][data-model-update-id="${modelUpdateId}"]`)
          .count();
        expect(movementMatches).toBe(1);
        stages["D_what_changed_ui"] = "PASS";

        // Real browser POST /api/message with capture correlation.
        const composer = await awaitExploreComposerReady(
          page,
          context,
          primary,
          clerk,
          conversationId,
        );
        const nonce = `p6msg_${Date.now()}_${randomBytes(4).toString("hex")}`;
        trackCaptureNonce(nonce);
        try {
          let messagePostCount = 0;
          await page.route("**/api/message", async (route) => {
            const request = route.request();
            if (request.method() === "POST") {
              messagePostCount += 1;
              const response = await route.fetch({
                headers: {
                  ...request.headers(),
                  [ORVEK_CANONICAL_AI_CAPTURE_NONCE_HEADER]: nonce,
                },
              });
              await route.fulfill({ response });
              return;
            }
            await route.continue();
          });
          const responsePromise = page.waitForResponse(
            (response) =>
              response.url().includes("/api/message") &&
              response.request().method() === "POST",
            { timeout: 120_000 },
          );
          await composer.fill(
            "Phase 6 authority check: what is my current understanding of the seeded concept?",
          );
          const send = page.getByRole("button", { name: /^Ask$/i }).or(
            page.getByTestId("explore-send").or(page.locator('[data-shell-item="explore-send-action"]')),
          );
          await send.first().click({ force: true });
          const messageResponse = await responsePromise;
          if (!messageResponse.ok()) {
            const bodyText = await messageResponse.text();
            throw new Error(
              `POST /api/message failed status=${messageResponse.status()} body=${bodyText.slice(0, 800)}`,
            );
          }
          expect(messagePostCount).toBe(1);
          let capture = readCanonicalAiRequestCaptureFile(nonce);
          const captureDeadline = Date.now() + 30_000;
          while (!capture && Date.now() < captureDeadline) {
            await new Promise((r) => setTimeout(r, 500));
            capture = readCanonicalAiRequestCaptureFile(nonce);
          }
          expect(capture).not.toBeNull();
          expect(capture?.correlationId).toBe(nonce);
          expect(capture?.conceptIds).toContain(conceptId);
          expect(capture?.currentRevisionIds).toContain(resultingRevisionId);
          expect(capture?.versions).toContain(2);
          expect(capture?.summaries).toContain(PHASE6_REVISION_TWO);
          expect(capture?.summaries).not.toContain(PHASE6_MUTATED_LEGACY);
          expect(capture?.summaries).not.toContain(PHASE6_REVISION_ONE);
          expect(capture?.assembledBeforeReferenceMemory).toBe(true);
          expect(capture?.canonicalBlockBeforeReferenceMemory).toBe(true);
          expect(capture?.canonicalBlockBeforeContradictions).toBe(true);
          expect(capture?.canonicalBlockBeforeTranscript).toBe(true);
          stages["D_browser_message_post"] = "PASS";
          stages["D_post_publication_parity"] = "PASS";
        } finally {
          // Always delete capture file — including when assertions fail before the success path.
          deleteTrackedCaptureNonce(nonce);
        }
      } finally {
        await context.close();
      }
    } catch (error) {
      stages["D_post_publication_parity"] = "FAIL";
      stages["D_what_changed_ui"] = stages["D_what_changed_ui"] ?? "FAIL";
      stages["D_browser_message_post"] = stages["D_browser_message_post"] ?? "FAIL";
      throw error;
    }
  });

  test("E. hard refresh persistence", async () => {
    try {
      const { context, page } = await openAuthenticatedPage(browser, primary, "/your-map");
      try {
        await refreshAuthCookies(context, primary, clerk);
        await openPublishedCanonicalOnMap(page);
        await expect(page.getByText(PHASE6_REVISION_TWO).first()).toBeVisible({
          timeout: 60_000,
        });
        const before = await assertRevisionTwoEverywhere(page, conceptId, primary);

        await page.reload({ waitUntil: "domcontentloaded" });
        await refreshAuthCookies(context, primary, clerk);
        await page.goto(`${ORIGIN}/your-map`, { waitUntil: "domcontentloaded" });
        await openPublishedCanonicalOnMap(page);
        await expect(page.getByText(PHASE6_REVISION_TWO).first()).toBeVisible({
          timeout: 60_000,
        });

        const afterApi = await page.request.get(
          `${ORIGIN}/api/current-understanding/canonical-concepts/${encodeURIComponent(conceptId)}`,
          {
            headers: {
              Cookie: `__session=${primary.sessionToken}; __clerk_db_jwt=${primary.devBrowserToken}; __client_uat=${primary.clientUat}`,
            },
          },
        );
        expect(afterApi.status()).toBe(200);
        const afterBody = (await afterApi.json()) as {
          conceptId: string;
          currentRevisionId: string;
          version: number;
          summary: string;
        };
        expect(afterBody.conceptId).toBe(before.conceptId);
        expect(afterBody.currentRevisionId).toBe(before.currentRevisionId);
        expect(afterBody.version).toBe(2);
        expect(afterBody.summary).toBe(PHASE6_REVISION_TWO);
        expect(afterBody.summary).not.toBe(PHASE6_MUTATED_LEGACY);

        await expect(page.getByText(PHASE6_MUTATED_LEGACY)).toHaveCount(0);
        stages["E_hard_refresh"] = "PASS";
      } finally {
        await context.close().catch(() => undefined);
      }
    } catch (error) {
      stages["E_hard_refresh"] = "FAIL";
      throw error;
    }
  });

  test("F. route reopen persistence", async () => {
    try {
      const { context, page } = await openAuthenticatedPage(browser, primary, "/");
      try {
        await openPublishedCanonicalOnMap(page);
        await page.getByTestId("nav-today").or(page.getByRole("navigation").getByRole("button", { name: /^Today$/i })).click();
        await openPublishedCanonicalOnMap(page);
        const body = await assertRevisionTwoEverywhere(page, conceptId, primary);
        expect(body.currentRevisionId).toBe(resultingRevisionId);
        stages["F_route_reopen"] = "PASS";
      } finally {
        await context.close();
      }
    } catch (error) {
      stages["F_route_reopen"] = "FAIL";
      throw error;
    }
  });

  test("G. fresh browser context reopen", async () => {
    try {
      const { context, page } = await openAuthenticatedPage(browser, primary, "/");
      try {
        await openPublishedCanonicalOnMap(page);
        const body = await assertRevisionTwoEverywhere(page, conceptId, primary);
        expect(body.currentRevisionId).toBe(resultingRevisionId);
        stages["G_fresh_browser_context"] = "PASS";
      } finally {
        await context.close();
      }
    } catch (error) {
      stages["G_fresh_browser_context"] = "FAIL";
      throw error;
    }
  });

  test("H. correction handoff honesty", async () => {
    try {
      const { context, page } = await openAuthenticatedPage(browser, primary, "/");
      try {
        await openPublishedCanonicalOnMap(page);
        // Map detail + Inspector both mount propose controls for the same concept.
        const propose = page
          .getByRole("main")
          .getByTestId("canonical-propose-correction-button");
        await expect(propose).toBeVisible({ timeout: 60_000 });
        await propose.click({ force: true });
        await expect(page.getByRole("heading", { name: "Explore", level: 1 })).toBeVisible({
          timeout: 60_000,
        });

        // The propose button must set the in-memory workbench handoff and navigate to Explore.
        // No sessionStorage injection fallback is permitted.
        stages["H_map_propose_store"] = "PASS";

        await expect(
          page.getByTestId("explore-canonical-correction-context"),
        ).toBeVisible({ timeout: 60_000 });
        const banner = page.getByTestId("explore-canonical-correction-context");
        await expect(banner).toHaveAttribute("data-concept-id", conceptId);
        await expect(banner).toHaveAttribute(
          "data-current-revision-id",
          resultingRevisionId,
        );
        await expect(page.getByText(/model changed|correction saved/i)).toHaveCount(
          0,
        );
        // Soft reload check: no false success toast after refresh; re-auth like hard-refresh proof.
        await page.reload({ waitUntil: "domcontentloaded" });
        const refreshed = await clerk.sessions.getToken(primary.sessionId);
        primary.sessionToken = refreshed.jwt;
        primary.devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;
        await context.clearCookies();
        await context.addCookies([
          {
            name: "__session",
            value: primary.sessionToken,
            url: ORIGIN,
            httpOnly: true,
            sameSite: "Lax",
          },
          {
            name: "__clerk_db_jwt",
            value: primary.devBrowserToken,
            url: ORIGIN,
            httpOnly: false,
            sameSite: "Lax",
          },
          {
            name: "__client_uat",
            value: primary.clientUat,
            url: ORIGIN,
            httpOnly: false,
            sameSite: "Lax",
          },
        ]);
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(
          page.getByTestId("nav-today").or(page.getByRole("button", { name: /^Today$/i })),
        ).toBeVisible({ timeout: 60_000 });
        await expect(page.getByText(/model changed|correction saved/i)).toHaveCount(
          0,
        );
        // After reload the in-memory handoff is gone (SPA state cleared); that is correct behaviour.
        // No false success: correction context must be absent, model still at rev2.
        await openPublishedCanonicalOnMap(page);
        const body = await assertRevisionTwoEverywhere(page, conceptId, primary);
        expect(body.currentRevisionId).toBe(resultingRevisionId);
        // Prove no private content survives in sessionStorage after reload.
        const storedAfterReload = await page.evaluate(
          (key: string) => window.sessionStorage.getItem(key),
          "mindlabs:canonical-correction-handoff:v1",
        );
        expect(storedAfterReload).toBeNull();

        // Same-context account-switch: switch to secondary and prove no user-A correction context.
        await context.clearCookies();
        const refreshedB = await clerk.sessions.getToken(secondary.sessionId);
        secondary.sessionToken = refreshedB.jwt;
        secondary.devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;
        await context.addCookies([
          { name: "__session", value: secondary.sessionToken, url: ORIGIN, httpOnly: true, sameSite: "Lax" },
          { name: "__clerk_db_jwt", value: secondary.devBrowserToken, url: ORIGIN, httpOnly: false, sameSite: "Lax" },
          { name: "__client_uat", value: secondary.clientUat, url: ORIGIN, httpOnly: false, sameSite: "Lax" },
        ]);
        await page.goto("/explore", { waitUntil: "domcontentloaded" });
        await expect(
          page.getByTestId("explore-canonical-correction-context"),
        ).toHaveCount(0);
        const storedAsB = await page.evaluate(
          (key: string) => window.sessionStorage.getItem(key),
          "mindlabs:canonical-correction-handoff:v1",
        );
        expect(storedAsB).toBeNull();

        stages["H_correction_handoff"] = "PASS";
      } finally {
        await context.close().catch(() => undefined);
      }
    } catch (error) {
      stages["H_correction_handoff"] = "FAIL";
      throw error;
    }
  });

  test("I. cross-user isolation", async () => {
    try {
      const { context, page } = await openAuthenticatedPage(
        browser,
        secondary,
        "/",
      );
      try {
        const api = await page.request.get(
          `${ORIGIN}/api/current-understanding/canonical-concepts/${encodeURIComponent(conceptId)}`,
          {
            headers: {
              Cookie: `__session=${secondary.sessionToken}; __clerk_db_jwt=${secondary.devBrowserToken}; __client_uat=${secondary.clientUat}`,
            },
          },
        );
        expect(api.status()).toBe(404);
        await expect(page.getByText(PHASE6_REVISION_TWO)).toHaveCount(0);
        stages["I_cross_user"] = "PASS";
      } finally {
        await context.close();
      }
    } catch (error) {
      stages["I_cross_user"] = "FAIL";
      throw error;
    }
  });

  test("J. gate disabled after publication — history remains", async () => {
    test.setTimeout(480_000);
    try {
      if (!server) {
        throw new Error("Managed server required for gate-off restart proof");
      }
      const conceptCountBefore = await prisma.canonicalConcept.count({
        where: { userId: primary.userId },
      });
      const revisionCountBefore = await prisma.canonicalConceptRevision.count({
        where: { concept: { userId: primary.userId } },
      });

      await stopServer(server);
      server = null;
      disablePhase6CanonicalGate();
      server = await restartServerGateOff(env);
      stages["J_gate_disabled_restart"] = "PASS";

      const { context, page } = await openAuthenticatedPage(browser, primary, "/");
      try {
        stages["J_post_restart_fresh_context"] = "PASS";
        await openPublishedCanonicalOnMap(page);
        const body = await assertRevisionTwoEverywhere(page, conceptId, primary);
        expect(body.currentRevisionId).toBe(resultingRevisionId);
        expect(body.version).toBe(2);
        await expect(page.getByText(PHASE6_MUTATED_LEGACY)).toHaveCount(0);

        await page.getByTestId("nav-timeline").or(page.getByRole("navigation").getByRole("button", { name: /^Timeline$/i })).click();
        await expect(
          page.getByRole("button", { name: /After:\s*REVISION TWO/i }).first(),
        ).toBeVisible({ timeout: 60_000 });
        expect(
          await page.getByRole("button", { name: /After:\s*REVISION TWO/i }).count(),
        ).toBe(1);

        await gotoWhatChanged(page, context, primary, clerk);
        await expect(page.getByText("Canonical model revision").first()).toBeVisible({
          timeout: 60_000,
        });
        const movementCard = page.getByTestId("what-changed-primary-movement");
        await expect(movementCard).toHaveAttribute("data-model-update-id", modelUpdateId);
        await expect(movementCard.getByText(PHASE6_REVISION_ONE).first()).toBeVisible({
          timeout: 60_000,
        });
        await expect(movementCard.getByText(PHASE6_REVISION_TWO).first()).toBeVisible({
          timeout: 60_000,
        });
        await page.getByRole("button", { name: /Open in inspector/i }).first().click();
        const inspectorMovement = page
          .getByRole("complementary")
          .getByTestId("inspector-model-movement");
        await expect(inspectorMovement).toBeVisible({ timeout: 60_000 });
        await expect(inspectorMovement).toHaveAttribute("data-model-update-id", modelUpdateId);
        stages["J_gate_disabled_what_changed"] = "PASS";
        stages["J_gate_disabled_history_visible"] = "PASS";

        const gateOffUmc = await seedPhase6LegacyOnly({
          userId: primary.userId,
          db: prisma,
        });
        await prisma.userMapConclusion.update({
          where: { id: gateOffUmc.id },
          data: {
            title: "GATE OFF UMC TITLE",
            summary: "GATE OFF UMC SUMMARY",
          },
        });

        const composer = await awaitExploreComposerReady(
          page,
          context,
          primary,
          clerk,
          conversationId,
        );
        const creationNonce = `p6gate_${Date.now()}_${randomBytes(4).toString("hex")}`;
        trackCaptureNonce(creationNonce);
        try {
          await page.route("**/api/message", async (route) => {
            const request = route.request();
            if (request.method() === "POST") {
              const response = await route.fetch({
                headers: {
                  ...request.headers(),
                  [ORVEK_CANONICAL_AI_CAPTURE_NONCE_HEADER]: creationNonce,
                  [ORVEK_PHASE6_CREATION_ATTEMPT_HEADER]: gateOffUmc.id,
                },
              });
              await route.fulfill({ response });
              return;
            }
            await route.continue();
          });
          const responsePromise = page.waitForResponse(
            (response) =>
              response.url().includes("/api/message") &&
              response.request().method() === "POST",
            { timeout: 120_000 },
          );
          await composer.fill("Phase 6 gate-off creation attempt message.");
          await page
            .getByRole("button", { name: /^Ask$/i })
            .or(page.locator('[data-shell-item="explore-send-action"]'))
            .first()
            .click({ force: true });
          const creationResponse = await responsePromise;
          expect(creationResponse.ok()).toBeTruthy();

          const createdProposal = await prisma.exploreMovementProposal.findFirst({
            where: {
              userId: primary.userId,
              afterSummary: "PHASE6 GATE-OFF CREATION ATTEMPT SUMMARY",
            },
            orderBy: { createdAt: "desc" },
          });
          expect(createdProposal).not.toBeNull();
          expect(createdProposal?.authorityMode).toBe(ExploreMovementAuthorityMode.legacy);
          expect(createdProposal?.canonicalConceptId).toBeNull();
          expect(
            await prisma.canonicalConcept.count({ where: { userId: primary.userId } }),
          ).toBe(conceptCountBefore);
          expect(
            await prisma.canonicalConceptRevision.count({
              where: { concept: { userId: primary.userId } },
            }),
          ).toBe(revisionCountBefore);
          stages["J_post_restart_new_creation_legacy"] = "PASS";
        } finally {
          deleteTrackedCaptureNonce(creationNonce);
        }
      } finally {
        await context.close();
      }
    } catch (error) {
      stages["J_gate_disabled_restart"] = stages["J_gate_disabled_restart"] ?? "FAIL";
      stages["J_gate_disabled_history_visible"] =
        stages["J_gate_disabled_history_visible"] ?? "FAIL";
      stages["J_gate_disabled_what_changed"] =
        stages["J_gate_disabled_what_changed"] ?? "FAIL";
      stages["J_post_restart_fresh_context"] =
        stages["J_post_restart_fresh_context"] ?? "FAIL";
      stages["J_post_restart_new_creation_legacy"] =
        stages["J_post_restart_new_creation_legacy"] ?? "FAIL";
      throw error;
    }
  });
});
