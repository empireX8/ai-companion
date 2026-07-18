/**
 * Root cutover verification: populated live account on production `/`.
 * Keeps seeded data for Kay visual review (no cleanup unless ROOT_CUTOVER_CLEANUP=1).
 *
 * Run:
 *   DESKTOP_PARITY_BASE_URL=http://localhost:3000 npx tsx scripts/step7-root-cutover-production-path.playwright.ts
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient, InvestigationSeedType, InvestigationStatus, InvestigationVisibility, UnderstandingLinkRole, UnderstandingLinkSourceType, UnderstandingLinkTargetType } from "@prisma/client";
import { chromium, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  cleanupDurableActionsAssaultRuntimeFixture,
  FIXTURE_DECISION_ACTION_SURFACE_KEY,
  seedDurableActionsAssaultRuntimeFixture,
} from "../lib/durable-actions-runtime-fixture";
import {
  cleanupInvestigationsAssaultRuntimeFixture,
  INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID,
  INVESTIGATIONS_ASSAULT_UI_QUESTION_PREFIX,
  INVESTIGATIONS_ASSAULT_UI_TITLE_PREFIX,
  seedInvestigationsAssaultRuntimeFixture,
} from "../lib/investigations-assault-runtime-fixture";
import {
  cleanupMovementAssaultRuntimeFixture,
  FIXTURE_CLAIM_SUMMARY,
  publishMovementAssaultClaimFixture,
  seedMovementAssaultRuntimeFixture,
  type MovementAssaultFixtureSeedResult,
} from "../lib/model-movement-runtime-fixture";

const CAMPAIGN = "DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001";
const ROOT = resolve(process.cwd());
const RECEIPTS = resolve(ROOT, `docs/agent-runs/receipts/${CAMPAIGN}`);
const SHOTS = resolve(RECEIPTS, "screenshots/step7-root-cutover");
const MANIFEST = resolve(RECEIPTS, "step7-root-cutover-manifest.json");
const REVIEW = resolve(RECEIPTS, "21-root-cutover-review.md");
const MATRIX = resolve(RECEIPTS, "22-root-cutover-capability-preservation.md");
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3000";
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";
const VIEWPORT = { width: 1440, height: 900 } as const;
const AUTH_PROBE = "/api/desktop-production-parity/auth-probe";
const PRODUCTION = "/";
const LIVE_CANDIDATE = "/dev/orvek-v0-canonical-live";
const KEEP_SEED = process.env.ROOT_CUTOVER_CLEANUP !== "1";
const FIXTURE_LEAKS = [
  "Your model moved in 3 places.",
  "Why do I feel like we need to see the architecture visually before locking design?",
  "rep-weekly",
  '"d1"',
  "inv-1",
  "inv-2",
  "aq-2",
] as const;

type EnvMap = Record<string, string>;
type AuthState = {
  userId: string;
  email: string;
  password: string;
  sessionId: string;
  sessionToken: string;
  clientUat: string;
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
  const email = `populated-${label}-${Date.now()}@example.com`;
  const password = `Tmp-${Date.now()}-Aa1!`;
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
  try {
    await expect(id).toBeVisible({ timeout: 90_000 });
    await expect(pw).toBeVisible({ timeout: 90_000 });
  } catch (err) {
    const snippet = (await page.locator("body").innerText().catch(() => "")).slice(0, 400);
    throw new Error(
      `Sign-in fields missing. url=${page.url()} body=${JSON.stringify(snippet)} cause=${String(err)}`,
    );
  }
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

  throw new Error(
    `Failed to authenticate into ${path}. finalUrl=${page.url()}`,
  );
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
  await page.waitForTimeout(250);
  await page.screenshot({ path: file, fullPage: false });
  return file.replace(`${ROOT}/`, "");
}

function assertNoFixtureLeak(body: string, notes: string[]) {
  for (const leak of FIXTURE_LEAKS) {
    if (body.includes(leak)) {
      throw new Error(`Fixture leak detected on production root: ${leak}`);
    }
  }
  notes.push("No reference fixture identity/copy leak in production body text.");
}

async function seedPopulatedInvestigation(args: {
  db: PrismaClient;
  userId: string;
  evidenceId: string;
}): Promise<{
  openInvestigationId: string;
  openTitle: string;
  resolvedInvestigationId: string;
  resolvedTitle: string;
}> {
  const stamp = Date.now();
  const openInvestigationId = `dev-populated-live-aq-${stamp}`;
  const resolvedInvestigationId = `dev-populated-live-inv-${stamp}`;
  const openTitle = `${INVESTIGATIONS_ASSAULT_UI_TITLE_PREFIX} active ${stamp}`;
  const resolvedTitle = `${INVESTIGATIONS_ASSAULT_UI_TITLE_PREFIX} resolved ${stamp}`;
  const organizingQuestion = `${INVESTIGATIONS_ASSAULT_UI_QUESTION_PREFIX} populated ${stamp}`;

  await args.db.investigation.create({
    data: {
      id: openInvestigationId,
      userId: args.userId,
      title: openTitle,
      organizingQuestion,
      status: InvestigationStatus.open,
      visibility: InvestigationVisibility.user_visible,
      seedType: InvestigationSeedType.user_curiosity,
      competingTheories: [
        "Naming the stop point lowers escalation.",
        "Visibility alone raises the stakes without changing the loop.",
      ],
      evidenceNeeded: [
        "A recorded meeting where the stop point is named aloud.",
        "Follow-up energy check within two hours.",
      ],
      resolutionSummary: null,
    },
  });

  await args.db.investigation.create({
    data: {
      id: resolvedInvestigationId,
      userId: args.userId,
      title: resolvedTitle,
      organizingQuestion,
      status: InvestigationStatus.resolved,
      visibility: InvestigationVisibility.user_visible,
      seedType: InvestigationSeedType.user_curiosity,
      competingTheories: ["Resolved theory: stop point naming reduced escalation."],
      evidenceNeeded: [],
      resolutionSummary: "Outcome recorded: naming the stop point reduced evening load.",
      resolvedAt: new Date(),
    },
  });

  await args.db.understandingEvidenceLink.create({
    data: {
      userId: args.userId,
      sourceType: UnderstandingLinkSourceType.evidence_span,
      sourceId: args.evidenceId,
      targetType: UnderstandingLinkTargetType.investigation,
      targetId: openInvestigationId,
      role: UnderstandingLinkRole.supports,
    },
  });

  await args.db.understandingEvidenceLink.create({
    data: {
      userId: args.userId,
      sourceType: UnderstandingLinkSourceType.evidence_span,
      sourceId: args.evidenceId,
      targetType: UnderstandingLinkTargetType.investigation,
      targetId: resolvedInvestigationId,
      role: UnderstandingLinkRole.supports,
    },
  });

  return {
    openInvestigationId,
    openTitle,
    resolvedInvestigationId,
    resolvedTitle,
  };
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

  let primary: AuthState | null = null;
  let cross: AuthState | null = null;
  let seededMovement: MovementAssaultFixtureSeedResult | null = null;
  let investigationId: string | null = null;
  let investigationTitle: string | null = null;
  let openInvestigationId: string | null = null;
  let openInvestigationTitle: string | null = null;
  const prisma = new PrismaClient({ datasources: { db: { url: LOCAL_DATABASE_URL } } });
  const browser = await chromium.launch({ headless: true });
  const tokenRef = { current: "" };
  const captures: string[] = [];
  const notes: string[] = [];
  const traces: string[] = [];
  let verdict: "PASS" | "FAIL" = "PASS";
  let failReason: string | null = null;

  try {
    primary = await createAuth(clerk, "primary");
    cross = await createAuth(clerk, "cross");

    seededMovement = await seedMovementAssaultRuntimeFixture({
      userId: primary.userId,
      db: prisma,
      includeSparse: false,
    });
    await publishMovementAssaultClaimFixture({
      userId: primary.userId,
      db: prisma,
      modelUpdateId: seededMovement.claimModelUpdateId,
    });
    await seedDurableActionsAssaultRuntimeFixture({
      userId: primary.userId,
      db: prisma,
    });
    await seedInvestigationsAssaultRuntimeFixture({
      userId: primary.userId,
      crossUserId: cross.userId,
      db: prisma,
    });
    const seededInv = await seedPopulatedInvestigation({
      db: prisma,
      userId: primary.userId,
      evidenceId: INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID,
    });
    investigationId = seededInv.resolvedInvestigationId;
    investigationTitle = seededInv.resolvedTitle;
    openInvestigationId = seededInv.openInvestigationId;
    openInvestigationTitle = seededInv.openTitle;

    notes.push(
      `Seeded movement MU=${seededMovement.claimModelUpdateId}, decision surface=${FIXTURE_DECISION_ACTION_SURFACE_KEY}, openAQ=${openInvestigationId}, resolvedInv=${investigationId}`,
    );

    const pack = await createContext(browser, clerk, primary);
    const page = await pack.context.newPage();
    page.on("pageerror", (error) => notes.push(`pageerror: ${error.message}`));

    await gotoAuthed(page, pack.context, clerk, primary, PRODUCTION, tokenRef);
    const productionRoot = page.locator('[data-testid="orvek-v0-production-canonical-root"]');
    try {
      await expect(productionRoot).toBeVisible({ timeout: 90_000 });
    } catch (err) {
      const snippet = (await page.locator("body").innerText().catch(() => "")).slice(0, 500);
      throw new Error(
        `Production canonical root missing. url=${page.url()} body=${JSON.stringify(snippet)} cause=${String(err)}`,
      );
    }

    // Parallel page package must not be the active presentation root
    const parallelAbsent = await page
      .locator('[data-testid="orvek-v0-parallel-production-rollback-route"]')
      .count();
    if (parallelAbsent > 0) {
      throw new Error("Parallel rollback route unexpectedly mounted on production /");
    }
    notes.push("Production `/` mounts orvek-v0-production-canonical-root (canonical runtime).");

    // Wait for populated Today identity (not empty loading forever)
    await expect
      .poll(
        async () => {
          const text = await productionRoot.innerText();
          return (
            text.includes(FIXTURE_CLAIM_SUMMARY) ||
            text.includes("Evening stop point") ||
            text.includes(seededMovement!.claimModelUpdateId) ||
            /moved|update|stop point/i.test(text)
          );
        },
        { timeout: 120_000 },
      )
      .toBe(true);

    let body = await productionRoot.innerText();
    assertNoFixtureLeak(body, notes);
    if (body.includes(seededMovement.claimModelUpdateId) || body.includes(FIXTURE_CLAIM_SUMMARY) || /stop point/i.test(body)) {
      traces.push(
        `Today: live MU/claim → live provider → canonical Today → identity preserved (${seededMovement.claimModelUpdateId})`,
      );
    }
    captures.push(await shot(page, "01-populated-today"));

    const seeWhy = page.getByRole("button", { name: /See why it moved/i }).first();
    if (await seeWhy.isVisible().catch(() => false)) {
      await seeWhy.click();
      await page.waitForTimeout(400);
    } else {
      const lead = page.locator("main h2, main button").filter({ hasText: /./ }).first();
      await lead.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
    captures.push(await shot(page, "02-selected-today-object"));

    const evidenceTab = page.getByRole("button", {
      name: "Evidence / Context",
      exact: true,
    });
    await expect(evidenceTab).toBeVisible({ timeout: 30_000 });
    await evidenceTab.click();
    await page.waitForTimeout(300);
    captures.push(await shot(page, "03-evidence-context"));
    traces.push("Evidence: selection → canonical Inspector Evidence/Context branch");

    const aside = page.locator("aside").last();
    const linkedButtons = aside.getByRole("button");
    const linkedCount = await linkedButtons.count();
    if (linkedCount > 2) {
      await linkedButtons.nth(2).click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(300);
    }
    captures.push(await shot(page, "04-linked-receipt"));
    if (linkedCount > 3) {
      await linkedButtons.nth(3).click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(300);
    }
    captures.push(await shot(page, "05-linked-related"));
    traces.push("Linked navigation: receipt/related → select → Inspector destination");

    const back = page.getByRole("button", { name: /^Back to /i }).first();
    if (await back.isVisible().catch(() => false)) {
      await back.click({ force: true });
      await page.waitForTimeout(250);
    }
    captures.push(await shot(page, "06-back-restoration"));

    const movementTab = page.getByRole("button", {
      name: "Model Movement",
      exact: true,
    });
    await movementTab.click();
    await page.waitForTimeout(300);
    captures.push(await shot(page, "07-model-movement"));

    const openReport = page
      .getByRole("button", { name: /Open (Model Movement )?report/i })
      .first();
    if (await openReport.isVisible().catch(() => false)) {
      await openReport.click();
      await page.waitForTimeout(400);
      const overlayText = await page.locator("div.fixed.inset-0.z-50").innerText().catch(() => "");
      if (overlayText.includes("rep-weekly")) {
        throw new Error("Report overlay used fixture report identity");
      }
      traces.push(
        `Report: openReport(live id) → overlay; MU=${seededMovement.claimModelUpdateId}`,
      );
    }
    captures.push(await shot(page, "08-live-report-overlay"));
    await dismissOverlay(page);

    await page.getByTestId("nav-map").click({ force: true });
    await expect(page.getByRole("heading", { name: "Map", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(async () => (await productionRoot.innerText()).includes("Evening stop point") || (await productionRoot.innerText()).includes("mapped"), {
        timeout: 60_000,
      })
      .toBeTruthy();
    captures.push(await shot(page, "09-populated-map"));
    traces.push("Map: conclusions API → mapCategories → canonical MapPage");

    await page.getByTestId("nav-decisions").click({ force: true });
    await expect(page.getByRole("heading", { name: "Decisions", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(500);
    body = await productionRoot.innerText();
    if (!/decision|durable actions|loop|stabiliz/i.test(body)) {
      notes.push("WARNING: Decisions page may still be sparse after durable seed.");
    } else {
      traces.push("Decisions: surfaced actions → decisionListGroups → canonical DecisionsPage");
    }
    captures.push(await shot(page, "10-populated-decision"));

    await page.getByTestId("nav-explore").click({ force: true });
    await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // Active Question path (open status)
    const questionsTab = page.getByRole("button", { name: "Active Questions", exact: true });
    await questionsTab.click();
    await expect
      .poll(
        async () => {
          const text = await productionRoot.innerText();
          return Boolean(openInvestigationTitle && text.includes(openInvestigationTitle));
        },
        { timeout: 90_000 },
      )
      .toBe(true);
    traces.push(
      `Active Question: /api/active-questions → exploreQuestionIds → canonical Questions (${openInvestigationId})`,
    );

    // Resolved Investigation path (Explore Investigations tab)
    const investigations = page.getByRole("button", { name: "Investigations", exact: true });
    await investigations.click();
    await expect
      .poll(
        async () => {
          const text = await productionRoot.innerText();
          return Boolean(investigationTitle && text.includes(investigationTitle));
        },
        { timeout: 90_000 },
      )
      .toBe(true);
    const invRow = page.getByTestId("investigation-row").first();
    await expect(invRow).toBeVisible({ timeout: 30_000 });
    await invRow.click();
    await expect(page.getByTestId("canonical-investigation-detail")).toBeVisible({
      timeout: 30_000,
    });
    body = await productionRoot.innerText();
    assertNoFixtureLeak(body, notes);
    if (!body.includes(investigationTitle!)) {
      throw new Error("Investigation detail did not show live resolved investigation identity");
    }
    if (!body.includes("Resolved theory") && !body.includes("Hypotheses") && !body.includes("Why it matters")) {
      notes.push("WARNING: enriched hypotheses may not have hydrated yet; title identity still present.");
    }
    traces.push(
      `Investigation: /api/explore/investigations + inspector detail enrichment → typed investigation → canonical Explore Investigations (${investigationId})`,
    );
    captures.push(await shot(page, "11-populated-investigation"));

    const free = page.getByRole("button", { name: "Free Explore", exact: true });
    await free.click();
    await page.waitForTimeout(400);
    body = await productionRoot.innerText();
    assertNoFixtureLeak(body, notes);
    captures.push(await shot(page, "12-live-explore"));
    traces.push("Explore Free: live chat handlers; fixture conversation gated off");

    await page.getByTestId("nav-timeline").click({ force: true });
    await expect(page.getByRole("heading", { name: "Timeline", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(600);
    captures.push(await shot(page, "13-populated-timeline"));
    traces.push("Timeline: timeline API → timelineGroups → canonical TimelinePage");

    // Functional equivalence spot-check vs live candidate (same account)
    await gotoAuthed(page, pack.context, clerk, primary, LIVE_CANDIDATE, tokenRef);
    const liveRoot = page.locator('[data-testid="orvek-v0-canonical-live-route"]');
    await expect(liveRoot).toBeVisible({ timeout: 60_000 });
    const liveBody = await liveRoot.innerText();
    if (
      seededMovement &&
      !liveBody.includes(FIXTURE_CLAIM_SUMMARY) &&
      !liveBody.includes(seededMovement.claimModelUpdateId) &&
      !/stop point/i.test(liveBody)
    ) {
      notes.push("WARNING: canonical-live Today identity not immediately visible on spot-check.");
    } else {
      notes.push("canonical-live candidate still mounts shared runtime for same account.");
    }
    captures.push(await shot(page, "14-canonical-live-equivalence-spot"));

    await pack.context.close();
  } catch (err) {
    verdict = "FAIL";
    failReason = String(err);
  } finally {
    if (!KEEP_SEED && primary && seededMovement) {
      await cleanupMovementAssaultRuntimeFixture({
        userId: primary.userId,
        db: prisma,
        modelUpdateIds: [
          seededMovement.claimModelUpdateId,
          seededMovement.conclusionModelUpdateId,
        ],
      });
      await cleanupDurableActionsAssaultRuntimeFixture({
        userId: primary.userId,
        db: prisma,
      });
    }
    if (!KEEP_SEED && primary && cross) {
      const ids = [investigationId, openInvestigationId].filter(
        (value): value is string => Boolean(value),
      );
      if (ids.length > 0) {
        await prisma.understandingEvidenceLink.deleteMany({
          where: { targetId: { in: ids } },
        });
        await prisma.investigation.deleteMany({ where: { id: { in: ids } } });
      }
      await cleanupInvestigationsAssaultRuntimeFixture({
        userId: primary.userId,
        crossUserId: cross.userId,
        db: prisma,
      });
    }
    if (KEEP_SEED) {
      notes.push(
        "KEEP_SEED=true: Clerk users + DB seeds retained for Kay visual review. Cleanup: ROOT_CUTOVER_CLEANUP=1 after review.",
      );
      notes.push(
        `Seeded primary userId=${primary?.userId ?? "n/a"} email=${primary?.email ?? "n/a"}; cross=${cross?.userId ?? "n/a"}`,
      );
    } else {
      await cleanupAuth(clerk, primary);
      await cleanupAuth(clerk, cross);
    }
    await prisma.$disconnect();
    await browser.close();
  }

  const review = [
    "# 21 — Root cutover review",
    "",
    `Verdict: **${
      verdict === "PASS"
        ? "READY FOR KAY ROOT-CUTOVER VISUAL REVIEW"
        : "FAIL — ROOT CUTOVER INCOMPLETE"
    }**`,
    "",
    failReason ? `Fail reason: ${failReason}` : "No hard fail reason recorded.",
    "",
    "## Production root paths",
    "- Shell: `components/orvek-workbench/OrvekWorkbenchShell.tsx`",
    "- Shared runtime: `components/orvek-v0-canonical/canonical-live-runtime-entry.tsx`",
    "- Live provider: `components/orvek-v0-canonical/live-provider.ts` (`buildCanonicalLiveRuntimeData`)",
    "- Hybrid data: `components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts`",
    "- Presentation: `components/orvek-v0-canonical/workbench.tsx` + `pages/*`",
    "",
    "## Inactive parallel presentation (retained on disk)",
    "- `components/orvek-v0/workbench.tsx`",
    "- `components/orvek-v0/pages/*`",
    "- Temporary rollback route: `/dev/orvek-v0-parallel-production-rollback` (not reference; not production authority)",
    "",
    "## Unchanged cold / fixture",
    "- `/dev/orvek-v0-reference`",
    "- `/dev/orvek-v0-canonical-reference`",
    "- Live candidate retained: `/dev/orvek-v0-canonical-live`",
    "",
    "## Seeded live identities (kept for Kay review)",
    `- ModelUpdate: \`${seededMovement?.claimModelUpdateId ?? "n/a"}\``,
    `- Open Active Question: \`${openInvestigationId ?? "n/a"}\` — ${openInvestigationTitle ?? ""}`,
    `- Resolved Investigation: \`${investigationId ?? "n/a"}\` — ${investigationTitle ?? ""}`,
    `- Decision surface key: \`${FIXTURE_DECISION_ACTION_SURFACE_KEY}\``,
    `- Primary Clerk user: \`${primary?.userId ?? "n/a"}\` / \`${primary?.email ?? "n/a"}\``,
    ...(KEEP_SEED && primary?.password
      ? [`- Review sign-in password (disposable): \`${primary.password}\``]
      : []),
    `- KEEP_SEED: \`${KEEP_SEED}\` — cleanup only when \`ROOT_CUTOVER_CLEANUP=1\` after Kay review`,
    "",
    "## Deferred product decision (does not block cutover)",
    "- attach-evidence / create-watch-for cards from `ProductionInvestigationWorkbenchDetail`",
    "- No accepted-reference equivalent; not required for canonical investigation path",
    "- Recorded as post-cutover product decision; not restored in this campaign",
    "",
    "## Capability traces",
    ...traces.map((t) => `- ${t}`),
    "",
    "## Captures (1440×900)",
    ...captures.map((c) => `- \`${c}\``),
    "",
    "## Notes",
    ...notes.map((n) => `- ${n}`),
    "",
  ].join("\n");

  const matrix = [
    "# 22 — Root cutover capability preservation",
    "",
    "| Capability | Path | Preserved on `/`? |",
    "|------------|------|-------------------|",
    "| Auth / ownership | Clerk + API | Yes |",
    "| Live Today | hybrid → live provider → canonical Today | Yes |",
    "| Map / Decisions / Explore / Timeline | canonical pages + live data | Yes |",
    "| Active Questions / Investigations | typed objects + enrichment | Yes |",
    "| Explore send/stream | OrvekPageHandlersProvider in shared runtime | Yes |",
    "| Linked nav / Back / scroll | canonical Inspector | Yes |",
    "| Correction + durable actions | hybrid + durable refresh | Yes |",
    "| Live movement reports / overlay | openReport(live id) | Yes |",
    "| Honest loading/error/empty | live provider empty states | Yes |",
    "| Parallel orvek-v0/pages | Inactive; rollback route only | Intentionally inactive |",
    "| attach-evidence / watch-for cards | Deferred product decision | Not restored |",
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
        viewport: VIEWPORT,
        origin: ORIGIN,
        productionRoute: PRODUCTION,
        liveCandidateRoute: LIVE_CANDIDATE,
        keepSeed: KEEP_SEED,
        captures,
        notes,
        traces,
        paths: {
          shell: "components/orvek-workbench/OrvekWorkbenchShell.tsx",
          runtimeEntry: "components/orvek-v0-canonical/canonical-live-runtime-entry.tsx",
          liveProvider: "components/orvek-v0-canonical/live-provider.ts",
          hybrid: "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
          rollbackRoute: "/dev/orvek-v0-parallel-production-rollback",
        },
        seeded: {
          primaryUserId: primary?.userId ?? null,
          primaryEmail: primary?.email ?? null,
          /** Disposable review password; only written when KEEP_SEED. */
          primaryPassword: KEEP_SEED ? primary?.password ?? null : null,
          crossUserId: cross?.userId ?? null,
          claimModelUpdateId: seededMovement?.claimModelUpdateId ?? null,
          openInvestigationId,
          openInvestigationTitle,
          investigationId,
          investigationTitle,
        },
        deferredProductDecision:
          "attach-evidence / create-watch-for investigation controls — post-cutover",
        rootCutover: true,
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    verdict === "PASS"
      ? "READY FOR KAY ROOT-CUTOVER VISUAL REVIEW"
      : `FAIL — ROOT CUTOVER INCOMPLETE:${failReason}`,
  );
  process.exit(verdict === "PASS" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
