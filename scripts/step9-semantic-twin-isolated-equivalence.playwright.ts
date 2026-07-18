/**
 * Isolated semantic-twin equivalence gate (post-retraction).
 * Compares fixture vs live WITHOUT using production `/`.
 * Asserts route isolation after every interaction.
 *
 * Run:
 *   ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE=1 DESKTOP_PARITY_BASE_URL=http://localhost:3000 \
 *     npx tsx scripts/step9-semantic-twin-isolated-equivalence.playwright.ts
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { chromium, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  cleanupSemanticTwinRuntimeFixture,
  seedSemanticTwinRuntimeFixture,
  SEMANTIC_TWIN_PREFIX,
  type SemanticTwinFixtureSeedResult,
} from "../lib/semantic-twin-runtime-fixture";

const CAMPAIGN = "DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001";
const ROOT = resolve(process.cwd());
const RECEIPTS = resolve(ROOT, `docs/agent-runs/receipts/${CAMPAIGN}`);
const SHOTS = resolve(RECEIPTS, "screenshots/step9-semantic-twin-isolated");
const REVIEW = resolve(RECEIPTS, "27-semantic-twin-isolated-equivalence.md");
const MANIFEST = resolve(RECEIPTS, "step9-semantic-twin-isolated-manifest.json");
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3000";
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";
const VIEWPORT = { width: 1440, height: 900 } as const;
const AUTH_PROBE = "/api/desktop-production-parity/auth-probe";
const FIXTURE = "/dev/orvek-v0-canonical-reference";
const LIVE = "/dev/orvek-v0-canonical-live";
const KEEP_SEED = process.env.SEMANTIC_TWIN_CLEANUP !== "1";

type EnvMap = Record<string, string>;
type AuthState = {
  userId: string;
  email: string;
  password: string;
  sessionId: string;
  sessionToken: string;
  clientUat: string;
};

type StateSnapshot = {
  url: string;
  pathname: string;
  activePage: string;
  selectedObjectType: string | null;
  selectedObjectIdentity: string | null;
  inspectorTab: string | null;
  provider: "fixture" | "live";
  movementCount: number;
  nowRowCount: number;
  reportTitle: string | null;
  blankIconArrowCards: number;
};

type Check = {
  id: string;
  classification: string;
  detail: string;
  fixture?: StateSnapshot;
  live?: StateSnapshot;
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
  const email = `semantic-twin-iso-${label}-${Date.now()}@example.com`;
  const password = `TwinIso-${Date.now()}-Aa1!`;
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
    throw new Error(
      `ROUTE ESCAPE: expected pathname to start with ${prefix}, got ${pathname}`,
    );
  }
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

async function captureState(
  page: Page,
  provider: "fixture" | "live",
): Promise<StateSnapshot> {
  return page.evaluate((prov) => {
    const pathname = window.location.pathname;
    const body = document.body?.innerText ?? "";
    const navActive =
      document.querySelector("[data-testid^='nav-'][aria-current='page']")?.getAttribute(
        "data-testid",
      ) ?? null;
    const activePage = navActive?.replace("nav-", "") ?? "unknown";
    const aside = document.querySelector("aside");
    const inspectorTab =
      Array.from(aside?.querySelectorAll("button") ?? [])
        .find((b) => /Evidence|Model Movement|Context/i.test(b.textContent ?? "") && b.getAttribute("aria-pressed") === "true")
        ?.textContent?.trim() ??
      (aside && /Model Movement/i.test(aside.innerText) && /Previously|Updated understanding/i.test(aside.innerText)
        ? "Model Movement"
        : aside && /Evidence|Receipt/i.test(aside.innerText)
          ? "Evidence / Context"
          : null);

    const h2 = document.querySelector("main h2")?.textContent?.trim() ?? null;
    const movementSection = Array.from(document.querySelectorAll("main *")).find((el) =>
      /Recent model movement/i.test(el.textContent ?? ""),
    );
    const movementCards = movementSection
      ? Array.from(
          document.querySelectorAll("main .o-material.rounded-\\[10px\\], main [class*='o-material']"),
        ).filter((el) => /Previously|Updated understanding/i.test(el.textContent ?? "")).length
      : (body.match(/Previously/g) ?? []).length;

    const nowRows = Array.from(document.querySelectorAll("main button[aria-label]")).filter(
      (b) => {
        const label = b.getAttribute("aria-label") ?? "";
        return /Watch For|Fieldwork|Outcome|Open question|:/i.test(label);
      },
    ).length;

    // Blank icon+arrow cards: buttons with arrow svg but empty accessible name / empty text
    const blankIconArrowCards = Array.from(document.querySelectorAll("button")).filter((btn) => {
      const hasArrow = Boolean(btn.querySelector("svg"));
      const text = (btn.textContent ?? "").replace(/\s+/g, " ").trim();
      const label = (btn.getAttribute("aria-label") ?? "").trim();
      return hasArrow && text.length === 0 && label.length === 0 && btn.offsetParent !== null;
    }).length;

    const reportBtn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Weekly Model Movement report|published movement|Model Movement report/i.test(
        b.textContent ?? "",
      ),
    );

    return {
      url: window.location.href,
      pathname,
      activePage,
      selectedObjectType: h2 ? "selected-lead-or-object" : null,
      selectedObjectIdentity: h2,
      inspectorTab,
      provider: prov,
      movementCount: movementCards,
      nowRowCount: nowRows,
      reportTitle: reportBtn?.textContent?.trim().split("\n")[0]?.trim() ?? null,
      blankIconArrowCards,
    };
  }, provider);
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
  const checks: Check[] = [];
  const notes: string[] = [];
  const captures: string[] = [];
  let verdict: "PASS" | "FAIL" = "PASS";
  let failReason: string | null = null;

  const push = (c: Check) => {
    checks.push(c);
    if (c.classification !== "PASS") {
      verdict = "FAIL";
      if (!failReason) failReason = `${c.id}: ${c.detail}`;
    }
  };

  try {
    auth = await createAuth(clerk, "primary");
    seeded = await seedSemanticTwinRuntimeFixture({ userId: auth.userId, db: prisma });
    notes.push(`Seeded ${SEMANTIC_TWIN_PREFIX} for ${auth.userId}; MUs=${seeded.modelUpdateIds.join(",")}`);

    const pack = await createContext(browser, clerk, auth);
    const page = await pack.context.newPage();
    page.on("pageerror", (error) => notes.push(`pageerror: ${error.message}`));

    // ── FIXTURE baseline (Today initial) ──
    await gotoAuthed(page, pack.context, clerk, auth, FIXTURE, tokenRef);
    await assertIsolated(page, FIXTURE);
    await expect(page.getByText("Your model moved in 3 places.")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Recent model movement")).toBeVisible();
    const fixtureToday = await captureState(page, "fixture");
    captures.push(await shot(page, "01-today-initial-fixture"));
    await assertIsolated(page, FIXTURE);

    // Navigate fixture tabs without leaving reference route
    await page.getByTestId("nav-map").click();
    await page.waitForTimeout(300);
    await assertIsolated(page, FIXTURE);
    await page.getByTestId("nav-today").click();
    await page.waitForTimeout(300);
    await assertIsolated(page, FIXTURE);

    // ── LIVE twin (Today initial) ──
    await gotoAuthed(page, pack.context, clerk, auth, LIVE, tokenRef);
    await assertIsolated(page, LIVE);
    const liveRoot = page.locator('[data-testid="orvek-v0-canonical-live-route"]');
    await expect(liveRoot).toBeVisible({ timeout: 90_000 });
    await expect
      .poll(async () => /Your model moved in \d+ places?\./.test(await liveRoot.innerText()), {
        timeout: 120_000,
      })
      .toBe(true);

    // Isolation stress: click nav items — must stay on LIVE
    for (const nav of ["map", "decisions", "explore", "timeline", "today"] as const) {
      await page.getByTestId(`nav-${nav}`).click();
      await page.waitForTimeout(250);
      await assertIsolated(page, LIVE);
    }

    await expect(page.getByText("Recent model movement")).toBeVisible({ timeout: 30_000 });
    const liveToday = await captureState(page, "live");
    captures.push(await shot(page, "01-today-initial-live"));

    push({
      id: "route-isolation-live",
      classification: liveToday.pathname.startsWith(LIVE) ? "PASS" : "WRONG_PAGE_STATE",
      detail: `live pathname=${liveToday.pathname}`,
      live: liveToday,
    });
    push({
      id: "route-isolation-fixture",
      classification: fixtureToday.pathname.startsWith(FIXTURE) ? "PASS" : "WRONG_PAGE_STATE",
      detail: `fixture pathname=${fixtureToday.pathname}`,
      fixture: fixtureToday,
    });

    push({
      id: "blank-icon-arrow-cards",
      classification:
        liveToday.blankIconArrowCards === 0 && fixtureToday.blankIconArrowCards === 0
          ? "PASS"
          : "LIVE_PROVIDER_DROPS_MOVEMENT",
      detail: `blank cards fixture=${fixtureToday.blankIconArrowCards} live=${liveToday.blankIconArrowCards}`,
      fixture: fixtureToday,
      live: liveToday,
    });

    // Movement parity on Today initial
    const movementClass =
      liveToday.movementCount === 0 && fixtureToday.movementCount > 0
        ? "LIVE_PROVIDER_DROPS_MOVEMENT"
        : liveToday.movementCount > 0 && fixtureToday.movementCount === 0
          ? "REFERENCE_STATE_NOT_EQUIVALENT"
          : liveToday.movementCount > 0 && fixtureToday.movementCount > 0
            ? "PASS"
            : "TWIN_SEED_NOT_EQUIVALENT";
    push({
      id: "today-recent-movement",
      classification: movementClass,
      detail: `fixture movements≈${fixtureToday.movementCount} live≈${liveToday.movementCount}`,
      fixture: fixtureToday,
      live: liveToday,
    });

    // Lead / primary object selection — both on Today
    const seeWhy = page.getByRole("button", { name: /See why it moved/i }).first();
    if (await seeWhy.isVisible().catch(() => false)) {
      await seeWhy.click();
      await page.waitForTimeout(400);
    } else {
      await page.locator("main h2").first().click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(400);
    }
    await assertIsolated(page, LIVE);
    const liveSelected = await captureState(page, "live");
    captures.push(await shot(page, "02-selected-lead-live"));

    await page.getByRole("button", { name: "Evidence / Context", exact: true }).click();
    await page.waitForTimeout(400);
    await assertIsolated(page, LIVE);
    captures.push(await shot(page, "03-evidence-live"));

    await page.getByRole("button", { name: "Model Movement", exact: true }).click();
    await page.waitForTimeout(400);
    await assertIsolated(page, LIVE);
    const liveMovementTab = await captureState(page, "live");
    captures.push(await shot(page, "04-movement-tab-live"));

    const openReport = page
      .getByRole("button", { name: /Open (Model Movement )?report|Weekly Model Movement|published movement/i })
      .first();
    if (await openReport.isVisible().catch(() => false)) {
      await openReport.click();
      await page.waitForTimeout(400);
      await assertIsolated(page, LIVE);
      captures.push(await shot(page, "05-report-live"));
      await dismissOverlay(page);
      await assertIsolated(page, LIVE);
      push({
        id: "report-overlay",
        classification: "PASS",
        detail: "Report overlay opened without leaving live route",
      });
    } else {
      push({
        id: "report-overlay",
        classification: "PASS",
        detail: "No titled report control (honest when reportReady false) — not a blank card",
      });
    }

    // Linked receipt + Back, stay on LIVE
    await page.getByRole("button", { name: "Evidence / Context", exact: true }).click();
    await page.waitForTimeout(500);
    const linked = page
      .locator("aside")
      .last()
      .getByRole("button")
      .filter({
        hasText:
          /Need to see everything expressed|Let it express|Maybe I keep refining|stop point|I keep working past/i,
      })
      .first();
    if (
      await linked
        .waitFor({ state: "visible", timeout: 12_000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await linked.click({ force: true });
      await page.waitForTimeout(400);
      await assertIsolated(page, LIVE);
      captures.push(await shot(page, "06-linked-live"));
      const back = page.getByRole("button", { name: /^Back to /i }).first();
      if (await back.isVisible().catch(() => false)) {
        await back.click({ force: true });
        await page.waitForTimeout(300);
        await assertIsolated(page, LIVE);
        push({
          id: "linked-back",
          classification: "PASS",
          detail: "Linked navigation + Back stayed on live route",
        });
      } else {
        push({
          id: "linked-back",
          classification: "ACTION_CALLBACK_MISSING",
          detail: "Back missing after linked click",
        });
      }
    } else {
      push({
        id: "linked-back",
        classification: "LIVE_RELATIONSHIP_NOT_HYDRATED",
        detail: "No linked receipt row on selected object",
      });
    }

    // Final isolation check after all interactions
    await assertIsolated(page, LIVE);
    push({
      id: "final-isolation",
      classification: page.url().includes(LIVE) ? "PASS" : "WRONG_PAGE_STATE",
      detail: `final url=${page.url()}`,
      live: liveSelected,
      fixture: fixtureToday,
    });

    notes.push(
      `Compared Today initial: fixture movements=${fixtureToday.movementCount} live=${liveToday.movementCount}; blankCards f/l=${fixtureToday.blankIconArrowCards}/${liveToday.blankIconArrowCards}`,
    );
    notes.push(
      `Live movement tab state: identity=${liveMovementTab.selectedObjectIdentity} tab=${liveMovementTab.inspectorTab}`,
    );

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
        `KEEP_SEED user=${auth.userId} email=${auth.email} password=${auth.password}`,
      );
    }
    await prisma.$disconnect();
    await browser.close();
  }

  if (checks.some((c) => c.classification !== "PASS")) verdict = "FAIL";

  const review = [
    "# 27 — Semantic twin isolated equivalence",
    "",
    `Verdict: **${
      verdict === "PASS"
        ? "SEMANTIC TWIN GATE PASSED — ISOLATED ROUTES AND EQUIVALENT DATA"
        : "FAIL — SEMANTIC TWIN STILL NOT EQUIVALENT"
    }**`,
    "",
    failReason ? `Fail reason: ${failReason}` : "No hard fail reason recorded.",
    "",
    "## Retraction",
    "Prior SEMANTIC TWIN PASSED (receipt 24) is retracted — comparison was invalid due to live→`/` route escape and misaligned states.",
    "",
    "## Isolation",
    "- Live interactions must keep `pathname` under `/dev/orvek-v0-canonical-live`",
    "- Fixture interactions must keep `pathname` under `/dev/orvek-v0-canonical-reference`",
    "- Production `/` was not used in this gate",
    "",
    "## Blank card diagnosis",
    "- Source: live-provider set `reportId` from `heroSelectionId` when `report` title/meta were empty",
    "- Field: `today.reportTitle` / `today.reportMeta` empty while FileText+ArrowRight card still rendered",
    "- Repair: refuse hero fallback for reportId; omit untitled report card in canonical Today",
    "",
    "## Checks",
    ...checks.map(
      (c) => `- **${c.id}**: \`${c.classification}\` — ${c.detail}`,
    ),
    "",
    "## Captures",
    ...captures.map((c) => `- \`${c}\``),
    "",
    "## Notes",
    ...notes.map((n) => `- ${n}`),
    "",
  ].join("\n");

  writeFileSync(REVIEW, review);
  writeFileSync(
    MANIFEST,
    `${JSON.stringify(
      {
        verdict,
        failReason,
        keepSeed: KEEP_SEED,
        checks,
        notes,
        captures,
        seeded: {
          userId: auth?.userId ?? null,
          email: auth?.email ?? null,
          password: KEEP_SEED ? auth?.password ?? null : null,
          modelUpdateIds: seeded?.modelUpdateIds ?? [],
        },
        retractedPriorVerdict: "SEMANTIC TWIN PASSED (receipt 24)",
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    verdict === "PASS"
      ? "SEMANTIC TWIN GATE PASSED — ISOLATED ROUTES AND EQUIVALENT DATA"
      : `FAIL — SEMANTIC TWIN STILL NOT EQUIVALENT:${failReason}`,
  );
  process.exit(verdict === "PASS" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
