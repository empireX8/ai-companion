/**
 * Bind + verify exact round-trip for the KEEP_SEED Kay review Clerk user
 * (existing user — does not create a new Clerk user).
 *
 * Exercises the authenticated seed URL, then asserts live DOM + composition API.
 *
 * Run:
 *   DESKTOP_PARITY_BASE_URL=http://localhost:3000 \
 *     npx tsx scripts/verify-current-browser-exact-seed.playwright.ts
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
const SEED = "/dev/orvek-v0-canonical-live/seed-exact-round-trip?redirect=1";
const LIVE = "/dev/orvek-v0-canonical-live";

/** Kay review KEEP_SEED account from step7 root cutover. */
const REVIEW_USER_ID = "user_3GfkY153edzcz5FzJhlCMFybtmc";
const REVIEW_EMAIL = "populated-primary-1784370053828@example.com";
const REVIEW_PASSWORD = "Kay-RootCutover-Review-Aa1!";

const LEAD = "Use v0 architecture prototype before final design";
const REPORT = "Weekly Model Movement report";
const REPORT_META = "Ready · 3 loops, 2 decisions, 1 context update";
const MOVEMENTS = [
  "Decision pressure was treated as an isolated state.",
  "Background context was held as loose metadata.",
  "Avoidance read as a general tendency under pressure.",
] as const;

type EnvMap = Record<string, string>;

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
  await expect(pw).toBeVisible({ timeout: 90_000 });
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

async function main() {
  mkdirSync(RECEIPTS, { recursive: true });
  const env = readEnv();
  const clerk = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY!,
  });

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
  let pass = false;
  let failReason = "";
  const checks: Record<string, unknown> = {};

  try {
    await gotoAuthed(page, context, clerk, SEED);
    checks.afterSeedUrl = page.url();
    checks.authenticatedAs = REVIEW_USER_ID;

    // Seed with redirect=1 should land on live
    if (!page.url().includes("/dev/orvek-v0-canonical-live")) {
      throw new Error(`Expected live after seed redirect, got ${page.url()}`);
    }
    if (page.url().includes("seed-exact")) {
      // confirmation page without redirect — follow link
      await page.goto(LIVE, { waitUntil: "domcontentloaded" });
    }

    const composition = await page.evaluate(async () => {
      const res = await fetch("/api/canonical-today-composition", {
        cache: "no-store",
      });
      const json = await res.json();
      return { status: res.status, json };
    });
    const comp = composition.json?.composition as
      | {
          leadTitle?: string;
          movements?: unknown[];
          nowRows?: unknown[];
          resurfacedObjectIds?: unknown[];
        }
      | null
      | undefined;
    const report = composition.json?.report as
      | { title?: string; meta?: string }
      | null
      | undefined;
    checks.compositionApi = {
      status: composition.status,
      hasComposition: Boolean(comp),
      leadTitle: comp?.leadTitle ?? null,
      reportTitle: report?.title ?? null,
      reportMeta: report?.meta ?? null,
      movementCount: comp?.movements?.length ?? 0,
      nowCount: comp?.nowRows?.length ?? 0,
      resurfacedCount: comp?.resurfacedObjectIds?.length ?? 0,
      source: comp
        ? "persisted_canonical_today_composition"
        : "missing",
    };

    await gotoAuthed(page, context, clerk, LIVE);
    await page
      .locator('[data-testid="orvek-v0-canonical-live-route"]')
      .waitFor({ state: "visible", timeout: 45_000 })
      .catch(() => null);
    // Allow hybrid fetch to settle
    await page.waitForTimeout(2500);

    const body = await page.locator("body").innerText();
    checks.liveHasLead = body.includes(LEAD);
    checks.liveHasReport = body.includes(REPORT);
    checks.liveHasReportMeta = body.includes(REPORT_META);
    checks.liveHasWhatChangedFallback = body.includes("What Changed");
    checks.movementsPresent = MOVEMENTS.map((m) => body.includes(m));
    checks.movementsInOrder = MOVEMENTS.every((m, i) => {
      const idx = body.indexOf(m);
      if (idx < 0) return false;
      if (i === 0) return true;
      return idx > body.indexOf(MOVEMENTS[i - 1]!);
    });

    const shot = resolve(
      RECEIPTS,
      "screenshots/32-browser-session-exact-seed-live.png",
    );
    mkdirSync(resolve(RECEIPTS, "screenshots"), { recursive: true });
    await page.screenshot({ path: shot, fullPage: true });
    checks.screenshot = shot;

    const api = checks.compositionApi as {
      source: string;
      leadTitle: string | null;
      reportTitle: string | null;
      reportMeta: string | null;
      movementCount: number;
      nowCount: number;
      resurfacedCount: number;
    };
    const apiOk =
      api.source === "persisted_canonical_today_composition" &&
      api.leadTitle === LEAD &&
      api.reportTitle === REPORT &&
      api.reportMeta === REPORT_META &&
      api.movementCount === 3 &&
      api.nowCount === 4 &&
      api.resurfacedCount === 3;

    const domOk =
      checks.liveHasLead === true &&
      checks.liveHasReport === true &&
      checks.liveHasReportMeta === true &&
      checks.movementsInOrder === true;

    pass = Boolean(apiOk && domOk);
    if (!pass) {
      failReason = JSON.stringify({ apiOk, domOk, checks }, null, 2);
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

  const receipt = {
    at: new Date().toISOString(),
    reviewUserId: REVIEW_USER_ID,
    seedPath: SEED,
    livePath: LIVE,
    pass,
    failReason: failReason || null,
    checks,
  };
  writeFileSync(
    resolve(RECEIPTS, "32-current-browser-user-exact-seed-verify.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );

  // cleanup debug helper if present
  try {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(resolve(ROOT, "scripts/_debug-auth.ts"));
  } catch {
    /* ignore */
  }

  if (pass) {
    console.log(
      "CURRENT BROWSER USER SEEING EXACT ROUND-TRIP DATA — OPEN http://localhost:3000/dev/orvek-v0-canonical-live/seed-exact-round-trip",
    );
    process.exit(0);
  }
  console.log("FAIL — CURRENT BROWSER USER STILL ON FALLBACK");
  console.error(failReason);
  process.exit(1);
}

main();
