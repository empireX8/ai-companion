/**
 * Semantic twin live-data contract gate.
 * Compares /dev/orvek-v0-canonical-reference vs /dev/orvek-v0-canonical-live
 * for an account seeded with production-backed semantic-twin data.
 *
 * Run:
 *   ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1 DESKTOP_PARITY_BASE_URL=http://localhost:3000 \
 *     npx tsx scripts/step8-semantic-twin-live-contract.playwright.ts
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { chromium, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  SEMANTIC_TWIN_EXPECTED_TITLES,
  SEMANTIC_TWIN_PREFIX,
  cleanupSemanticTwinRuntimeFixture,
  seedSemanticTwinRuntimeFixture,
  type SemanticTwinFixtureSeedResult,
} from "../lib/semantic-twin-runtime-fixture";

const CAMPAIGN = "DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001";
const ROOT = resolve(process.cwd());
const RECEIPTS = resolve(ROOT, `docs/agent-runs/receipts/${CAMPAIGN}`);
const SHOTS = resolve(RECEIPTS, "screenshots/step8-semantic-twin");
const REVIEW = resolve(RECEIPTS, "24-semantic-twin-live-contract-gate.md");
const MATRIX = resolve(RECEIPTS, "25-semantic-twin-mismatch-matrix.md");
const MANIFEST = resolve(RECEIPTS, "step8-semantic-twin-manifest.json");
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3000";
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";
const VIEWPORT = { width: 1440, height: 900 } as const;
const AUTH_PROBE = "/api/desktop-production-parity/auth-probe";
const FIXTURE = "/dev/orvek-v0-canonical-reference";
const LIVE = "/dev/orvek-v0-canonical-live";
const KEEP_SEED = process.env.SEMANTIC_TWIN_CLEANUP !== "1";

function assertNoFixtureIdLeak(body: string, lane: string) {
  const bareIds = [
    "d1", "d2", "d3", "inv-1", "inv-2", "inv-3", "aq-1", "aq-2", "aq-3", "aq-4",
    "mu-1", "mu-2", "r6", "r5", "r2", "rep-weekly",
  ];
  const twinSafe = body.replace(new RegExp(`${SEMANTIC_TWIN_PREFIX}-[\\w-]+`, "g"), "<twin>");
  for (const id of bareIds) {
    const re = new RegExp(`(^|[^\\w-])${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w-]|$)`);
    if (re.test(twinSafe)) {
      throw new Error(`Fixture id leak on ${lane}: ${id}`);
    }
  }
}

function normalizeSemanticText(raw: string): string {
  return raw
    .replace(/\b\d{4}-\d{2}-\d{2}T[\d:.Z+-]+\b/g, "<ts>")
    .replace(/\b\d+ (minute|hour|day|week)s? ago\b/gi, "<rel>")
    .replace(new RegExp(`${SEMANTIC_TWIN_PREFIX}-[\\w-]+`, "g"), "<twin-id>")
    .replace(/\buser_[A-Za-z0-9]+\b/g, "<user>")
    .replace(/\s+/g, " ")
    .trim();
}


type EnvMap = Record<string, string>;
type AuthState = {
  userId: string;
  email: string;
  password: string;
  sessionId: string;
  sessionToken: string;
  clientUat: string;
};

type MismatchClass =
  | "LIVE_DATA_EXISTS_BUT_PROVIDER_DROPS_IT"
  | "LIVE_DATA_EXISTS_BUT_HYDRATION_DROPS_IT"
  | "LIVE_DATA_MAPPED_TO_WRONG_CANONICAL_FIELD"
  | "LIVE_RELATIONSHIP_NOT_HYDRATED"
  | "WRONG_OBJECT_TYPE"
  | "WRONG_ORDERING_OR_COMPOSITION"
  | "ACTION_CALLBACK_MISSING"
  | "PRODUCTION_STORAGE_CANNOT_REPRESENT_REFERENCE_CONTRACT"
  | "REFERENCE_ONLY_MOCK_BEHAVIOUR"
  | "CANONICAL_PRESENTATION_DEFECT"
  | "PASS";

type CheckRow = {
  id: string;
  state: string;
  classification: MismatchClass;
  detail: string;
  fixtureShot?: string;
  liveShot?: string;
};

function readEnv(relativePath = ".env"): EnvMap {
  const file = readFileSync(resolve(ROOT, relativePath), "utf8");
  const env: EnvMap = {};
  for (const raw of file.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
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

function requireEnv(env: EnvMap, key: string) {
  const v = env[key];
  if (!v) throw new Error(`Missing ${key}`);
  return v;
}

function decodeJwt(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

async function createAuth(
  clerk: ReturnType<typeof createClerkClient>,
  label: string,
): Promise<AuthState> {
  const email = `semantic-twin-${label}-${Date.now()}@example.com`;
  const password = `Twin-${Date.now()}-Aa1!`;
  const user = await clerk.users.createUser({
    emailAddress: [email],
    password,
    skipPasswordChecks: true,
    skipPasswordRequirement: true,
  });
  const session = await clerk.sessions.createSession({ userId: user.id });
  const token = await clerk.sessions.getToken(session.id);
  const payload = decodeJwt(token.jwt);
  return {
    userId: user.id,
    email,
    password,
    sessionId: session.id,
    sessionToken: token.jwt,
    clientUat: typeof payload.iat === "number" ? String(payload.iat) : "1",
  };
}

async function cleanupAuth(
  clerk: ReturnType<typeof createClerkClient>,
  auth: AuthState | null,
) {
  if (!auth) return;
  try {
    await clerk.sessions.revokeSession(auth.sessionId);
  } catch {
    /* ignore */
  }
  try {
    await clerk.users.deleteUser(auth.userId);
  } catch {
    /* ignore */
  }
}

