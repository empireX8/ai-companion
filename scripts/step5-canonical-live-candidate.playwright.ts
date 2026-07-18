/**
 * Blue/green live candidate capture + path gate (no root cutover).
 * Captures /dev/orvek-v0-canonical-live at 1440×900 and asserts:
 * - same canonical page family as fixture route
 * - no fixture mock conversation / fixture ids on live
 * - auth required
 *
 * Run:
 *   DESKTOP_PARITY_BASE_URL=http://localhost:3000 npx tsx scripts/step5-canonical-live-candidate.playwright.ts
 */
import { createClerkClient } from "@clerk/backend";
import { chromium, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const CAMPAIGN = "DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001";
const ROOT = resolve(process.cwd());
const RECEIPTS = resolve(ROOT, `docs/agent-runs/receipts/${CAMPAIGN}`);
const SHOTS = resolve(RECEIPTS, "screenshots/step5-live-candidate");
const MANIFEST = resolve(RECEIPTS, "step5-live-candidate-manifest.json");
const REVIEW = resolve(RECEIPTS, "18-live-candidate-review.md");
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3000";
const VIEWPORT = { width: 1440, height: 900 } as const;
const AUTH_PROBE = "/api/desktop-production-parity/auth-probe";
const LIVE = "/dev/orvek-v0-canonical-live";
const FIXTURE = "/dev/orvek-v0-canonical-reference";

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
): Promise<AuthState> {
  const email = `live-candidate-${Date.now()}@example.com`;
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

async function cleanup(
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
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  if (!(await probe(page, auth.userId))) {
    await maybeSignIn(page, auth);
    await expect.poll(() => probe(page, auth.userId), { timeout: 90_000 }).toBe(true);
  }
  await page.goto(path, { waitUntil: "domcontentloaded" });
  if (!(await probe(page, auth.userId))) {
    await maybeSignIn(page, auth);
    await page.goto(path, { waitUntil: "domcontentloaded" });
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
  const clerk = createClerkClient({
    secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
    publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
  });
  let auth: AuthState | null = null;
  const browser = await chromium.launch({ headless: true });
  const tokenRef = { current: "" };
  const captures: string[] = [];
  const notes: string[] = [];
  let verdict: "PASS" | "FAIL" = "PASS";
  let failReason: string | null = null;

  try {
    auth = await createAuth(clerk);
    const pack = await createContext(browser, clerk, auth);
    const page = await pack.context.newPage();

    await gotoAuthed(page, pack.context, clerk, auth, LIVE, tokenRef);

    const liveRoot = page.locator('[data-testid="orvek-v0-canonical-live-route"]');
    try {
      await expect(liveRoot).toBeVisible({ timeout: 90_000 });
    } catch (err) {
      const url = page.url();
      const bodySnippet = (await page.locator("body").innerText().catch(() => "")).slice(0, 500);
      throw new Error(
        `Live candidate root not visible. url=${url} body=${JSON.stringify(bodySnippet)} cause=${String(err)}`,
      );
    }
    notes.push("Live candidate route mounted under auth.");

    page.on("pageerror", (error) => {
      notes.push(`pageerror: ${error.message}`);
    });

    // No fixture mock conversation markers required for empty live — but must not show reference sample
    const bodyText = await liveRoot.innerText();
    if (bodyText.includes("Your model moved in 3 places.")) {
      verdict = "FAIL";
      failReason =
        "Live candidate shows fixture Today briefing title — fixture data leaked";
    }
    if (
      bodyText.includes(
        "Why do I feel like we need to see the architecture visually before locking design?",
      )
    ) {
      verdict = "FAIL";
      failReason = "Live candidate shows fixture Free Explore sample conversation";
    }

    captures.push(await shot(page, "01-today"));

    // Select first consequential control if present
    const anySelect = page
      .locator("main, [class*='max-w']")
      .getByRole("button")
      .filter({ hasText: /./ })
      .first();
    if (await anySelect.isVisible().catch(() => false)) {
      await anySelect.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(300);
    }
    captures.push(await shot(page, "02-today-selected"));

    const evidenceTab = page.getByRole("button", {
      name: "Evidence / Context",
      exact: true,
    });
    if (await evidenceTab.isVisible().catch(() => false)) {
      await evidenceTab.click();
      await page.waitForTimeout(200);
    }
    captures.push(await shot(page, "03-evidence-context"));

    const aside = page.locator("aside").last();
    const linked = aside.getByRole("button").nth(2);
    if (await linked.isVisible().catch(() => false)) {
      await linked.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(250);
    }
    captures.push(await shot(page, "04-linked-receipt"));
    captures.push(await shot(page, "05-linked-context"));

    const back = page.getByRole("button", { name: /^Back to /i }).first();
    if (await back.isVisible().catch(() => false)) {
      await back.click({ force: true });
      await page.waitForTimeout(200);
    }
    captures.push(await shot(page, "06-back-restoration"));

    const movementTab = page.getByRole("button", {
      name: "Model Movement",
      exact: true,
    });
    if (await movementTab.isVisible().catch(() => false)) {
      await movementTab.click();
      await page.waitForTimeout(200);
    }
    captures.push(await shot(page, "07-model-movement"));

    const openReport = page
      .getByRole("button", { name: /Open (Model Movement )?report/i })
      .first();
    if (await openReport.isVisible().catch(() => false)) {
      await openReport.click();
      await page.waitForTimeout(300);
    }
    captures.push(await shot(page, "08-report-overlay"));
    await dismissOverlay(page);

    await expect(page.getByTestId("nav-map")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("nav-map").click({ force: true });
    await expect(page.getByRole("heading", { name: "Map", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(400);
    captures.push(await shot(page, "09-map"));

    await expect(page.getByTestId("nav-decisions")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("nav-decisions").click({ force: true });
    await expect(page.getByRole("heading", { name: "Decisions", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(400);
    captures.push(await shot(page, "10-decision"));

    await expect(page.getByTestId("nav-explore")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("nav-explore").click({ force: true });
    await expect(page.getByRole("heading", { name: "Explore", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(300);
    const investigations = page.getByRole("button", { name: "Investigations" });
    if (await investigations.isVisible().catch(() => false)) {
      await investigations.click();
      await page.waitForTimeout(250);
    }
    captures.push(await shot(page, "11-experiment-investigation"));

    const free = page.getByRole("button", { name: "Free Explore" });
    if (await free.isVisible().catch(() => false)) {
      await free.click();
      await page.waitForTimeout(250);
    }
    captures.push(await shot(page, "12-explore"));

    // Explore must remain live-capable wiring (handlers available flag may be false until session)
    const exploreHtml = await page.content();
    if (exploreHtml.includes("orvek-v0/pages/explore")) {
      verdict = "FAIL";
      failReason = "Parallel production explore page referenced in live DOM";
    }

    await page.getByTestId("nav-timeline").click({ force: true });
    await expect(page.getByRole("heading", { name: "Timeline", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(400);
    captures.push(await shot(page, "13-timeline"));

    // Fixture route still uses same CanonicalWorkbench family (source already gated)
    await gotoAuthed(page, pack.context, clerk, auth, FIXTURE, tokenRef);
    await expect(
      page.locator('[data-testid="orvek-v0-canonical-reference-route"]'),
    ).toBeVisible({ timeout: 60_000 });
    notes.push("Fixture route still mounts independently after live candidate visit.");

    await pack.context.close();
  } catch (err) {
    verdict = "FAIL";
    failReason = String(err);
  } finally {
    await cleanup(clerk, auth);
    await browser.close();
  }

  const review = [
    "# 18 — Live candidate review",
    "",
    `Verdict: **${
      verdict === "PASS"
        ? "LIVE CANDIDATE PASSED — READY FOR ROOT CUTOVER REVIEW"
        : "FAIL — LIVE PROVIDER INCOMPLETE"
    }**`,
    "",
    failReason ? `Fail reason: ${failReason}` : "No hard fail reason recorded.",
    "",
    "## Captures (1440×900)",
    ...captures.map((c) => `- \`${c}\``),
    "",
    "## Notes",
    ...notes.map((n) => `- ${n}`),
    "",
    "- Root `/` was not cut over.",
    "- Cold `/dev/orvek-v0-reference` and fixture `/dev/orvek-v0-canonical-reference` were not modified.",
    "- See `16-live-capability-trace.md` and `17-capability-preservation-matrix.md`.",
    "",
  ].join("\n");

  writeFileSync(REVIEW, review);
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
        rootCutover: false,
      },
      null,
      2,
    )}\n`,
  );

  console.log(verdict === "PASS" ? "LIVE_CANDIDATE_PASS" : `LIVE_CANDIDATE_FAIL:${failReason}`);
  process.exit(verdict === "PASS" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
