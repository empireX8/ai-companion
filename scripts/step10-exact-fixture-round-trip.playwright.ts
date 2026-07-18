/**
 * Exact fixture round-trip gate (replaces approximate semantic-twin pass).
 *
 * Compares ONLY:
 *   /dev/orvek-v0-canonical-reference
 *   /dev/orvek-v0-canonical-live
 *
 * Run:
 *   ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1 DESKTOP_PARITY_BASE_URL=http://localhost:3000 \
 *     SEMANTIC_TWIN_CLEANUP=1 npx tsx scripts/step10-exact-fixture-round-trip.playwright.ts
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { chromium, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  compareExactTodayComposition,
  normalizeTodayMovementsForCompare,
  type ExactMismatch,
  type LiveTodayCompareSlice,
} from "../lib/exact-fixture-round-trip-compare";
import { formatExactRoundTripGapsMarkdown } from "../lib/exact-fixture-round-trip-gaps";
import { buildExactFixtureManifest } from "../lib/exact-fixture-round-trip-manifest";
import {
  cleanupExactFixtureRoundTrip,
  seedExactFixtureRoundTrip,
  type ExactRoundTripSeedResult,
} from "../lib/exact-fixture-round-trip-seed";

const CAMPAIGN = "DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001";
const ROOT = resolve(process.cwd());
const RECEIPTS = resolve(ROOT, `docs/agent-runs/receipts/${CAMPAIGN}`);
const SHOTS = resolve(RECEIPTS, "screenshots/step10-exact-round-trip");
const REVIEW = resolve(RECEIPTS, "29-exact-fixture-round-trip-gate.md");
const MANIFEST_OUT = resolve(RECEIPTS, "step10-exact-round-trip-manifest.json");
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3000";
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";
const VIEWPORT = { width: 1440, height: 900 } as const;
const AUTH_PROBE = "/api/desktop-production-parity/auth-probe";
const FIXTURE = "/dev/orvek-v0-canonical-reference";
const LIVE = "/dev/orvek-v0-canonical-live";
const KEEP_SEED = process.env.SEMANTIC_TWIN_CLEANUP !== "1";

const PASS = "EXACT ROUND-TRIP PASSED — PRODUCTION CAN REPRESENT CANONICAL CONTRACT";
const FAIL = "FAIL — CANONICAL DATA CONTRACTS STILL INCOMPLETE";

type EnvMap = Record<string, string>;
type AuthState = {
  userId: string;
  email: string;
  password: string;
  sessionId: string;
  sessionToken: string;
  clientUat: string;
};

type DomTodaySlice = LiveTodayCompareSlice & {
  url: string;
  pathname: string;
  leadTitle: string;
  bodyText: string;
};

type WalkState = {
  id: string;
  label: string;
  fixture?: DomTodaySlice;
  live?: DomTodaySlice;
  mismatches: ExactMismatch[];
  screenshotFixture?: string;
  screenshotLive?: string;
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
  const email = `exact-rt-${label}-${Date.now()}@example.com`;
  const password = `ExactRt-${Date.now()}-Aa1!`;
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
  return { context };
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
    if ((await probe(page, auth.userId)) && !page.url().includes("/sign-in")) return;
    tokenRef.current = (await clerk.testingTokens.createTestingToken()).token;
    await context.addCookies([
      { name: "__clerk_db_jwt", value: tokenRef.current, url: ORIGIN },
    ]);
  }
  throw new Error(`Failed to authenticate into ${path}`);
}

async function assertIsolated(page: Page, prefix: string) {
  const pathname = new URL(page.url()).pathname;
  if (!pathname.startsWith(prefix)) {
    throw new Error(`ROUTE ESCAPE: expected ${prefix}, got ${pathname}`);
  }
}

async function shot(page: Page, name: string) {
  const file = resolve(SHOTS, `${name}.png`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: file, fullPage: false });
  return file.replace(`${ROOT}/`, "");
}

/** Extract Today composition texts from the canonical Today DOM. */
async function captureTodayDom(page: Page): Promise<DomTodaySlice> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const text = main?.innerText ?? document.body.innerText ?? "";
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const briefingTitle =
      lines.find((l) => /Your model moved in \d+ places?\./.test(l)) ?? "";
    const briefingLine =
      lines.find((l) => /since your last visit/i.test(l)) ?? "";
    const briefingMetaIdx = lines.findIndex((l) => l === briefingTitle);
    const briefingMeta =
      briefingMetaIdx >= 0 ? (lines[briefingMetaIdx + 1] ?? "") : "";

    const leadTitle = document.querySelector("main h2")?.textContent?.trim() ?? "";

    // Lead narrative = first muted paragraph under h2
    let leadNarrative = "";
    const h2 = document.querySelector("main h2");
    if (h2) {
      const block = h2.closest("div")?.parentElement ?? h2.parentElement;
      const p = block?.querySelector("p");
      leadNarrative = p?.textContent?.trim() ?? "";
    }

    // dl grid: What changed / Linked receipts / Last evidence
    let leadWhatChanged = "";
    let leadLastEvidence = "";
    for (const dt of Array.from(document.querySelectorAll("main dt"))) {
      const label = (dt.textContent ?? "").trim().toLowerCase();
      const dd = dt.nextElementSibling?.textContent?.trim() ?? "";
      if (label.includes("what changed")) leadWhatChanged = dd;
      if (label.includes("last evidence")) leadLastEvidence = dd;
    }

    // Kicker above lead
    let leadKicker = "";
    const kickerEl = Array.from(document.querySelectorAll("main *")).find((el) =>
      /Most consequential now/i.test((el.textContent ?? "").trim()) &&
      (el.textContent ?? "").trim().length < 120,
    );
    leadKicker = kickerEl?.textContent?.trim() ?? "";

    const reportBtn = Array.from(
      document.querySelectorAll("aside button, main button"),
    ).find((b) => /Weekly Model Movement report/i.test(b.textContent ?? ""));
    let reportTitle = "";
    let reportMeta = "";
    if (reportBtn) {
      const spans = Array.from(reportBtn.querySelectorAll("span")).map((s) =>
        (s.textContent ?? "").trim(),
      );
      reportTitle =
        spans.find((s) => /^Weekly Model Movement report$/i.test(s)) ??
        "Weekly Model Movement report";
      reportMeta = spans.find((s) => /^Ready ·/i.test(s)) ?? "";
    }

    const nowRowTitles: string[] = [];
    const nowRowKickers: string[] = [];
    const nowRowStatuses: string[] = [];
    for (const btn of Array.from(document.querySelectorAll("main button[aria-label]"))) {
      const label = btn.getAttribute("aria-label") ?? "";
      const m = label.match(/^(Watch For|Fieldwork|Outcome review|Open question):\s*(.+)$/i);
      if (!m) continue;
      nowRowKickers.push(m[1]!);
      nowRowTitles.push(m[2]!);
      const badge = Array.from(btn.querySelectorAll("span")).find((s) =>
        /rounded-full|ring-action/i.test(s.className),
      );
      nowRowStatuses.push((badge?.textContent ?? "").trim());
    }

    // Movement cards: outer o-material cards (not the inner Previously/Updated grid)
    const movements: Array<{ previous: string; updated: string; evidence: string }> = [];
    const cards = Array.from(document.querySelectorAll("main div")).filter((el) => {
      if (typeof el.className !== "string") return false;
      if (!el.className.includes("o-material")) return false;
      const t = el.textContent ?? "";
      return (
        /Previously/i.test(t) &&
        /Updated understanding/i.test(t) &&
        /See why/i.test(t)
      );
    });
    for (const card of cards.slice(0, 3)) {
      const raw = (card as HTMLElement).innerText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const prevIdx = raw.findIndex((l) => /^Previously$/i.test(l));
      const updIdx = raw.findIndex((l) => /^Updated understanding$/i.test(l));
      const previous = prevIdx >= 0 ? (raw[prevIdx + 1] ?? "") : "";
      const updated = updIdx >= 0 ? (raw[updIdx + 1] ?? "") : "";
      const seeWhyIdx = raw.findIndex((l) => /^See why/i.test(l));
      const evidence =
        seeWhyIdx > 0
          ? raw
              .slice(updIdx >= 0 ? updIdx + 2 : 0, seeWhyIdx)
              .filter(
                (l) =>
                  l &&
                  !/^Previously$/i.test(l) &&
                  !/^Updated understanding$/i.test(l),
              )
              .at(-1) ?? ""
          : "";
      if (previous || updated || evidence) {
        movements.push({ previous, updated, evidence });
      }
    }

    const primaryActionLabels = Array.from(document.querySelectorAll("main button[aria-label]"))
      .map((b) => b.getAttribute("aria-label") ?? "")
      .filter((l) =>
        /Continue from what changed|Add what happened|Review outcome|Check in on fieldwork|Capture new signal/i.test(
          l,
        ),
      );

    const resurfacedTitles: string[] = [];
    const resurfacedHeading = Array.from(document.querySelectorAll("main *")).find((el) =>
      /^Receipts resurfaced$/i.test((el.textContent ?? "").trim()),
    );
    if (resurfacedHeading) {
      let node: Element | null = resurfacedHeading.parentElement;
      while (node && resurfacedTitles.length < 3) {
        for (const btn of Array.from(node.querySelectorAll("button"))) {
          const t = (btn.textContent ?? "").replace(/\s+/g, " ").trim();
          if (t && !/Receipts resurfaced/i.test(t) && resurfacedTitles.length < 3) {
            resurfacedTitles.push(t.split("·")[0]?.trim() || t);
          }
        }
        node = node.nextElementSibling;
        if (resurfacedTitles.length >= 3) break;
      }
    }

    return {
      url: window.location.href,
      pathname: window.location.pathname,
      briefingLine,
      briefingTitle,
      briefingMeta,
      leadTitle,
      leadNarrative,
      leadWhatChanged,
      leadLastEvidence,
      leadKicker,
      nowRowTitles,
      nowRowKickers,
      nowRowStatuses,
      movements: movements.map((m, order) => ({ order, ...m })),
      resurfacedTitles,
      reportTitle,
      reportMeta,
      reportPresent: Boolean(reportTitle.trim()),
      primaryActionLabels,
      bodyText: text.slice(0, 4000),
    };
  });
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const fixtureManifest = buildExactFixtureManifest();
  const env = readEnv();
  process.env.DATABASE_URL = LOCAL_DATABASE_URL;
  process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
  if (process.env.NODE_ENV === "production") process.env.NODE_ENV = "test";

  const clerk = createClerkClient({
    secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
    publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
  });

  let auth: AuthState | null = null;
  let seeded: ExactRoundTripSeedResult | null = null;
  const prisma = new PrismaClient({ datasources: { db: { url: LOCAL_DATABASE_URL } } });
  const browser = await chromium.launch({ headless: true });
  const tokenRef = { current: "" };
  const walk: WalkState[] = [];
  const notes: string[] = [];
  let allMismatches: ExactMismatch[] = [];
  let hardError: string | null = null;

  try {
    auth = await createAuth(clerk, "primary");
    seeded = await seedExactFixtureRoundTrip({ userId: auth.userId, db: prisma });
    notes.push(
      `Seeded exact round-trip composition for ${auth.userId}; report=${seeded.reportId}; movements=${seeded.movementIds.join(",")}`,
    );
    notes.push(
      `Controlled timestamps: reportGeneratedAt=${seeded.controlledTimestamps.reportGeneratedAt}`,
    );
    notes.push(`fixtureIdMap keys=${Object.keys(seeded.fixtureIdMap).length}`);

    const pack = await createContext(browser, clerk, auth);
    const page = await pack.context.newPage();

    // ── FIXTURE Today ──
    await gotoAuthed(page, pack.context, clerk, auth, FIXTURE, tokenRef);
    await assertIsolated(page, FIXTURE);
    await expect(page.getByText("Your model moved in 3 places.")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Weekly Model Movement report")).toBeVisible();
    const fixtureToday = await captureTodayDom(page);
    const shotFix = await shot(page, "01-today-top-fixture");

    // ── LIVE Today ──
    await gotoAuthed(page, pack.context, clerk, auth, LIVE, tokenRef);
    await assertIsolated(page, LIVE);
    const liveRoot = page.locator('[data-testid="orvek-v0-canonical-live-route"]');
    await expect(liveRoot).toBeVisible({ timeout: 90_000 });
    await expect
      .poll(async () => /Your model moved in \d+ places?\./.test(await liveRoot.innerText()), {
        timeout: 120_000,
      })
      .toBe(true);
    for (const nav of ["map", "decisions", "explore", "timeline", "today"] as const) {
      await page.getByTestId(`nav-${nav}`).click();
      await page.waitForTimeout(200);
      await assertIsolated(page, LIVE);
    }

    await expect(page.getByText("Your model moved in 3 places.")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Recent model movement/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Weekly Model Movement report")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByText(/Recent model movement/i).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const evidenceProbe = await page.evaluate(() => {
      const body = document.body.innerText;
      return {
        hasMu1Evidence: body.includes(
          "6 receipts tied pressure to repeated scope reopening.",
        ),
        hasMu2Evidence: body.includes(
          "Recent captures referenced current build constraints directly.",
        ),
        hasAqEvidence: body.includes(
          "A decision review added social-consequence detail.",
        ),
      };
    });
    notes.push(`evidenceProbe=${JSON.stringify(evidenceProbe)}`);
    const liveToday = await captureTodayDom(page);
    const shotLive = await shot(page, "01-today-top-live");

    const fixtureExpected = fixtureManifest.today;
    // Normalize case for CSS-uppercased briefing line capture
    if (liveToday.briefingLine) {
      const expected = fixtureExpected.briefingLine;
      if (
        liveToday.briefingLine.toLowerCase() === expected.toLowerCase() &&
        liveToday.briefingLine !== expected
      ) {
        liveToday.briefingLine = expected;
      }
    }

    const liveMismatches = compareExactTodayComposition(fixtureExpected, {
      briefingLine: liveToday.briefingLine,
      briefingTitle: liveToday.briefingTitle,
      briefingMeta: liveToday.briefingMeta,
      leadNarrative: liveToday.leadNarrative,
      leadWhatChanged: liveToday.leadWhatChanged,
      leadLastEvidence: liveToday.leadLastEvidence,
      leadKicker: liveToday.leadKicker,
      nowRowTitles: liveToday.nowRowTitles,
      nowRowKickers: liveToday.nowRowKickers,
      nowRowStatuses: liveToday.nowRowStatuses,
      movements: normalizeTodayMovementsForCompare(liveToday.movements ?? []),
      reportTitle: liveToday.reportTitle,
      reportMeta: liveToday.reportMeta,
      reportPresent: liveToday.reportPresent,
      primaryActionLabels: liveToday.primaryActionLabels,
      resurfacedTitles: liveToday.resurfacedTitles,
    });

    // Lead title exact (fixture object d1 title)
    const fixtureLeadTitle =
      fixtureManifest.objects.find((o) => o.id === fixtureExpected.leadId)?.title ?? "";
    if (fixtureLeadTitle && liveToday.leadTitle !== fixtureLeadTitle) {
      liveMismatches.push({
        path: "today.leadTitle",
        fixture: fixtureLeadTitle,
        live: liveToday.leadTitle,
      });
    }

    // Report card must be present on both (never omitted)
    if (!fixtureToday.reportPresent) {
      liveMismatches.push({
        path: "fixture.report.present",
        fixture: "true",
        live: String(fixtureToday.reportPresent),
      });
    }
    if (!liveToday.reportPresent) {
      liveMismatches.push({
        path: "live.report.present",
        fixture: "true",
        live: "false — report card missing or untitled",
      });
    }

    allMismatches = liveMismatches;
    walk.push({
      id: "1-today-top",
      label: "Today top",
      fixture: fixtureToday,
      live: liveToday,
      mismatches: liveMismatches,
      screenshotFixture: shotFix,
      screenshotLive: shotLive,
    });

    // Movement-only exact dump for receipt
    notes.push(
      `Fixture movements (manifest): ${JSON.stringify(fixtureExpected.movements)}`,
    );
    notes.push(`Live DOM movements: ${JSON.stringify(liveToday.movements)}`);
    notes.push(
      `Report fixture="${fixtureExpected.reportTitle}" / "${fixtureExpected.reportMeta}"`,
    );
    notes.push(`Report live="${liveToday.reportTitle}" / "${liveToday.reportMeta}"`);
    notes.push(`Lead fixture="${fixtureLeadTitle}" live="${liveToday.leadTitle}"`);

    // Quick walkthrough samples (isolation + screenshots) — still FAIL if Today mismatches
    const states: Array<{ id: string; label: string; run: () => Promise<void> }> = [
      {
        id: "4-recent-movement",
        label: "Recent Model Movement",
        run: async () => {
          await page.getByText("Recent model movement").first().scrollIntoViewIfNeeded();
        },
      },
      {
        id: "5-see-why",
        label: "First movement See why",
        run: async () => {
          const btn = page.getByRole("button", { name: /^See why$/i }).first();
          if (await btn.isVisible().catch(() => false)) await btn.click();
        },
      },
      {
        id: "12-model-movement-tab",
        label: "Model Movement tab",
        run: async () => {
          const tab = page.getByRole("button", { name: "Model Movement", exact: true });
          if (await tab.isVisible().catch(() => false)) await tab.click();
        },
      },
      {
        id: "13-report-overlay",
        label: "Report overlay",
        run: async () => {
          await page.getByTestId("nav-today").click();
          await page.waitForTimeout(300);
          const report = page
            .getByRole("button", {
              name: /Weekly Model Movement report|What Changed|published movement/i,
            })
            .first();
          if (await report.isVisible().catch(() => false)) {
            await report.click();
            await page.waitForTimeout(400);
          }
        },
      },
      {
        id: "15-map",
        label: "Map",
        run: async () => {
          await page.keyboard.press("Escape").catch(() => undefined);
          await page.getByTestId("nav-map").click();
        },
      },
      {
        id: "17-decision",
        label: "Decision",
        run: async () => {
          await page.getByTestId("nav-decisions").click();
        },
      },
      {
        id: "20-timeline",
        label: "Timeline",
        run: async () => {
          await page.getByTestId("nav-timeline").click();
        },
      },
    ];

    for (const s of states) {
      await s.run();
      await page.waitForTimeout(350);
      await assertIsolated(page, LIVE);
      const shotPath = await shot(page, `${s.id}-live`);
      walk.push({
        id: s.id,
        label: s.label,
        live: await captureTodayDom(page).catch(() => undefined),
        mismatches: [],
        screenshotLive: shotPath,
      });
    }

    await pack.context.close();
  } catch (err) {
    hardError = String(err);
  } finally {
    if (!KEEP_SEED && auth && seeded) {
      await cleanupExactFixtureRoundTrip({
        userId: auth.userId,
        db: prisma,
      });
      await cleanupAuth(clerk, auth);
    } else if (KEEP_SEED && auth) {
      notes.push(`KEEP_SEED user=${auth.userId} email=${auth.email} password=${auth.password}`);
    }
    await prisma.$disconnect();
    await browser.close();
  }

  const passed = !hardError && allMismatches.length === 0;
  const verdict = passed ? PASS : FAIL;

  const review = [
    `# 29 — Exact fixture round-trip gate`,
    ``,
    `Verdict: **${verdict}**`,
    ``,
    `Prior approximate twin pass (receipt 27) is **rejected** by Kay. Report card omission is **retracted** — canonical Today always renders the report button; providers must supply title/meta/id.`,
    ``,
    hardError ? `Hard error: ${hardError}` : `Hard error: none`,
    ``,
    `## Exact Today mismatches (${allMismatches.length})`,
    ...(allMismatches.length
      ? allMismatches.map(
          (m) =>
            `- \`${m.path}\`\n  - fixture: ${JSON.stringify(m.fixture)}\n  - live: ${JSON.stringify(m.live)}`,
        )
      : ["- none"]),
    ``,
    `## Missing production storage/API contracts`,
    formatExactRoundTripGapsMarkdown(),
    ``,
    `## Walkthrough captures`,
    ...walk.map(
      (w) =>
        `- **${w.id}** ${w.label}: mismatches=${w.mismatches.length}` +
        (w.screenshotLive ? ` · \`${w.screenshotLive}\`` : "") +
        (w.screenshotFixture ? ` · \`${w.screenshotFixture}\`` : ""),
    ),
    ``,
    `## Notes`,
    ...notes.map((n) => `- ${n}`),
    ``,
    `Allowed differences only: internal DB IDs, auth/session IDs, controlled timestamps listed in notes.`,
    ``,
  ].join("\n");

  writeFileSync(REVIEW, review);
  writeFileSync(
    MANIFEST_OUT,
    `${JSON.stringify(
      {
        verdict,
        hardError,
        mismatchCount: allMismatches.length,
        mismatches: allMismatches,
        walk,
        notes,
        seeded: {
          userId: auth?.userId ?? null,
          email: KEEP_SEED ? auth?.email ?? null : null,
          reportId: seeded?.reportId ?? null,
          movementIds: seeded?.movementIds ?? [],
          controlledTimestamps: seeded?.controlledTimestamps ?? null,
        },
        retracted: "SEMANTIC TWIN GATE PASSED (receipt 27) — approximate; report card omitted",
        contracts: "see 30-root-cause-canonical-data-contract-map.md",
      },
      null,
      2,
    )}\n`,
  );

  console.log(verdict);
  if (!passed && allMismatches[0]) {
    console.log(`first_mismatch: ${allMismatches[0].path}`);
  }
  if (hardError) console.log(`hard_error: ${hardError}`);
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
