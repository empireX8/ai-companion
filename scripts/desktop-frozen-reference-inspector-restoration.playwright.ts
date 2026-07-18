import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  FIXTURE_MOVEMENT_SUMMARY,
  FIXTURE_SOURCE_TEXT,
} from "../lib/live-evidence-depth-runtime-fixture";
import {
  FIXTURE_CLAIM_SUMMARY,
  cleanupMovementAssaultRuntimeFixture,
  publishMovementAssaultClaimFixture,
  seedMovementAssaultRuntimeFixture,
  type MovementAssaultFixtureSeedResult,
} from "../lib/model-movement-runtime-fixture";

const CAMPAIGN = "DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001";
const BASELINE_COMMIT = "1f8cb7cede1844d079a2dd0ab0ac434a132e761e";
const ROOT = resolve(process.cwd());
const RECEIPTS_DIR = resolve(ROOT, `docs/agent-runs/receipts/${CAMPAIGN}`);
const SCREENSHOTS_DIR = resolve(RECEIPTS_DIR, "screenshots");
const MANIFEST_PATH = resolve(RECEIPTS_DIR, "visual-comparison-manifest.json");
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3000";
const VIEWPORT = { width: 1440, height: 900 } as const;
const AUTH_PROBE_PATH = "/api/desktop-production-parity/auth-probe";

const REFERENCE_MAP_OBJECT_ID = "m-claim-1";
const REFERENCE_MAP_OBJECT_TITLE = "You often need visual expression before locking architecture.";
const REFERENCE_MOVEMENT_OBJECT_ID = "mu-1";
const REFERENCE_MOVEMENT_OBJECT_TITLE = "Decision pressure is now linked to scope reopening.";
const REFERENCE_REPORT_ID = "rep-weekly";

type EnvMap = Record<string, string>;

type AuthState = {
  userId: string;
  email: string;
  password: string;
  sessionId: string;
  sessionToken: string;
  clientUat: string;
};

type CaptureRecord = {
  state: string;
  label: string;
  surface: "reference" | "production";
  route: string;
  screenshotPath: string;
  selectedObjectId: string | null;
  reportId: string | null;
  selectors: string[];
  scrollTop: number | null;
  viewport: typeof VIEWPORT;
  notes: string[];
};

type VisualComparisonManifest = {
  campaign: string;
  date: string;
  baselineCommit: string;
  visualAuthorityComplete: false;
  storedVisualReferencePaths: string[];
  viewport: typeof VIEWPORT;
  imageDiff: {
    available: false;
    reason: string;
  };
  captures: CaptureRecord[];
  fixtureCleanup: Record<string, unknown> | null;
};

const manifest: VisualComparisonManifest = {
  campaign: CAMPAIGN,
  date: "2026-07-17",
  baselineCommit: BASELINE_COMMIT,
  visualAuthorityComplete: false,
  storedVisualReferencePaths: [],
  viewport: VIEWPORT,
  imageDiff: {
    available: false,
    reason: "No pixel-diff tool is available in this local environment.",
  },
  captures: [],
  fixtureCleanup: null,
};

let clerk: ReturnType<typeof createClerkClient>;
let prisma: PrismaClient;
let devBrowserToken = "";
let primaryAuth: AuthState | null = null;
let emptyAuth: AuthState | null = null;
let seededMovement: MovementAssaultFixtureSeedResult | null = null;

