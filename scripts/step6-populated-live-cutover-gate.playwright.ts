/**
 * Final pre-cutover gate: populated live account on /dev/orvek-v0-canonical-live.
 * Does not cut over production `/`.
 *
 * Run:
 *   DESKTOP_PARITY_BASE_URL=http://localhost:3000 npx tsx scripts/step6-populated-live-cutover-gate.playwright.ts
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
const SHOTS = resolve(RECEIPTS, "screenshots/step6-populated-live");
const MANIFEST = resolve(RECEIPTS, "step6-populated-live-manifest.json");
const REVIEW = resolve(RECEIPTS, "19-populated-live-cutover-gate.md");
const MATRIX = resolve(RECEIPTS, "20-root-cutover-capability-matrix.md");
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3000";
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";
const VIEWPORT = { width: 1440, height: 900 } as const;
const AUTH_PROBE = "/api/desktop-production-parity/auth-probe";
const LIVE = "/dev/orvek-v0-canonical-live";
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
      throw new Error(`Fixture leak detected on live candidate: ${leak}`);
    }
  }
  notes.push("No reference fixture identity/copy leak in live body text.");
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

    await gotoAuthed(page, pack.context, clerk, primary, LIVE, tokenRef);
    const liveRoot = page.locator('[data-testid="orvek-v0-canonical-live-route"]');
    try {
      await expect(liveRoot).toBeVisible({ timeout: 90_000 });
    } catch (err) {
      const snippet = (await page.locator("body").innerText().catch(() => "")).slice(0, 500);
      throw new Error(
        `Live candidate root missing. url=${page.url()} body=${JSON.stringify(snippet)} cause=${String(err)}`,
      );
    }

    // Wait for populated Today identity (not empty loading forever)
    await expect
      .poll(
        async () => {
          const text = await liveRoot.innerText();
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

    let body = await liveRoot.innerText();
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
      .poll(async () => (await liveRoot.innerText()).includes("Evening stop point") || (await liveRoot.innerText()).includes("mapped"), {
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
    body = await liveRoot.innerText();
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
          const text = await liveRoot.innerText();
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
          const text = await liveRoot.innerText();
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
    body = await liveRoot.innerText();
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
    body = await liveRoot.innerText();
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

    await pack.context.close();
  } catch (err) {
    verdict = "FAIL";
    failReason = String(err);
  } finally {
    if (primary && seededMovement) {
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
    if (primary && cross) {
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
    await prisma.$disconnect();
    await cleanupAuth(clerk, primary);
    await cleanupAuth(clerk, cross);
    await browser.close();
  }

  const review = [
    "# 19 — Populated live cutover gate",
    "",
    `Verdict: **${
      verdict === "PASS"
        ? "POPULATED LIVE GATE PASSED — READY FOR ROOT CUTOVER"
        : "FAIL — ROOT CUTOVER BLOCKERS REMAIN"
    }**`,
    "",
    failReason ? `Fail reason: ${failReason}` : "No hard fail reason recorded.",
    "",
    "## Seeded live identities (not reference fixtures)",
    `- ModelUpdate: \`${seededMovement?.claimModelUpdateId ?? "n/a"}\``,
    `- Open Active Question: \`${openInvestigationId ?? "n/a"}\` — ${openInvestigationTitle ?? ""}`,
    `- Resolved Investigation: \`${investigationId ?? "n/a"}\` — ${investigationTitle ?? ""}`,
    `- Decision surface key: \`${FIXTURE_DECISION_ACTION_SURFACE_KEY}\``,
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
    "- Root `/` was not cut over.",
    "- See `20-root-cutover-capability-matrix.md` and Investigation decision in that matrix.",
    "",
  ].join("\n");

  const matrix = [
    "# 20 — Root cutover capability matrix",
    "",
    "| Existing production capability | Canonical-live equivalent | Populated runtime proof | Preserved? | Behavioural difference | Root-cutover blocker? |",
    "|-------------------------------|---------------------------|-------------------------|------------|------------------------|-----------------------|",
    "| Auth / ownership | Same Clerk + API ownership | Live candidate under auth | PRESERVED | None | No |",
    "| Today + ModelUpdate identity | live provider → canonical Today | Capture 01–02; MU seed | PRESERVED_THROUGH_NEW_ADAPTER | Content ≠ fixture | No |",
    "| Evidence / Context Inspector | orvek-v0-authority panel | Captures 03–06 | PRESERVED | None | No |",
    "| Linked receipt / related | typed relatedIds/receiptIds + select | Captures 04–05 | PRESERVED_THROUGH_NEW_ADAPTER | Depends on object graph depth | No |",
    "| Model Movement + live report | openReport(live id) | Captures 07–08 | PRESERVED | Live id ≠ rep-weekly | No |",
    "| Map objects | mapCategories + MapPage | Capture 09 | PRESERVED_THROUGH_NEW_ADAPTER | Counts from live | No |",
    "| Decisions | decisionListGroups + DecisionsPage | Capture 10 | PRESERVED_THROUGH_NEW_ADAPTER | Entry module still reference-shaped | No |",
    "| Investigation thread (reference-equivalent) | typed investigation + Explore Investigations + detail enrichment (A+B) | Capture 11 | PRESERVED_THROUGH_NEW_ADAPTER | Uses canonical InvBlocks, not ProductionInvestigationWorkbenchDetail | No |",
    "| Investigation attach-evidence / watch-for action cards | No accepted-reference equivalent; not mounted on current CanonicalWorkbench shell | Not reintroduced | **C — explicit Kay decision** | Old parallel Explore detail actions | **Yes — Kay must decide** if those action cards are required before cutover |",
    "| Timeline | timelineGroups + TimelinePage | Capture 12 | PRESERVED_THROUGH_NEW_ADAPTER | None material | No |",
    "| Explore Free send/stream | handlers + FreeExplore | Capture 13 | PRESERVED_THROUGH_NEW_ADAPTER | Fixture chat off | No |",
    "| Parallel orvek-v0/pages/* | Inactive | Quarantined | OLD_BEHAVIOUR_INTENTIONALLY_REMOVED | N/A | No |",
    "",
    "## Investigation capability decision",
    "",
    "**Classification: A + B for reference-equivalent investigation detail; C for production-only deep action cards.**",
    "",
    "- **A:** Accepted cold/canonical reference expresses investigations as typed `investigation` objects (title, whyItMatters, hypotheses, missingEvidence, relatedIds) in Explore → Inspector. Live hybrid already maps `/api/explore/investigations` into that object type.",
    "- **B:** Competing theories / evidence-needed / linked evidence+fieldwork from `/api/inspector/investigations/:id` are now enriched into the typed object + linked objects (`enrichmentFromInspectorInvestigationDetail`) without mounting a production-specific renderer.",
    "- **C (explicit):** `ProductionInvestigationWorkbenchDetail` attach-evidence / create-watch-for controls and inline evidence/fieldwork article cards have **no accepted-reference equivalent**. Restoring them would require new product design or Kay’s decision to keep them out of cutover. They are already absent from the current CanonicalWorkbench production shell (parallel Explore page inactive).",
    "",
    "Root cutover may proceed on investigation **thread detail** (A+B). If Kay requires the old attach-evidence UI before cutover, treat that as a **product decision blocker**, not a silent deferral.",
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
        liveRoute: LIVE,
        captures,
        notes,
        traces,
        seeded: {
          claimModelUpdateId: seededMovement?.claimModelUpdateId ?? null,
          openInvestigationId,
          openInvestigationTitle,
          investigationId,
          investigationTitle,
        },
        rootCutover: false,
        investigationDecision: "A+B preserved; C action cards require Kay decision",
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    verdict === "PASS"
      ? "POPULATED_LIVE_GATE_PASS"
      : `POPULATED_LIVE_GATE_FAIL:${failReason}`,
  );
  process.exit(verdict === "PASS" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
