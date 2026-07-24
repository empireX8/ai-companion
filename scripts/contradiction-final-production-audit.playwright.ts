/**
 * Authenticated browser proof for CONTRADICTION-FINAL-PRODUCTION-AUDIT-001.
 *
 * Boundary:
 * - Message-route creation is proven by the real route/DB integration proof.
 * - Authenticated browser DOM is proven from a real persisted candidate fixture.
 * - No claim is made that a live model-created candidate was generated through
 *   the browser.
 *
 * Uses:
 * - real Next.js routes
 * - real local PostgreSQL fixture data
 * - real Clerk development users and sessions
 *
 * Does NOT:
 * - call a live contradiction provider
 * - touch non-local or production databases
 * - bypass auth
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CONTRADICTION_REAL_DB_TEST_URL_ENV,
  assertContradictionRealDbTestUrl,
  assertDestructiveTargetIsIsolatedTestDb,
} from "../lib/contradiction-real-db-round-trip-safety";
import {
  createBrowserAuditClerkRuntimeError,
  resolveBrowserAuditCleanupUserId,
} from "../lib/contradiction-final-production-audit-runtime";
import {
  CONTRADICTION_RT_CONTENT_A,
  CONTRADICTION_RT_CONTENT_B,
  CONTRADICTION_RT_PROP_A,
  CONTRADICTION_RT_PROP_B,
  CONTRADICTION_RT_QUOTE_A,
  CONTRADICTION_RT_QUOTE_B,
  cleanupContradictionRtFixtureUser,
  contradictionRtFixtureCounts,
  makeContradictionRtFixtureIds,
  seedContradictionRtAuthoritativeFixture,
  shaExactQuote,
  type ContradictionRtFixtureIds,
} from "../lib/__tests__/helpers/contradiction-real-db-fixture-helpers";

type EnvMap = Record<string, string>;

type AuthState = {
  userId: string;
  email: string;
  password: string;
};

type PageFetchResult = {
  status: number;
  headers: Record<string, string>;
  body: string;
  url: string;
};

type CandidateApiItem = {
  id: string;
  title: string;
  status: string;
  sideA: string;
  sideB: string;
  sideASourceSpanId?: string | null;
  sideBSourceSpanId?: string | null;
  dualSource?: {
    lineageState: string;
    sideA: {
      availability: string;
      spanId?: string;
      messageId?: string;
      exactQuote?: string;
    };
    sideB: {
      availability: string;
      spanId?: string;
      messageId?: string;
      exactQuote?: string;
    };
  };
};

type ContradictionListPayload = {
  items: CandidateApiItem[];
  page: number;
  limit: number;
  hasMore: boolean;
};

type ContradictionDetailPayload = {
  id: string;
  status: string;
  sideA: string;
  sideB: string;
  evidenceCount: number;
  dualSource: {
    lineageState: string;
    sideA: {
      availability: string;
      spanId: string;
      messageId: string;
      exactQuote: string;
      side: string;
    };
    sideB: {
      availability: string;
      spanId: string;
      messageId: string;
      exactQuote: string;
      side: string;
    };
  };
};

type InspectorPayload = {
  item: {
    id: string;
    title: string;
    status: string;
    evidenceCount: number;
    dualSource: {
      lineageState: string;
      sideA: {
        availability: string;
        spanId: string;
        exactQuote: string;
      };
      sideB: {
        availability: string;
        spanId: string;
        exactQuote: string;
      };
    };
  };
};

type UserMapListPayload = {
  items: Array<{
    id: string;
    title: string;
    summary: string;
    status: string;
  }>;
  page: number;
  limit: number;
  hasMore: boolean;
};

type UserMapDetailPayload = {
  item: {
    id: string;
    title: string;
    summary: string;
    status: string;
  };
};

type PatchConflictPayload = {
  error: {
    code: string;
    message: string;
  };
};

type BrowserAuditFixture = {
  ids: ContradictionRtFixtureIds;
  title: string;
  sameTitleConclusionId: string;
  sameTitleSummary: string;
  candidateNodeId: string;
  sideASpanId: string;
  sideBSpanId: string;
  confidence: "low";
  evidenceCount: 0;
};

type SetupStage =
  | "env_file_load"
  | "clerk_env_validation"
  | "db_url_validation"
  | "prisma_client_create"
  | "clerk_client_create"
  | "primary_clerk_user_create"
  | "foreign_clerk_user_create"
  | "fixture_seed"
  | "fixture_counts";

type SetupFailureCategory =
  | "BLOCKED_LOCAL_DATABASE_RUNTIME"
  | "BLOCKED_AUTHENTICATED_BROWSER_RUNTIME"
  | "FAIL_PRODUCTION_AUDIT";

const ROOT = resolve(process.cwd());
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3100";
const AUTH_PROBE_PATH = "/api/desktop-production-parity/auth-probe";
const CANDIDATE_API_PATH =
  "/api/contradiction?status=candidate&page=1&limit=50&includeDualSource=true";
const OPEN_API_PATH = "/api/contradiction?status=open&page=1&limit=50";
const USER_MAP_LIST_PATH = "/api/user-map/conclusions?limit=50&sortOrder=desc";

let env: EnvMap;
let prisma: PrismaClient;
let clerk = createClerkClient({ secretKey: "", publishableKey: "" });
let devBrowserToken = "";
let primaryAuth: AuthState | null = null;
let foreignAuth: AuthState | null = null;
let fixture: BrowserAuditFixture | null = null;

function readEnvFile(relativePath = process.env.MINDLAB_ENV_FILE ?? ".env"): EnvMap {
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

function classifySetupFailure(stage: SetupStage): Error {
  const categoryByStage: Record<SetupStage, SetupFailureCategory> = {
    env_file_load: "BLOCKED_AUTHENTICATED_BROWSER_RUNTIME",
    clerk_env_validation: "BLOCKED_AUTHENTICATED_BROWSER_RUNTIME",
    db_url_validation: "BLOCKED_LOCAL_DATABASE_RUNTIME",
    prisma_client_create: "BLOCKED_LOCAL_DATABASE_RUNTIME",
    clerk_client_create: "BLOCKED_AUTHENTICATED_BROWSER_RUNTIME",
    primary_clerk_user_create: "BLOCKED_AUTHENTICATED_BROWSER_RUNTIME",
    foreign_clerk_user_create: "BLOCKED_AUTHENTICATED_BROWSER_RUNTIME",
    fixture_seed: "BLOCKED_LOCAL_DATABASE_RUNTIME",
    fixture_counts: "BLOCKED_LOCAL_DATABASE_RUNTIME",
  };

  return new Error(`${categoryByStage[stage]}:${stage}`);
}

async function createAuthState(prefix: string): Promise<AuthState> {
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
      if (!isClerkRateLimitError(error) || attempt === 5) {
        break;
      }
      await sleep(15_000 * attempt);
    }
  }
  throw createBrowserAuditClerkRuntimeError("testing_user_create");
}

async function safeDeleteClerkUser(userId: string): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await clerk.users.deleteUser(userId);
      return;
    } catch (error) {
      if (!isClerkRateLimitError(error) || attempt === 5) {
        break;
      }
      await sleep(15_000 * attempt);
    }
  }
  throw createBrowserAuditClerkRuntimeError("testing_user_delete");
}

async function refreshTestingBrowserToken() {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;
      return;
    } catch (error) {
      if (!isClerkRateLimitError(error) || attempt === 5) {
        break;
      }
      await sleep(15_000 * attempt);
    }
  }

  throw createBrowserAuditClerkRuntimeError("testing_token_refresh");
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
    return await page.evaluate(
      async ({ endpoint, expectedId }) => {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) {
          return false;
        }
        const payload = (await response.json()) as {
          authenticated?: boolean;
          userId?: string | null;
        };
        return payload.authenticated === true && payload.userId === expectedId;
      },
      { endpoint: AUTH_PROBE_PATH, expectedId: expectedUserId },
    );
  } catch {
    return false;
  }
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

function resolveCurrentPath(page: Page): string {
  try {
    const url = new URL(page.url());
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
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

async function gotoPath(
  page: Page,
  context: BrowserContext,
  authState: AuthState,
  path: string,
  baseURL?: string,
) {
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response = await page.goto(path, { waitUntil: "domcontentloaded" });
    if (await page.getByRole("heading", { name: /Sign in/i }).isVisible().catch(() => false)) {
      await stabilizeAuthenticatedSession(page, context, authState, baseURL);
      response = await page.goto(path, { waitUntil: "domcontentloaded" });
    }

    lastStatus = response?.status() ?? null;
    await waitForBrowserAuthOnCurrentPage(page, authState.userId);

    try {
      await expect
        .poll(() => resolveCurrentPath(page), { timeout: 15_000 })
        .toBe(path);
      return lastStatus;
    } catch {
      if (attempt === 3) {
        break;
      }
      await page.waitForTimeout(1_000 * attempt);
    }
  }

  return lastStatus;
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
  const finalPath = resolveCurrentPath(page);
  if (finalPath !== path) {
    throw new Error(`Authenticated navigation drifted to ${finalPath} instead of ${path}`);
  }
  return { context, page };
}

async function assertAuthenticatedSessionProof(args: {
  page: Page;
  expectedUserId: string;
}) {
  const result = await fetchOnPage(args.page, AUTH_PROBE_PATH);
  expect(result.status).toBe(200);
  const payload = parseJson<{ authenticated: boolean; userId: string | null }>(result);
  expect(payload.authenticated).toBe(true);
  expect(payload.userId).toBe(args.expectedUserId);
}

async function fetchOnPage(
  page: Page,
  path: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<PageFetchResult> {
  return page.evaluate(
    async ({ pathArg, method, headers, body }) => {
      const response = await fetch(pathArg, {
        method,
        headers,
        body,
        cache: "no-store",
      });
      return {
        status: response.status,
        headers: Object.fromEntries(Array.from(response.headers.entries())),
        body: await response.text(),
        url: response.url,
      };
    },
    {
      pathArg: path,
      method: options?.method ?? "GET",
      headers: options?.headers ?? {},
      body: options?.body ?? undefined,
    },
  );
}

function parseJson<T>(result: PageFetchResult): T {
  return JSON.parse(result.body) as T;
}

function titleButtons(page: Page, title: string) {
  return page.getByRole("button", { name: title, exact: true });
}

function candidateCards(page: Page, auditFixture: BrowserAuditFixture) {
  return page
    .locator("li", {
      has: page.getByText(auditFixture.title, { exact: true }),
    })
    .filter({ has: page.getByText(CONTRADICTION_RT_PROP_A, { exact: true }) })
    .filter({ has: page.getByText(CONTRADICTION_RT_PROP_B, { exact: true }) })
    .filter({ has: page.getByText(CONTRADICTION_RT_QUOTE_A, { exact: true }) })
    .filter({ has: page.getByText(CONTRADICTION_RT_QUOTE_B, { exact: true }) });
}

function contradictionSelectedPath(nodeId: string): string {
  return `/your-map?selected=${encodeURIComponent(`contradiction-${nodeId}`)}`;
}

function assertNoLeak(
  body: string,
  forbidden: Array<string | null | undefined>,
): void {
  for (const value of forbidden) {
    if (value) {
      expect(body).not.toContain(value);
    }
  }
}

function fixtureLeakValues(auditFixture: BrowserAuditFixture): string[] {
  return [
    auditFixture.title,
    auditFixture.candidateNodeId,
    auditFixture.sideASpanId,
    auditFixture.sideBSpanId,
    auditFixture.ids.messageAId,
    auditFixture.ids.messageBId,
    CONTRADICTION_RT_PROP_A,
    CONTRADICTION_RT_PROP_B,
    CONTRADICTION_RT_QUOTE_A,
    CONTRADICTION_RT_QUOTE_B,
  ];
}

function quoteOffsets(content: string, quote: string): { charStart: number; charEnd: number } {
  const charStart = content.indexOf(quote);
  if (charStart < 0) {
    throw new Error(`Could not find quote "${quote}" in fixture content.`);
  }
  return {
    charStart,
    charEnd: charStart + quote.length,
  };
}

async function seedBrowserAuditFixture(
  db: PrismaClient,
  ids: ContradictionRtFixtureIds,
): Promise<BrowserAuditFixture> {
  const suffix = ids.prefix.slice(-8);
  const title = `Alcohol contradiction audit ${suffix}`;
  const sameTitleSummary =
    `Same-title disputed map conclusion for browser identity audit ${suffix}.`;
  const sideAOffsets = quoteOffsets(CONTRADICTION_RT_CONTENT_A, CONTRADICTION_RT_QUOTE_A);
  const sideBOffsets = quoteOffsets(CONTRADICTION_RT_CONTENT_B, CONTRADICTION_RT_QUOTE_B);

  await seedContradictionRtAuthoritativeFixture(db, ids, {
    includeSideBMessage: true,
  });

  const sideASpan = await db.evidenceSpan.create({
    data: {
      userId: ids.userId,
      messageId: ids.messageAId,
      charStart: sideAOffsets.charStart,
      charEnd: sideAOffsets.charEnd,
      contentHash: shaExactQuote(CONTRADICTION_RT_QUOTE_A),
    },
  });

  const sideBSpan = await db.evidenceSpan.create({
    data: {
      userId: ids.userId,
      messageId: ids.messageBId,
      charStart: sideBOffsets.charStart,
      charEnd: sideBOffsets.charEnd,
      contentHash: shaExactQuote(CONTRADICTION_RT_QUOTE_B),
    },
  });

  const node = await db.contradictionNode.create({
    data: {
      userId: ids.userId,
      title,
      sideA: CONTRADICTION_RT_PROP_A,
      sideB: CONTRADICTION_RT_PROP_B,
      type: "narrative_conflict",
      confidence: "low",
      status: "candidate",
      evidenceCount: 0,
      sourceSessionId: ids.sessionId,
      sourceMessageId: ids.messageBId,
      sideASourceSpanId: sideASpan.id,
      sideBSourceSpanId: sideBSpan.id,
    },
  });

  const sameTitleConclusion = await db.userMapConclusion.create({
    data: {
      userId: ids.userId,
      area: "operating_logic",
      status: "disputed",
      visibility: "user_visible",
      title,
      summary: sameTitleSummary,
      confidenceScore: 0.42,
      confidenceLevel: "low",
      evidenceCount: 1,
      sourceDiversity: 1,
      timeSpreadDays: 0,
      firstEvidenceAt: new Date(),
      lastEvidenceAt: new Date(),
    },
  });

  return {
    ids,
    title,
    sameTitleConclusionId: sameTitleConclusion.id,
    sameTitleSummary,
    candidateNodeId: node.id,
    sideASpanId: sideASpan.id,
    sideBSpanId: sideBSpan.id,
    confidence: "low",
    evidenceCount: 0,
  };
}

async function cleanupBrowserAuditFixture(
  db: PrismaClient,
  userId: string,
): Promise<void> {
  assertDestructiveTargetIsIsolatedTestDb({
    databaseName: "companion_contradiction_rt_test",
    operation: `cleanupBrowserAuditFixture(${userId})`,
  });

  await db.understandingEvidenceLink.deleteMany({ where: { userId } });
  await db.userMapConclusion.deleteMany({ where: { userId } });
  await cleanupContradictionRtFixtureUser(db, userId);
}

async function expectMapTitleCount(
  page: Page,
  title: string,
  expectedCount: number,
) {
  await expect
    .poll(
      async () => titleButtons(page, title).count(),
      { timeout: 60_000 },
    )
    .toBe(expectedCount);
}

async function expectContradictionInspectorDom(
  page: Page,
  auditFixture: BrowserAuditFixture,
) {
  const inspectorButton = page.getByRole("button", {
    name: "Full receipts & movement in inspector",
    exact: true,
  });
  if (await inspectorButton.isVisible().catch(() => false)) {
    await inspectorButton.click();
  }

  await expect(page.getByText("Active signal", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(/open · 0 evidence/i)).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page
      .getByText(`A: ${CONTRADICTION_RT_PROP_A} · B: ${CONTRADICTION_RT_PROP_B}`, {
        exact: true,
      })
      .first(),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Side A interpretation", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("Side B interpretation", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(CONTRADICTION_RT_QUOTE_A, { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(CONTRADICTION_RT_QUOTE_B, { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByText(`Side A: ${CONTRADICTION_RT_PROP_A}`).first(),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByText(`Side B: ${CONTRADICTION_RT_PROP_B}`).first(),
  ).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByText(
      "Raw message evidence stays on the signal detail surface. Use the full page for deeper review.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 60_000 });

  expect(auditFixture.evidenceCount).toBe(0);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  let setupStage: SetupStage = "env_file_load";

  try {
    setupStage = "env_file_load";
    env = readEnvFile();
    setupStage = "clerk_env_validation";
    assertRealClerkEnv(env);

    setupStage = "db_url_validation";
    const safeUrl = assertContradictionRealDbTestUrl(
      process.env[CONTRADICTION_REAL_DB_TEST_URL_ENV],
      process.env.DATABASE_URL &&
        process.env.DATABASE_URL !== process.env[CONTRADICTION_REAL_DB_TEST_URL_ENV]
        ? process.env.DATABASE_URL
        : undefined,
    );

    if (process.env.DATABASE_URL !== safeUrl) {
      throw new Error("DATABASE_URL must exactly equal the isolated contradiction test URL.");
    }

    setupStage = "prisma_client_create";
    prisma = new PrismaClient({
      datasources: { db: { url: safeUrl } },
    });

    setupStage = "clerk_client_create";
    clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });

    setupStage = "primary_clerk_user_create";
    primaryAuth = await createAuthState("contradiction-final-audit-primary");
    setupStage = "foreign_clerk_user_create";
    foreignAuth = await createAuthState("contradiction-final-audit-foreign");

    const baseIds = makeContradictionRtFixtureIds("browser-audit");
    const ids: ContradictionRtFixtureIds = {
      ...baseIds,
      userId: primaryAuth.userId,
    };

    setupStage = "fixture_seed";
    fixture = await seedBrowserAuditFixture(prisma, ids);

    setupStage = "fixture_counts";
    const counts = await contradictionRtFixtureCounts(prisma, ids.userId);
    expect(counts.contradictionNodes).toBe(1);
    expect(counts.evidenceSpans).toBe(2);
    expect(counts.referenceItems).toBe(1);
    expect(counts.messages).toBe(2);
    expect(counts.sessions).toBe(1);
    expect(counts.contradictionEvidence).toBe(0);
    expect(counts.modelUpdates).toBe(0);
  } catch {
    throw classifySetupFailure(setupStage);
  }
});

test.afterAll(async () => {
  const cleanupFailures: string[] = [];
  const cleanupUserId = resolveBrowserAuditCleanupUserId({
    fixture,
    primaryAuth,
  });

  if (prisma && cleanupUserId) {
    try {
      await cleanupBrowserAuditFixture(prisma, cleanupUserId);
    } catch {
      cleanupFailures.push("fixture_cleanup_failed");
    }
  }

  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch {
      cleanupFailures.push("prisma_disconnect_failed");
    }
  }

  if (primaryAuth) {
    try {
      await safeDeleteClerkUser(primaryAuth.userId);
    } catch {
      cleanupFailures.push("primary_clerk_cleanup_failed");
    }
  }
  if (foreignAuth) {
    try {
      await safeDeleteClerkUser(foreignAuth.userId);
    } catch {
      cleanupFailures.push("foreign_clerk_cleanup_failed");
    }
  }

  if (cleanupFailures.length > 0) {
    throw new Error(`FAIL_PRODUCTION_AUDIT:${cleanupFailures.join(",")}`);
  }
});

test("candidate -> map exclusion -> browser confirm -> map -> inspector -> refresh -> foreign isolation", async ({
  browser,
}) => {
  if (!primaryAuth || !foreignAuth || !fixture) {
    throw new Error("Audit runtime was not initialised.");
  }

  const { context: primaryContext, page: primaryPage } = await openAuthenticatedPage(
    browser,
    primaryAuth,
    ORIGIN,
    "/contradictions/candidates",
  );

  try {
    await test.step("phase 1: candidate review proves exact browser card + authenticated API identity", async () => {
      await assertAuthenticatedSessionProof({
        page: primaryPage,
        expectedUserId: primaryAuth!.userId,
      });
      await expect(
        primaryPage.getByText("Candidate Tensions", { exact: true }),
      ).toBeVisible({ timeout: 60_000 });

      await expect
        .poll(async () => candidateCards(primaryPage, fixture!).count(), { timeout: 60_000 })
        .toBe(1);

      const candidateCard = candidateCards(primaryPage, fixture!).first();
      await expect(candidateCard).toContainText(fixture.title);
      await expect(candidateCard).toContainText(CONTRADICTION_RT_PROP_A);
      await expect(candidateCard).toContainText(CONTRADICTION_RT_PROP_B);
      await expect(candidateCard).toContainText(CONTRADICTION_RT_QUOTE_A);
      await expect(candidateCard).toContainText(CONTRADICTION_RT_QUOTE_B);
      await expect(
        candidateCard.getByRole("button", { name: "Confirm", exact: true }),
      ).toBeVisible();
      await expect(primaryPage.locator('a[href="/contradictions"]')).toHaveCount(0);
      await expect(primaryPage.locator('a[href^="/contradictions/"]')).toHaveCount(0);

      const backToMapLink = primaryPage.getByRole("link", {
        name: "Back to Map",
        exact: true,
      });
      await expect(backToMapLink).toHaveAttribute("href", "/your-map");
      await backToMapLink.click();
      await expect
        .poll(() => resolveCurrentPath(primaryPage), { timeout: 60_000 })
        .toBe("/your-map");
      await expect(primaryPage.getByRole("heading", { name: /^Map$/i })).toBeVisible({
        timeout: 60_000,
      });

      await gotoPath(
        primaryPage,
        primaryContext,
        primaryAuth!,
        "/contradictions/candidates",
        ORIGIN,
      );
      await expect
        .poll(async () => candidateCards(primaryPage, fixture!).count(), {
          timeout: 60_000,
        })
        .toBe(1);

      const candidateResult = await fetchOnPage(primaryPage, CANDIDATE_API_PATH);
      expect(candidateResult.status).toBe(200);
      const candidatePayload = parseJson<ContradictionListPayload>(candidateResult);
      const exactCandidate = candidatePayload.items.filter(
        (item) => item.id === fixture!.candidateNodeId,
      );
      expect(exactCandidate).toHaveLength(1);
      expect(
        candidatePayload.items.filter((item) => item.title === fixture!.title).map((item) => item.id),
      ).toEqual([fixture!.candidateNodeId]);
      expect(exactCandidate[0]!.status).toBe("candidate");
      expect(exactCandidate[0]!.sideA).toBe(CONTRADICTION_RT_PROP_A);
      expect(exactCandidate[0]!.sideB).toBe(CONTRADICTION_RT_PROP_B);
      expect(exactCandidate[0]!.sideASourceSpanId).toBe(fixture!.sideASpanId);
      expect(exactCandidate[0]!.sideBSourceSpanId).toBe(fixture!.sideBSpanId);
      expect(exactCandidate[0]!.dualSource?.lineageState).toBe("complete_verified");
      expect(exactCandidate[0]!.dualSource?.sideA.availability).toBe("available");
      expect(exactCandidate[0]!.dualSource?.sideB.availability).toBe("available");
      expect(exactCandidate[0]!.dualSource?.sideA.exactQuote).toBe(CONTRADICTION_RT_QUOTE_A);
      expect(exactCandidate[0]!.dualSource?.sideB.exactQuote).toBe(CONTRADICTION_RT_QUOTE_B);
    });

    await test.step("phase 2: pre-confirm map excludes candidate while leaving same-title disputed conclusion separately selectable", async () => {
      await gotoPath(
        primaryPage,
        primaryContext,
        primaryAuth!,
        contradictionSelectedPath(fixture!.candidateNodeId),
        ORIGIN,
      );
      await expect(primaryPage.getByRole("heading", { name: /^Map$/i })).toBeVisible({
        timeout: 60_000,
      });
      await expectMapTitleCount(primaryPage, fixture!.title, 1);
      await expect(
        primaryPage.getByText("Nothing selected", { exact: true }).first(),
      ).toBeVisible({ timeout: 60_000 });
      await titleButtons(primaryPage, fixture!.title).first().click();
      await expect(
        primaryPage.getByText(fixture!.sameTitleSummary, { exact: true }).first(),
      ).toBeVisible({ timeout: 60_000 });
      await expect(
        primaryPage.getByText(
          "Raw message evidence stays on the signal detail surface. Use the full page for deeper review.",
          { exact: true },
        ),
      ).toHaveCount(0);
      await expect(primaryPage.getByText(CONTRADICTION_RT_QUOTE_A, { exact: true })).toHaveCount(0);
      await expect(primaryPage.getByText(CONTRADICTION_RT_QUOTE_B, { exact: true })).toHaveCount(0);

      const openResult = await fetchOnPage(primaryPage, OPEN_API_PATH);
      expect(openResult.status).toBe(200);
      const openPayload = parseJson<ContradictionListPayload>(openResult);
      expect(openPayload.items.find((item) => item.id === fixture!.candidateNodeId)).toBeUndefined();

      const userMapListResult = await fetchOnPage(primaryPage, USER_MAP_LIST_PATH);
      expect(userMapListResult.status).toBe(200);
      const userMapListPayload = parseJson<UserMapListPayload>(userMapListResult);
      const sameTitleItem = userMapListPayload.items.find(
        (item) => item.id === fixture!.sameTitleConclusionId,
      );
      expect(sameTitleItem?.title).toBe(fixture!.title);
      expect(sameTitleItem?.status).toBe("disputed");

      const sameTitleDetailResult = await fetchOnPage(
        primaryPage,
        `/api/user-map/conclusions/${encodeURIComponent(fixture!.sameTitleConclusionId)}`,
      );
      expect(sameTitleDetailResult.status).toBe(200);
      const sameTitleDetailPayload = parseJson<UserMapDetailPayload>(sameTitleDetailResult);
      expect(sameTitleDetailPayload.item.id).toBe(fixture!.sameTitleConclusionId);
      expect(sameTitleDetailPayload.item.summary).toBe(fixture!.sameTitleSummary);
    });

    await test.step("phase 3: real browser confirmation PATCH opens the node without duplicates", async () => {
      await gotoPath(
        primaryPage,
        primaryContext,
        primaryAuth!,
        "/contradictions/candidates",
        ORIGIN,
      );
      await expect
        .poll(async () => candidateCards(primaryPage, fixture!).count(), { timeout: 60_000 })
        .toBe(1);

      const confirmResponsePromise = primaryPage.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/contradiction/${fixture!.candidateNodeId}`) &&
          response.request().method() === "PATCH",
        { timeout: 60_000 },
      );

      await candidateCards(primaryPage, fixture!)
        .first()
        .getByRole("button", { name: "Confirm", exact: true })
        .click();

      const confirmResponse = await confirmResponsePromise;
      expect(confirmResponse.status()).toBe(200);
      const confirmPayload = (await confirmResponse.json()) as CandidateApiItem;
      expect(confirmPayload.id).toBe(fixture!.candidateNodeId);
      expect(confirmPayload.status).toBe("open");
      expect(confirmPayload.sideASourceSpanId).toBe(fixture!.sideASpanId);
      expect(confirmPayload.sideBSourceSpanId).toBe(fixture!.sideBSpanId);

      await expect
        .poll(async () => candidateCards(primaryPage, fixture!).count(), { timeout: 60_000 })
        .toBe(0);
      await expect(
        primaryPage.getByText("No candidate tensions.", { exact: true }),
      ).toBeVisible({ timeout: 60_000 });

      const candidateAfterResult = await fetchOnPage(primaryPage, CANDIDATE_API_PATH);
      expect(candidateAfterResult.status).toBe(200);
      const candidateAfterPayload = parseJson<ContradictionListPayload>(candidateAfterResult);
      expect(
        candidateAfterPayload.items.find((item) => item.id === fixture!.candidateNodeId),
      ).toBeUndefined();

      const secondConfirmResult = await fetchOnPage(
        primaryPage,
        `/api/contradiction/${encodeURIComponent(fixture!.candidateNodeId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm_candidate" }),
        },
      );
      expect(secondConfirmResult.status).toBe(409);
      const secondConfirmPayload = parseJson<PatchConflictPayload>(secondConfirmResult);
      expect(secondConfirmPayload.error.code).toBe(
        "CONFIRM_CANDIDATE_REQUIRES_CANDIDATE_STATUS",
      );

      const dbCounts = await contradictionRtFixtureCounts(prisma, fixture!.ids.userId);
      expect(dbCounts.contradictionNodes).toBe(1);
      expect(dbCounts.evidenceSpans).toBe(2);
      expect(dbCounts.contradictionEvidence).toBe(0);
      expect(dbCounts.modelUpdates).toBe(0);
    });

    await test.step("phase 4: post-confirm map shows same-title seed plus exact live contradiction rail", async () => {
      await gotoPath(primaryPage, primaryContext, primaryAuth!, "/your-map", ORIGIN);
      await expect(primaryPage.getByRole("heading", { name: /^Map$/i })).toBeVisible({
        timeout: 60_000,
      });
      await expectMapTitleCount(primaryPage, fixture!.title, 2);

      await titleButtons(primaryPage, fixture!.title).nth(1).click();
      await expectContradictionInspectorDom(primaryPage, fixture!);

      await gotoPath(
        primaryPage,
        primaryContext,
        primaryAuth!,
        contradictionSelectedPath(fixture!.candidateNodeId),
        ORIGIN,
      );
      await expect(primaryPage).toHaveURL(
        new RegExp(`selected=contradiction-${fixture!.candidateNodeId}`),
        { timeout: 60_000 },
      );
      await expectMapTitleCount(primaryPage, fixture!.title, 2);
      await titleButtons(primaryPage, fixture!.title).nth(1).click();
      await expectContradictionInspectorDom(primaryPage, fixture!);

      const openResult = await fetchOnPage(primaryPage, OPEN_API_PATH);
      expect(openResult.status).toBe(200);
      const openPayload = parseJson<ContradictionListPayload>(openResult);
      const exactOpen = openPayload.items.filter((item) => item.id === fixture!.candidateNodeId);
      expect(exactOpen).toHaveLength(1);
      expect(exactOpen[0]!.title).toBe(fixture!.title);
      expect(exactOpen[0]!.status).toBe("open");
      expect(exactOpen[0]!.sideA).toBe(CONTRADICTION_RT_PROP_A);
      expect(exactOpen[0]!.sideB).toBe(CONTRADICTION_RT_PROP_B);
      expect(exactOpen[0]!.sideASourceSpanId).toBe(fixture!.sideASpanId);
      expect(exactOpen[0]!.sideBSourceSpanId).toBe(fixture!.sideBSpanId);

      const userMapListResult = await fetchOnPage(primaryPage, USER_MAP_LIST_PATH);
      expect(userMapListResult.status).toBe(200);
      const userMapListPayload = parseJson<UserMapListPayload>(userMapListResult);
      expect(
        userMapListPayload.items.find((item) => item.id === fixture!.sameTitleConclusionId),
      ).toBeTruthy();
    });

    await test.step("phase 5: inspector DOM + authenticated detail routes prove ordered exact lineage", async () => {
      const detailResult = await fetchOnPage(
        primaryPage,
        `/api/contradiction/${encodeURIComponent(fixture!.candidateNodeId)}`,
      );
      expect(detailResult.status).toBe(200);
      const detailPayload = parseJson<ContradictionDetailPayload>(detailResult);
      expect(detailPayload.id).toBe(fixture!.candidateNodeId);
      expect(detailPayload.status).toBe("open");
      expect(detailPayload.sideA).toBe(CONTRADICTION_RT_PROP_A);
      expect(detailPayload.sideB).toBe(CONTRADICTION_RT_PROP_B);
      expect(detailPayload.evidenceCount).toBe(0);
      expect(detailPayload.dualSource.lineageState).toBe("complete_verified");
      expect(detailPayload.dualSource.sideA.availability).toBe("available");
      expect(detailPayload.dualSource.sideB.availability).toBe("available");
      expect(detailPayload.dualSource.sideA.side).toBe("A");
      expect(detailPayload.dualSource.sideB.side).toBe("B");
      expect(detailPayload.dualSource.sideA.spanId).toBe(fixture!.sideASpanId);
      expect(detailPayload.dualSource.sideB.spanId).toBe(fixture!.sideBSpanId);
      expect(detailPayload.dualSource.sideA.messageId).toBe(fixture!.ids.messageAId);
      expect(detailPayload.dualSource.sideB.messageId).toBe(fixture!.ids.messageBId);
      expect(detailPayload.dualSource.sideA.exactQuote).toBe(CONTRADICTION_RT_QUOTE_A);
      expect(detailPayload.dualSource.sideB.exactQuote).toBe(CONTRADICTION_RT_QUOTE_B);

      const inspectorResult = await fetchOnPage(
        primaryPage,
        `/api/inspector/contradictions/${encodeURIComponent(fixture!.candidateNodeId)}`,
      );
      expect(inspectorResult.status).toBe(200);
      const inspectorPayload = parseJson<InspectorPayload>(inspectorResult);
      expect(inspectorPayload.item.id).toBe(fixture!.candidateNodeId);
      expect(inspectorPayload.item.status).toBe("open");
      expect(inspectorPayload.item.evidenceCount).toBe(0);
      expect(inspectorPayload.item.dualSource.lineageState).toBe("complete_verified");
      expect(inspectorPayload.item.dualSource.sideA.spanId).toBe(fixture!.sideASpanId);
      expect(inspectorPayload.item.dualSource.sideB.spanId).toBe(fixture!.sideBSpanId);
      expect(inspectorPayload.item.dualSource.sideA.exactQuote).toBe(CONTRADICTION_RT_QUOTE_A);
      expect(inspectorPayload.item.dualSource.sideB.exactQuote).toBe(CONTRADICTION_RT_QUOTE_B);
    });

    await test.step("phase 6: fresh browser context preserves exact node + span identity with no duplicates", async () => {
      const { context: freshContext, page: freshPage } = await openAuthenticatedPage(
        browser,
        primaryAuth!,
        ORIGIN,
        contradictionSelectedPath(fixture!.candidateNodeId),
      );

      try {
        await assertAuthenticatedSessionProof({
          page: freshPage,
          expectedUserId: primaryAuth!.userId,
        });
        await expectMapTitleCount(freshPage, fixture!.title, 2);
        await titleButtons(freshPage, fixture!.title).nth(1).click();
        await expectContradictionInspectorDom(freshPage, fixture!);

        const openResult = await fetchOnPage(freshPage, OPEN_API_PATH);
        expect(openResult.status).toBe(200);
        const openPayload = parseJson<ContradictionListPayload>(openResult);
        expect(openPayload.items.filter((item) => item.id === fixture!.candidateNodeId)).toHaveLength(1);

        const detailResult = await fetchOnPage(
          freshPage,
          `/api/contradiction/${encodeURIComponent(fixture!.candidateNodeId)}`,
        );
        expect(detailResult.status).toBe(200);
        const detailPayload = parseJson<ContradictionDetailPayload>(detailResult);
        expect(detailPayload.dualSource.sideA.spanId).toBe(fixture!.sideASpanId);
        expect(detailPayload.dualSource.sideB.spanId).toBe(fixture!.sideBSpanId);
        expect(detailPayload.dualSource.sideA.exactQuote).toBe(CONTRADICTION_RT_QUOTE_A);
        expect(detailPayload.dualSource.sideB.exactQuote).toBe(CONTRADICTION_RT_QUOTE_B);

        const inspectorResult = await fetchOnPage(
          freshPage,
          `/api/inspector/contradictions/${encodeURIComponent(fixture!.candidateNodeId)}`,
        );
        expect(inspectorResult.status).toBe(200);
        const inspectorPayload = parseJson<InspectorPayload>(inspectorResult);
        expect(inspectorPayload.item.id).toBe(fixture!.candidateNodeId);
        expect(inspectorPayload.item.dualSource.sideA.spanId).toBe(fixture!.sideASpanId);
        expect(inspectorPayload.item.dualSource.sideB.spanId).toBe(fixture!.sideBSpanId);

        const dbCounts = await contradictionRtFixtureCounts(prisma, fixture!.ids.userId);
        expect(dbCounts.contradictionNodes).toBe(1);
        expect(dbCounts.evidenceSpans).toBe(2);
        expect(dbCounts.contradictionEvidence).toBe(0);
        expect(dbCounts.modelUpdates).toBe(0);
      } finally {
        await freshContext.close();
      }
    });

    await test.step("phase 7: foreign authenticated browser sees no leak and cannot mutate", async () => {
      const { context: foreignContext, page: foreignPage } = await openAuthenticatedPage(
        browser,
        foreignAuth!,
        ORIGIN,
        "/contradictions/candidates",
      );

      try {
        await assertAuthenticatedSessionProof({
          page: foreignPage,
          expectedUserId: foreignAuth!.userId,
        });

        await expect(
          foreignPage.getByText("Candidate Tensions", { exact: true }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(candidateCards(foreignPage, fixture!)).toHaveCount(0);
        await expect(
          foreignPage.getByText("No candidate tensions.", { exact: true }),
        ).toBeVisible({ timeout: 60_000 });

        const foreignCandidateResult = await fetchOnPage(foreignPage, CANDIDATE_API_PATH);
        expect(foreignCandidateResult.status).toBe(200);
        assertNoLeak(foreignCandidateResult.body, fixtureLeakValues(fixture!));
        const foreignCandidatePayload = parseJson<ContradictionListPayload>(foreignCandidateResult);
        expect(
          foreignCandidatePayload.items.find((item) => item.id === fixture!.candidateNodeId),
        ).toBeUndefined();

        await gotoPath(
          foreignPage,
          foreignContext,
          foreignAuth!,
          contradictionSelectedPath(fixture!.candidateNodeId),
          ORIGIN,
        );
        await expect(
          foreignPage.getByRole("heading", { name: /^Map$/i }),
        ).toBeVisible({ timeout: 60_000 });
        await expect(titleButtons(foreignPage, fixture!.title)).toHaveCount(0);
        await expect(
          foreignPage.getByText("Nothing on your map yet.", { exact: true }),
        ).toBeVisible({ timeout: 60_000 });

        const foreignOpenResult = await fetchOnPage(foreignPage, OPEN_API_PATH);
        expect(foreignOpenResult.status).toBe(200);
        assertNoLeak(foreignOpenResult.body, fixtureLeakValues(fixture!));
        const foreignOpenPayload = parseJson<ContradictionListPayload>(foreignOpenResult);
        expect(
          foreignOpenPayload.items.find((item) => item.id === fixture!.candidateNodeId),
        ).toBeUndefined();

        const foreignDetailResult = await fetchOnPage(
          foreignPage,
          `/api/contradiction/${encodeURIComponent(fixture!.candidateNodeId)}`,
        );
        expect(foreignDetailResult.status).toBe(404);
        assertNoLeak(foreignDetailResult.body, fixtureLeakValues(fixture!));

        const foreignInspectorResult = await fetchOnPage(
          foreignPage,
          `/api/inspector/contradictions/${encodeURIComponent(fixture!.candidateNodeId)}`,
        );
        expect(foreignInspectorResult.status).toBe(404);
        assertNoLeak(foreignInspectorResult.body, fixtureLeakValues(fixture!));

        const foreignConfirmResult = await fetchOnPage(
          foreignPage,
          `/api/contradiction/${encodeURIComponent(fixture!.candidateNodeId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "confirm_candidate" }),
          },
        );
        expect(foreignConfirmResult.status).toBe(404);
        assertNoLeak(foreignConfirmResult.body, fixtureLeakValues(fixture!));

        const foreignDeleteResult = await fetchOnPage(
          foreignPage,
          `/api/contradiction/${encodeURIComponent(fixture!.candidateNodeId)}`,
          {
            method: "DELETE",
          },
        );
        expect(foreignDeleteResult.status).toBe(404);
        assertNoLeak(foreignDeleteResult.body, fixtureLeakValues(fixture!));
      } finally {
        await foreignContext.close();
      }
    });
  } finally {
    await primaryContext.close();
  }
});
