/**
 * Authenticated Playwright proof for DESKTOP-PRODUCTION-PARITY-CLOSURE-001.
 *
 * Uses the real application routes, real local Postgres data, and Clerk dev
 * sessions. No API mocking or fixture substitution on production surfaces.
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient, ModelUpdateVisibility } from "@prisma/client";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  cleanupDurableActionsAssaultRuntimeFixture,
  FIXTURE_CORRECTABLE_CONCLUSION_ID,
  FIXTURE_FIELDWORK_ASSIGNMENT_ID,
  seedDurableActionsAssaultRuntimeFixture,
} from "../lib/durable-actions-runtime-fixture";
import { DECISIONS_EMPTY_COPY } from "../lib/decisions-surface";
import { V0_EXPLORE_INVESTIGATIONS_EMPTY_LIST } from "../lib/orvek-adapters/explore";
import {
  cleanupExploreAssaultRuntimeFixture,
  FIXTURE_CLAIM_EVIDENCE_ID,
  FIXTURE_CROSS_USER_SESSION_ID,
  FIXTURE_JOURNAL_VERIFIED_ID,
  FIXTURE_SESSION_ID,
  seedExploreAssaultRuntimeFixture,
} from "../lib/explore-grounding-movement-runtime-fixture";
import {
  cleanupInvestigationsAssaultRuntimeFixture,
  countInvestigationsAssaultRuntimeFixture,
} from "../lib/explore-grounding-movement-runtime-fixture";
import {
  cleanupInvestigationsAssaultRuntimeFixture as cleanupInvestigationsFixture,
  countInvestigationsAssaultRuntimeFixture as countInvestigationsFixture,
  FIXTURE_CROSS_EVIDENCE_ID as LEGACY_CROSS_EVIDENCE_ID,
  INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID,
  INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID,
  INVESTIGATIONS_ASSAULT_UI_QUESTION_PREFIX,
  INVESTIGATIONS_ASSAULT_UI_TITLE_PREFIX,
  INVESTIGATIONS_ASSAULT_UI_WATCH_FOR_PREFIX,
  seedInvestigationsAssaultRuntimeFixture,
} from "../lib/investigations-assault-runtime-fixture";
import {
  cleanupMovementAssaultRuntimeFixture,
  FIXTURE_CLAIM_SUMMARY as MOVEMENT_FIXTURE_CLAIM_SUMMARY,
  MOVEMENT_ASSAULT_FIXTURE_MARKER,
  MOVEMENT_ASSAULT_FIXTURE_PREFIX,
  publishMovementAssaultClaimFixture,
  seedMovementAssaultRuntimeFixture,
} from "../lib/model-movement-runtime-fixture";
import { TIMELINE_ACTIVITY_EMPTY_COPY } from "../lib/timeline-model-layers";
import {
  FIXTURE_CLAIM_ID as MOVEMENT_FIXTURE_CLAIM_ID,
  FIXTURE_CONCLUSION_ID as MOVEMENT_FIXTURE_CONCLUSION_ID,
  FIXTURE_EVIDENCE_ID as MOVEMENT_FIXTURE_EVIDENCE_ID,
} from "../lib/live-evidence-depth-runtime-fixture";

type EnvMap = Record<string, string>;

type AuthState = {
  userId: string;
  email: string;
  password: string;
};

type BrowserProofRecord = {
  name: string;
  status: string;
  notes?: string[];
  ids?: Record<string, string | null>;
  statuses?: Record<string, number>;
};

type AuthProbeRecord = {
  at: string;
  source: "context_preflight" | "browser_preflight";
  pageUrl: string;
  status: number;
  contentType: string | null;
  responseBody: string | null;
  authenticated: boolean | null;
  userId: string | null;
};

type ClosureArtifact = {
  campaign: string;
  date: string;
  baselineCommit: string;
  status: "running" | "passed" | "failed";
  requiredSuite: string;
  requiredMinimum: number;
  completed: number;
  passed: number;
  tests: BrowserProofRecord[];
  ids: Record<string, string | null>;
  inspectorIdentities: Record<string, string | null>;
  negativeStatuses: Record<string, number>;
  fixtureCleanup: Record<string, unknown> | null;
};

type Test2LifecycleRecord = {
  at: string;
  step: string;
  details?: Record<string, unknown>;
};

type Test2RequestRecord = {
  at: string;
  source: "context_preflight" | "browser_preflight" | "page_response";
  pageUrl: string;
  status: number;
  contentType: string | null;
  responseBody: string | null;
  returnedCount: number | null;
  returnedIds: string[];
  handlerEntered: boolean;
  handlerUserId: string | null;
  expectedUserMatch: boolean | null;
  ownerMatch: boolean | null;
  fixtureSetupComplete: boolean;
  priorTeardownActive: boolean;
  clerkAuthStatus: string | null;
  clerkAuthReason: string | null;
  middlewareRewrite: string | null;
  matchingConclusionCount: number | null;
  conclusionExists: boolean | null;
};

type Test2RunArtifact = {
  runLabel: string;
  expectedPrimaryUserId: string;
  fixtureOwnerUserId: string;
  emptyUserId: string;
  conclusionId: string;
  lifecycle: Test2LifecycleRecord[];
  primaryRequests: Test2RequestRecord[];
  emptyUserRequests: Test2RequestRecord[];
  result: Record<string, unknown> | null;
};

type Test2RequestRuntimeState = {
  fixtureSetupComplete: boolean;
  priorTeardownActive: boolean;
};

const ROOT = resolve(process.cwd());
const RECEIPTS_DIR = resolve(
  ROOT,
  "docs/agent-runs/receipts/DESKTOP-PRODUCTION-PARITY-CLOSURE-001",
);
const PLAYWRIGHT_ARTIFACT_PATH = resolve(RECEIPTS_DIR, "playwright-artifacts.json");
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3100";
const BASELINE_COMMIT = "38d3b2c7cc9e944512fd6269269f04838b46a8e5";
const EXPLORE_SESSION_STORAGE_KEY = "mindlabs:explore:session-id";
const MAP_LIST_ENDPOINT = "/api/user-map/conclusions?limit=50&sortOrder=desc";
const AUTH_PROBE_PATH = "/api/desktop-production-parity/auth-probe";
const TEST2_RUN_LABEL = process.env.DESKTOP_PARITY_TEST2_RUN_LABEL?.trim() || null;
const TEST2_RUNS_DIR = resolve(RECEIPTS_DIR, "test-2-runs");

const FIXTURE_DECISION_TITLE =
  "Write the recurring thought down as-is, without trying to resolve it";
const FIXTURE_OUTCOME_NOTE = "Durable assault outcome: stop point helped after meetings.";
const FIXTURE_CHECKIN_NOTE =
  "Investigations assault check-in: the stop point only held once I named it before the next ask.";
const OUTCOME_NOTE =
  "Investigations assault outcome: explicit stop-point naming reduced reopened scope pressure.";
const POSITIVE_USER_MESSAGE =
  "I keep missing the stop point after meetings and my energy collapses before commitments lock.";

const artifacts: ClosureArtifact = {
  campaign: "DESKTOP-PRODUCTION-PARITY-CLOSURE-001",
  date: "2026-07-16",
  baselineCommit: BASELINE_COMMIT,
  status: "running",
  requiredSuite: "dedicated global production-parity Playwright suite",
  requiredMinimum: 7,
  completed: 0,
  passed: 0,
  tests: [],
  ids: {
    todayModelUpdateId: null,
    mapConclusionId: null,
    decisionActionId: null,
    exploreConversationId: null,
    exploreUserMessageId: null,
    exploreAssistantMessageId: null,
    exploreProposalId: null,
    exploreModelUpdateId: null,
    investigationId: null,
    investigationEvidenceId: null,
    watchForId: null,
    timelineModelUpdateId: null,
  },
  inspectorIdentities: {
    todayModelUpdateId: null,
    mapConclusionId: null,
    decisionActionId: null,
    exploreModelUpdateId: null,
    investigationId: null,
    timelineModelUpdateId: null,
  },
  negativeStatuses: {},
  fixtureCleanup: null,
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function parseNullableBoolean(value: string | null | undefined): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseNullableNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeResponseBody(body: string | null): string | null {
  if (!body) {
    return null;
  }

  return body.length <= 1200 ? body : `${body.slice(0, 1200)}…`;
}

function extractReturnedIds(contentType: string | null, body: string | null): string[] {
  if (!contentType?.includes("application/json") || !body) {
    return [];
  }

  try {
    const parsed = JSON.parse(body) as {
      items?: Array<{ id?: string | null }>;
      item?: { id?: string | null };
    };

    if (Array.isArray(parsed.items)) {
      return parsed.items
        .map((item) => (typeof item?.id === "string" ? item.id : null))
        .filter((value): value is string => Boolean(value));
    }

    if (typeof parsed.item?.id === "string") {
      return [parsed.item.id];
    }
  } catch {
    return [];
  }

  return [];
}

function extractReturnedCount(contentType: string | null, body: string | null): number | null {
  if (!contentType?.includes("application/json") || !body) {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as { items?: unknown[]; item?: unknown };
    if (Array.isArray(parsed.items)) {
      return parsed.items.length;
    }
    if (parsed.item) {
      return 1;
    }
  } catch {
    return null;
  }

  return null;
}

function parseAuthProbeBody(contentType: string | null, body: string | null) {
  if (!contentType?.includes("application/json") || !body) {
    return {
      authenticated: null,
      userId: null,
    };
  }

  try {
    const parsed = JSON.parse(body) as {
      authenticated?: unknown;
      userId?: unknown;
    };

    return {
      authenticated:
        typeof parsed.authenticated === "boolean" ? parsed.authenticated : null,
      userId: typeof parsed.userId === "string" ? parsed.userId : null,
    };
  } catch {
    return {
      authenticated: null,
      userId: null,
    };
  }
}

function buildAuthProbeRecord(args: {
  source: AuthProbeRecord["source"];
  pageUrl: string;
  status: number;
  contentType: string | null;
  body: string | null;
}): AuthProbeRecord {
  const parsed = parseAuthProbeBody(args.contentType, args.body);

  return {
    at: nowIso(),
    source: args.source,
    pageUrl: args.pageUrl,
    status: args.status,
    contentType: args.contentType,
    responseBody: safeResponseBody(args.body),
    authenticated: parsed.authenticated,
    userId: parsed.userId,
  };
}

function buildTest2RequestRecord(args: {
  source: Test2RequestRecord["source"];
  pageUrl: string;
  status: number;
  contentType: string | null;
  body: string | null;
  headers: Record<string, string>;
  runtimeState: Test2RequestRuntimeState;
}): Test2RequestRecord {
  return {
    at: nowIso(),
    source: args.source,
    pageUrl: args.pageUrl,
    status: args.status,
    contentType: args.contentType,
    responseBody: safeResponseBody(args.body),
    returnedCount: extractReturnedCount(args.contentType, args.body),
    returnedIds: extractReturnedIds(args.contentType, args.body),
    handlerEntered: args.headers["x-desktop-parity-handler-entered"] === "1",
    handlerUserId: args.headers["x-desktop-parity-handler-user-id"] || null,
    expectedUserMatch: parseNullableBoolean(
      args.headers["x-desktop-parity-expected-user-match"],
    ),
    ownerMatch: parseNullableBoolean(args.headers["x-desktop-parity-owner-match"]),
    fixtureSetupComplete: args.runtimeState.fixtureSetupComplete,
    priorTeardownActive: args.runtimeState.priorTeardownActive,
    clerkAuthStatus: args.headers["x-clerk-auth-status"] || null,
    clerkAuthReason: args.headers["x-clerk-auth-reason"] || null,
    middlewareRewrite: args.headers["x-middleware-rewrite"] || null,
    matchingConclusionCount: parseNullableNumber(
      args.headers["x-desktop-parity-matching-conclusion-count"],
    ),
    conclusionExists: parseNullableBoolean(
      args.headers["x-desktop-parity-conclusion-exists"],
    ),
  };
}

function writeJsonArtifact(path: string, value: unknown) {
  mkdirSync(RECEIPTS_DIR, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function buildTest2DiagnosticHeaders(args: {
  runLabel: string;
  expectedUserId: string;
  fixtureOwnerUserId: string;
  conclusionId: string;
  runtimeState: Test2RequestRuntimeState;
}): Record<string, string> {
  return {
    "x-desktop-parity-test2-run": args.runLabel,
    "x-desktop-parity-expected-user-id": args.expectedUserId,
    "x-desktop-parity-fixture-owner-id": args.fixtureOwnerUserId,
    "x-desktop-parity-fixture-conclusion-id": args.conclusionId,
    "x-desktop-parity-fixture-setup-complete": String(args.runtimeState.fixtureSetupComplete),
    "x-desktop-parity-prior-teardown-active": String(args.runtimeState.priorTeardownActive),
  };
}

function resolveCurrentPath(page: Page): string {
  try {
    const url = new URL(page.url());
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

function buildTest2RunArtifact(args: {
  runLabel: string;
  primaryUserId: string;
  emptyUserId: string;
  conclusionId: string;
}): Test2RunArtifact {
  return {
    runLabel: args.runLabel,
    expectedPrimaryUserId: args.primaryUserId,
    fixtureOwnerUserId: args.primaryUserId,
    emptyUserId: args.emptyUserId,
    conclusionId: args.conclusionId,
    lifecycle: [],
    primaryRequests: [],
    emptyUserRequests: [],
    result: null,
  };
}

function writeTest2RunArtifact(runArtifact: Test2RunArtifact) {
  mkdirSync(TEST2_RUNS_DIR, { recursive: true });
  writeJsonArtifact(resolve(TEST2_RUNS_DIR, `${runArtifact.runLabel}.json`), runArtifact);
}

function recordTest2Lifecycle(
  runArtifact: Test2RunArtifact,
  step: string,
  details?: Record<string, unknown>,
) {
  runArtifact.lifecycle.push({
    at: nowIso(),
    step,
    ...(details ? { details } : {}),
  });
  writeTest2RunArtifact(runArtifact);
}

let env: EnvMap;
let prisma: PrismaClient;
let clerk = createClerkClient({ secretKey: "", publishableKey: "" });
let devBrowserToken = "";
let primaryAuth: AuthState | null = null;
let crossAuth: AuthState | null = null;
let emptyAuth: AuthState | null = null;

function readEnvFile(relativePath = ".env"): EnvMap {
  const file = readFileSync(resolve(ROOT, relativePath), "utf8");
  const parsed: EnvMap = {};

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
    parsed[key] = value;
  }

  return parsed;
}

function requireEnv(input: EnvMap, key: string): string {
  const value = process.env[key] ?? input[key];
  if (!value) {
    throw new Error(`Missing ${key} in .env`);
  }
  return value;
}

function assertRealClerkEnv(input: EnvMap) {
  const publishableKey = requireEnv(input, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  const secretKey = requireEnv(input, "CLERK_SECRET_KEY");
  if (publishableKey.endsWith("...") || secretKey.endsWith("...")) {
    throw new Error("Clerk credentials are placeholders. Provide real Clerk dev credentials.");
  }
}

function uniqueEmail(prefix: string): string {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}.${stamp}@example.com`;
}

function sleep(ms: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function isClerkRateLimitError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
  return /Too Many Requests|429/i.test(text);
}

function ensureArtifactRecord(name: string): BrowserProofRecord {
  let record = artifacts.tests.find((entry) => entry.name === name);
  if (!record) {
    record = { name, status: "not_run" };
    artifacts.tests.push(record);
  }
  return record;
}

function patchArtifactRecord(name: string, patch: Partial<BrowserProofRecord>) {
  Object.assign(ensureArtifactRecord(name), patch);
}

async function captureMapListApiResponse(args: {
  context: BrowserContext;
  page: Page;
  runLabel: string;
  expectedUserId: string;
  fixtureOwnerUserId: string;
  conclusionId: string;
  runtimeState: Test2RequestRuntimeState;
}): Promise<Test2RequestRecord> {
  const response = await args.context.request.get(MAP_LIST_ENDPOINT, {
    headers: buildTest2DiagnosticHeaders({
      runLabel: args.runLabel,
      expectedUserId: args.expectedUserId,
      fixtureOwnerUserId: args.fixtureOwnerUserId,
      conclusionId: args.conclusionId,
      runtimeState: args.runtimeState,
    }),
  });
  const headers = normalizeHeaders(response.headers());
  const body = await response.text();

  return buildTest2RequestRecord({
    source: "context_preflight",
    pageUrl: args.page.url(),
    status: response.status(),
    contentType: headers["content-type"] ?? null,
    body,
    headers,
    runtimeState: args.runtimeState,
  });
}

async function captureAuthProbeViaContext(args: {
  context: BrowserContext;
  page: Page;
}): Promise<AuthProbeRecord> {
  const response = await args.context.request.get(AUTH_PROBE_PATH);
  const headers = normalizeHeaders(response.headers());
  const body = await response.text();

  return buildAuthProbeRecord({
    source: "context_preflight",
    pageUrl: args.page.url(),
    status: response.status(),
    contentType: headers["content-type"] ?? null,
    body,
  });
}

async function captureAuthProbeViaBrowser(page: Page): Promise<AuthProbeRecord> {
  const result = await page.evaluate(async (endpoint) => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.text();
    return {
      pageUrl: window.location.href,
      status: response.status,
      contentType: response.headers.get("content-type"),
      body,
    };
  }, AUTH_PROBE_PATH);

  return buildAuthProbeRecord({
    source: "browser_preflight",
    pageUrl: result.pageUrl,
    status: result.status,
    contentType: result.contentType,
    body: result.body,
  });
}

async function assertAuthenticatedSessionProof(args: {
  page: Page;
  context: BrowserContext;
  expectedUserId: string;
}) {
  const contextProbe = await captureAuthProbeViaContext({
    context: args.context,
    page: args.page,
  });
  expect(contextProbe.status).toBe(200);
  expect(contextProbe.authenticated).toBe(true);
  expect(contextProbe.userId).toBe(args.expectedUserId);

  const browserProbe = await captureAuthProbeViaBrowser(args.page);
  expect(browserProbe.status).toBe(200);
  expect(browserProbe.authenticated).toBe(true);
  expect(browserProbe.userId).toBe(args.expectedUserId);

  return {
    contextProbe,
    browserProbe,
  };
}

async function captureMapListBrowserFetch(args: {
  page: Page;
  runtimeState: Test2RequestRuntimeState;
}): Promise<Test2RequestRecord> {
  const result = await args.page.evaluate(async (endpoint) => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.text();
    return {
      pageUrl: window.location.href,
      status: response.status,
      contentType: response.headers.get("content-type"),
      headers: Object.fromEntries(Array.from(response.headers.entries())),
      body,
    };
  }, MAP_LIST_ENDPOINT);

  return buildTest2RequestRecord({
    source: "browser_preflight",
    pageUrl: result.pageUrl,
    status: result.status,
    contentType: result.contentType,
    body: result.body,
    headers: normalizeHeaders(result.headers),
    runtimeState: args.runtimeState,
  });
}

function attachPageMapResponseRecorder(args: {
  page: Page;
  records: Test2RequestRecord[];
  runtimeState: Test2RequestRuntimeState;
}) {
  const pending: Promise<void>[] = [];
  const listener = (response: Awaited<ReturnType<Page["waitForResponse"]>>) => {
    if (!response.url().includes(MAP_LIST_ENDPOINT)) {
      return;
    }

    pending.push(
      (async () => {
        const headers = normalizeHeaders(await response.allHeaders());
        let body: string | null = null;
        try {
          body = await response.text();
        } catch {
          body = null;
        }

        args.records.push(
          buildTest2RequestRecord({
            source: "page_response",
            pageUrl: args.page.url(),
            status: response.status(),
            contentType: headers["content-type"] ?? null,
            body,
            headers,
            runtimeState: args.runtimeState,
          }),
        );
      })(),
    );
  };

  args.page.on("response", listener);

  return async () => {
    args.page.off("response", listener);
    await Promise.allSettled(pending);
  };
}

async function countMovementMapFixtureRemaining(userId: string) {
  const [conclusions, claims, evidence, modelUpdates, evidenceLinks] = await Promise.all([
    prisma.userMapConclusion.count({
      where: { id: MOVEMENT_FIXTURE_CONCLUSION_ID, userId },
    }),
    prisma.patternClaim.count({
      where: { id: MOVEMENT_FIXTURE_CLAIM_ID, userId },
    }),
    prisma.patternClaimEvidence.count({
      where: { id: MOVEMENT_FIXTURE_EVIDENCE_ID },
    }),
    prisma.modelUpdate.count({
      where: {
        userId,
        OR: [
          { internalNotes: { contains: MOVEMENT_ASSAULT_FIXTURE_MARKER } },
          { id: { startsWith: MOVEMENT_ASSAULT_FIXTURE_PREFIX } },
        ],
      },
    }),
    prisma.understandingEvidenceLink.count({
      where: {
        userId,
        OR: [
          { sourceId: { in: [MOVEMENT_FIXTURE_CLAIM_ID, MOVEMENT_FIXTURE_EVIDENCE_ID] } },
          { targetId: { startsWith: MOVEMENT_ASSAULT_FIXTURE_PREFIX } },
        ],
      },
    }),
  ]);

  return {
    conclusions,
    claims,
    evidence,
    modelUpdates,
    evidenceLinks,
  };
}

async function createAuthState(prefix: string): Promise<AuthState> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const email = uniqueEmail(prefix);
      const password = `Tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-Aa1!`;
      const user = await clerk.users.createUser({
        emailAddress: [email],
        password,
        skipPasswordChecks: true,
        skipPasswordRequirement: true,
      });
      return {
        userId: user.id,
        email,
        password,
      };
    } catch (error) {
      lastError = error;
      if (!isClerkRateLimitError(error) || attempt === 5) {
        break;
      }
      await sleep(15_000 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not create Clerk auth state.");
}

async function refreshTestingBrowserToken() {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;
      return;
    } catch (error) {
      lastError = error;
      if (!isClerkRateLimitError(error) || attempt === 5) {
        break;
      }
      await sleep(15_000 * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not refresh Clerk testing browser token.");
}

async function seedTestingBrowserCookie(context: BrowserContext, baseURL?: string) {
  const origin = baseURL ?? ORIGIN;
  await context.addCookies([
    { name: "__clerk_db_jwt", value: devBrowserToken, url: origin },
  ]);
}

async function probeBrowserAuthOnCurrentPage(
  page: Page,
  expectedUserId: string,
): Promise<boolean> {
  try {
    return await page.evaluate(async ({ endpoint, expectedId }) => {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) return false;
      const payload = (await response.json()) as {
        authenticated?: boolean;
        userId?: string | null;
      };
      return payload.authenticated === true && payload.userId === expectedId;
    }, { endpoint: AUTH_PROBE_PATH, expectedId: expectedUserId });
  } catch {
    return false;
  }
}

async function stabilizeAuthenticatedSession(
  page: Page,
  context: BrowserContext,
  authState: AuthState,
  baseURL?: string,
) {
  const identifierField = page
    .locator(
      '#identifier-field, input[name="identifier"], input[autocomplete="username"], input[type="email"]',
    )
    .first();
  const passwordField = page
    .locator(
      '#password-field, input[name="password"], input[autocomplete="current-password"], input[type="password"]',
    )
    .first();
  const continueButton = page.getByRole("button", { name: /^Continue$/i });

  await refreshTestingBrowserToken();
  await seedTestingBrowserCookie(context, baseURL);
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  if (await probeBrowserAuthOnCurrentPage(page, authState.userId)) {
    return;
  }
  const clerkDevBrowserError = page.getByText(
    "Unable to authenticate this browser for your development instance.",
  );
  if (await clerkDevBrowserError.isVisible().catch(() => false)) {
    await refreshTestingBrowserToken();
    await seedTestingBrowserCookie(context, baseURL);
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    if (await probeBrowserAuthOnCurrentPage(page, authState.userId)) {
      return;
    }
  }
  await expect(identifierField).toBeVisible({ timeout: 90_000 });
  await expect(passwordField).toBeVisible({ timeout: 90_000 });
  await identifierField.fill(authState.email);
  await passwordField.fill(authState.password);
  await continueButton.click();
  await waitForBrowserAuthOnCurrentPage(page, authState.userId);
}

async function waitForBrowserAuthOnCurrentPage(
  page: Page,
  expectedUserId: string,
) {
  await expect
    .poll(
      async () => probeBrowserAuthOnCurrentPage(page, expectedUserId),
      { timeout: 90_000 },
    )
    .toBe(true);
}

async function gotoPath(
  page: Page,
  context: BrowserContext,
  authState: AuthState,
  path: string,
  baseURL?: string,
) {
  let response = await page.goto(path, { waitUntil: "domcontentloaded" });
  if (await page.getByRole("heading", { name: /Sign in/i }).isVisible().catch(() => false)) {
    await stabilizeAuthenticatedSession(page, context, authState, baseURL);
    response = await page.goto(path, { waitUntil: "domcontentloaded" });
  }
  return response?.status() ?? null;
}

async function recoverAfterReload(
  page: Page,
  context: BrowserContext,
  authState: AuthState,
  baseURL?: string,
  path?: string,
) {
  const nextPath = path ?? resolveCurrentPath(page);
  await stabilizeAuthenticatedSession(page, context, authState, baseURL);
  await gotoPath(page, context, authState, nextPath, baseURL);
}

async function openAuthenticatedPage(
  browser: Browser,
  authState: AuthState,
  baseURL?: string,
  path = "/",
) {
  const context = await browser.newContext({ baseURL: baseURL ?? ORIGIN });
  const page = await context.newPage();
  await stabilizeAuthenticatedSession(page, context, authState, baseURL);
  await gotoPath(page, context, authState, path, baseURL);
  await waitForBrowserAuthOnCurrentPage(page, authState.userId);
  const finalStatus = await gotoPath(page, context, authState, path, baseURL);
  await waitForBrowserAuthOnCurrentPage(page, authState.userId);
  if (finalStatus !== null && finalStatus >= 400) {
    throw new Error(`Authenticated navigation to ${path} returned ${finalStatus}`);
  }
  return { context, page };
}

async function resetFixtures() {
  if (!primaryAuth || !crossAuth || !prisma) {
    return;
  }
  await cleanupMovementAssaultRuntimeFixture({ userId: primaryAuth.userId, db: prisma });
  await cleanupDurableActionsAssaultRuntimeFixture({ userId: primaryAuth.userId, db: prisma });
  await cleanupExploreAssaultRuntimeFixture({
    userId: primaryAuth.userId,
    crossUserId: crossAuth.userId,
    db: prisma,
  });
  await cleanupInvestigationsFixture({
    userId: primaryAuth.userId,
    crossUserId: crossAuth.userId,
    db: prisma,
  });
}

async function openMapConclusion(
  page: Page,
  context: BrowserContext,
  authState: AuthState,
  conclusionId: string,
  title: string,
  baseURL?: string,
) {
  const openMapButton = page.getByTestId("nav-map");
  await expect(openMapButton).toBeVisible({ timeout: 30_000 });
  await openMapButton.click();
  await expect(page.getByTestId("orvek-v0-map-page")).toBeVisible({ timeout: 60_000 });

  const browserHasConclusion = async () =>
    page.evaluate(
      async ({ endpoint, id }) => {
        try {
          const response = await fetch(endpoint, { cache: "no-store" });
          if (!response.ok) return false;
          const payload = (await response.json()) as { items?: Array<{ id?: string }> };
          return payload.items?.some((item) => item.id === id) ?? false;
        } catch {
          return false;
        }
      },
      { endpoint: MAP_LIST_ENDPOINT, id: conclusionId },
    );

  try {
    await expect.poll(browserHasConclusion, { timeout: 30_000 }).toBe(true);
  } catch {
    await recoverAfterReload(page, context, authState, baseURL, "/your-map");
    await expect.poll(browserHasConclusion, { timeout: 60_000 }).toBe(true);
  }

  const row = page.getByRole("button", { name: title }).first();
  try {
    await expect(row).toBeVisible({ timeout: 30_000 });
  } catch {
    const loadError = page.getByText("Could not load your map.");
    if (await loadError.isVisible().catch(() => false)) {
      await recoverAfterReload(page, context, authState, baseURL);
      await expect(openMapButton).toBeVisible({ timeout: 30_000 });
      await openMapButton.click();
      await expect(page.getByTestId("orvek-v0-map-page")).toBeVisible({ timeout: 60_000 });
      await expect.poll(browserHasConclusion, { timeout: 60_000 }).toBe(true);
    }
    await expect(row).toBeVisible({ timeout: 60_000 });
  }
  const detailPromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/user-map/conclusions/${encodeURIComponent(conclusionId)}`) &&
      response.request().method() === "GET" &&
      response.status() === 200,
    { timeout: 30_000 },
  ).catch(() => null);
  await row.click();
  await detailPromise;
  await expect(page).toHaveURL(new RegExp(`selected=${conclusionId}`), { timeout: 30_000 });
}

async function waitForTodayMovementHydration(
  page: Page,
  context: BrowserContext,
  authState: AuthState,
  modelUpdateId: string,
  baseURL?: string,
) {
  await gotoPath(page, context, authState, "/", baseURL);
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
    await recoverAfterReload(page, context, authState, baseURL, "/");
  });

  await expect(page.getByTestId("today-full-report")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("today-full-report")).toHaveAttribute("data-report-id", modelUpdateId);
}

async function openExploreTab(
  page: Page,
  context: BrowserContext,
  authState: AuthState,
  baseURL: string | undefined,
  tab: "questions" | "investigations" | "fieldwork",
) {
  await gotoPath(page, context, authState, "/explore", baseURL);
  await expect(page.getByTestId("orvek-v0-explore-page")).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(
      async () => {
        await page.getByTestId(`explore-tab-${tab}`).click();
        return page.getByTestId(`explore-tab-${tab}`).getAttribute("aria-current");
      },
      { timeout: 30_000 },
    )
    .toBe("page");
}

async function recoverAfterReloadToExploreTab(
  page: Page,
  context: BrowserContext,
  authState: AuthState,
  baseURL: string | undefined,
  tab: "questions" | "investigations" | "fieldwork",
) {
  await recoverAfterReload(page, context, authState, baseURL, "/explore");
  await openExploreTab(page, context, authState, baseURL, tab);
}

async function openLiveExplore(
  page: Page,
  context: BrowserContext,
  authState: AuthState,
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

  await gotoPath(page, context, authState, "/explore", baseURL);
  const explore = page.getByTestId("orvek-v0-explore-page");
  await expect(explore).toBeVisible({ timeout: 60_000 });
  await expect(explore.getByRole("heading", { name: /^Explore$/i })).toBeVisible({
    timeout: 30_000,
  });

  const freeTab = explore.getByRole("button", { name: /Free Explore/i });
  if (await freeTab.isVisible().catch(() => false)) {
    await freeTab.click();
  }

  await expect
    .poll(
      async () => {
        const response = await page.evaluate(
          async ({ preferredId }) => {
            const list = await fetch("/api/session/list?origin=app&surfaceType=explore_chat", {
              cache: "no-store",
            });
            if (!list.ok) return false;
            const sessions = (await list.json()) as Array<{ id: string }>;
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
        return response;
      },
      { timeout: 90_000 },
    )
    .toBe(true);

  await expect
    .poll(
      async () => {
        return explore
          .getByTestId("explore-composer")
          .getAttribute("data-free-explore-send-handler");
      },
      { timeout: 90_000 },
    )
    .toBe("true");

  return explore;
}

async function sendExploreMessage(page: Page, message: string) {
  const explore = page.getByTestId("orvek-v0-explore-page");
  const composer = explore.locator(
    'input[placeholder*="Ask the model"], input[placeholder*="Ask your Mind Model"]',
  );
  await expect(composer).toBeVisible({ timeout: 60_000 });
  await composer.fill(message);
  const ask = explore.getByTestId("explore-ask-button");
  await expect
    .poll(async () => ask.getAttribute("data-can-send"), { timeout: 30_000 })
    .toBe("true");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/message") && response.request().method() === "POST",
    { timeout: 120_000 },
  );
  await ask.click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
}

async function resolveActiveExploreSessionId(
  context: BrowserContext,
): Promise<string> {
  const response = await context.request.get("/api/session/list?origin=app&surfaceType=explore_chat");
  expect(response.ok()).toBeTruthy();
  const sessions = (await response.json()) as Array<{ id: string }>;
  expect(sessions.length).toBeGreaterThan(0);
  return sessions[0]!.id;
}

async function listMessages(
  context: BrowserContext,
  sessionId: string,
) {
  return context.request.get(`/api/message/list?sessionId=${encodeURIComponent(sessionId)}`);
}

async function forceExploreSession(
  page: Page,
  context: BrowserContext,
  authState: AuthState,
  sessionId: string,
  baseURL?: string,
) {
  await page.evaluate(
    ({ key, id }) => {
      window.localStorage.setItem(key, id);
    },
    { key: EXPLORE_SESSION_STORAGE_KEY, id: sessionId },
  );
  await recoverAfterReload(page, context, authState, baseURL, "/explore");
  await openLiveExplore(page, context, authState, baseURL, sessionId);
}

async function createInvestigationViaUi(
  page: Page,
  context: BrowserContext,
  authState: AuthState,
  baseURL: string | undefined,
  label: string,
) {
  const title = `${INVESTIGATIONS_ASSAULT_UI_TITLE_PREFIX} ${label} ${Date.now()}`;
  const organizingQuestion = `${INVESTIGATIONS_ASSAULT_UI_QUESTION_PREFIX} ${label} ${Date.now()}`;

  await openExploreTab(page, context, authState, baseURL, "questions");
  await expect(page.getByTestId("active-questions-create-card")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("active-questions-create-title").fill(title);
  await page.getByTestId("active-questions-create-question").fill(organizingQuestion);

  const createPromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/investigations") &&
      response.request().method() === "POST",
    { timeout: 30_000 },
  );
  await page.getByTestId("active-questions-create-submit").click();
  const createResponse = await createPromise;
  expect(createResponse.status()).toBe(201);
  const createPayload = (await createResponse.json()) as { item?: { id?: string } };
  const investigationId = createPayload.item?.id;
  expect(investigationId).toBeTruthy();

  await expect(page.getByTestId("active-questions-create-success-id")).toContainText(
    investigationId!,
    { timeout: 30_000 },
  );

  return {
    investigationId: investigationId!,
    title,
    organizingQuestion,
  };
}

async function openInvestigationDetailFromList(page: Page, investigationId: string, title?: string) {
  const row = page.getByTestId("active-question-row").filter({ hasText: investigationId }).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  await row.click();
  await expect(page.getByTestId("investigation-id")).toContainText(investigationId, {
    timeout: 60_000,
  });
  if (title) {
    await expect(
      page
        .getByTestId("production-investigation-detail")
        .getByRole("heading", { name: title }),
    ).toBeVisible({ timeout: 60_000 });
  }
}

async function openClosedInvestigationFromExploreTab(
  page: Page,
  context: BrowserContext,
  authState: AuthState,
  baseURL: string | undefined,
  investigationId: string,
) {
  await openExploreTab(page, context, authState, baseURL, "investigations");
  const row = page.getByTestId("investigation-row").filter({ hasText: investigationId }).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  await row.click();
  await expect(page.getByTestId("investigation-id")).toContainText(investigationId, {
    timeout: 60_000,
  });
}

async function waitForInvestigationInspector(page: Page, investigationId: string) {
  const panel = page.locator('[data-testid="inspector-investigation-panel"]:visible').first();
  await expect(panel).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByTestId("inspector-investigation-id")).toContainText(investigationId, {
    timeout: 60_000,
  });
  return panel;
}

test.describe("desktop production parity closure browser proof", () => {
  test.describe.configure({ mode: "serial", timeout: 1_200_000 });

  test.beforeAll(async () => {
    env = readEnvFile();
    const databaseUrl = requireEnv(env, "DATABASE_URL");
    process.env.DATABASE_URL = databaseUrl;
    process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
    process.env.NODE_ENV = process.env.NODE_ENV === "production" ? "test" : process.env.NODE_ENV;
    assertRealClerkEnv(env);

    clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });
    devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;

    primaryAuth = await createAuthState("desktop-production-parity-primary");
    crossAuth = await createAuthState("desktop-production-parity-cross");
    emptyAuth = await createAuthState("desktop-production-parity-empty");

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await resetFixtures();
  });

  test.beforeEach(async () => {
    await resetFixtures();
  });

  test.afterEach(async ({}, testInfo) => {
    artifacts.completed += 1;
    const passed = testInfo.status === testInfo.expectedStatus;
    if (passed) {
      artifacts.passed += 1;
    }
    patchArtifactRecord(testInfo.title, {
      status: passed ? "PASS" : String(testInfo.status).toUpperCase(),
      notes:
        !passed && testInfo.errors.length > 0
          ? testInfo.errors.map((error) => error.message.split("\n")[0] ?? "Unknown error")
          : undefined,
    });
  });

  test.afterAll(async () => {
    try {
      if (primaryAuth && crossAuth && prisma) {
        const movement = await cleanupMovementAssaultRuntimeFixture({
          userId: primaryAuth.userId,
          db: prisma,
        });
        const durable = await cleanupDurableActionsAssaultRuntimeFixture({
          userId: primaryAuth.userId,
          db: prisma,
        });
        const explore = await cleanupExploreAssaultRuntimeFixture({
          userId: primaryAuth.userId,
          crossUserId: crossAuth.userId,
          db: prisma,
        });
        const investigations = await cleanupInvestigationsFixture({
          userId: primaryAuth.userId,
          crossUserId: crossAuth.userId,
          db: prisma,
        });
        const investigationsRemaining = await countInvestigationsFixture({
          userId: primaryAuth.userId,
          crossUserId: crossAuth.userId,
          db: prisma,
        });

        artifacts.fixtureCleanup = {
          movement,
          durable,
          explore,
          investigations,
          investigationsRemaining,
        };
      }
    } finally {
      await prisma?.$disconnect();
    }

    const authStates = [primaryAuth, crossAuth, emptyAuth].filter(
      (value): value is AuthState => Boolean(value),
    );
    for (const authState of authStates) {
      try {
        await clerk.users.deleteUser(authState.userId);
      } catch {
        // best-effort
      }
    }

    artifacts.status =
      artifacts.completed >= artifacts.requiredMinimum &&
      artifacts.passed === artifacts.completed
        ? "passed"
        : "failed";

    mkdirSync(RECEIPTS_DIR, { recursive: true });
    writeFileSync(PLAYWRIGHT_ARTIFACT_PATH, JSON.stringify(artifacts, null, 2));
    if (TEST2_RUN_LABEL) {
      writeFileSync(
        resolve(RECEIPTS_DIR, `playwright-artifacts-${TEST2_RUN_LABEL}.json`),
        JSON.stringify(artifacts, null, 2),
      );
    }
  });

  test("TEST 1 — Today and report continuity", async ({ browser, baseURL }) => {
    if (!primaryAuth || !emptyAuth) {
      throw new Error("Auth runtime was not initialized.");
    }

    const seeded = await seedMovementAssaultRuntimeFixture({
      userId: primaryAuth.userId,
      db: prisma,
      includeSparse: false,
    });
    await publishMovementAssaultClaimFixture({
      userId: primaryAuth.userId,
      db: prisma,
      modelUpdateId: seeded.claimModelUpdateId,
    });
    artifacts.ids.todayModelUpdateId = seeded.claimModelUpdateId;
    artifacts.inspectorIdentities.todayModelUpdateId = seeded.claimModelUpdateId;
    artifacts.ids.timelineModelUpdateId = seeded.claimModelUpdateId;

    const { context, page } = await openAuthenticatedPage(browser, primaryAuth, baseURL, "/");
    try {
      await waitForTodayMovementHydration(
        page,
        context,
        primaryAuth,
        seeded.claimModelUpdateId,
        baseURL,
      );
      await expect(page.getByTestId("reference-sample-report-control")).toHaveCount(0);
      await expect(page.getByText("rep-weekly")).toHaveCount(0);

      const seeWhy = page.getByTestId("today-see-why").first();
      await expect(seeWhy).toBeVisible();
      await expect(seeWhy).toHaveAttribute("data-movement-id", seeded.claimModelUpdateId);
      await seeWhy.click();
      await expect(page.getByTestId("inspector-model-update-id").first()).toHaveText(
        seeded.claimModelUpdateId,
        { timeout: 30_000 },
      );

      await page.getByTestId("today-full-report").click();
      await expect(page.getByTestId("report-overlay-canonical-id")).toHaveText(
        seeded.claimModelUpdateId,
      );
      await expect(page.getByTestId("report-overlay-provenance")).toHaveAttribute(
        "data-report-provenance",
        "live_model_update",
      );

      patchArtifactRecord("TEST 1 — Today and report continuity", {
        ids: {
          modelUpdateId: seeded.claimModelUpdateId,
          reportOverlayId: seeded.claimModelUpdateId,
          inspectorModelUpdateId: seeded.claimModelUpdateId,
        },
      });
    } finally {
      await context.close();
    }

    const emptyPage = await openAuthenticatedPage(browser, emptyAuth, baseURL, "/");
    try {
      await expect(emptyPage.page.getByText("No current state surfaced yet.")).toBeVisible({
        timeout: 60_000,
      });
      await expect(
        emptyPage.page.getByText("No next observation or test surfaced yet."),
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        emptyPage.page.getByText("No receipts resurfaced in this window yet."),
      ).toBeVisible({ timeout: 60_000 });
      await expect(emptyPage.page.getByTestId("today-full-report")).toHaveCount(0);
      await expect(emptyPage.page.getByTestId("reference-sample-report-control")).toHaveCount(0);
      await expect(emptyPage.page.getByText("rep-weekly")).toHaveCount(0);
    } finally {
      await emptyPage.context.close();
    }
  });

  test("TEST 2 — Map and Inspector", async ({ browser, baseURL }) => {
    if (!primaryAuth || !emptyAuth) {
      throw new Error("Auth runtime was not initialized.");
    }

    const conclusionId = MOVEMENT_FIXTURE_CONCLUSION_ID;
    const title = "Evening stop point matters";
    const runLabel = TEST2_RUN_LABEL ?? `adhoc-${Date.now()}`;
    const runArtifact = buildTest2RunArtifact({
      runLabel,
      primaryUserId: primaryAuth.userId,
      emptyUserId: emptyAuth.userId,
      conclusionId,
    });
    const primaryRuntimeState: Test2RequestRuntimeState = {
      fixtureSetupComplete: false,
      priorTeardownActive: false,
    };
    const emptyRuntimeState: Test2RequestRuntimeState = {
      fixtureSetupComplete: true,
      priorTeardownActive: false,
    };

    writeTest2RunArtifact(runArtifact);
    recordTest2Lifecycle(runArtifact, "prior cleanup complete");
    recordTest2Lifecycle(runArtifact, "authenticated test user resolved", {
      primaryUserId: primaryAuth.userId,
      emptyUserId: emptyAuth.userId,
    });

    const seededTx = await prisma.$transaction(async (tx) => {
      const seeded = await seedMovementAssaultRuntimeFixture({
        userId: primaryAuth.userId,
        db: tx as unknown as PrismaClient,
        includeSparse: false,
      });

      const matchingCount = await tx.userMapConclusion.count({
        where: {
          id: conclusionId,
          userId: primaryAuth.userId,
        },
      });

      return {
        seeded,
        matchingCount,
      };
    });
    const seeded = seededTx.seeded;
    primaryRuntimeState.fixtureSetupComplete = true;
    recordTest2Lifecycle(runArtifact, "campaign fixture created", {
      claimModelUpdateId: seeded.claimModelUpdateId,
      conclusionModelUpdateId: seeded.conclusionModelUpdateId,
      sparseModelUpdateId: seeded.sparseModelUpdateId,
    });
    recordTest2Lifecycle(runArtifact, "database transaction committed", {
      wrapper: "prisma.$transaction",
    });
    recordTest2Lifecycle(runArtifact, "direct database read confirms fixture exists", {
      conclusionId,
      exactCount: seededTx.matchingCount,
      fixtureOwnerUserId: primaryAuth.userId,
    });
    expect(seededTx.matchingCount).toBe(1);

    artifacts.ids.mapConclusionId = conclusionId;
    artifacts.inspectorIdentities.mapConclusionId = conclusionId;

    let inspectorIdentity: string | null = null;
    let cleanupResult: Record<string, unknown> | null = null;
    let remainingCounts: Record<string, unknown> | null = null;

    const { context, page } = await openAuthenticatedPage(browser, primaryAuth, baseURL);
    try {
      recordTest2Lifecycle(runArtifact, "browser context created", {
        pageUrl: page.url(),
      });

      const primaryAuthProof = await assertAuthenticatedSessionProof({
        page,
        context,
        expectedUserId: primaryAuth.userId,
      });
      recordTest2Lifecycle(runArtifact, "authenticated identity confirmed", {
        source: primaryAuthProof.contextProbe.source,
        status: primaryAuthProof.contextProbe.status,
        resolvedUserId: primaryAuthProof.contextProbe.userId,
        fixtureOwnerUserId: primaryAuth.userId,
        browserResolvedUserId: primaryAuthProof.browserProbe.userId,
      });

      const apiPreflight = await captureMapListApiResponse({
        context,
        page,
        runLabel,
        expectedUserId: primaryAuth.userId,
        fixtureOwnerUserId: primaryAuth.userId,
        conclusionId,
        runtimeState: primaryRuntimeState,
      });
      runArtifact.primaryRequests.push(apiPreflight);
      writeTest2RunArtifact(runArtifact);
      expect(apiPreflight.status).toBe(200);
      expect(apiPreflight.returnedIds).toContain(conclusionId);

      const browserPreflight = await captureMapListBrowserFetch({
        page,
        runtimeState: primaryRuntimeState,
      });
      runArtifact.primaryRequests.push(browserPreflight);
      writeTest2RunArtifact(runArtifact);
      recordTest2Lifecycle(runArtifact, "browser-side authenticated identity confirmed", {
        source: browserPreflight.source,
        status: browserPreflight.status,
        returnedIds: browserPreflight.returnedIds,
        pageUrl: browserPreflight.pageUrl,
      });
      expect(browserPreflight.status).toBe(200);
      expect(browserPreflight.returnedIds).toContain(conclusionId);

      const flushPrimaryResponses = attachPageMapResponseRecorder({
        page,
        records: runArtifact.primaryRequests,
        runtimeState: primaryRuntimeState,
      });
      recordTest2Lifecycle(runArtifact, "Map navigation begins", {
        pageUrl: page.url(),
      });
      await openMapConclusion(page, context, primaryAuth, conclusionId, title, baseURL);
      await flushPrimaryResponses();
      writeTest2RunArtifact(runArtifact);
      try {
        await expect(page.getByText("Could not load your map.")).toHaveCount(0);
        const inspectorPanel = page
          .locator('[data-testid="inspector-map-conclusion-panel"]:visible')
          .first();
        await expect(inspectorPanel).toHaveAttribute(
          "data-object-id",
          conclusionId,
        );
        await expect(inspectorPanel).toContainText(title);
        await expect(inspectorPanel).toContainText("Supporting evidence");
        await expect(inspectorPanel).toContainText(MOVEMENT_FIXTURE_CLAIM_SUMMARY);
        await expect(inspectorPanel).not.toContainText("No linked public evidence yet.");
        inspectorIdentity = await inspectorPanel.getAttribute("data-object-id");
        recordTest2Lifecycle(runArtifact, "UI assertion completes", {
          visibleRowId: conclusionId,
          inspectorId: inspectorIdentity,
          pageUrl: page.url(),
        });
      } catch (error) {
        throw error;
      }
      runArtifact.result = {
        primaryVisibleRowId: conclusionId,
        primaryInspectorId: inspectorIdentity,
      };
      writeTest2RunArtifact(runArtifact);
      patchArtifactRecord("TEST 2 — Map and Inspector", {
        ids: {
          mapConclusionId: conclusionId,
          inspectorMapConclusionId: conclusionId,
        },
      });
    } finally {
      recordTest2Lifecycle(runArtifact, "browser context closes", {
        pageUrl: page.url(),
      });
      await context.close();
    }

    const emptyPage = await openAuthenticatedPage(browser, emptyAuth, baseURL);
    try {
      recordTest2Lifecycle(runArtifact, "empty browser context created", {
        pageUrl: emptyPage.page.url(),
      });

      const emptyAuthProof = await assertAuthenticatedSessionProof({
        page: emptyPage.page,
        context: emptyPage.context,
        expectedUserId: emptyAuth.userId,
      });
      recordTest2Lifecycle(runArtifact, "empty-user authenticated identity confirmed", {
        source: emptyAuthProof.contextProbe.source,
        status: emptyAuthProof.contextProbe.status,
        resolvedUserId: emptyAuthProof.contextProbe.userId,
        browserResolvedUserId: emptyAuthProof.browserProbe.userId,
      });

      const emptyApiPreflight = await captureMapListApiResponse({
        context: emptyPage.context,
        page: emptyPage.page,
        runLabel,
        expectedUserId: emptyAuth.userId,
        fixtureOwnerUserId: emptyAuth.userId,
        conclusionId,
        runtimeState: emptyRuntimeState,
      });
      runArtifact.emptyUserRequests.push(emptyApiPreflight);
      writeTest2RunArtifact(runArtifact);
      expect(emptyApiPreflight.status).toBe(200);
      expect(emptyApiPreflight.returnedCount).toBe(0);
      expect(emptyApiPreflight.returnedIds).toHaveLength(0);

      const emptyBrowserPreflight = await captureMapListBrowserFetch({
        page: emptyPage.page,
        runtimeState: emptyRuntimeState,
      });
      runArtifact.emptyUserRequests.push(emptyBrowserPreflight);
      writeTest2RunArtifact(runArtifact);
      expect(emptyBrowserPreflight.status).toBe(200);
      expect(emptyBrowserPreflight.returnedCount).toBe(0);
      expect(emptyBrowserPreflight.returnedIds).toHaveLength(0);

      const flushEmptyResponses = attachPageMapResponseRecorder({
        page: emptyPage.page,
        records: runArtifact.emptyUserRequests,
        runtimeState: emptyRuntimeState,
      });
      const openMapButton = emptyPage.page.getByTestId("nav-map");
      await expect(openMapButton).toBeVisible({ timeout: 30_000 });
      recordTest2Lifecycle(runArtifact, "empty-user Map navigation begins", {
        pageUrl: emptyPage.page.url(),
      });
      await openMapButton.click();
      await expect(emptyPage.page.getByText("Nothing on your map yet.")).toBeVisible({
        timeout: 60_000,
      });
      await expect(emptyPage.page.getByText("Could not load your map.")).toHaveCount(0);
      await expect(
        emptyPage.page.getByText(/scope reopening under uncertainty/i),
      ).toHaveCount(0);
      await flushEmptyResponses();
      writeTest2RunArtifact(runArtifact);
      recordTest2Lifecycle(runArtifact, "empty-user UI assertion completes", {
        responseStatus: emptyApiPreflight.status,
        returnedCount: emptyApiPreflight.returnedCount,
        pageUrl: emptyPage.page.url(),
      });
    } finally {
      recordTest2Lifecycle(runArtifact, "empty browser context closes", {
        pageUrl: emptyPage.page.url(),
      });
      await emptyPage.context.close();
    }

    primaryRuntimeState.priorTeardownActive = true;
    emptyRuntimeState.priorTeardownActive = true;
    recordTest2Lifecycle(runArtifact, "campaign cleanup begins");

    cleanupResult = await cleanupMovementAssaultRuntimeFixture({
      userId: primaryAuth.userId,
      db: prisma,
      modelUpdateIds: [seeded.claimModelUpdateId, seeded.conclusionModelUpdateId],
    });
    remainingCounts = await countMovementMapFixtureRemaining(primaryAuth.userId);
    recordTest2Lifecycle(runArtifact, "cleanup query confirms zero remaining records", {
      cleanupResult,
      remainingCounts,
    });
    expect(Object.values(remainingCounts).every((value) => value === 0)).toBe(true);
    runArtifact.result = {
      ...(runArtifact.result ?? {}),
      primaryVisibleRowId: conclusionId,
      primaryInspectorId: inspectorIdentity,
      emptyUserResponseStatus: 200,
      emptyUserUiState: "Nothing on your map yet.",
      cleanupResult,
      remainingCounts,
    };
    writeTest2RunArtifact(runArtifact);
  });

  test("TEST 3 — Decisions continuity", async ({ browser, baseURL }) => {
    if (!primaryAuth || !emptyAuth) {
      throw new Error("Auth runtime was not initialized.");
    }

    const seeded = await seedDurableActionsAssaultRuntimeFixture({
      userId: primaryAuth.userId,
      db: prisma,
    });
    const decisionActionId = seeded.decisionActionId;
    artifacts.ids.decisionActionId = decisionActionId;
    artifacts.inspectorIdentities.decisionActionId = decisionActionId;

    const { context, page } = await openAuthenticatedPage(browser, primaryAuth, baseURL, "/actions");
    try {
      const decisionsPage = page.getByTestId("orvek-v0-decisions-page");
      const inspectorDecisionPanel = page
        .locator('[data-testid="inspector-decision-panel"]:visible')
        .first();
      await expect(page.getByText(FIXTURE_DECISION_TITLE).first()).toBeVisible({ timeout: 60_000 });
      await page.getByText(FIXTURE_DECISION_TITLE).first().click();
      await expect(decisionsPage.getByTestId("durable-outcome-input")).toBeVisible({ timeout: 30_000 });
      await expect(inspectorDecisionPanel).toHaveAttribute(
        "data-object-id",
        decisionActionId,
      );

      await decisionsPage.getByTestId("durable-outcome-input").fill(FIXTURE_OUTCOME_NOTE);
      const patchPromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/actions/${decisionActionId}`) &&
          response.request().method() === "PATCH",
        { timeout: 30_000 },
      );
      await decisionsPage.getByTestId("durable-outcome-submit").click();
      const patchResponse = await patchPromise;
      expect(patchResponse.status()).toBe(200);

      await expect(decisionsPage.getByTestId("durable-outcome-recorded")).toContainText(
        FIXTURE_OUTCOME_NOTE,
      );
      await recoverAfterReload(page, context, primaryAuth, baseURL, "/actions");
      await expect(page.getByText(FIXTURE_DECISION_TITLE).first()).toBeVisible({ timeout: 60_000 });
      await page.getByText(FIXTURE_DECISION_TITLE).first().click();
      await expect(decisionsPage.getByTestId("durable-outcome-recorded")).toContainText(
        FIXTURE_OUTCOME_NOTE,
      );
      await expect(inspectorDecisionPanel).toHaveAttribute(
        "data-object-id",
        decisionActionId,
      );

      patchArtifactRecord("TEST 3 — Decisions continuity", {
        ids: {
          decisionActionId,
          inspectorDecisionId: decisionActionId,
        },
      });
    } finally {
      await context.close();
    }

    const emptyPage = await openAuthenticatedPage(browser, emptyAuth, baseURL, "/actions");
    try {
      await expect(
        emptyPage.page.getByText(DECISIONS_EMPTY_COPY),
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        emptyPage.page.getByText(/Use v0 architecture prototype before final design/i),
      ).toHaveCount(0);
    } finally {
      await emptyPage.context.close();
    }
  });

  test("TEST 4 — Explore grounding and movement continuity", async ({ browser, baseURL }) => {
    if (!primaryAuth || !crossAuth) {
      throw new Error("Auth runtime was not initialized.");
    }

    await seedExploreAssaultRuntimeFixture({
      userId: primaryAuth.userId,
      crossUserId: crossAuth.userId,
      db: prisma,
    });

    const { context, page } = await openAuthenticatedPage(browser, primaryAuth, baseURL, "/explore");
    let runtimeConversationId = FIXTURE_SESSION_ID;
    let runtimeUserMessageId = "";
    let runtimeAssistantMessageId = "";
    let runtimeProposalId = "";
    let runtimeModelUpdateId = "";

    try {
      const explore = await openLiveExplore(page, context, primaryAuth, baseURL, FIXTURE_SESSION_ID);
      runtimeConversationId = FIXTURE_SESSION_ID;
      await sendExploreMessage(page, POSITIVE_USER_MESSAGE);
      runtimeConversationId =
        (await page.evaluate(
          (key) => window.localStorage.getItem(key),
          EXPLORE_SESSION_STORAGE_KEY,
        )) ?? FIXTURE_SESSION_ID;

      await expect
        .poll(
          async () => {
            const list = await listMessages(context, runtimeConversationId);
            if (!list.ok()) return "list_not_ok";
            const messages = (await list.json()) as Array<{
              id: string;
              role: string;
              content?: string;
              grounding?: {
                sources?: Array<{ sourceId: string; epistemicStatus?: string }>;
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
                  sourceIds.includes(FIXTURE_CLAIM_EVIDENCE_ID)
                );
              });
            if (groundedAssistantIndex < 0) return "missing_grounded_assistant";
            const assistant = messages[messages.length - 1 - groundedAssistantIndex]!;
            const precedingUser = [...messages.slice(0, messages.indexOf(assistant))]
              .reverse()
              .find((row) => row.role === "user");
            if (!precedingUser) return "missing_preceding_user";
            const sourceIds = (assistant.grounding?.sources ?? []).map((source) => source.sourceId);
            if (!sourceIds.includes(FIXTURE_JOURNAL_VERIFIED_ID)) return "missing_verified";
            if (!sourceIds.includes(FIXTURE_CLAIM_EVIDENCE_ID)) return "missing_inferred";
            runtimeUserMessageId = precedingUser.id;
            runtimeAssistantMessageId = assistant.id;
            runtimeProposalId = assistant.grounding?.movementProposal?.proposalId ?? "";
            return "ok";
          },
          { timeout: 120_000 },
        )
        .toBe("ok");

      await expect(
        explore.getByTestId(`explore-grounding-chip-${FIXTURE_JOURNAL_VERIFIED_ID}`),
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        explore.getByTestId(`explore-grounding-chip-${FIXTURE_CLAIM_EVIDENCE_ID}`),
      ).toBeVisible({ timeout: 60_000 });
      await expect(explore.locator('[data-epistemic-status="VERIFIED"]').first()).toBeVisible();
      await expect(explore.locator('[data-epistemic-status="INFERRED"]').first()).toBeVisible();

      await forceExploreSession(page, context, primaryAuth, runtimeConversationId, baseURL);

      const assistantBubble = explore.locator('[data-message-role="assistant"]').last();
      await assistantBubble.click();
      const inspector = page.getByRole("complementary").filter({ hasText: "Inspector" });
      await expect(
        inspector.getByTestId(`inspector-grounding-source-${FIXTURE_JOURNAL_VERIFIED_ID}`).first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        inspector.getByTestId(`inspector-grounding-source-${FIXTURE_CLAIM_EVIDENCE_ID}`).first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(explore.getByTestId("explore-proposed-movement")).toBeVisible({ timeout: 60_000 });

      const proposalId =
        (await explore
          .getByTestId("explore-proposed-movement")
          .getAttribute("data-proposal-id")) || runtimeProposalId;
      runtimeProposalId = proposalId ?? "";
      expect(runtimeProposalId).toBeTruthy();

      const publishPromise = page.waitForResponse(
        (response) =>
          response.url().includes("/movement-proposals/") &&
          response.url().includes("/publish") &&
          response.request().method() === "POST",
        { timeout: 60_000 },
      );
      await explore.getByTestId("explore-publish-movement").click();
      const publishResponse = await publishPromise;
      expect(publishResponse.ok()).toBeTruthy();
      const publishJson = (await publishResponse.json()) as { modelUpdateId?: string };
      runtimeModelUpdateId = publishJson.modelUpdateId ?? "";
      expect(runtimeModelUpdateId.length).toBeGreaterThan(8);

      artifacts.ids.exploreConversationId = runtimeConversationId;
      artifacts.ids.exploreUserMessageId = runtimeUserMessageId;
      artifacts.ids.exploreAssistantMessageId = runtimeAssistantMessageId;
      artifacts.ids.exploreProposalId = runtimeProposalId;
      artifacts.ids.exploreModelUpdateId = runtimeModelUpdateId;
      artifacts.inspectorIdentities.exploreModelUpdateId = runtimeModelUpdateId;

      await expect(explore.getByTestId("explore-published-model-update-id")).toHaveAttribute(
        "data-model-update-id",
        runtimeModelUpdateId,
      );

      await gotoPath(page, context, primaryAuth, "/", baseURL);
      await expect(
        page.locator(`[data-testid="today-full-report"][data-report-id="${runtimeModelUpdateId}"]`),
      ).toBeVisible({ timeout: 60_000 });
      await page.getByTestId("today-see-why").first().click();
      await expect(page.getByTestId("inspector-model-update-id").first()).toContainText(
        runtimeModelUpdateId,
      );

      await gotoPath(page, context, primaryAuth, "/timeline", baseURL);
      await expect(
        page.locator(`[data-testid="timeline-movement-row"][data-movement-id="${runtimeModelUpdateId}"]`).first(),
      ).toBeVisible({ timeout: 60_000 });

      await gotoPath(page, context, primaryAuth, "/dev/orvek-v0-reference", baseURL);
      await expect(page.getByTestId("orvek-v0-reference-route")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("reference-sample-report-control")).toBeVisible();

      patchArtifactRecord("TEST 4 — Explore grounding and movement continuity", {
        ids: {
          conversationId: runtimeConversationId,
          userMessageId: runtimeUserMessageId,
          assistantMessageId: runtimeAssistantMessageId,
          proposalId: runtimeProposalId,
          modelUpdateId: runtimeModelUpdateId,
        },
      });
    } finally {
      await context.close();
    }
  });

  test("TEST 5 — Investigations continuity", async ({ browser, baseURL }) => {
    if (!primaryAuth || !crossAuth) {
      throw new Error("Auth runtime was not initialized.");
    }

    await seedInvestigationsAssaultRuntimeFixture({
      userId: primaryAuth.userId,
      crossUserId: crossAuth.userId,
      db: prisma,
    });

    const { context, page } = await openAuthenticatedPage(browser, primaryAuth, baseURL, "/explore");
    try {
      const created = await createInvestigationViaUi(
        page,
        context,
        primaryAuth,
        baseURL,
        "closure",
      );
      artifacts.ids.investigationId = created.investigationId;
      artifacts.inspectorIdentities.investigationId = created.investigationId;

      await openInvestigationDetailFromList(page, created.investigationId, created.title);
      await expect(page.getByTestId("investigation-linked-evidence-empty")).toBeVisible();
      await expect(page.getByTestId("investigation-linked-fieldwork-empty")).toBeVisible();

      await expect(page.getByTestId(`investigation-available-evidence-${INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID}`)).toBeVisible({
        timeout: 30_000,
      });
      await page.getByTestId(`investigation-available-evidence-${INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID}`).check();
      const evidencePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/understanding/evidence-links") &&
          response.request().method() === "POST",
        { timeout: 30_000 },
      );
      await page.getByTestId("investigation-link-evidence-submit").click();
      expect((await evidencePromise).status()).toBe(201);
      artifacts.ids.investigationEvidenceId = INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID;

      const watchForPrompt = `${INVESTIGATIONS_ASSAULT_UI_WATCH_FOR_PREFIX} closure ${Date.now()}`;
      const watchForReason = "Verify whether naming the stop point changes the escalation.";
      await page.getByTestId("investigation-watch-for-prompt").fill(watchForPrompt);
      await page.getByTestId("investigation-watch-for-reason").fill(watchForReason);
      const watchForPromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/fieldwork") &&
          response.request().method() === "POST",
        { timeout: 30_000 },
      );
      await page.getByTestId("investigation-watch-for-submit").click();
      const watchForResponse = await watchForPromise;
      expect(watchForResponse.status()).toBe(201);
      const watchForJson = (await watchForResponse.json()) as { item?: { id?: string } };
      const watchForId = watchForJson.item?.id ?? "";
      expect(watchForId).toBeTruthy();
      artifacts.ids.watchForId = watchForId;
      await expect(page.getByTestId("investigation-linked-fieldwork-list")).toContainText(
        `Fieldwork ID ${watchForId}`,
        { timeout: 60_000 },
      );

      await openExploreTab(page, context, primaryAuth, baseURL, "fieldwork");
      const fieldworkRow = page.getByTestId("fieldwork-row").filter({ hasText: watchForId }).first();
      if (await fieldworkRow.count()) {
        await expect(fieldworkRow).toBeVisible({ timeout: 60_000 });
        await fieldworkRow.click();
      }
      await expect(page.getByTestId("watch-for-id")).toContainText(watchForId, {
        timeout: 60_000,
      });
      await page.getByTestId("durable-checkin-input").fill(FIXTURE_CHECKIN_NOTE);
      const checkInPromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/fieldwork/${watchForId}`) &&
          response.request().method() === "PATCH",
        { timeout: 30_000 },
      );
      await page.getByTestId("durable-checkin-submit").click();
      expect((await checkInPromise).status()).toBe(200);

      await recoverAfterReloadToExploreTab(page, context, primaryAuth, baseURL, "questions");
      await openInvestigationDetailFromList(page, created.investigationId, created.title);
      await page.getByTestId("investigation-outcome-input").fill(OUTCOME_NOTE);
      const outcomePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/investigations/${created.investigationId}`) &&
          response.request().method() === "PATCH",
        { timeout: 30_000 },
      );
      await page.getByTestId("investigation-outcome-save").click();
      expect((await outcomePromise).status()).toBe(200);

      for (const nextStatus of ["gathering_evidence", "testing", "resolving"] as const) {
        const transitionPromise = page.waitForResponse(
          (response) =>
            response.url().includes(`/api/investigations/${created.investigationId}`) &&
            response.request().method() === "PATCH",
          { timeout: 30_000 },
        );
        await page.getByTestId(`investigation-transition-${nextStatus}`).click();
        expect((await transitionPromise).status()).toBe(200);
      }

      const resolvePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/investigations/${created.investigationId}`) &&
          response.request().method() === "PATCH",
        { timeout: 30_000 },
      );
      await page.getByTestId("investigation-transition-resolved").click();
      expect((await resolvePromise).status()).toBe(200);

      await openClosedInvestigationFromExploreTab(
        page,
        context,
        primaryAuth,
        baseURL,
        created.investigationId,
      );
      await expect(page.getByTestId("investigation-status")).toContainText("resolved");
      const inspectorPanel = await waitForInvestigationInspector(page, created.investigationId);
      await expect(inspectorPanel).toContainText(OUTCOME_NOTE);
      await expect(inspectorPanel).toContainText(`Evidence ID ${INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID}`);
      await expect(inspectorPanel).toContainText(`Fieldwork ID ${watchForId}`);

      patchArtifactRecord("TEST 5 — Investigations continuity", {
        ids: {
          investigationId: created.investigationId,
          evidenceId: INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID,
          watchForId,
          inspectorInvestigationId: created.investigationId,
        },
      });
    } finally {
      await context.close();
    }
  });

  test("TEST 6 — Timeline provenance", async ({ browser, baseURL }) => {
    if (!primaryAuth || !emptyAuth) {
      throw new Error("Auth runtime was not initialized.");
    }

    const seeded = await seedMovementAssaultRuntimeFixture({
      userId: primaryAuth.userId,
      db: prisma,
      includeSparse: true,
    });
    await publishMovementAssaultClaimFixture({
      userId: primaryAuth.userId,
      db: prisma,
      modelUpdateId: seeded.claimModelUpdateId,
    });
    artifacts.ids.timelineModelUpdateId = seeded.claimModelUpdateId;
    artifacts.inspectorIdentities.timelineModelUpdateId = seeded.claimModelUpdateId;

    const { context, page } = await openAuthenticatedPage(browser, primaryAuth, baseURL, "/timeline");
    try {
      const row = page.locator(
        `[data-testid="timeline-movement-row"][data-movement-id="${seeded.claimModelUpdateId}"]`,
      ).first();
      await expect(row).toBeVisible({ timeout: 60_000 });
      await expect(
        page.locator('[data-testid="timeline-movement-row"]').first(),
      ).toHaveAttribute("data-movement-id", seeded.claimModelUpdateId);
      await row.click();
      await expect(page.getByTestId("inspector-model-update-id").first()).toHaveText(
        seeded.claimModelUpdateId,
      );

      const evidence = await context.request.get(
        `/api/what-changed/${seeded.claimModelUpdateId}/evidence`,
      );
      expect(evidence.ok()).toBeTruthy();

      patchArtifactRecord("TEST 6 — Timeline provenance", {
        ids: {
          modelUpdateId: seeded.claimModelUpdateId,
          inspectorModelUpdateId: seeded.claimModelUpdateId,
        },
      });
    } finally {
      await context.close();
    }

    const emptyPage = await openAuthenticatedPage(browser, emptyAuth, baseURL, "/timeline");
    try {
      await expect(emptyPage.page.getByTestId("timeline-movement-row")).toHaveCount(0);
      await expect(emptyPage.page.getByText(TIMELINE_ACTIVITY_EMPTY_COPY)).toBeVisible({
        timeout: 60_000,
      });
      await expect(emptyPage.page.getByTestId("today-full-report")).toHaveCount(0);
    } finally {
      await emptyPage.context.close();
    }
  });

  test("TEST 7 — global empty, unavailable, auth, and reference isolation", async ({ browser, baseURL }) => {
    if (!primaryAuth || !crossAuth || !emptyAuth) {
      throw new Error("Auth runtime was not initialized.");
    }

    const { context, page } = await openAuthenticatedPage(browser, emptyAuth, baseURL, "/");
    try {
      const inspector = page.getByRole("complementary").filter({ hasText: "Inspector" });
      await expect(inspector.getByText("Select something to inspect")).toBeVisible({
        timeout: 60_000,
      });
      await expect(
        inspector.getByText(
          "Open a receipt, movement item, or attention row on Today to see evidence and context here.",
        ),
      ).toBeVisible({ timeout: 60_000 });

      await gotoPath(page, context, emptyAuth, "/explore", baseURL);
      await expect(page.getByTestId("explore-grounding-empty")).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-testid^="explore-grounding-chip-"]')).toHaveCount(0);

      await openExploreTab(page, context, emptyAuth, baseURL, "questions");
      await expect(page.getByText("No active questions are open yet.")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByTestId("active-question-row")).toHaveCount(0);

      await openExploreTab(page, context, emptyAuth, baseURL, "investigations");
      await expect(page.getByText(V0_EXPLORE_INVESTIGATIONS_EMPTY_LIST)).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByTestId("investigation-row")).toHaveCount(0);

      await gotoPath(page, context, emptyAuth, "/dev/orvek-v0-reference", baseURL);
      await expect(page.getByTestId("orvek-v0-reference-route")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("reference-sample-report-control")).toBeVisible();
    } finally {
      await context.close();
    }

    const primaryNegative = await openAuthenticatedPage(browser, primaryAuth, baseURL, "/");
    const crossNegative = await openAuthenticatedPage(browser, crossAuth, baseURL, "/");
    let primaryInvestigationId = "";
    try {
      await assertAuthenticatedSessionProof({
        page: primaryNegative.page,
        context: primaryNegative.context,
        expectedUserId: primaryAuth.userId,
      });
      await assertAuthenticatedSessionProof({
        page: crossNegative.page,
        context: crossNegative.context,
        expectedUserId: crossAuth.userId,
      });

      const primaryCreate = await primaryNegative.context.request.post("/api/investigations", {
        headers: { "Content-Type": "application/json" },
        data: {
          title: `${INVESTIGATIONS_ASSAULT_UI_TITLE_PREFIX} negative ${Date.now()}`,
          organizingQuestion: `${INVESTIGATIONS_ASSAULT_UI_QUESTION_PREFIX} negative ${Date.now()}`,
          status: "open",
          seedType: "user_curiosity",
          competingTheories: [],
          evidenceNeeded: [],
        },
      });
      expect(primaryCreate.status()).toBe(201);
      const primaryCreatePayload = (await primaryCreate.json()) as { item?: { id?: string } };
      primaryInvestigationId = primaryCreatePayload.item?.id ?? "";
      expect(primaryInvestigationId).toBeTruthy();

      const unauthenticatedList = await fetch(`${ORIGIN}/api/investigations`);
      const unauthenticatedDetail = await fetch(
        `${ORIGIN}/api/investigations/${encodeURIComponent(primaryInvestigationId)}`,
      );
      const unauthenticatedDecisionPatch = await fetch(`${ORIGIN}/api/actions/missing-action`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "helped", note: "blocked" }),
      });
      const crossUserDetail = await crossNegative.context.request.get(
        `/api/investigations/${encodeURIComponent(primaryInvestigationId)}`,
      );
      const missingInvestigation = await primaryNegative.context.request.get(
        `/api/investigations/${encodeURIComponent("missing-investigation-assault")}`,
      );
      const missingExploreMessage = await primaryNegative.context.request.get(
        `/api/explore/messages/${encodeURIComponent("missing-explore-message-assault")}/grounding`,
      );
      const malformedExploreMessage = await primaryNegative.context.request.get(
        "/api/explore/messages/%20/grounding",
      );
      const crossSessionList = await primaryNegative.context.request.get(
        `/api/message/list?sessionId=${encodeURIComponent(FIXTURE_CROSS_USER_SESSION_ID)}`,
      );

      artifacts.negativeStatuses = {
        unauthenticatedInvestigationList: unauthenticatedList.status,
        unauthenticatedInvestigationDetail: unauthenticatedDetail.status,
        unauthenticatedDecisionPatch: unauthenticatedDecisionPatch.status,
        crossUserInvestigationDetail: crossUserDetail.status(),
        missingInvestigation: missingInvestigation.status(),
        missingExploreMessage: missingExploreMessage.status(),
        malformedExploreMessage: malformedExploreMessage.status(),
        crossUserExploreSessionList: crossSessionList.status(),
      };
    } finally {
      await primaryNegative.context.close();
      await crossNegative.context.close();
    }

    patchArtifactRecord("TEST 7 — global empty, unavailable, auth, and reference isolation", {
      statuses: artifacts.negativeStatuses,
      ids: {
        negativeInvestigationId: primaryInvestigationId,
      },
    });
  });
});