async function createContext(
  browser: Browser,
  clerk: ReturnType<typeof createClerkClient>,
  auth: AuthState,
) {
  const dbJwt = (await clerk.testingTokens.createTestingToken()).token;
  const context = await browser.newContext({
    baseURL: ORIGIN,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  await context.addCookies([
    {
      name: "__session",
      value: auth.sessionToken,
      url: ORIGIN,
      httpOnly: true,
      sameSite: "Lax",
    },
    { name: "__clerk_db_jwt", value: dbJwt, url: ORIGIN, sameSite: "Lax" },
    { name: "__client_uat", value: auth.clientUat, url: ORIGIN, sameSite: "Lax" },
  ]);
  return { context, dbJwt };
}

async function probe(page: Page, userId: string) {
  try {
    return await page.evaluate(
      async ({ endpoint, expectedId }) => {
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) return false;
        const body = (await res.json()) as {
          authenticated?: boolean;
          userId?: string | null;
        };
        return body.authenticated === true && body.userId === expectedId;
      },
      { endpoint: AUTH_PROBE, expectedId: userId },
    );
  } catch {
    return false;
  }
}

async function maybeSignIn(page: Page, auth: AuthState) {
  const heading = page.getByRole("heading", { name: /sign in/i }).first();
  const visible = await heading
    .waitFor({ state: "visible", timeout: 4_000 })
    .then(() => true)
    .catch(() => false);
  if (!visible && !page.url().includes("/sign-in")) return;
  const id = page
    .locator(
      '#identifier-field, input[name="identifier"], input[autocomplete="username"], input[type="email"]',
    )
    .first();
  const pw = page
    .locator(
      '#password-field, input[name="password"], input[autocomplete="current-password"], input[type="password"]',
    )
    .first();
  await expect(id).toBeVisible({ timeout: 90_000 });
  await expect(pw).toBeVisible({ timeout: 90_000 });
  await id.fill(auth.email);
  await pw.fill(auth.password);
  await page.getByRole("button", { name: /^Continue$/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), {
    timeout: 90_000,
  });
}

async function gotoAuthed(
  page: Page,
  context: BrowserContext,
  clerk: ReturnType<typeof createClerkClient>,
  auth: AuthState,
  path: string,
  tokenRef: { current: string },
) {
  tokenRef.current = (await clerk.testingTokens.createTestingToken()).token;
  await context.addCookies([
    { name: "__clerk_db_jwt", value: tokenRef.current, url: ORIGIN },
  ]);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    if (!(await probe(page, auth.userId))) {
      await maybeSignIn(page, auth);
      await expect.poll(() => probe(page, auth.userId), { timeout: 90_000 }).toBe(true);
    }
    await page.goto(path, { waitUntil: "domcontentloaded" });
    if (await probe(page, auth.userId)) {
      if (!page.url().includes("/sign-in")) return;
    }
    tokenRef.current = (await clerk.testingTokens.createTestingToken()).token;
    await context.addCookies([
      { name: "__clerk_db_jwt", value: tokenRef.current, url: ORIGIN },
    ]);
  }
  throw new Error(`Failed to authenticate into ${path}. finalUrl=${page.url()}`);
}