function persistManifest() {
  mkdirSync(RECEIPTS_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

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

async function createAuthState(prefix: string): Promise<AuthState> {
  const email = uniqueEmail(prefix);
  const password = `Tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-Aa1!`;
  const user = await clerk.users.createUser({
    emailAddress: [email],
    password,
    skipPasswordChecks: true,
    skipPasswordRequirement: true,
  });
  const session = await clerk.sessions.createSession({ userId: user.id });
  const token = await clerk.sessions.getToken(session.id);
  const payload = decodeJwtPayload(token.jwt);
  const iat = typeof payload.iat === "number" ? String(payload.iat) : "1";

  return {
    userId: user.id,
    email,
    password,
    sessionId: session.id,
    sessionToken: token.jwt,
    clientUat: iat,
  };
}

async function createAuthedContext(browser: Browser, auth: AuthState) {
  devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;
  const context = await browser.newContext({
    baseURL: ORIGIN,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });

  await context.addCookies([
    { name: "__session", value: auth.sessionToken, url: ORIGIN, httpOnly: true, sameSite: "Lax" },
    { name: "__clerk_db_jwt", value: devBrowserToken, url: ORIGIN, sameSite: "Lax" },
    { name: "__client_uat", value: auth.clientUat, url: ORIGIN, sameSite: "Lax" },
  ]);

  return context;
}

async function seedTestingBrowserCookie(context: BrowserContext) {
  await context.addCookies([{ name: "__clerk_db_jwt", value: devBrowserToken, url: ORIGIN }]);
}

async function maybeSignIn(page: Page, auth: AuthState, path: string) {
  const signInHeading = page.getByRole("heading", { name: /sign in/i }).first();
  const onSignInRoute = (() => {
    try {
      return new URL(page.url()).pathname.startsWith("/sign-in");
    } catch {
      return false;
    }
  })();
  const signInVisible = await signInHeading
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!onSignInRoute && !signInVisible) {
    return;
  }

  const identifierField = page
    .locator(
      '#identifier-field, input[name="identifier"], input[autocomplete="username"], input[type="email"]'
    )
    .first();
  const passwordField = page
    .locator(
      '#password-field, input[name="password"], input[autocomplete="current-password"], input[type="password"]'
    )
    .first();

  await expect(identifierField).toBeVisible({ timeout: 90_000 });
  await expect(passwordField).toBeVisible({ timeout: 90_000 });
  await identifierField.fill(auth.email);
  await passwordField.fill(auth.password);
  await page.getByRole("button", { name: /^Continue$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 90_000 });
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

async function probeBrowserAuthOnCurrentPage(page: Page, expectedUserId: string): Promise<boolean> {
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

async function waitForBrowserAuthOnCurrentPage(page: Page, expectedUserId: string) {
  await expect
    .poll(() => probeBrowserAuthOnCurrentPage(page, expectedUserId), { timeout: 90_000 })
    .toBe(true);
}

async function stabilizeAuthenticatedSession(
  page: Page,
  context: BrowserContext,
  auth: AuthState,
) {
  devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;
  await seedTestingBrowserCookie(context);
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  if (await probeBrowserAuthOnCurrentPage(page, auth.userId)) {
    return;
  }

  const clerkDevBrowserError = page.getByText(
    "Unable to authenticate this browser for your development instance.",
  );
  if (await clerkDevBrowserError.isVisible().catch(() => false)) {
    devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;
    await seedTestingBrowserCookie(context);
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    if (await probeBrowserAuthOnCurrentPage(page, auth.userId)) {
      return;
    }
  }

  await maybeSignIn(page, auth, "/");
  await waitForBrowserAuthOnCurrentPage(page, auth.userId);
}

async function gotoAuthed(
  page: Page,
  context: BrowserContext,
  auth: AuthState,
  path: string,
) {
  // Always stabilize the Clerk browser session first. Cookie injection alone is
  // intermittently insufficient against the local Turbopack/dev Clerk protect rewrite.
  await stabilizeAuthenticatedSession(page, context, auth);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  if (!(await probeBrowserAuthOnCurrentPage(page, auth.userId))) {
    await stabilizeAuthenticatedSession(page, context, auth);
    await page.goto(path, { waitUntil: "domcontentloaded" });
  }
  await waitForBrowserAuthOnCurrentPage(page, auth.userId);
}

function inspector(page: Page) {
  return page.locator("aside").filter({ hasText: "Inspector" }).first();
}

async function waitForTodayMovementHydration(page: Page, modelUpdateId: string) {
  await expect(page.getByTestId("nav-today")).toBeVisible({ timeout: 90_000 });
  await expect(
    page.locator(`[data-testid="today-full-report"][data-report-id="${modelUpdateId}"]`)
  ).toBeVisible({ timeout: 90_000 });
}

async function openMapInspectorSelection(
  page: Page,
  title: string,
  surface: "reference" | "production"
) {
  await page.getByTestId("nav-map").click();
  if (surface === "reference") {
    await expect(page.getByRole("heading", { name: /^Map$/i })).toBeVisible({ timeout: 60_000 });
  } else {
    await expect(page.getByTestId("orvek-v0-map-page")).toBeVisible({ timeout: 60_000 });
  }
  await expect(page.getByRole("button", { name: title }).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: title }).first().click();
  await expect(
    page.getByRole("button", { name: /^Full receipts & movement in inspector$/i }).first()
  ).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: /^Full receipts & movement in inspector$/i }).first().click();
  await expect(inspector(page)).toContainText(title);
}

