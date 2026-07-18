/**
 * Verify Map global model summary (243 receipts / 7 open questions) on canonical-live.
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
const LIVE = "/dev/orvek-v0-canonical-live";
const REFERENCE = "/dev/orvek-v0-reference";
const REVIEW_USER_ID = "user_3GfkY153edzcz5FzJhlCMFybtmc";
const REVIEW_EMAIL = "populated-primary-1784370053828@example.com";
const REVIEW_PASSWORD = "Kay-RootCutover-Review-Aa1!";

function readEnv() {
  const file = readFileSync(resolve(ROOT, ".env"), "utf8");
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

function decodeJwt(token: string) {
  const parts = token.split(".");
  const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
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
  await page
    .locator(
      '#identifier-field, input[name="identifier"], input[autocomplete="username"], input[type="email"]',
    )
    .first()
    .fill(REVIEW_EMAIL);
  await page
    .locator(
      '#password-field, input[name="password"], input[autocomplete="current-password"], input[type="password"]',
    )
    .first()
    .fill(REVIEW_PASSWORD);
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
  throw new Error(`auth failed for ${path}`);
}

async function openMap(page: Page) {
  const mapNav = page.getByRole("button", { name: /^Map$/i }).first();
  await mapNav.click();
  await page.waitForURL(/\/map/, { timeout: 15_000 }).catch(() => null);
  await expect(page.getByRole("heading", { name: /^Map$/i })).toBeVisible({
    timeout: 20_000,
  });
}

function headerChecks(text: string) {
  return {
    confidence: /Confidence\s+mixed\s*\/\s*evolving/i.test(text),
    receipts243: /\b243\b\s+receipts/i.test(text),
    questions7: /\b7\b\s+open questions/i.test(text),
    mapped30: /\b30\b\s+mapped/i.test(text),
    questions4: /\b4\b\s+open questions/i.test(text),
  };
}

async function main() {
  mkdirSync(RECEIPTS, { recursive: true });
  const env = readEnv();
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY! });
  const session = await clerk.sessions.createSession({ userId: REVIEW_USER_ID });
  const token = await clerk.sessions.getToken(session.id);
  const payload = decodeJwt(token.jwt);
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
    {
      name: "__clerk_db_jwt",
      value: (await clerk.testingTokens.createTestingToken()).token,
      url: ORIGIN,
      sameSite: "Lax",
    },
    {
      name: "__client_uat",
      value: String(payload.iat ?? 1),
      url: ORIGIN,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  const checks: Record<string, unknown> = {};
  let pass = false;
  let failReason = "";

  try {
    await gotoAuthed(page, context, clerk, LIVE);
    await page
      .locator('[data-testid="orvek-v0-canonical-live-route"]')
      .waitFor({ state: "visible", timeout: 45_000 })
      .catch(() => null);
    await page.waitForTimeout(2500);

    const api = await page.evaluate(async () => {
      const res = await fetch("/api/canonical-today-composition", {
        cache: "no-store",
      });
      const body = (await res.json()) as {
        composition?: {
          workbench?: {
            mapHeader?: {
              confidenceLabel?: string;
              receiptsLabel?: string;
              openQuestionsLabel?: string;
            };
          };
        };
      };
      return {
        status: res.status,
        mapHeader: body?.composition?.workbench?.mapHeader ?? null,
      };
    });
    checks.api = api;

    await openMap(page);
    await page.waitForTimeout(1500);
    const liveText = await page.locator("body").innerText();
    checks.live = headerChecks(liveText);
    await page.screenshot({
      path: resolve(RECEIPTS, "screenshots/35-map-header-live.png"),
      fullPage: false,
    });

    await page.goto(REFERENCE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await openMap(page);
    await page.waitForTimeout(1000);
    const refText = await page.locator("body").innerText();
    checks.reference = headerChecks(refText);
    await page.screenshot({
      path: resolve(RECEIPTS, "screenshots/35-map-header-reference.png"),
      fullPage: false,
    });

    const live = checks.live as ReturnType<typeof headerChecks>;
    const ref = checks.reference as ReturnType<typeof headerChecks>;
    const apiHeader = (checks.api as { mapHeader?: typeof api.mapHeader }).mapHeader;

    pass = Boolean(
      apiHeader?.receiptsLabel === "243" &&
        apiHeader?.openQuestionsLabel === "7" &&
        apiHeader?.confidenceLabel === "mixed / evolving" &&
        live.confidence &&
        live.receipts243 &&
        live.questions7 &&
        !live.mapped30 &&
        !live.questions4 &&
        ref.confidence &&
        ref.receipts243 &&
        ref.questions7,
    );
    if (!pass) {
      failReason = JSON.stringify({ checks }, null, 2);
    }
  } catch (e) {
    failReason = e instanceof Error ? e.message : String(e);
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
    resolve(RECEIPTS, "35-map-header-verify.json"),
    `${JSON.stringify({ at: new Date().toISOString(), pass, failReason, checks }, null, 2)}\n`,
  );

  if (pass) {
    console.log("GLOBAL MODEL SUMMARY MATCHES REFERENCE — READY FOR KAY REVIEW");
    process.exit(0);
  }
  console.log("FAIL — MODEL SUMMARY COUNTS STILL DIFFER");
  console.error(failReason);
  process.exit(1);
}

main();
