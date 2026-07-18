/**
 * Verify Import Review enabled + overlay parity for KEEP_SEED full-reference seed.
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

const SUBTITLE = "18,582 messages · 243 receipts · 18 objects · 7 questions.";
const PROPOSALS = [
  "Repeated loop: reopening before shipping",
  "Belief: completeness precedes commitment",
  "Open question: would a narrow public test break the loop?",
  "Receipt only — no model change",
] as const;

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
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
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

async function openImport(page: Page) {
  const btn = page.getByRole("button", { name: /Import/i }).first();
  await expect(btn).toBeEnabled({ timeout: 15_000 });
  await btn.click();
  await expect(page.getByRole("heading", { name: "Review import" })).toBeVisible({
    timeout: 10_000,
  });
}

async function main() {
  mkdirSync(RECEIPTS, { recursive: true });
  // Re-seed full reference including importReview
  const { PrismaClient } = await import("@prisma/client");
  const {
    cleanupFullReferenceRoundTrip,
    seedFullReferenceRoundTrip,
  } = await import("../lib/exact-fixture-round-trip-seed");
  process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
  const db = new PrismaClient();
  await cleanupFullReferenceRoundTrip({ userId: REVIEW_USER_ID, db });
  const seeded = await seedFullReferenceRoundTrip({ userId: REVIEW_USER_ID, db });
  await db.$disconnect();

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
  const checks: Record<string, unknown> = {
    compositionId: seeded.compositionId,
  };
  let pass = false;
  let failReason = "";

  try {
    await gotoAuthed(page, context, clerk, LIVE);
    await page
      .locator('[data-testid="orvek-v0-canonical-live-route"]')
      .waitFor({ state: "visible", timeout: 45_000 })
      .catch(() => null);
    await page.waitForTimeout(2000);

    const api = await page.evaluate(async () => {
      const res = await fetch("/api/canonical-today-composition", {
        cache: "no-store",
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { parseError: text.slice(0, 120) };
      }
      const body = json as {
        composition?: {
          workbench?: { importReview?: unknown };
          objects?: Array<{ id: string; reportSummary?: string }>;
        };
      };
      return {
        status: res.status,
        importReview: body?.composition?.workbench?.importReview ?? null,
        impTitle: (body?.composition?.objects ?? []).find(
          (o) => o.id?.includes("obj-imp-1") || o.id?.endsWith("-imp-1"),
        )?.reportSummary,
      };
    });
    checks.api = api;

    await openImport(page);
    const liveOverlay = await page.locator("body").innerText();
    checks.live = {
      subtitle: liveOverlay.includes(SUBTITLE),
      proposals: PROPOSALS.map((p) => liveOverlay.includes(p)),
      title: liveOverlay.includes("Review import"),
      url: page.url(),
    };
    // Reference OverlayShell has no Escape handler — close via X (same as reference).
    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(500);
    checks.liveClosed =
      !(await page
        .getByRole("heading", { name: "Review import" })
        .isVisible()
        .catch(() => false)) && page.url().includes("/dev/orvek-v0-canonical-live");

    // Reference parity (same browser profile)
    await page.goto(REFERENCE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await openImport(page);
    const refOverlay = await page.locator("body").innerText();
    checks.reference = {
      subtitle: refOverlay.includes(SUBTITLE),
      proposals: PROPOSALS.map((p) => refOverlay.includes(p)),
    };
    await page.getByRole("button", { name: "Close" }).click();

    const liveOk =
      (checks.live as { subtitle: boolean }).subtitle &&
      (checks.live as { proposals: boolean[] }).proposals.every(Boolean) &&
      (checks.live as { title: boolean }).title &&
      checks.liveClosed === true &&
      ((checks.api as { importReview?: { candidates?: unknown[] } | null })
        .importReview?.candidates?.length ?? 0) === 4;

    const refOk =
      (checks.reference as { subtitle: boolean }).subtitle &&
      (checks.reference as { proposals: boolean[] }).proposals.every(Boolean);

    pass = Boolean(liveOk && refOk);
    if (!pass) {
      failReason = JSON.stringify({ liveOk, refOk, checks }, null, 2);
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
    resolve(RECEIPTS, "34-import-review-verify.json"),
    `${JSON.stringify({ at: new Date().toISOString(), pass, failReason, checks }, null, 2)}\n`,
  );

  if (pass) {
    console.log("IMPORT REVIEW ROUND-TRIP IMPLEMENTED — READY FOR KAY REVIEW");
    process.exit(0);
  }
  console.log("FAIL — IMPORT REVIEW PATH STILL INCOMPLETE");
  console.error(failReason);
  process.exit(1);
}

main();