async function openMovementTab(page: Page) {
  await inspector(page).getByRole("button", { name: "Model Movement" }).click();
  await expect(inspector(page)).toContainText("Recent model movement");
}

async function scrollInspector(page: Page, ratio: number) {
  const body = page.locator(".o-inspector-body").first();
  await expect(body).toBeVisible();
  const scrollTop = await body.evaluate((element, nextRatio) => {
    const target = element as HTMLElement;
    const maxScroll = Math.max(target.scrollHeight - target.clientHeight, 0);
    const nextTop = Math.round(maxScroll * Number(nextRatio));
    target.scrollTop = nextTop;
    return target.scrollTop;
  }, ratio);
  await page.waitForTimeout(150);
  return scrollTop;
}

async function captureState(args: {
  page: Page;
  state: string;
  label: string;
  surface: "reference" | "production";
  route: string;
  selectedObjectId: string | null;
  reportId?: string | null;
  selectors: string[];
  notes?: string[];
  scrollTop?: number | null;
}) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const filename = `${String(manifest.captures.length + 1).padStart(2, "0")}-${args.state}-${args.surface}.png`;
  const absolutePath = resolve(SCREENSHOTS_DIR, filename);
  await args.page.screenshot({
    path: absolutePath,
    fullPage: false,
    animations: "disabled",
  });

  manifest.captures.push({
    state: args.state,
    label: args.label,
    surface: args.surface,
    route: args.route,
    screenshotPath: absolutePath,
    selectedObjectId: args.selectedObjectId,
    reportId: args.reportId ?? null,
    selectors: args.selectors,
    scrollTop: args.scrollTop ?? null,
    viewport: VIEWPORT,
    notes: args.notes ?? [],
  });
  persistManifest();
}

async function cleanupAuthState(auth: AuthState | null) {
  if (!auth) {
    return;
  }

  try {
    await clerk.sessions.revokeSession(auth.sessionId);
  } catch {
    // Best-effort cleanup.
  }

  try {
    await clerk.users.deleteUser(auth.userId);
  } catch {
    // Best-effort cleanup.
  }
}

