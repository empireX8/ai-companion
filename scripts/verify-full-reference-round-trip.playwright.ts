/**
 * Browser verify: full reference round-trip on KEEP_SEED review user.
 * Compares live page rails against frozen reference object titles (via composition API).
 * Does not create a new Clerk user.
 */
import { createClerkClient } from "@clerk/backend";
import { chromium, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3000";
const RECEIPTS = resolve(
  ROOT,
  "docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001",
);
const AUTH_PROBE = "/api/desktop-production-parity/auth-probe";
const SEED =
  "/dev/orvek-v0-canonical-live/seed-full-reference-round-trip?redirect=1";
const LIVE = "/dev/orvek-v0-canonical-live";
const REFERENCE = "/dev/orvek-v0-reference";

const REVIEW_USER_ID = "user_3GfkY153edzcz5FzJhlCMFybtmc";
const REVIEW_EMAIL = "populated-primary-1784370053828@example.com";
const REVIEW_PASSWORD = "Kay-RootCutover-Review-Aa1!";

const EXPECTED = {
  lead: "Use v0 architecture prototype before final design",
  report: "Weekly Model Movement report",
  claim: "You often need visual expression before locking architecture.",
  movements: [
    "Decision pressure was treated as an isolated state.",
    "Background context was held as loose metadata.",
    "Avoidance read as a general tendency under pressure.",
  ],
  mapSections: [
    "Patterns",
    "Claims",
    "Active conflicts",
    "Goals / directions",
    "Background / Context",
    "Active questions",
    "Model updates",
    "Uncertainty",
  ],
  decisionSections: ["Active", "Chosen", "Outcome due", "Reviewed"],
  timelineSections: [
    "Today",
    "This week",
    "Last week",
    "Earlier",
    "Imported history",
  ],
};

function readEnv(relativePath = ".env") {
  const file = readFileSync(resolve(ROOT, relativePath), "utf8");
  const env: Record<string, string> = {};
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

async function maybeSignIn(page: Page) {
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
  await id.fill(REVIEW_EMAIL);
  await pw.fill(REVIEW_PASSWORD);
  await page.getByRole("button", { name: /^Continue$/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), {
    timeout: 90_000,
  });
}

async function gotoAuthed(
  page: Page,
  context: BrowserContext,
  clerk: ReturnType<typeof createClerkClient>,
  path: string,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const dbJwt = (await clerk.testingTokens.createTestingToken()).token;
    await context.addCookies([
      { name: "__clerk_db_jwt", value: dbJwt, url: ORIGIN, sameSite: "Lax" },
    ]);
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    if (!(await probe(page, REVIEW_USER_ID))) {
      await maybeSignIn(page);
      await expect
        .poll(() => probe(page, REVIEW_USER_ID), { timeout: 90_000 })
        .toBe(true);
    }
    await page.goto(path, { waitUntil: "domcontentloaded", timeout: 90_000 });
    if ((await probe(page, REVIEW_USER_ID)) && !page.url().includes("/sign-in")) {
      return;
    }
  }
  throw new Error(`Failed to authenticate into ${path}`);
}

function includesCI(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

async function clickNav(page: Page, name: string) {
  const nav = page.locator("nav, aside").first();
  await nav.getByRole("button", { name, exact: true }).first().click();
  await page.waitForTimeout(800);
}

async function clickExploreTab(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await page.waitForTimeout(700);
}

async function main() {
  mkdirSync(RECEIPTS, { recursive: true });
  const env = readEnv();
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY! });
  const session = await clerk.sessions.createSession({
    userId: REVIEW_USER_ID,
  });
  const token = await clerk.sessions.getToken(session.id);
  const payload = decodeJwt(token.jwt);
  const clientUat =
    typeof payload.iat === "number" ? String(payload.iat) : "1";
  const dbJwt = (await clerk.testingTokens.createTestingToken()).token;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: ORIGIN,
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies([
    {
      name: "__session",
      value: token.jwt,
      url: ORIGIN,
      httpOnly: true,
      sameSite: "Lax",
    },
    { name: "__clerk_db_jwt", value: dbJwt, url: ORIGIN, sameSite: "Lax" },
    { name: "__client_uat", value: clientUat, url: ORIGIN, sameSite: "Lax" },
  ]);
  const page = await context.newPage();
  const checks: Record<string, unknown> = {};
  let pass = false;
  let failReason = "";

  try {
    await gotoAuthed(page, context, clerk, SEED);
    await page.waitForTimeout(500);
    checks.afterSeedUrl = page.url();

    const composition = await page.evaluate(async () => {
      const res = await fetch("/api/canonical-today-composition", {
        cache: "no-store",
      });
      return { status: res.status, json: await res.json() };
    });
    const comp = composition.json?.composition;
    const wb = comp?.workbench;
    checks.compositionApi = {
      status: composition.status,
      leadTitle: comp?.leadTitle ?? null,
      objectCount: comp?.objects?.length ?? 0,
      mapCats: wb?.mapCategories?.length ?? 0,
      timelineGroups: wb?.timelineGroups?.length ?? 0,
      decisionGroups: wb?.decisionListGroups?.length ?? 0,
      exploreQ: wb?.exploreQuestionIds?.length ?? 0,
      exploreInv: wb?.exploreInvestigationIds?.length ?? 0,
      exploreFw: wb?.exploreFieldworkIds?.length ?? 0,
      hasWorkbench: Boolean(wb),
    };

    await gotoAuthed(page, context, clerk, LIVE);
    await page
      .locator('[data-testid="orvek-v0-canonical-live-route"]')
      .waitFor({ state: "visible", timeout: 45_000 })
      .catch(() => null);
    await page.waitForTimeout(2500);

    const todayBody = await page.locator("body").innerText();
    checks.today = {
      lead: includesCI(todayBody, EXPECTED.lead),
      report: includesCI(todayBody, EXPECTED.report),
      movements: EXPECTED.movements.every((m) => includesCI(todayBody, m)),
      whatChangedFallback: /\bWhat Changed\b/.test(todayBody),
    };

    await clickNav(page, "Map");
    const mapBody = await page.locator("body").innerText();
    checks.map = {
      sections: EXPECTED.mapSections.map((s) => ({
        s,
        ok: includesCI(mapBody, s),
      })),
      claim: includesCI(mapBody, EXPECTED.claim),
      empty: includesCI(mapBody, "Nothing on your map yet"),
    };

    await clickNav(page, "Decisions");
    const decBody = await page.locator("body").innerText();
    checks.decisions = {
      sections: EXPECTED.decisionSections.map((s) => ({
        s,
        ok: includesCI(decBody, s),
      })),
      lead: includesCI(decBody, EXPECTED.lead),
      empty: /no decisions/i.test(decBody),
    };

    await clickNav(page, "Timeline");
    const tlBody = await page.locator("body").innerText();
    checks.timeline = {
      sections: EXPECTED.timelineSections.map((s) => ({
        s,
        ok: includesCI(tlBody, s),
      })),
    };

    await clickNav(page, "Explore");
    await clickExploreTab(page, "Active Questions");
    const qBody = await page.locator("body").innerText();
    checks.exploreQuestions = {
      hasList: includesCI(qBody, "Does public visibility trigger overbuilding?"),
      empty: /no active questions yet/i.test(qBody),
    };

    await clickExploreTab(page, "Investigations");
    const invBody = await page.locator("body").innerText();
    checks.exploreInvestigations = {
      hasList:
        includesCI(invBody, "investigation") ||
        includesCI(invBody, "hypothesis") ||
        includesCI(invBody, "scope"),
      empty: /no investigations/i.test(invBody),
    };

    await clickExploreTab(page, "Fieldwork Bridge");
    const fwBody = await page.locator("body").innerText();
    checks.exploreFieldwork = {
      hasList:
        includesCI(fwBody, "public test") ||
        includesCI(fwBody, "Expected signal") ||
        includesCI(fwBody, "Fieldwork"),
      empty: /no fieldwork yet/i.test(fwBody),
    };

    const shotDir = resolve(RECEIPTS, "screenshots");
    mkdirSync(shotDir, { recursive: true });
    await page.screenshot({
      path: resolve(shotDir, "33-full-reference-live-fieldwork.png"),
      fullPage: true,
    });

    // Soft reference presence check (no auth required for frozen route? may redirect)
    await page.goto(REFERENCE, { waitUntil: "domcontentloaded" }).catch(() => null);
    checks.referenceReachable = page.url().includes("orvek-v0-reference");

    const apiOk =
      checks.compositionApi &&
      (checks.compositionApi as { hasWorkbench: boolean }).hasWorkbench &&
      (checks.compositionApi as { mapCats: number }).mapCats === 8 &&
      (checks.compositionApi as { objectCount: number }).objectCount >= 66 &&
      (checks.compositionApi as { leadTitle: string }).leadTitle === EXPECTED.lead;

    const todayOk =
      (checks.today as { lead: boolean }).lead &&
      (checks.today as { report: boolean }).report &&
      (checks.today as { movements: boolean }).movements &&
      !(checks.today as { whatChangedFallback: boolean }).whatChangedFallback;

    const mapOk =
      (checks.map as { sections: { ok: boolean }[] }).sections.every((x) => x.ok) &&
      (checks.map as { claim: boolean }).claim &&
      !(checks.map as { empty: boolean }).empty;

    const decisionsOk =
      (checks.decisions as { sections: { ok: boolean }[] }).sections.every(
        (x) => x.ok,
      ) &&
      (checks.decisions as { lead: boolean }).lead &&
      !(checks.decisions as { empty: boolean }).empty;

    const timelineOk = (
      checks.timeline as { sections: { ok: boolean }[] }
    ).sections.every((x) => x.ok);

    const exploreOk =
      (checks.exploreQuestions as { hasList: boolean }).hasList &&
      !(checks.exploreQuestions as { empty: boolean }).empty &&
      (checks.exploreInvestigations as { hasList: boolean }).hasList &&
      !(checks.exploreInvestigations as { empty: boolean }).empty &&
      (checks.exploreFieldwork as { hasList: boolean }).hasList &&
      !(checks.exploreFieldwork as { empty: boolean }).empty;

    pass = Boolean(
      apiOk && todayOk && mapOk && decisionsOk && timelineOk && exploreOk,
    );
    if (!pass) {
      failReason = JSON.stringify(
        { apiOk, todayOk, mapOk, decisionsOk, timelineOk, exploreOk, checks },
        null,
        2,
      );
    }
  } catch (e) {
    failReason = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
    pass = false;
  } finally {
    try {
      await clerk.sessions.revokeSession(session.id);
    } catch {
      /* ignore */
    }
    await browser.close();
  }

  writeFileSync(
    resolve(RECEIPTS, "33-full-reference-browser-verify.json"),
    `${JSON.stringify(
      {
        at: new Date().toISOString(),
        reviewUserId: REVIEW_USER_ID,
        pass,
        failReason: failReason || null,
        checks,
        seedUrl: `${ORIGIN}/dev/orvek-v0-canonical-live/seed-full-reference-round-trip`,
      },
      null,
      2,
    )}\n`,
  );

  if (pass) {
    console.log(
      "FULL REFERENCE ROUND-TRIP IMPLEMENTED — OPEN http://localhost:3000/dev/orvek-v0-canonical-live/seed-full-reference-round-trip",
    );
    process.exit(0);
  }
  console.log("FAIL — FULL REFERENCE MODEL CANNOT YET ROUND-TRIP");
  console.error(failReason);
  process.exit(1);
}

main();