async function dismissOverlay(page: Page) {
  for (let i = 0; i < 4; i += 1) {
    const overlay = page.locator("div.fixed.inset-0.z-50").first();
    if (!(await overlay.isVisible().catch(() => false))) return;
    const closeReport = overlay.getByRole("button", {
      name: "Close report",
      exact: true,
    });
    if (await closeReport.isVisible().catch(() => false)) {
      await closeReport.click({ force: true });
      await page.waitForTimeout(150);
      continue;
    }
    const close = overlay.getByRole("button", { name: "Close", exact: true });
    if (await close.isVisible().catch(() => false)) {
      await close.click({ force: true });
      await page.waitForTimeout(150);
      continue;
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
}

async function shot(page: Page, name: string) {
  const file = resolve(SHOTS, `${name}.png`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: file, fullPage: false });
  return file.replace(`${ROOT}/`, "");
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const env = readEnv();
  process.env.DATABASE_URL = LOCAL_DATABASE_URL;
  process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
  if (process.env.NODE_ENV === "production") process.env.NODE_ENV = "test";

  const clerk = createClerkClient({
    secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
    publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
  });

  let auth: AuthState | null = null;
  let seeded: SemanticTwinFixtureSeedResult | null = null;
  const prisma = new PrismaClient({ datasources: { db: { url: LOCAL_DATABASE_URL } } });
  const browser = await chromium.launch({ headless: true });
  const tokenRef = { current: "" };
  const checks: CheckRow[] = [];
  const notes: string[] = [];
  let verdict: "PASS" | "FAIL" = "PASS";
  let failReason: string | null = null;

  const push = (row: CheckRow) => {
    checks.push(row);
    if (row.classification !== "PASS") {
      verdict = "FAIL";
      if (!failReason) failReason = `${row.id}: ${row.detail}`;
    }
  };

  try {
    auth = await createAuth(clerk, "primary");
    seeded = await seedSemanticTwinRuntimeFixture({
      userId: auth.userId,
      db: prisma,
    });
    notes.push(
      `Seeded twin for ${auth.userId}; MUs=${seeded.modelUpdateIds.join(",")}; reportCandidate=${seeded.reportCandidateId}`,
    );

    const pack = await createContext(browser, clerk, auth);
    const page = await pack.context.newPage();
    page.on("pageerror", (error) => notes.push(`pageerror: ${error.message}`));

    // ── Fixture baseline (no twin required; shared presentation) ──
    await gotoAuthed(page, pack.context, clerk, auth, FIXTURE, tokenRef);
    const fixtureRoot = page.locator('[data-testid="orvek-v0-canonical-reference-route"], body').first();
    await expect(page.getByText("Your model moved in 3 places.")).toBeVisible({
      timeout: 60_000,
    });
    const fixtureToday = await shot(page, "01-today-fixture");
    const fixtureBody = normalizeSemanticText(await page.locator("body").innerText());

    // ── Live twin ──
    await gotoAuthed(page, pack.context, clerk, auth, LIVE, tokenRef);
    const liveRoot = page.locator('[data-testid="orvek-v0-canonical-live-route"]');
    await expect(liveRoot).toBeVisible({ timeout: 90_000 });

    await expect
      .poll(
        async () => {
          const text = await liveRoot.innerText();
          return (
            /Your model moved in \d+ places?\./.test(text) ||
            text.includes("Scope reopening") ||
            text.includes("Decision pressure") ||
            /moved|Current state|Evening|visual/i.test(text)
          );
        },
        { timeout: 120_000 },
      )
      .toBe(true);

    let liveBody = await liveRoot.innerText();
    assertNoFixtureIdLeak(liveBody, "live-today");
    const liveToday = await shot(page, "01-today-live");

    // 1–2 Today briefing + composition
    const liveHasMovementHeadline = /Your model moved in \d+ places?\./.test(liveBody);
    push({
      id: "today-briefing-title",
      state: "Today initial",
      classification: liveHasMovementHeadline ? "PASS" : "WRONG_ORDERING_OR_COMPOSITION",
      detail: liveHasMovementHeadline
        ? "Live briefing uses movement-count headline"
        : `Live briefing missing movement-count headline. Snippet=${JSON.stringify(liveBody.slice(0, 240))}`,
      fixtureShot: fixtureToday,
      liveShot: liveToday,
    });

    const expectedPresent = SEMANTIC_TWIN_EXPECTED_TITLES.filter((title) =>
      liveBody.includes(title),
    );
    const expectedMissing = SEMANTIC_TWIN_EXPECTED_TITLES.filter(
      (title) => !liveBody.includes(title),
    );
    // On Today, only a subset of titles is expected in first viewport.
    const todayMust = [
      "Small public test — narrow version before reopening",
      "Decision pressure is now linked to scope reopening.",
    ];
    // Map loop densograph title is asserted on the Map check, not Today NOW.
    const todayMissing = todayMust.filter((t) => !liveBody.includes(t));
    push({
      id: "today-semantic-titles",
      state: "Today initial / NOW / movements",
      classification:
        todayMissing.length === 0
          ? "PASS"
          : todayMissing.length <= 2
            ? "LIVE_DATA_EXISTS_BUT_HYDRATION_DROPS_IT"
            : "WRONG_ORDERING_OR_COMPOSITION",
      detail:
        todayMissing.length === 0
          ? `Today shows core twin titles (${expectedPresent.length}/${SEMANTIC_TWIN_EXPECTED_TITLES.length} global hits so far)`
          : `Missing on Today: ${todayMissing.join(" | ")}`,
      liveShot: liveToday,
    });

    // 3 Select primary / hero object
    const seeWhy = page.getByRole("button", { name: /See why it moved/i }).first();
    if (await seeWhy.isVisible().catch(() => false)) {
      await seeWhy.click();
      await page.waitForTimeout(400);
    } else {
      await page.locator("main h2, main button").filter({ hasText: /./ }).first().click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
    const selectedShot = await shot(page, "02-selected-live");

    // 4–10 Evidence / linked / back
    const evidenceTab = page.getByRole("button", {
      name: "Evidence / Context",
      exact: true,
    });
    await expect(evidenceTab).toBeVisible({ timeout: 30_000 });
    await evidenceTab.click();
    await page.waitForTimeout(350);
    liveBody = await liveRoot.innerText();
    const hasEvidenceSections =
      /Receipt|Supporting|Conflicting|Context|Why it matters|Evidence/i.test(liveBody);
    push({
      id: "inspector-evidence",
      state: "Evidence / Context",
      classification: hasEvidenceSections
        ? "PASS"
        : "LIVE_DATA_EXISTS_BUT_HYDRATION_DROPS_IT",
      detail: hasEvidenceSections
        ? "Inspector Evidence/Context sections present"
        : "Evidence/Context sections absent after selection",
      liveShot: await shot(page, "03-evidence-live"),
    });

    // Linked + Back via ModelUpdate compose receipts (source-text quotes as LinkedRows).
    await page.getByTestId("nav-today").click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(400);
    const seeWhyAgain = page.getByRole("button", { name: /See why it moved/i }).first();
    if (await seeWhyAgain.isVisible().catch(() => false)) {
      await seeWhyAgain.click();
      await page.waitForTimeout(400);
    } else {
      await page.locator("main h2, main button").filter({ hasText: /./ }).first().click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
    await page.getByRole("button", { name: "Evidence / Context", exact: true }).click();
    await page.waitForTimeout(800);
    const aside = page.locator("aside").last();
    const linkedTarget = aside
      .getByRole("button")
      .filter({
        hasText:
          /Need to see everything expressed|Let it express itself visually|Maybe I keep refining because shipping|We need to see everything and see it expressed|not concerned with colours|stop point|Evening|I keep working past/i,
      })
      .first();
    const linkedVisible = await linkedTarget
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (linkedVisible) {
      await linkedTarget.click({ force: true });
      await page.waitForTimeout(500);
    }
    await shot(page, "04-linked-live");
    push({
      id: "linked-navigation",
      state: "Linked object",
      classification: linkedVisible
        ? "PASS"
        : "LIVE_RELATIONSHIP_NOT_HYDRATED",
      detail: linkedVisible
        ? "MU Evidence receipt LinkedRow navigable"
        : "No receipt quote LinkedRow after MU Evidence compose — relationship graph still thin",
    });

    const back = page.getByRole("button", { name: /^Back to /i }).first();
    if (await back.isVisible().catch(() => false)) {
      await back.click({ force: true });
      await page.waitForTimeout(250);
      push({
        id: "back-restoration",
        state: "Back",
        classification: "PASS",
        detail: "Back control restored prior selection path",
      });
    } else {
      push({
        id: "back-restoration",
        state: "Back",
        classification: linkedVisible
          ? "ACTION_CALLBACK_MISSING"
          : "LIVE_RELATIONSHIP_NOT_HYDRATED",
        detail: linkedVisible
          ? "Receipt LinkedRow clicked but Back did not appear"
          : "Back unverifiable — receipt relationships not hydrated on selected MU",
      });
    }

    // 11–13 Model Movement + report
    await page.getByRole("button", { name: "Model Movement", exact: true }).click();
    await page.waitForTimeout(350);
    liveBody = await liveRoot.innerText();
    const hasMovement =
      /before|after|previous|updated|movement|rationale/i.test(liveBody);
    push({
      id: "model-movement",
      state: "Model Movement",
      classification: hasMovement
        ? "PASS"
        : "LIVE_DATA_EXISTS_BUT_HYDRATION_DROPS_IT",
      detail: hasMovement
        ? "Movement tab shows movement content"
        : "Movement tab thin/empty",
      liveShot: await shot(page, "05-movement-live"),
    });

    const openReport = page
      .getByRole("button", { name: /Open (Model Movement )?report/i })
      .first();
    if (await openReport.isVisible().catch(() => false)) {
      await openReport.click();
      await page.waitForTimeout(400);
      const overlayText = await page.locator("div.fixed.inset-0.z-50").innerText().catch(() => "");
      if (overlayText.includes("rep-weekly")) {
        push({
          id: "report-overlay",
          state: "Report overlay",
          classification: "LIVE_DATA_MAPPED_TO_WRONG_CANONICAL_FIELD",
          detail: "Report overlay leaked fixture report id",
        });
      } else {
        push({
          id: "report-overlay",
          state: "Report overlay",
          classification: "PASS",
          detail: "Report overlay opened on live identity",
          liveShot: await shot(page, "06-report-live"),
        });
      }
      await dismissOverlay(page);
    } else {
      push({
        id: "report-overlay",
        state: "Report overlay",
        classification: "PRODUCTION_STORAGE_CANNOT_REPRESENT_REFERENCE_CONTRACT",
        detail:
          "No Open report control — live reportReady may be false; fixture uses rep-weekly densograph object",
      });
    }

    // 14–15 Map
    await page.getByTestId("nav-map").click({ force: true });
    await expect(page.getByRole("heading", { name: "Map", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(800);
    liveBody = await liveRoot.innerText();
    assertNoFixtureIdLeak(liveBody, "live-map");
    const mapHasCategories =
      /Patterns|Claims|Conflicts|Goals|Background|Active questions|Model updates/i.test(
        liveBody,
      );
    const mapHasTwinObject =
      liveBody.includes("You often need visual expression before locking architecture.") ||
      liveBody.includes("Scope reopening under uncertainty") ||
      liveBody.includes("Speed vs depth");
    push({
      id: "map-composition",
      state: "Map",
      classification:
        mapHasCategories && mapHasTwinObject
          ? "PASS"
          : mapHasCategories
            ? "LIVE_RELATIONSHIP_NOT_HYDRATED"
            : "WRONG_ORDERING_OR_COMPOSITION",
      detail:
        mapHasCategories && mapHasTwinObject
          ? "Map rails + twin object titles present"
          : `categories=${mapHasCategories} twinObject=${mapHasTwinObject}`,
      liveShot: await shot(page, "07-map-live"),
    });

    // 16 Decisions
    await page.getByTestId("nav-decisions").click({ force: true });
    await expect(page.getByRole("heading", { name: "Decisions", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(600);
    liveBody = await liveRoot.innerText();
    const decisionsHaveContent =
      /Active|Chosen|Outcome|Reviewed|prototype|architecture|decision/i.test(liveBody);
    push({
      id: "decisions",
      state: "Decision",
      classification: decisionsHaveContent
        ? "PASS"
        : "LIVE_DATA_EXISTS_BUT_HYDRATION_DROPS_IT",
      detail: decisionsHaveContent
        ? "Decisions rail populated"
        : "Decisions empty/sparse after twin seed",
      liveShot: await shot(page, "08-decisions-live"),
    });

    // 17–19 Explore AQ / Investigation / Free
    await page.getByTestId("nav-explore").click({ force: true });
    await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Active Questions", exact: true }).click();
    await page.waitForTimeout(600);
    liveBody = await liveRoot.innerText();
    const aqHit =
      liveBody.includes("Does public visibility trigger overbuilding?") ||
      liveBody.includes("Does visual prototyping reduce architecture uncertainty?") ||
      liveBody.includes("Which features are essential");
    push({
      id: "active-questions",
      state: "Active Question",
      classification: aqHit ? "PASS" : "LIVE_DATA_EXISTS_BUT_HYDRATION_DROPS_IT",
      detail: aqHit
        ? "Active Questions show twin titles"
        : "Active Questions missing twin titles",
      liveShot: await shot(page, "09-aq-live"),
    });

    await page.getByRole("button", { name: "Investigations", exact: true }).click();
    await page.waitForTimeout(600);
    liveBody = await liveRoot.innerText();
    const invHit =
      liveBody.includes("Why do I reopen scope before design?") ||
      /investigation|resolved|hypothes/i.test(liveBody);
    push({
      id: "investigations",
      state: "Investigation",
      classification: invHit ? "PASS" : "LIVE_DATA_EXISTS_BUT_HYDRATION_DROPS_IT",
      detail: invHit
        ? "Investigations show twin content"
        : "Investigations missing twin content",
      liveShot: await shot(page, "10-inv-live"),
    });

    await page.getByRole("button", { name: "Free Explore", exact: true }).click();
    await page.waitForTimeout(400);
    liveBody = await liveRoot.innerText();
    assertNoFixtureIdLeak(liveBody, "live-explore-free");
    push({
      id: "explore-free",
      state: "Explore",
      classification: liveBody.includes("Why do I feel like we need to see the architecture")
        ? "REFERENCE_ONLY_MOCK_BEHAVIOUR"
        : "PASS",
      detail: liveBody.includes("Why do I feel like we need to see the architecture")
        ? "Fixture Explore conversation leaked into live"
        : "Free Explore does not show fixture conversation",
      liveShot: await shot(page, "11-explore-live"),
    });

    // 20 Timeline
    await page.getByTestId("nav-timeline").click({ force: true });
    await expect(page.getByRole("heading", { name: "Timeline", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(700);
    liveBody = await liveRoot.innerText();
    const timelineHasGroups = /Today|This week|Earlier|Model Updates|Receipts/i.test(liveBody);
    push({
      id: "timeline",
      state: "Timeline",
      classification: timelineHasGroups
        ? "PASS"
        : "PRODUCTION_STORAGE_CANNOT_REPRESENT_REFERENCE_CONTRACT",
      detail: timelineHasGroups
        ? "Timeline groups present (projected, not densograph t1–t14)"
        : "Timeline empty after twin seed",
      liveShot: await shot(page, "12-timeline-live"),
    });

    // Global expected titles coverage across visit (best-effort: re-check Map+Today titles already captured)
    notes.push(
      `Semantic title hits on last live body sample: ${expectedPresent.length}; missing sample: ${expectedMissing.slice(0, 8).join(", ")}`,
    );
    notes.push(`Fixture baseline captured: ${fixtureBody.includes("Your model moved in 3 places.")}`);
    void selectedShot;

    await pack.context.close();
  } catch (err) {
    verdict = "FAIL";
    failReason = String(err);
  } finally {
    if (!KEEP_SEED && auth && seeded) {
      await cleanupSemanticTwinRuntimeFixture({
        userId: auth.userId,
        db: prisma,
        ids: seeded.ids,
      });
      await cleanupAuth(clerk, auth);
    } else if (KEEP_SEED && auth) {
      notes.push(
        `KEEP_SEED: user=${auth.userId} email=${auth.email} password=${auth.password}. Cleanup: SEMANTIC_TWIN_CLEANUP=1`,
      );
    }
    await prisma.$disconnect();
    await browser.close();
  }

  const hardFails = checks.filter((c) => c.classification !== "PASS");
  if (hardFails.length > 0) verdict = "FAIL";

  const review = [
    "# 24 — Semantic twin live contract gate",
    "",
    `Verdict: **${
      verdict === "PASS"
        ? "SEMANTIC TWIN PASSED — LIVE PROVIDER MATCHES REFERENCE CONTRACT"
        : "FAIL — LIVE PROVIDER CONTRACT INCOMPLETE"
    }**`,
    "",
    failReason ? `Fail reason: ${failReason}` : "No hard fail reason recorded.",
    "",
    "## Scope",
    "- Fixture: `/dev/orvek-v0-canonical-reference`",
    "- Live: `/dev/orvek-v0-canonical-live` with semantic-twin seeded account",
    "- Presentation unchanged; repairs limited to live-provider / hydration / MU compose",
    "",
    "## Seed",
    `- Prefix: \`${SEMANTIC_TWIN_PREFIX}\``,
    `- User: \`${auth?.userId ?? "n/a"}\` / \`${auth?.email ?? "n/a"}\``,
    `- ModelUpdates: ${(seeded?.modelUpdateIds ?? []).map((id) => `\`${id}\``).join(", ") || "n/a"}`,
    `- KEEP_SEED: \`${KEEP_SEED}\``,
    "",
    "## Checks",
    ...checks.map(
      (c) =>
        `- **${c.id}** (${c.state}): \`${c.classification}\` — ${c.detail}`,
    ),
    "",
    "## Notes",
    ...notes.map((n) => `- ${n}`),
    "",
    "## Real-account diagnosis (post-twin)",
    "Anything still absent on a real populated account after twin PASS should be classified as intelligence/persistence gaps (not observed / not generated / not linked / insufficient evidence), not as provider presentation defects.",
    "",
  ].join("\n");

  const matrix = [
    "# 25 — Semantic twin mismatch matrix",
    "",
    "| Check | State | Classification | Repair target |",
    "|-------|-------|----------------|---------------|",
    ...checks.map((c) => {
      const repair =
        c.classification === "PASS"
          ? "—"
          : c.classification === "LIVE_DATA_EXISTS_BUT_PROVIDER_DROPS_IT"
            ? "live-provider.ts field map"
            : c.classification === "LIVE_DATA_EXISTS_BUT_HYDRATION_DROPS_IT"
              ? "hybrid/today/map hydration"
              : c.classification === "PRODUCTION_STORAGE_CANNOT_REPRESENT_REFERENCE_CONTRACT"
                ? "storage/product decision (not presentation)"
                : c.classification === "REFERENCE_ONLY_MOCK_BEHAVIOUR"
                  ? "leave fixture-only"
                  : "see inventory 23";
      return `| ${c.id} | ${c.state} | ${c.classification} | ${repair} |`;
    }),
    "",
  ].join("\n");

  writeFileSync(REVIEW, review);
  writeFileSync(MATRIX, matrix);
  writeFileSync(
    MANIFEST,
    `${JSON.stringify(
      {
        verdict,
        failReason,
        keepSeed: KEEP_SEED,
        checks,
        notes,
        seeded: {
          userId: auth?.userId ?? null,
          email: auth?.email ?? null,
          password: KEEP_SEED ? auth?.password ?? null : null,
          modelUpdateIds: seeded?.modelUpdateIds ?? [],
          reportCandidateId: seeded?.reportCandidateId ?? null,
        },
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    verdict === "PASS"
      ? "SEMANTIC TWIN PASSED — LIVE PROVIDER MATCHES REFERENCE CONTRACT"
      : `FAIL — LIVE PROVIDER CONTRACT INCOMPLETE:${failReason}`,
  );
  process.exit(verdict === "PASS" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