test.describe.serial("desktop frozen reference inspector restoration visual comparison", () => {
  test.beforeAll(async () => {
    mkdirSync(RECEIPTS_DIR, { recursive: true });
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    manifest.captures = [];
    persistManifest();

    const env = readEnvFile();
    clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });

    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
    process.env.NODE_ENV = process.env.NODE_ENV === "production" ? "test" : process.env.NODE_ENV;

    devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;
    primaryAuth = await createAuthState("desktop-frozen-reference-primary");
    emptyAuth = await createAuthState("desktop-frozen-reference-empty");

    prisma = new PrismaClient({
      datasources: { db: { url: LOCAL_DATABASE_URL } },
    });

    seededMovement = await seedMovementAssaultRuntimeFixture({
      userId: primaryAuth.userId,
      db: prisma,
      includeSparse: false,
    });
    await publishMovementAssaultClaimFixture({
      userId: primaryAuth.userId,
      db: prisma,
      modelUpdateId: seededMovement.claimModelUpdateId,
    });

    persistManifest();
  });

  test.afterAll(async () => {
    if (primaryAuth && seededMovement) {
      manifest.fixtureCleanup = await cleanupMovementAssaultRuntimeFixture({
        userId: primaryAuth.userId,
        db: prisma,
        modelUpdateIds: [seededMovement.claimModelUpdateId, seededMovement.conclusionModelUpdateId],
      });
    }

    persistManifest();

    await prisma?.$disconnect();
    await cleanupAuthState(primaryAuth);
    await cleanupAuthState(emptyAuth);
  });

  test("captures frozen reference inspector states", async ({ browser }) => {
    if (!primaryAuth) {
      throw new Error("Primary auth state was not initialized.");
    }

    const context = await createAuthedContext(browser, primaryAuth);
    const page = await context.newPage();

    try {
      await gotoAuthed(page, context, primaryAuth, "/dev/orvek-v0-reference");
      await expect(page.getByTestId("orvek-v0-reference-route")).toBeVisible({ timeout: 60_000 });

      await captureState({
        page,
        state: "today-hero-identity",
        label: "Today hero/list identity",
        surface: "reference",
        route: "/dev/orvek-v0-reference",
        selectedObjectId: null,
        selectors: ['[data-testid="orvek-v0-reference-route"]'],
        notes: [
          "Reference Today curated identity (no generic Link Detected · Related pattern).",
          "Presentation: frozen Today page (not ObjectDetail).",
        ],
      });

      await page.getByRole("button", { name: /See why it moved/i }).first().click();
      await expect(inspector(page)).toContainText(REFERENCE_MOVEMENT_OBJECT_TITLE);
      await inspector(page).getByRole("button", { name: "Evidence / Context" }).click();
      await expect(page.locator('[data-testid="model-update-evidence-top"]')).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator('[data-testid="model-update-evidence-top"]')).toContainText(
        REFERENCE_MOVEMENT_OBJECT_TITLE,
      );

      await captureState({
        page,
        state: "evidence-top",
        label: "01 Evidence / Context top",
        surface: "reference",
        route: "/dev/orvek-v0-reference",
        selectedObjectId: REFERENCE_MOVEMENT_OBJECT_ID,
        selectors: ['[data-testid="model-update-evidence-top"]'],
        notes: ["Shared ObjectDetail presentation for ModelUpdate."],
      });

      await page.locator('[data-testid="model-update-receipts"]').scrollIntoViewIfNeeded();
      await captureState({
        page,
        state: "evidence-receipts-supporting",
        label: "02 Receipt/supporting/conflicting section",
        surface: "reference",
        route: "/dev/orvek-v0-reference",
        selectedObjectId: REFERENCE_MOVEMENT_OBJECT_ID,
        selectors: [
          '[data-testid="model-update-receipts"]',
          '[data-testid="model-update-supporting-conflicting"]',
        ],
        notes: ["Shared ObjectDetail receipts / supporting blocks."],
      });

      const related = page.locator('[data-testid="model-update-related-objects"]');
      if ((await related.count()) > 0) {
        await related.scrollIntoViewIfNeeded();
      }
      await captureState({
        page,
        state: "evidence-related",
        label: "03 Related-object rows",
        surface: "reference",
        route: "/dev/orvek-v0-reference",
        selectedObjectId: REFERENCE_MOVEMENT_OBJECT_ID,
        selectors: ['[data-testid="model-update-related-objects"]'],
        notes: ["Shared ObjectDetail related rows."],
      });

      await scrollInspector(page, 0.45);
      await page
        .locator('[data-testid="model-update-receipts"] button')
        .first()
        .click();
      await expect(inspector(page).getByRole("button", { name: /^Back to /i })).toBeVisible();
      await captureState({
        page,
        state: "linked-object-detail",
        label: "04 Linked-object detail",
        surface: "reference",
        route: "/dev/orvek-v0-reference",
        selectedObjectId: null,
        selectors: ['button[name^="Back to"]'],
        notes: ["Shared ObjectDetail for linked receipt."],
      });

      await page.getByRole("button", { name: /^Back to /i }).click();
      await expect(page.locator('[data-testid="model-update-evidence-top"]')).toBeVisible();
      const restoredScrollTop = await page.locator(".o-inspector-body").evaluate((el) => {
        return (el as HTMLElement).scrollTop;
      });
      await captureState({
        page,
        state: "linked-back-navigation",
        label: "05 Back restoration at prior scroll position",
        surface: "reference",
        route: "/dev/orvek-v0-reference",
        selectedObjectId: REFERENCE_MOVEMENT_OBJECT_ID,
        selectors: ['[data-testid="model-update-evidence-top"]'],
        scrollTop: restoredScrollTop,
        notes: ["Shared ObjectDetail + store scroll restore."],
      });

      await inspector(page).getByRole("button", { name: "Model Movement" }).click();
      await expect(page.locator('[data-testid="model-update-movement-top"]')).toBeVisible();
      await captureState({
        page,
        state: "movement-top",
        label: "06 Model Movement top",
        surface: "reference",
        route: "/dev/orvek-v0-reference",
        selectedObjectId: REFERENCE_MOVEMENT_OBJECT_ID,
        selectors: ['[data-testid="model-update-movement-top"]'],
        notes: ["Shared MovementView presentation."],
      });

      await captureState({
        page,
        state: "movement-recent",
        label: "07 Recent movement cards",
        surface: "reference",
        route: "/dev/orvek-v0-reference",
        selectedObjectId: REFERENCE_MOVEMENT_OBJECT_ID,
        selectors: ['[data-testid="model-update-recent-movement"]'],
        notes: ["Shared MovementView recent cards."],
      });

      await inspector(page)
        .getByRole("button", { name: "Open Model Movement report" })
        .click();
      await expect(page.getByTestId("report-overlay-provenance")).toBeVisible();
      await captureState({
        page,
        state: "report-overlay-top",
        label: "08 Report overlay top",
        surface: "reference",
        route: "/dev/orvek-v0-reference",
        selectedObjectId: REFERENCE_MOVEMENT_OBJECT_ID,
        reportId: REFERENCE_REPORT_ID,
        selectors: ['[data-testid="report-overlay-provenance"]'],
        notes: ["Shared report overlay opened from MovementView."],
      });

      await page
        .getByTestId("report-overlay-evidence")
        .or(page.getByTestId("report-overlay-after"))
        .first()
        .scrollIntoViewIfNeeded()
        .catch(async () => {
          await page.mouse.wheel(0, 1200);
        });
      await captureState({
        page,
        state: "report-overlay-lower",
        label: "09 Report overlay lower content",
        surface: "reference",
        route: "/dev/orvek-v0-reference",
        selectedObjectId: REFERENCE_MOVEMENT_OBJECT_ID,
        reportId: REFERENCE_REPORT_ID,
        selectors: ['[data-testid="report-overlay-provenance"]'],
        notes: ["Shared report overlay lower content."],
      });

      await page.getByRole("button", { name: /Close report/i }).click();
      await expect(page.getByTestId("report-overlay-provenance")).toHaveCount(0);
      await expect(page.locator('[data-testid="model-update-movement-top"]')).toBeVisible();
      await captureState({
        page,
        state: "report-overlay-close",
        label: "10 Overlay close/return state",
        surface: "reference",
        route: "/dev/orvek-v0-reference",
        selectedObjectId: REFERENCE_MOVEMENT_OBJECT_ID,
        selectors: ['[data-testid="model-update-movement-top"]'],
        notes: ["Returns to shared MovementView without Map detour."],
      });
    } finally {
      await context.close();
    }
  });

  test("captures authenticated production inspector states", async ({ browser }) => {
    if (!emptyAuth || !primaryAuth || !seededMovement) {
      throw new Error("Authenticated production state was not initialized.");
    }

    const emptyContext = await createAuthedContext(browser, emptyAuth);
    const emptyPage = await emptyContext.newPage();
    try {
      await gotoAuthed(emptyPage, emptyContext, emptyAuth, "/");
      await expect(inspector(emptyPage)).toContainText("Nothing selected");
      await captureState({
        page: emptyPage,
        state: "empty-inspector",
        label: "Empty Inspector",
        surface: "production",
        route: "/",
        selectedObjectId: null,
        selectors: ['aside:has-text("Inspector")'],
        notes: ["Authenticated production route with a fixture-free user."],
      });
    } finally {
      await emptyContext.close();
    }

    const context = await createAuthedContext(browser, primaryAuth);
    const page = await context.newPage();
    try {
      await gotoAuthed(page, context, primaryAuth, "/");
      await waitForTodayMovementHydration(page, seededMovement.claimModelUpdateId);
      const productionEvidenceTop = page.locator('[data-testid="model-update-evidence-top"]');
      const productionSupportingConflicting = page.locator(
        '[data-testid="model-update-supporting-conflicting"]',
      );
      const productionReceipts = page.locator('[data-testid="model-update-receipts"]');
      const productionRelated = page.locator('[data-testid="model-update-related-objects"]');
      const productionMovementTop = page.locator('[data-testid="model-update-movement-top"]');
      const productionRecentMovement = page.locator('[data-testid="model-update-recent-movement"]');
      const seeWhy = page.locator(
        `[data-testid="today-see-why"][data-movement-id="${seededMovement.claimModelUpdateId}"]`,
      );
      await expect(seeWhy).toBeVisible({ timeout: 90_000 });
      await expect(page.locator("main")).not.toContainText("Link Detected · Related pattern");
      await expect(page.locator("main")).not.toContainText("Reference item");
      await expect(page.locator("main")).not.toContainText("Linked pattern");
      await captureState({
        page,
        state: "today-hero-identity",
        label: "11 Today hero/list identity with no generic label leakage",
        surface: "production",
        route: "/",
        selectedObjectId: null,
        selectors: [
          `[data-testid="today-see-why"][data-movement-id="${seededMovement.claimModelUpdateId}"]`,
        ],
        notes: [
          "Shared resolveModelUpdateDisplayTitle identity on Today.",
          "Must not show Link Detected · Related pattern / Reference item / Linked pattern.",
        ],
      });

      await seeWhy.first().click();
      await expect(inspector(page)).not.toContainText("Nothing selected", { timeout: 30_000 });
      await inspector(page).getByRole("button", { name: "Evidence / Context" }).click();
      await expect(page.getByTestId("authority-model-update-evidence")).toBeVisible({
        timeout: 60_000,
      });

      await productionEvidenceTop.waitFor({ state: "visible", timeout: 60_000 });
      await expect(page.getByTestId("authority-model-update-evidence")).toBeVisible();
      await expect(productionEvidenceTop).toContainText(FIXTURE_MOVEMENT_SUMMARY);
      await expect(productionEvidenceTop).not.toContainText("Related pattern");
      await expect(page.locator("aside").filter({ hasText: "Inspector" })).not.toContainText(
        "Link Detected · Related pattern",
      );
      const summaryBlock = page.locator('[data-testid="model-update-summary"]');
      if ((await summaryBlock.count()) > 0) {
        await expect(summaryBlock).not.toContainText(/Related pattern|Reference item|Linked pattern/i);
      }
      await expect(inspector(page)).not.toContainText("Related pattern movement");
      await expect(page.locator('[data-testid="model-update-recorded-metadata"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="model-update-affected-object"]')).toHaveCount(0);
      await expect(inspector(page)).not.toContainText(
        "Full affected-object detail is not exposed in this selection yet.",
      );
      await expect(productionReceipts).toContainText(FIXTURE_SOURCE_TEXT);
      await expect(productionSupportingConflicting.or(productionRelated).first()).toBeVisible();
      await captureState({
        page,
        state: "evidence-top",
        label: "01 Evidence / Context top",
        surface: "production",
        route: "/",
        selectedObjectId: seededMovement.claimModelUpdateId,
        selectors: [
          '[data-testid="authority-model-update-evidence"]',
          '[data-testid="model-update-evidence-top"]',
        ],
        notes: [
          "Same presentation component as reference: ObjectDetail.",
          "Live composed OrvekObject via composeProductionModelUpdateCanonicalViewModel.",
        ],
      });

      await productionReceipts.scrollIntoViewIfNeeded();
      await captureState({
        page,
        state: "evidence-receipts-supporting",
        label: "02 Receipt/supporting/conflicting section",
        surface: "production",
        route: "/",
        selectedObjectId: seededMovement.claimModelUpdateId,
        selectors: [
          '[data-testid="model-update-receipts"]',
          '[data-testid="model-update-supporting-conflicting"]',
        ],
        notes: ["Same presentation component as reference: ObjectDetail."],
      });

      if ((await productionRelated.count()) > 0) {
        await productionRelated.scrollIntoViewIfNeeded();
      }
      await captureState({
        page,
        state: "evidence-related",
        label: "03 Related-object rows",
        surface: "production",
        route: "/",
        selectedObjectId: seededMovement.claimModelUpdateId,
        selectors: ['[data-testid="model-update-related-objects"]'],
        notes: ["Same presentation component as reference: ObjectDetail."],
      });

      await scrollInspector(page, 0.45);
      await productionReceipts
        .locator("button, div")
        .filter({ hasText: FIXTURE_SOURCE_TEXT })
        .first()
        .click();
      await expect(inspector(page).getByRole("button", { name: /^Back to /i })).toBeVisible();
      await expect(inspector(page)).toContainText("Viewing supporting receipt");
      await captureState({
        page,
        state: "linked-object-detail",
        label: "04 Linked-object detail",
        surface: "production",
        route: "/",
        selectedObjectId: null,
        selectors: ['button[name^="Back to"]'],
        notes: ["Same presentation component as reference: ObjectDetail for linked receipt."],
      });

      const midScrollBeforeBack = await scrollInspector(page, 0.4);
      await page.getByRole("button", { name: /^Back to /i }).click();
      await productionEvidenceTop.waitFor({ state: "visible", timeout: 60_000 });
      await expect(inspector(page)).not.toContainText(
        "Full affected-object detail is not exposed in this selection yet.",
      );
      const restoredScrollTop = await page.locator(".o-inspector-body").evaluate((el) => {
        return (el as HTMLElement).scrollTop;
      });
      await captureState({
        page,
        state: "linked-back-navigation",
        label: "05 Back restoration at prior scroll position",
        surface: "production",
        route: "/",
        selectedObjectId: seededMovement.claimModelUpdateId,
        selectors: [
          '[data-testid="model-update-evidence-top"]',
          '[data-testid="model-update-receipts"]',
        ],
        scrollTop: restoredScrollTop,
        notes: [
          `Scroll before linked navigation mid-point was ${midScrollBeforeBack}; restored scrollTop=${restoredScrollTop}.`,
          "Same ObjectDetail path; sticky overlay preserves receipt satellites.",
        ],
      });

      await inspector(page).getByRole("button", { name: "Model Movement" }).click();
      await productionMovementTop.waitFor({ state: "visible", timeout: 60_000 });
      await expect(productionMovementTop).toContainText(FIXTURE_MOVEMENT_SUMMARY);
      await expect(productionRecentMovement).toBeVisible();
      await expect(page.locator('[data-testid="model-update-movement-metadata"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="model-update-movement-what-changed"]')).toHaveCount(
        0,
      );
      await expect(page.locator('[data-testid="model-update-movement-reality-gate"]')).toHaveCount(
        0,
      );
      await expect(page.getByTestId("authority-model-update-movement")).toBeVisible();
      await captureState({
        page,
        state: "movement-top",
        label: "06 Model Movement top",
        surface: "production",
        route: "/",
        selectedObjectId: seededMovement.claimModelUpdateId,
        selectors: [
          '[data-testid="authority-model-update-movement"]',
          '[data-testid="model-update-movement-top"]',
        ],
        notes: ["Same presentation component as reference: MovementView."],
      });

      await captureState({
        page,
        state: "movement-recent",
        label: "07 Recent movement cards",
        surface: "production",
        route: "/",
        selectedObjectId: seededMovement.claimModelUpdateId,
        selectors: ['[data-testid="model-update-recent-movement"]'],
        notes: ["Same presentation component as reference: MovementView."],
      });

      await inspector(page)
        .getByRole("button", { name: "Open Model Movement report" })
        .click();
      await expect(page.getByTestId("report-overlay-canonical-id")).toHaveText(
        seededMovement.claimModelUpdateId,
      );
      await captureState({
        page,
        state: "report-overlay-top",
        label: "08 Report overlay top",
        surface: "production",
        route: "/",
        selectedObjectId: seededMovement.claimModelUpdateId,
        reportId: seededMovement.claimModelUpdateId,
        selectors: ['button[name="Open Model Movement report"]'],
        notes: ["Opened from shared MovementView with live report identity."],
      });

      await page
        .getByTestId("report-overlay-evidence")
        .or(page.getByTestId("report-overlay-after"))
        .first()
        .scrollIntoViewIfNeeded()
        .catch(async () => {
          await page.mouse.wheel(0, 1200);
        });
      await captureState({
        page,
        state: "report-overlay-lower",
        label: "09 Report overlay lower content",
        surface: "production",
        route: "/",
        selectedObjectId: seededMovement.claimModelUpdateId,
        reportId: seededMovement.claimModelUpdateId,
        selectors: ['[data-testid="report-overlay-canonical-id"]'],
        notes: ["Live report overlay lower content."],
      });

      await page.getByRole("button", { name: /Close report/i }).click();
      await expect(page.getByTestId("report-overlay-provenance")).toHaveCount(0);
      await expect(productionMovementTop).toBeVisible();
      await captureState({
        page,
        state: "report-overlay-close",
        label: "10 Overlay close/return state",
        surface: "production",
        route: "/",
        selectedObjectId: seededMovement.claimModelUpdateId,
        selectors: ['[data-testid="model-update-movement-top"]'],
        notes: [
          "Closing the overlay returns to shared MovementView without Map detour.",
        ],
      });
    } finally {
      await context.close();
    }
  });

  test("keeps weekly report and Inspector continuity on the production route", async ({ browser }) => {
    if (!primaryAuth || !seededMovement) {
      throw new Error("Production fixture state was not initialized.");
    }

    const context = await createAuthedContext(browser, primaryAuth);
    const page = await context.newPage();

    try {
      await gotoAuthed(page, context, primaryAuth, "/");
      await waitForTodayMovementHydration(page, seededMovement.claimModelUpdateId);

      const seeWhy = page.getByTestId("today-see-why").first();
      await expect(seeWhy).toHaveAttribute("data-movement-id", seededMovement.claimModelUpdateId);
      await seeWhy.click();
      await expect(page.getByTestId("inspector-model-update-id").first()).toHaveText(
        seededMovement.claimModelUpdateId,
      );

      await page.getByTestId("today-full-report").click();
      await expect(page.getByTestId("report-overlay-canonical-id")).toHaveText(
        seededMovement.claimModelUpdateId
      );
      await page.getByRole("button", { name: /Close report/i }).click();
      await expect(page.getByTestId("report-overlay-provenance")).toHaveCount(0);

      await page.getByTestId("nav-timeline").click();
      await expect(
        page.locator(
          `[data-testid="timeline-movement-row"][data-movement-id="${seededMovement.claimModelUpdateId}"]`
        )
      ).toBeVisible({ timeout: 30_000 });
    } finally {
      await context.close();
    }
  });
});
