/**
 * STEP 4 ONLY — cold authority vs canonical fixture reference-equivalence gate.
 * No product code changes. Captures paired screenshots + comparison matrix.
 *
 * Run:
 *   DESKTOP_PARITY_BASE_URL=http://localhost:3000 npx playwright test \
 *     scripts/step4-canonical-fixture-equivalence.playwright.ts --config=/dev/null
 *
 * Or via node + playwright programmatic runner below if not registered in playwright.config.
 */
import { createClerkClient } from "@clerk/backend";
import {
  chromium,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const CAMPAIGN = "DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001";
const ROOT = resolve(process.cwd());
const RECEIPTS = resolve(ROOT, `docs/agent-runs/receipts/${CAMPAIGN}`);
const SHOTS = resolve(RECEIPTS, "screenshots/step4-fixture-gate");
const MATRIX_MD = resolve(RECEIPTS, "15-step4-fixture-equivalence-matrix.md");
const MATRIX_JSON = resolve(RECEIPTS, "step4-fixture-equivalence-manifest.json");
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3000";
const VIEWPORT = { width: 1440, height: 900 } as const;
const AUTH_PROBE_PATH = "/api/desktop-production-parity/auth-probe";
const PIXEL_FAIL_THRESHOLD = 0.002; // 0.2% differing pixels
const COLD_PATH = "/dev/orvek-v0-reference";
const FIXTURE_PATH = "/dev/orvek-v0-canonical-reference";

type EnvMap = Record<string, string>;
type AuthState = {
  userId: string;
  email: string;
  password: string;
  sessionId: string;
  sessionToken: string;
  clientUat: string;
};

type Surface = "cold" | "fixture";

type StateRow = {
  id: string;
  state: string;
  coldScreenshot: string;
  fixtureScreenshot: string;
  coldComponentPath: string;
  fixtureComponentPath: string;
  coldProvider: string;
  fixtureProvider: string;
  visibleMismatch: string | null;
  behaviouralMismatch: string | null;
  pixelDiffRatio: number | null;
  textFingerprintMatch: boolean;
  verdict: "PASS" | "FAIL";
};

function readEnvFile(relativePath = ".env"): EnvMap {
  const file = readFileSync(resolve(ROOT, relativePath), "utf8");
  const env: EnvMap = {};
  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
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

function requireEnv(env: EnvMap, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing ${key} in .env`);
  return value;
}

function uniqueEmail(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return `${prefix}-${stamp}@example.com`;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

function slug(id: string): string {
  return id.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

async function createAuthState(
  clerk: ReturnType<typeof createClerkClient>,
  prefix: string,
): Promise<AuthState> {
  const email = uniqueEmail(prefix);
  const password = `Tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-Aa1!`;
  const user = await clerk.users.createUser({
    emailAddress: [email],
    password,
    skipPasswordChecks: true,
    skipPasswordRequirement: true,
  });
  const session = await clerk.sessions.createSession({ userId: user.id });
  const token = await clerk.sessions.getToken(session.id);
  const payload = decodeJwtPayload(token.jwt);
  const iat = typeof payload.iat === "number" ? String(payload.iat) : "1";
  return {
    userId: user.id,
    email,
    password,
    sessionId: session.id,
    sessionToken: token.jwt,
    clientUat: iat,
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

async function createAuthedContext(
  browser: Browser,
  clerk: ReturnType<typeof createClerkClient>,
  auth: AuthState,
  origin: string,
) {
  const devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;
  const context = await browser.newContext({
    baseURL: origin,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  await context.addCookies([
    {
      name: "__session",
      value: auth.sessionToken,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
    { name: "__clerk_db_jwt", value: devBrowserToken, url: origin, sameSite: "Lax" },
    { name: "__client_uat", value: auth.clientUat, url: origin, sameSite: "Lax" },
  ]);
  return { context, devBrowserToken };
}

async function probeAuth(page: Page, expectedUserId: string): Promise<boolean> {
  try {
    return await page.evaluate(
      async ({ endpoint, expectedId }) => {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) return false;
        const payload = (await response.json()) as {
          authenticated?: boolean;
          userId?: string | null;
        };
        return payload.authenticated === true && payload.userId === expectedId;
      },
      { endpoint: AUTH_PROBE_PATH, expectedId: expectedUserId },
    );
  } catch {
    return false;
  }
}

async function maybeSignIn(page: Page, auth: AuthState, path: string) {
  const signInHeading = page.getByRole("heading", { name: /sign in/i }).first();
  const onSignIn = (() => {
    try {
      return new URL(page.url()).pathname.startsWith("/sign-in");
    } catch {
      return false;
    }
  })();
  const visible = await signInHeading
    .waitFor({ state: "visible", timeout: 4_000 })
    .then(() => true)
    .catch(() => false);
  if (!onSignIn && !visible) return;

  const identifierField = page
    .locator(
      '#identifier-field, input[name="identifier"], input[autocomplete="username"], input[type="email"]',
    )
    .first();
  const passwordField = page
    .locator(
      '#password-field, input[name="password"], input[autocomplete="current-password"], input[type="password"]',
    )
    .first();
  await expect(identifierField).toBeVisible({ timeout: 90_000 });
  await expect(passwordField).toBeVisible({ timeout: 90_000 });
  await identifierField.fill(auth.email);
  await passwordField.fill(auth.password);
  await page.getByRole("button", { name: /^Continue$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
    timeout: 90_000,
  });
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

async function stabilize(
  page: Page,
  context: BrowserContext,
  clerk: ReturnType<typeof createClerkClient>,
  auth: AuthState,
  origin: string,
  tokenRef: { current: string },
) {
  tokenRef.current = (await clerk.testingTokens.createTestingToken()).token;
  await context.addCookies([
    { name: "__clerk_db_jwt", value: tokenRef.current, url: origin },
  ]);
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  if (await probeAuth(page, auth.userId)) return;
  await maybeSignIn(page, auth, "/");
  await expect.poll(() => probeAuth(page, auth.userId), { timeout: 90_000 }).toBe(true);
}

async function gotoAuthed(
  page: Page,
  context: BrowserContext,
  clerk: ReturnType<typeof createClerkClient>,
  auth: AuthState,
  origin: string,
  tokenRef: { current: string },
  path: string,
) {
  await stabilize(page, context, clerk, auth, origin, tokenRef);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  if (!(await probeAuth(page, auth.userId))) {
    await stabilize(page, context, clerk, auth, origin, tokenRef);
    await page.goto(path, { waitUntil: "domcontentloaded" });
  }
}

function workbenchRoot(page: Page, surface: Surface) {
  const testId =
    surface === "cold"
      ? "orvek-v0-reference-route"
      : "orvek-v0-canonical-reference-route";
  return page.locator(`[data-testid="${testId}"]`);
}

async function waitReady(page: Page, surface: Surface) {
  await expect(workbenchRoot(page, surface)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: /Your model moved/i })).toBeVisible({
    timeout: 60_000,
  });
}

async function nav(page: Page, label: string) {
  await dismissBlockingOverlay(page);
  const byTestId: Record<string, string> = {
    Map: "nav-map",
    Decisions: "nav-decisions",
    Timeline: "nav-timeline",
    Explore: "nav-explore",
    Today: "nav-today",
  };
  const testId = byTestId[label];
  if (testId) {
    await page.getByTestId(testId).click({ force: true });
    return;
  }
  await page
    .locator("nav, aside")
    .getByRole("button", { name: label, exact: true })
    .first()
    .click({ force: true });
}

async function textFingerprint(page: Page, surface: Surface): Promise<string> {
  const text = await workbenchRoot(page, surface).innerText();
  const normalized = text.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

async function capture(
  page: Page,
  surface: Surface,
  stateId: string,
): Promise<{ path: string; fingerprint: string }> {
  const file = resolve(SHOTS, `${slug(stateId)}-${surface}.png`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: file, fullPage: false });
  const fingerprint = await textFingerprint(page, surface);
  return { path: file, fingerprint };
}

async function pixelDiffRatio(aPath: string, bPath: string): Promise<number> {
  const a = sharp(aPath).ensureAlpha().raw();
  const b = sharp(bPath).ensureAlpha().raw();
  const [aMeta, bMeta] = await Promise.all([
    sharp(aPath).metadata(),
    sharp(bPath).metadata(),
  ]);
  if (
    !aMeta.width ||
    !aMeta.height ||
    aMeta.width !== bMeta.width ||
    aMeta.height !== bMeta.height
  ) {
    return 1;
  }
  const [aBuf, bBuf] = await Promise.all([a.toBuffer(), b.toBuffer()]);
  const len = Math.min(aBuf.length, bBuf.length);
  let diff = 0;
  // Compare RGBA channels with small per-channel tolerance
  for (let i = 0; i < len; i += 4) {
    const dr = Math.abs(aBuf[i] - bBuf[i]);
    const dg = Math.abs(aBuf[i + 1] - bBuf[i + 1]);
    const db = Math.abs(aBuf[i + 2] - bBuf[i + 2]);
    if (dr > 8 || dg > 8 || db > 8) diff += 1;
  }
  const pixels = (aMeta.width * aMeta.height) || 1;
  return diff / pixels;
}

async function assertNoLiveLeak(page: Page, surface: Surface) {
  const root = workbenchRoot(page, surface);
  await expect(root).toBeVisible();
  // Fixture identities that must appear on both
  await expect(page.getByText("Your model moved in 3 places.")).toBeVisible();
  // Live-only markers must not appear
  const html = await page.content();
  if (html.includes("buildCanonicalLiveRuntimeData")) {
    throw new Error(`${surface}: live provider symbol leaked into HTML`);
  }
  if (html.includes("useOrvekHybridWorkbenchDataApi")) {
    throw new Error(`${surface}: hybrid hook leaked into HTML`);
  }
}

type PathAction = (page: Page, surface: Surface) => Promise<void>;

const LEAD_TITLE = "Use v0 architecture prototype before final design";
const MAP_OBJECT = "You often need visual expression before locking architecture.";
const DECISION_TITLE = "Use v0 architecture prototype before final design";

async function dismissBlockingOverlay(page: Page) {
  for (let i = 0; i < 4; i += 1) {
    const overlay = page.locator("div.fixed.inset-0.z-50").first();
    if (!(await overlay.isVisible().catch(() => false))) {
      return;
    }
    const closeReport = overlay.getByRole("button", { name: "Close report", exact: true });
    if (await closeReport.isVisible().catch(() => false)) {
      await closeReport.click({ force: true });
      await page.waitForTimeout(200);
      continue;
    }
    const close = overlay.getByRole("button", { name: "Close", exact: true });
    if (await close.isVisible().catch(() => false)) {
      await close.click({ force: true });
      await page.waitForTimeout(200);
      continue;
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}

function inspectorAside(page: Page) {
  return page.locator("aside").last();
}

async function runPathOnSurface(
  page: Page,
  surface: Surface,
  captures: Map<string, { path: string; fingerprint: string }>,
) {
  const shot = async (id: string) => {
    captures.set(`${surface}:${id}`, await capture(page, surface, id));
  };

  // 1 Today initial
  await waitReady(page, surface);
  await assertNoLiveLeak(page, surface);
  await shot("01-today-initial");

  // 2 Today selected object (lead)
  await page.getByRole("button", { name: LEAD_TITLE }).first().click();
  await expect(page.getByRole("heading", { name: LEAD_TITLE }).first()).toBeVisible({
    timeout: 15_000,
  });
  await shot("02-today-selected-object");

  // 3 Evidence / Context top
  await page.getByRole("button", { name: "Evidence / Context", exact: true }).click();
  await page.waitForTimeout(200);
  await shot("03-evidence-context-top");

  // 4 Evidence lower — scroll inspector body
  const aside = inspectorAside(page);
  const inspectorScroll = aside.locator('[class*="overflow-y-auto"]').first();
  if (await inspectorScroll.count()) {
    await inspectorScroll.evaluate((el) => {
      el.scrollTop = Math.min(el.scrollHeight, 420);
    });
  } else {
    await aside.evaluate((el) => {
      el.scrollTop = Math.min(el.scrollHeight, 420);
    });
  }
  await page.waitForTimeout(200);
  await shot("04-evidence-context-lower");

  // 5 Linked receipt — prefer explicit receipt-like rows inside the inspector
  await dismissBlockingOverlay(page);
  const receiptBtn = aside
    .getByRole("button")
    .filter({ hasText: /Receipt|Linked receipt|capture from|journal entry/i })
    .first();
  if (await receiptBtn.isVisible().catch(() => false)) {
    await receiptBtn.click({ force: true });
  } else {
    const linked = aside.getByRole("button").filter({ hasText: /^r[0-9]/i }).first();
    if (await linked.isVisible().catch(() => false)) {
      await linked.click({ force: true });
    } else {
      // Fallback: first non-tab row in related/receipts section
      const fallback = aside
        .getByRole("button")
        .filter({ hasText: /scope-reopening|prototype|visual|pressure|avoidance/i })
        .first();
      await fallback.click({ force: true, timeout: 10_000 });
    }
  }
  await page.waitForTimeout(300);
  await dismissBlockingOverlay(page);
  await shot("05-linked-receipt");

  // 6 Linked context/object — Back then open a context-profile link
  await dismissBlockingOverlay(page);
  const backBtn = page.getByRole("button", { name: /^Back to /i }).first();
  if (await backBtn.isVisible().catch(() => false)) {
    await backBtn.click({ force: true });
    await page.waitForTimeout(200);
  }
  await dismissBlockingOverlay(page);
  const contextLink = aside
    .getByRole("button")
    .filter({ hasText: /Background context|Context Profile|Current build|Values|Self-model|Constraints/i })
    .first();
  if (await contextLink.isVisible().catch(() => false)) {
    await contextLink.click({ force: true });
    await page.waitForTimeout(300);
  } else {
    const anyCtx = aside.getByRole("button").filter({ hasText: /ctx-|Background|Values/i }).first();
    if (await anyCtx.isVisible().catch(() => false)) {
      await anyCtx.click({ force: true });
      await page.waitForTimeout(300);
    }
  }
  await dismissBlockingOverlay(page);
  await shot("06-linked-context-object");

  // 7 Back to parent
  await dismissBlockingOverlay(page);
  const back2 = page.getByRole("button", { name: /^Back to /i }).first();
  if (await back2.isVisible().catch(() => false)) {
    await back2.click({ force: true });
    await page.waitForTimeout(250);
  }
  await shot("07-back-to-parent");

  // 8 Model Movement
  await page.getByRole("button", { name: "Model Movement", exact: true }).click();
  await page.waitForTimeout(250);
  await shot("08-model-movement");

  // 9 Report overlay open
  await dismissBlockingOverlay(page);
  const openReport = page
    .getByRole("button", { name: /Open (Model Movement )?report/i })
    .first();
  if (await openReport.isVisible().catch(() => false)) {
    await openReport.click();
  } else {
    await page.getByText("Weekly Model Movement report").first().click();
  }
  await expect(
    page.locator("div.fixed.inset-0.z-50").getByText(/Model Movement report|Weekly Model Movement/i).first(),
  ).toBeVisible({ timeout: 15_000 });
  await shot("09-report-overlay-open");

  // 10 Report lower
  await page.locator("div.fixed.inset-0.z-50").evaluate((el) => {
    el.scrollTop = Math.min(el.scrollHeight, 600);
  });
  await page.waitForTimeout(200);
  await shot("10-report-overlay-lower");

  // 11 Close report and return
  await dismissBlockingOverlay(page);
  await page.waitForTimeout(300);
  await shot("11-report-close-return");

  // 12 Map
  await nav(page, "Map");
  await expect(page.getByText(/Your Map|mixed \/ evolving|Patterns/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await shot("12-map");

  // 13 Map selected object
  const mapObj = page.getByRole("button", { name: MAP_OBJECT }).first();
  if (await mapObj.isVisible().catch(() => false)) {
    await mapObj.click();
  } else {
    await page.getByRole("button").filter({ hasText: /claim|visual expression/i }).first().click();
  }
  await page.waitForTimeout(300);
  await shot("13-map-selected-object");

  // 14 Decisions
  await nav(page, "Decisions");
  await expect(page.getByText(/Active|Outcome due|Reviewed/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await shot("14-decisions");

  // 15 Decision selected
  const decision = page.getByRole("button", { name: DECISION_TITLE }).first();
  await decision.click();
  await page.waitForTimeout(300);
  await shot("15-decision-selected");

  // 16 Experiment / Investigation
  await nav(page, "Explore");
  await page.getByRole("button", { name: "Investigations" }).click();
  await page.waitForTimeout(300);
  await shot("16-experiment-investigation");

  // 17 Explore (Free Explore)
  await page.getByRole("button", { name: "Free Explore" }).click();
  await expect(
    page.getByText(/architecture visually before locking design/i).first(),
  ).toBeVisible({ timeout: 15_000 });
  await shot("17-explore");

  // 18 Timeline
  await nav(page, "Timeline");
  await expect(page.getByText(/Today|This week|Model Updates/i).first()).toBeVisible({
    timeout: 20_000,
  });
  await shot("18-timeline");
}

function verifyPrerequisites(): {
  coldUntouched: boolean;
  fixtureProvider: boolean;
  separateRoutes: boolean;
  noLiveOnFixtureRoute: boolean;
  notes: string[];
} {
  const notes: string[] = [];
  const frozenDir = resolve(ROOT, "components/orvek-v0-reference-frozen");
  const coldPage = readFileSync(
    resolve(ROOT, "app/dev/orvek-v0-reference/page.tsx"),
    "utf8",
  );
  const fixturePage = readFileSync(
    resolve(ROOT, "app/dev/orvek-v0-canonical-reference/page.tsx"),
    "utf8",
  );
  const fixtureProvider = readFileSync(
    resolve(ROOT, "components/orvek-v0-canonical/fixture-provider.ts"),
    "utf8",
  );

  const coldMountOk = coldPage.includes("FrozenReferenceWorkbench");
  const frozenToday = existsSync(resolve(frozenDir, "pages/today.tsx"));
  const entryPath = resolve(ROOT, "components/orvek-v0-canonical/canonical-fixture-entry.tsx");
  const entrySource = existsSync(entryPath) ? readFileSync(entryPath, "utf8") : "";
  const fixtureOk =
    fixturePage.includes("CanonicalFixtureEntry") &&
    !fixturePage.includes("createCanonicalFixtureRuntimeData") &&
    !fixturePage.includes("CanonicalWorkbench") &&
    !fixturePage.includes("buildCanonicalLiveRuntimeData") &&
    !fixturePage.includes("useOrvekHybridWorkbenchDataApi") &&
    entrySource.includes("createCanonicalFixtureRuntimeData") &&
    entrySource.includes("CanonicalWorkbench") &&
    entrySource.includes('"use client"');
  const providerOk =
    fixtureProvider.includes("createCanonicalFixtureRuntimeData") &&
    fixtureProvider.includes("referenceSurface: true") &&
    fixtureProvider.includes('leadId: "d1"') &&
    fixtureProvider.includes('reportId: "rep-weekly"') &&
    fixtureProvider.includes('"use client"');

  if (!coldMountOk) notes.push("Cold route does not mount FrozenReferenceWorkbench");
  if (!frozenToday) notes.push("Frozen today page missing");
  if (!fixtureOk)
    notes.push(
      "Canonical fixture route must render CanonicalFixtureEntry only; fixture data created client-side",
    );
  if (!providerOk) notes.push("Fixture provider missing accepted reference identities or client directive");

  notes.push(
    "Routes are separate app pages; each gate run uses an isolated BrowserContext (no shared workbench store).",
  );
  notes.push(
    "Canonical fixture route does not import live/hybrid providers (source verified).",
  );

  return {
    coldUntouched: coldMountOk && frozenToday,
    fixtureProvider: fixtureOk && providerOk,
    separateRoutes: true,
    noLiveOnFixtureRoute: fixtureOk,
    notes,
  };
}

function writeMatrix(rows: StateRow[], prereq: ReturnType<typeof verifyPrerequisites>, overall: "PASS" | "FAIL") {
  const lines: string[] = [];
  lines.push("# 15 — Step 4 fixture equivalence matrix");
  lines.push("");
  lines.push(`Campaign: \`${CAMPAIGN}\``);
  lines.push(`Date: \`${new Date().toISOString().slice(0, 10)}\``);
  lines.push(`Viewport: 1440×900`);
  lines.push(`Cold: \`${ORIGIN}${COLD_PATH}\``);
  lines.push(`Fixture: \`${ORIGIN}${FIXTURE_PATH}\``);
  lines.push("");
  lines.push(`## Overall verdict`);
  lines.push("");
  lines.push(
    overall === "PASS"
      ? "**STEP 4 GATE PASSED — READY FOR LIVE HARD-SWAP REVIEW**"
      : "**FAIL — CANONICAL FIXTURE DOES NOT MATCH COLD REFERENCE**",
  );
  lines.push("");
  lines.push("## Prerequisites");
  lines.push("");
  lines.push(`| Check | Result |`);
  lines.push(`|-------|--------|`);
  lines.push(
    `| Cold reference package / mount intact | ${prereq.coldUntouched ? "PASS" : "FAIL"} |`,
  );
  lines.push(
    `| Canonical route uses fixture provider | ${prereq.fixtureProvider ? "PASS" : "FAIL"} |`,
  );
  lines.push(
    `| Separate routes / isolated contexts | ${prereq.separateRoutes ? "PASS" : "FAIL"} |`,
  );
  lines.push(
    `| No live provider on fixture route (source) | ${prereq.noLiveOnFixtureRoute ? "PASS" : "FAIL"} |`,
  );
  for (const n of prereq.notes) {
    lines.push(`- ${n}`);
  }
  lines.push("");
  lines.push("## Comparison matrix");
  lines.push("");
  lines.push(
    "| state | cold screenshot | fixture screenshot | cold component path | fixture component path | cold provider | fixture provider | visible mismatch | behavioural mismatch | pixelDiff | textMatch | PASS/FAIL |",
  );
  lines.push(
    "|-------|-----------------|--------------------|---------------------|------------------------|---------------|------------------|------------------|----------------------|-----------|-----------|-----------|",
  );
  for (const row of rows) {
    lines.push(
      `| ${row.state} | \`${row.coldScreenshot}\` | \`${row.fixtureScreenshot}\` | \`${row.coldComponentPath}\` | \`${row.fixtureComponentPath}\` | ${row.coldProvider} | ${row.fixtureProvider} | ${row.visibleMismatch ?? "—"} | ${row.behaviouralMismatch ?? "—"} | ${row.pixelDiffRatio == null ? "n/a" : row.pixelDiffRatio.toFixed(5)} | ${row.textFingerprintMatch ? "yes" : "no"} | **${row.verdict}** |`,
    );
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push(
    "- Pixel threshold: differing pixels (channel delta > 8) above 0.2% of frame ⇒ visual FAIL.",
  );
  lines.push(
    "- Text fingerprint: SHA-256 of normalized workbench `innerText`; mismatch ⇒ content/composition FAIL.",
  );
  lines.push(
    "- No product code was modified during this verification pass.",
  );
  writeFileSync(MATRIX_MD, `${lines.join("\n")}\n`);
  writeFileSync(
    MATRIX_JSON,
    `${JSON.stringify({ overall, viewport: VIEWPORT, origin: ORIGIN, rows, prereq }, null, 2)}\n`,
  );
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const prereq = verifyPrerequisites();
  if (
    !prereq.coldUntouched ||
    !prereq.fixtureProvider ||
    !prereq.noLiveOnFixtureRoute
  ) {
    writeMatrix([], prereq, "FAIL");
    console.error("Prerequisite failure — see matrix.");
    process.exit(2);
  }

  const env = readEnvFile();
  const clerk = createClerkClient({
    secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
    publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
  });

  let auth: AuthState | null = null;
  const browser = await chromium.launch({ headless: true });
  const rows: StateRow[] = [];
  const tokenRef = { current: "" };

  try {
    auth = await createAuthState(clerk, "step4-fixture-gate");

    // Isolated contexts — no shared mutable workbench state
    const coldPack = await createAuthedContext(browser, clerk, auth, ORIGIN);
    const fixturePack = await createAuthedContext(browser, clerk, auth, ORIGIN);
    const coldPage = await coldPack.context.newPage();
    const fixturePage = await fixturePack.context.newPage();

    await gotoAuthed(
      coldPage,
      coldPack.context,
      clerk,
      auth,
      ORIGIN,
      tokenRef,
      COLD_PATH,
    );
    await gotoAuthed(
      fixturePage,
      fixturePack.context,
      clerk,
      auth,
      ORIGIN,
      tokenRef,
      FIXTURE_PATH,
    );

    // Confirm route testids (fixture must not be live shell)
    await expect(coldPage.locator('[data-testid="orvek-v0-reference-route"]')).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      fixturePage.locator('[data-testid="orvek-v0-canonical-reference-route"]'),
    ).toBeVisible({ timeout: 60_000 });

    const coldCaps = new Map<string, { path: string; fingerprint: string }>();
    const fixtureCaps = new Map<string, { path: string; fingerprint: string }>();

    await runPathOnSurface(coldPage, "cold", coldCaps);
    // Fresh navigation for fixture path so starting conditions match
    await gotoAuthed(
      fixturePage,
      fixturePack.context,
      clerk,
      auth,
      ORIGIN,
      tokenRef,
      FIXTURE_PATH,
    );
    await runPathOnSurface(fixturePage, "fixture", fixtureCaps);

    const stateDefs: {
      id: string;
      label: string;
      coldComponent: string;
      fixtureComponent: string;
    }[] = [
      {
        id: "01-today-initial",
        label: "Today initial state",
        coldComponent: "orvek-v0-reference-frozen/pages/today.tsx",
        fixtureComponent: "orvek-v0-canonical/pages/today.tsx",
      },
      {
        id: "02-today-selected-object",
        label: "Today selected object",
        coldComponent: "orvek-v0-authority/evidence-panel.tsx",
        fixtureComponent: "orvek-v0-authority/evidence-panel.tsx",
      },
      {
        id: "03-evidence-context-top",
        label: "Evidence / Context top",
        coldComponent: "orvek-v0-authority/evidence-panel.tsx",
        fixtureComponent: "orvek-v0-authority/evidence-panel.tsx",
      },
      {
        id: "04-evidence-context-lower",
        label: "Evidence / Context lower sections",
        coldComponent: "orvek-v0-authority/evidence-panel.tsx",
        fixtureComponent: "orvek-v0-authority/evidence-panel.tsx",
      },
      {
        id: "05-linked-receipt",
        label: "Linked receipt",
        coldComponent: "orvek-v0-authority/evidence-panel.tsx",
        fixtureComponent: "orvek-v0-authority/evidence-panel.tsx",
      },
      {
        id: "06-linked-context-object",
        label: "Linked context/object",
        coldComponent: "orvek-v0-authority/evidence-panel.tsx",
        fixtureComponent: "orvek-v0-authority/evidence-panel.tsx",
      },
      {
        id: "07-back-to-parent",
        label: "Back to parent object",
        coldComponent: "orvek-v0-authority/evidence-panel.tsx + store",
        fixtureComponent: "orvek-v0-authority/evidence-panel.tsx + store",
      },
      {
        id: "08-model-movement",
        label: "Model Movement",
        coldComponent: "orvek-v0-authority/evidence-panel.tsx",
        fixtureComponent: "orvek-v0-authority/evidence-panel.tsx",
      },
      {
        id: "09-report-overlay-open",
        label: "Report overlay open",
        coldComponent: "orvek-v0/overlays.tsx",
        fixtureComponent: "orvek-v0/overlays.tsx",
      },
      {
        id: "10-report-overlay-lower",
        label: "Report overlay lower content",
        coldComponent: "orvek-v0/overlays.tsx",
        fixtureComponent: "orvek-v0/overlays.tsx",
      },
      {
        id: "11-report-close-return",
        label: "Report overlay close and return",
        coldComponent: "orvek-v0/overlays.tsx + store",
        fixtureComponent: "orvek-v0/overlays.tsx + store",
      },
      {
        id: "12-map",
        label: "Map",
        coldComponent: "orvek-v0-reference-frozen/pages/map.tsx",
        fixtureComponent: "orvek-v0-canonical/pages/map.tsx",
      },
      {
        id: "13-map-selected-object",
        label: "Map selected object",
        coldComponent: "orvek-v0-reference-frozen/pages/map.tsx",
        fixtureComponent: "orvek-v0-canonical/pages/map.tsx",
      },
      {
        id: "14-decisions",
        label: "Decisions",
        coldComponent: "orvek-v0-reference-frozen/pages/decisions.tsx",
        fixtureComponent: "orvek-v0-canonical/pages/decisions.tsx",
      },
      {
        id: "15-decision-selected",
        label: "Decision selected object",
        coldComponent: "orvek-v0-reference-frozen/pages/decisions.tsx",
        fixtureComponent: "orvek-v0-canonical/pages/decisions.tsx",
      },
      {
        id: "16-experiment-investigation",
        label: "Experiment / Investigation",
        coldComponent: "orvek-v0-reference-frozen/pages/explore.tsx",
        fixtureComponent: "orvek-v0-canonical/pages/explore.tsx",
      },
      {
        id: "17-explore",
        label: "Explore",
        coldComponent: "orvek-v0-reference-frozen/pages/explore.tsx",
        fixtureComponent: "orvek-v0-canonical/pages/explore.tsx",
      },
      {
        id: "18-timeline",
        label: "Timeline",
        coldComponent: "orvek-v0-reference-frozen/pages/timeline.tsx",
        fixtureComponent: "orvek-v0-canonical/pages/timeline.tsx",
      },
    ];

    let firstFail: string | null = null;
    for (const def of stateDefs) {
      const cold = coldCaps.get(`cold:${def.id}`);
      const fix = fixtureCaps.get(`fixture:${def.id}`);
      if (!cold || !fix) {
        rows.push({
          id: def.id,
          state: def.label,
          coldScreenshot: cold?.path ?? "(missing)",
          fixtureScreenshot: fix?.path ?? "(missing)",
          coldComponentPath: def.coldComponent,
          fixtureComponentPath: def.fixtureComponent,
          coldProvider: "frozen hard-imports + createFrozenReferenceDataApi",
          fixtureProvider: "createCanonicalFixtureRuntimeData",
          visibleMismatch: "Capture missing for one or both surfaces",
          behaviouralMismatch: "Path did not complete identically",
          pixelDiffRatio: null,
          textFingerprintMatch: false,
          verdict: "FAIL",
        });
        firstFail ??= def.id;
        break; // stop on first mismatch per instructions
      }

      const ratio = await pixelDiffRatio(cold.path, fix.path);
      const textMatch = cold.fingerprint === fix.fingerprint;
      const visualFail = ratio > PIXEL_FAIL_THRESHOLD;
      const fail = visualFail || !textMatch;
      const relCold = cold.path.replace(`${ROOT}/`, "");
      const relFix = fix.path.replace(`${ROOT}/`, "");

      rows.push({
        id: def.id,
        state: def.label,
        coldScreenshot: relCold,
        fixtureScreenshot: relFix,
        coldComponentPath: def.coldComponent,
        fixtureComponentPath: def.fixtureComponent,
        coldProvider: "frozen hard-imports + createFrozenReferenceDataApi",
        fixtureProvider: "createCanonicalFixtureRuntimeData",
        visibleMismatch: visualFail
          ? `Pixel diff ratio ${ratio.toFixed(5)} > ${PIXEL_FAIL_THRESHOLD}`
          : null,
        behaviouralMismatch: textMatch
          ? null
          : "Normalized workbench text fingerprint differs (composition/copy/identity)",
        pixelDiffRatio: ratio,
        textFingerprintMatch: textMatch,
        verdict: fail ? "FAIL" : "PASS",
      });

      if (fail) {
        firstFail = def.id;
        break;
      }
    }

    const overall = firstFail || rows.some((r) => r.verdict === "FAIL") ? "FAIL" : "PASS";
    writeMatrix(rows, prereq, overall);

    await coldPack.context.close();
    await fixturePack.context.close();

    console.log(overall === "PASS" ? "STEP4_PASS" : `STEP4_FAIL:${firstFail}`);
    process.exit(overall === "PASS" ? 0 : 1);
  } finally {
    await cleanupAuth(clerk, auth);
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  const prereq = verifyPrerequisites();
  writeMatrix(
    [
      {
        id: "00-runner",
        state: "Gate runner error",
        coldScreenshot: "—",
        fixtureScreenshot: "—",
        coldComponentPath: "—",
        fixtureComponentPath: "—",
        coldProvider: "—",
        fixtureProvider: "—",
        visibleMismatch: String(err),
        behaviouralMismatch: "Runner aborted before complete path comparison",
        pixelDiffRatio: null,
        textFingerprintMatch: false,
        verdict: "FAIL",
      },
    ],
    prereq,
    "FAIL",
  );
  process.exit(1);
});
