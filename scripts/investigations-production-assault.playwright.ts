/**
 * Authenticated Playwright proof for DESKTOP-INVESTIGATIONS-PRODUCTION-ASSAULT-001.
 */
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  cleanupInvestigationsAssaultRuntimeFixture,
  countInvestigationsAssaultRuntimeFixture,
  investigationsAssaultFixtureAllowed,
  INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID,
  INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID,
  INVESTIGATIONS_ASSAULT_UI_QUESTION_PREFIX,
  INVESTIGATIONS_ASSAULT_UI_TITLE_PREFIX,
  INVESTIGATIONS_ASSAULT_UI_WATCH_FOR_PREFIX,
  seedInvestigationsAssaultRuntimeFixture,
} from "../lib/investigations-assault-runtime-fixture";

type EnvMap = Record<string, string>;

type AuthState = {
  userId: string;
  email: string;
  password: string;
  sessionId: string;
  sessionToken: string;
  clientUat: string;
};

type InvestigationBrowserArtifact = {
  investigationId: string;
  title: string;
  organizingQuestion: string;
};

type LinkedActivityArtifact = InvestigationBrowserArtifact & {
  evidenceId: string;
  evidenceLinkId: string;
  watchForId: string;
  watchForPrompt: string;
  watchForReason: string;
  checkInNote: string;
  checkInOutcome: string | null;
  inspectorId: string;
};

type ClosureArtifact = LinkedActivityArtifact & {
  outcome: string;
  finalStatus: string;
  resolvedAt: string | null;
  inspectorStatus: string;
};

type NegativeStatusArtifact = {
  unauthenticatedList: number;
  unauthenticatedDetail: number;
  unauthenticatedCreate: number;
  unauthenticatedUpdate: number;
  unauthenticatedClosure: number;
  crossUserList: number;
  crossUserDetail: number;
  crossUserUpdate: number;
  crossUserClosure: number;
  crossUserEvidenceAttachment: number;
  crossUserFieldworkAssociation: number;
  missingInvestigation: number;
  missingEvidence: number;
  missingFieldwork: number;
  malformedCreate: number;
  malformedUpdate: number;
  malformedClosure: number;
  invalidLifecycleTransition: number;
};

type AssaultArtifacts = {
  createAndReload: InvestigationBrowserArtifact | null;
  linkage: LinkedActivityArtifact | null;
  closure: ClosureArtifact | null;
  negativeStatuses: NegativeStatusArtifact | null;
  cleanup: Awaited<ReturnType<typeof cleanupInvestigationsAssaultRuntimeFixture>> | null;
};

const ROOT = resolve(process.cwd());
const RECEIPTS_DIR = resolve(
  ROOT,
  "docs/agent-runs/receipts/DESKTOP-INVESTIGATIONS-PRODUCTION-ASSAULT-001"
);
const PLAYWRIGHT_ARTIFACT_PATH = resolve(RECEIPTS_DIR, "playwright-artifacts.json");
const LOCAL_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/companion";
const ORIGIN = "http://localhost:3000";
const REFERENCE_INVESTIGATION_TITLE = "Why do I reopen scope before design?";
const REFERENCE_QUESTION_TITLE = "Does public visibility trigger overbuilding?";
const CHECK_IN_NOTE =
  "Investigations assault check-in: the stop point only held once I named it before the next ask.";
const CHECK_IN_OUTCOME =
  "Investigations assault check-in outcome: naming the stop point reduced escalation.";
const OUTCOME_NOTE =
  "Investigations assault outcome: explicit stop-point naming reduced reopened scope pressure.";

const artifacts: AssaultArtifacts = {
  createAndReload: null,
  linkage: null,
  closure: null,
  negativeStatuses: null,
  cleanup: null,
};

function readEnvFile(relativePath: string): EnvMap {
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
  const value = process.env[key] ?? env[key];
  if (!value) throw new Error(`Missing ${key} in .env`);
  return value;
}

function loadBestAvailableEnv(): EnvMap {
  const candidates = [".env", ".env.local", ".env.example"];

  for (const candidate of candidates) {
    try {
      return readEnvFile(candidate);
    } catch {
      // try the next env source
    }
  }

  return {};
}

function assertRealClerkEnv(env: EnvMap) {
  const publishableKey = requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  const secretKey = requireEnv(env, "CLERK_SECRET_KEY");

  if (publishableKey.endsWith("...") || secretKey.endsWith("...")) {
    throw new Error(
      "Clerk credentials are placeholders. Provide real NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY."
    );
  }
}

function uniqueEmail(prefix: string): string {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}.${stamp}@example.com`;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

test.describe("investigations production assault browser proof", () => {
  test.describe.configure({ mode: "serial", timeout: 900_000 });

  let env: EnvMap;
  let prisma: PrismaClient;
  let devBrowserToken = "";
  let clerk = createClerkClient({ secretKey: "", publishableKey: "" });
  let primaryAuth: AuthState | null = null;
  let crossAuth: AuthState | null = null;
  let emptyAuth: AuthState | null = null;
  let crossInvestigationId = "";
  let crossEvidenceId = "";

  function cookieHeader(authState: AuthState): string {
    return `__session=${authState.sessionToken}; __clerk_db_jwt=${devBrowserToken}; __client_uat=${authState.clientUat}`;
  }

  function authenticatedHeaders(
    authState: AuthState,
    headers: Record<string, string> = {}
  ): Record<string, string> {
    return {
      ...headers,
      Cookie: cookieHeader(authState),
      Authorization: `Bearer ${authState.sessionToken}`,
    };
  }

  async function createAuthState(prefix: string): Promise<AuthState> {
    const email = uniqueEmail(prefix);
    const password = `Tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-Aa1!`;
    const user = await clerk.users.createUser({
      emailAddress: [email],
      password,
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });
    const session = await clerk.sessions.createSession({ userId: user.id });
    const sessionToken = (await clerk.sessions.getToken(session.id)).jwt;
    const payload = decodeJwtPayload(sessionToken);

    return {
      userId: user.id,
      email,
      password,
      sessionId: session.id,
      sessionToken,
      clientUat: typeof payload.iat === "number" ? String(payload.iat) : "1",
    };
  }

  async function refreshSessionToken(authState: AuthState) {
    try {
      authState.sessionToken = (await clerk.sessions.getToken(authState.sessionId)).jwt;
      const payload = decodeJwtPayload(authState.sessionToken);
      if (typeof payload.iat === "number") {
        authState.clientUat = String(payload.iat);
      }
    } catch (error) {
      console.warn(
        `[investigations-production-assault] failed to refresh Clerk session token for ${authState.userId}:`,
        error
      );
    }
  }

  async function refreshAuthCookies(
    context: BrowserContext,
    authState: AuthState,
    baseURL?: string
  ) {
    const origin = baseURL ?? ORIGIN;
    await context.addCookies([
      { name: "__session", value: authState.sessionToken, url: origin },
      { name: "__clerk_db_jwt", value: devBrowserToken, url: origin },
      { name: "__client_uat", value: authState.clientUat, url: origin },
    ]);
  }

  async function stabilizeAuthenticatedSession(
    page: Page,
    context: BrowserContext,
    authState: AuthState,
    baseURL?: string
  ) {
    await refreshSessionToken(authState);
    await refreshAuthCookies(context, authState, baseURL);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await refreshAuthCookies(context, authState, baseURL);

    if (await page.getByRole("heading", { name: /Sign in/i }).isVisible().catch(() => false)) {
      await refreshSessionToken(authState);
      await refreshAuthCookies(context, authState, baseURL);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await refreshAuthCookies(context, authState, baseURL);
    }

    await expect(page.getByTestId("nav-today")).toBeVisible({ timeout: 90_000 });
    await expect
      .poll(
        async () => {
          const response = await context.request.get("/api/investigations?limit=1", {
            headers: authenticatedHeaders(authState),
          });
          return response.ok();
        },
        { timeout: 90_000 }
      )
      .toBe(true);

    await expect
      .poll(
        async () => {
          await refreshSessionToken(authState);
          await refreshAuthCookies(context, authState, baseURL);
          try {
            return await page.evaluate(async () => {
              try {
                const response = await fetch("/api/investigations?limit=1", { cache: "no-store" });
                return response.ok;
              } catch {
                return false;
              }
            });
          } catch {
            return false;
          }
        },
        { timeout: 90_000 }
      )
      .toBe(true);
  }

  async function recoverAfterReload(
    page: Page,
    context: BrowserContext,
    authState: AuthState,
    baseURL?: string
  ) {
    await refreshSessionToken(authState);
    await refreshAuthCookies(context, authState, baseURL);
    await page.reload({ waitUntil: "domcontentloaded" });
    await refreshAuthCookies(context, authState, baseURL);
    await stabilizeAuthenticatedSession(page, context, authState, baseURL);
  }

  async function openAuthenticatedPage(
    browser: Browser,
    authState: AuthState,
    baseURL?: string
  ) {
    const context = await browser.newContext({
      baseURL: baseURL ?? ORIGIN,
    });
    const page = await context.newPage();
    await stabilizeAuthenticatedSession(page, context, authState, baseURL);
    return { context, page };
  }

  async function openExploreTab(
    page: Page,
    context: BrowserContext,
    authState: AuthState,
    baseURL: string | undefined,
    tab: "questions" | "investigations" | "fieldwork"
  ) {
    await stabilizeAuthenticatedSession(page, context, authState, baseURL);
    await expect(page.getByTestId("nav-explore")).toBeVisible({ timeout: 90_000 });
    await expect
      .poll(
        async () => {
          await page.getByTestId("nav-explore").click();
          return page.getByTestId("orvek-v0-explore-page").isVisible().catch(() => false);
        },
        { timeout: 60_000 }
      )
      .toBe(true);
    await expect
      .poll(
        async () => {
          await page.getByTestId(`explore-tab-${tab}`).click();
          return page.getByTestId(`explore-tab-${tab}`).getAttribute("aria-current");
        },
        { timeout: 30_000 }
      )
      .toBe("page");
  }

  async function recoverAfterReloadToExploreTab(
    page: Page,
    context: BrowserContext,
    authState: AuthState,
    baseURL: string | undefined,
    tab: "questions" | "investigations" | "fieldwork"
  ) {
    await recoverAfterReload(page, context, authState, baseURL);
    await openExploreTab(page, context, authState, baseURL, tab);
  }

  async function fetchInvestigationRow(id: string, authState: AuthState) {
    const response = await fetch(`${ORIGIN}/api/investigations/${encodeURIComponent(id)}`, {
      headers: authenticatedHeaders(authState),
    });
    const payload = await readJson<{
      item?: {
        id: string;
        title: string;
        status: string;
        resolutionSummary: string | null;
        resolvedAt: string | null;
        organizingQuestion: string;
      };
    }>(response);
    return { response, payload };
  }

  async function fetchInvestigationLinks(id: string, authState: AuthState) {
    const response = await fetch(
      `${ORIGIN}/api/understanding/evidence-links?targetType=investigation&targetId=${encodeURIComponent(id)}`,
      {
        headers: authenticatedHeaders(authState),
      }
    );
    const payload = await readJson<{
      items?: Array<{ id: string; targetId: string; sourceId: string }>;
    }>(response);
    return { response, payload };
  }

  async function createInvestigationViaUi(
    page: Page,
    context: BrowserContext,
    authState: AuthState,
    baseURL: string | undefined,
    label: string
  ): Promise<InvestigationBrowserArtifact> {
    const title = `${INVESTIGATIONS_ASSAULT_UI_TITLE_PREFIX} ${label} ${Date.now()}`;
    const organizingQuestion = `${INVESTIGATIONS_ASSAULT_UI_QUESTION_PREFIX} ${label} ${Date.now()}`;

    await openExploreTab(page, context, authState, baseURL, "questions");
    await expect(page.getByTestId("active-questions-create-card")).toBeVisible({ timeout: 60_000 });

    await page.getByTestId("active-questions-create-title").fill(title);
    await page.getByTestId("active-questions-create-question").fill(organizingQuestion);

    const createPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/investigations") &&
        response.request().method() === "POST",
      { timeout: 30_000 }
    );
    await page.getByTestId("active-questions-create-submit").click();
    const createResponse = await createPromise;
    expect(createResponse.status()).toBe(201);

    const createPayload = (await createResponse.json()) as { item?: { id?: string } };
    const investigationId = createPayload.item?.id;
    expect(investigationId).toBeTruthy();

    await expect(page.getByTestId("active-questions-create-success-id")).toContainText(
      investigationId!,
      { timeout: 30_000 }
    );
    await expect(
      page.getByTestId("active-question-row").filter({ hasText: investigationId! }).first()
    ).toBeVisible({ timeout: 60_000 });

    console.log(
      `[investigations-production-assault] created investigation id=${investigationId} title=${title}`
    );

    return {
      investigationId: investigationId!,
      title,
      organizingQuestion,
    };
  }

  async function openInvestigationDetailFromList(
    page: Page,
    investigationId: string,
    title?: string
  ) {
    const row = page.getByTestId("active-question-row").filter({ hasText: investigationId }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.click();
    await expect(page.getByTestId("investigation-id")).toContainText(investigationId, {
      timeout: 60_000,
    });
    if (title) {
      await expect(
        page
          .getByTestId("production-investigation-detail")
          .getByRole("heading", { name: title })
      ).toBeVisible({ timeout: 60_000 });
    }
  }

  async function openClosedInvestigationFromExploreTab(
    page: Page,
    context: BrowserContext,
    authState: AuthState,
    baseURL: string | undefined,
    investigationId: string
  ) {
    await openExploreTab(page, context, authState, baseURL, "investigations");
    const row = page.getByTestId("investigation-row").filter({ hasText: investigationId }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.click();
    await expect(page.getByTestId("investigation-id")).toContainText(investigationId, {
      timeout: 60_000,
    });
  }

  async function waitForInspectorIdentity(page: Page, investigationId: string) {
    const panel = page.locator('[data-testid="inspector-investigation-panel"]:visible').first();
    await expect(panel).toBeVisible({ timeout: 60_000 });
    await expect(panel.getByTestId("inspector-investigation-id")).toContainText(investigationId, {
      timeout: 60_000,
    });
    return panel;
  }

  async function attachEvidenceViaUi(
    page: Page,
    context: BrowserContext,
    authState: AuthState,
    baseURL: string | undefined,
    investigationId: string,
    evidenceId: string
  ) {
    await expect(page.getByTestId(`investigation-available-evidence-${evidenceId}`)).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId(`investigation-available-evidence-${evidenceId}`).check();

    const linkPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/understanding/evidence-links") &&
        response.request().method() === "POST",
      { timeout: 30_000 }
    );
    await page.getByTestId("investigation-link-evidence-submit").click();
    const linkResponse = await linkPromise;
    expect(linkResponse.status()).toBe(201);
    const linkPayload = (await linkResponse.json()) as {
      item?: { id?: string; sourceId?: string; targetId?: string };
    };
    const evidenceLinkId = linkPayload.item?.id;
    expect(evidenceLinkId).toBeTruthy();

    await expect(page.getByTestId("investigation-linked-evidence-list")).toContainText(
      `Evidence ID ${evidenceId}`,
      { timeout: 60_000 }
    );

    await recoverAfterReloadToExploreTab(page, context, authState, baseURL, "questions");
    await openInvestigationDetailFromList(page, investigationId, "");
    await expect(page.getByTestId("investigation-id")).toContainText(investigationId, {
      timeout: 60_000,
    });
    await expect(page.getByTestId("investigation-linked-evidence-list")).toContainText(
      `Evidence ID ${evidenceId}`,
      { timeout: 60_000 }
    );

    const links = await fetchInvestigationLinks(investigationId, authState);
    expect(links.response.status).toBe(200);
    expect(
      links.payload?.items?.some((item) => item.id === evidenceLinkId && item.sourceId === evidenceId)
    ).toBe(true);

    console.log(
      `[investigations-production-assault] linked evidence investigation=${investigationId} evidence=${evidenceId} link=${evidenceLinkId}`
    );

    return {
      evidenceId,
      evidenceLinkId: evidenceLinkId!,
    };
  }

  async function createWatchForViaUi(
    page: Page,
    context: BrowserContext,
    authState: AuthState,
    baseURL: string | undefined,
    investigationId: string,
    label: string
  ) {
    const watchForPrompt = `${INVESTIGATIONS_ASSAULT_UI_WATCH_FOR_PREFIX} ${label} ${Date.now()}`;
    const watchForReason = `Reason for ${label}: verify whether naming the stop point changes the escalation.`;

    await page.getByTestId("investigation-watch-for-prompt").fill(watchForPrompt);
    await page.getByTestId("investigation-watch-for-reason").fill(watchForReason);

    const createPromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/fieldwork") &&
        response.request().method() === "POST",
      { timeout: 30_000 }
    );
    await page.getByTestId("investigation-watch-for-submit").click();
    const createResponse = await createPromise;
    expect(createResponse.status()).toBe(201);
    const payload = (await createResponse.json()) as { item?: { id?: string } };
    const watchForId = payload.item?.id;
    expect(watchForId).toBeTruthy();

    await expect(page.getByTestId("investigation-linked-fieldwork-list")).toContainText(
      `Fieldwork ID ${watchForId}`,
      { timeout: 60_000 }
    );

    await recoverAfterReloadToExploreTab(page, context, authState, baseURL, "questions");
    await openInvestigationDetailFromList(page, investigationId, "");
    await expect(page.getByTestId("investigation-id")).toContainText(investigationId, {
      timeout: 60_000,
    });
    await expect(page.getByTestId("investigation-linked-fieldwork-list")).toContainText(
      `Fieldwork ID ${watchForId}`,
      { timeout: 60_000 }
    );

    console.log(
      `[investigations-production-assault] created watch-for investigation=${investigationId} fieldwork=${watchForId}`
    );

    return {
      watchForId: watchForId!,
      watchForPrompt,
      watchForReason,
    };
  }

  async function recordWatchForCheckInViaUi(
    page: Page,
    context: BrowserContext,
    authState: AuthState,
    baseURL: string | undefined,
    watchForId: string
  ) {
    await openExploreTab(page, context, authState, baseURL, "fieldwork");
    const row = page.getByTestId("fieldwork-row").filter({ hasText: watchForId }).first();
    if (await row.count()) {
      await expect(row).toBeVisible({ timeout: 60_000 });
      await row.click();
    }
    await expect(page.getByTestId("watch-for-id")).toContainText(watchForId, { timeout: 60_000 });

    await page.getByTestId("durable-checkin-input").fill(CHECK_IN_NOTE);

    const patchPromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/fieldwork/${watchForId}`) &&
        response.request().method() === "PATCH",
      { timeout: 30_000 }
    );
    await page.getByTestId("durable-checkin-submit").click();
    const patchResponse = await patchPromise;
    expect(patchResponse.status()).toBe(200);

    await expect(page.getByTestId("durable-checkin-recorded")).toContainText(CHECK_IN_NOTE, {
      timeout: 30_000,
    });
    await recoverAfterReloadToExploreTab(page, context, authState, baseURL, "fieldwork");
    const reloadedRow = page.getByTestId("fieldwork-row").filter({ hasText: watchForId }).first();
    if (await reloadedRow.count()) {
      await expect(reloadedRow).toBeVisible({ timeout: 60_000 });
      await reloadedRow.click();
    }
    await expect(page.getByTestId("watch-for-id")).toContainText(watchForId, { timeout: 60_000 });
    await expect(page.getByTestId("durable-checkin-recorded")).toContainText(CHECK_IN_NOTE, {
      timeout: 60_000,
    });
  }

  async function createInvestigationWithLinkedActivity(
    page: Page,
    context: BrowserContext,
    authState: AuthState,
    baseURL: string | undefined,
    label: string,
    evidenceId = INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID
  ): Promise<LinkedActivityArtifact> {
    const created = await createInvestigationViaUi(page, context, authState, baseURL, label);
    await openInvestigationDetailFromList(page, created.investigationId, created.title);
    await expect(page.getByTestId("investigation-linked-evidence-empty")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("investigation-linked-fieldwork-empty")).toBeVisible({
      timeout: 30_000,
    });

    const linkedEvidence = await attachEvidenceViaUi(
      page,
      context,
      authState,
      baseURL,
      created.investigationId,
      evidenceId
    );
    const watchFor = await createWatchForViaUi(
      page,
      context,
      authState,
      baseURL,
      created.investigationId,
      label
    );

    await recordWatchForCheckInViaUi(page, context, authState, baseURL, watchFor.watchForId);

    await openExploreTab(page, context, authState, baseURL, "questions");
    await openInvestigationDetailFromList(page, created.investigationId, created.title);
    await page.getByTestId("investigation-open-inspector").click();
    const inspectorPanel = await waitForInspectorIdentity(page, created.investigationId);
    await expect(inspectorPanel).toContainText(`Evidence ID ${linkedEvidence.evidenceId}`, {
      timeout: 60_000,
    });
    await expect(inspectorPanel).toContainText(`Fieldwork ID ${watchFor.watchForId}`, {
      timeout: 60_000,
    });
    await expect(inspectorPanel).toContainText(CHECK_IN_NOTE, { timeout: 60_000 });

    const inspectorId = await inspectorPanel.getByTestId("inspector-investigation-id").innerText();

    return {
      ...created,
      evidenceId: linkedEvidence.evidenceId,
      evidenceLinkId: linkedEvidence.evidenceLinkId,
      watchForId: watchFor.watchForId,
      watchForPrompt: watchFor.watchForPrompt,
      watchForReason: watchFor.watchForReason,
      checkInNote: CHECK_IN_NOTE,
      checkInOutcome: null,
      inspectorId,
    };
  }

  async function saveOutcomeAndCloseInvestigation(
    page: Page,
    context: BrowserContext,
    authState: AuthState,
    baseURL: string | undefined,
    linkedActivity: LinkedActivityArtifact
  ): Promise<ClosureArtifact> {
    await openExploreTab(page, context, authState, baseURL, "questions");
    await openInvestigationDetailFromList(page, linkedActivity.investigationId, linkedActivity.title);
    await expect(page.getByTestId("investigation-id")).toContainText(linkedActivity.investigationId, {
      timeout: 60_000,
    });

    await page.getByTestId("investigation-outcome-input").fill(OUTCOME_NOTE);

    const savePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/investigations/${linkedActivity.investigationId}`) &&
        response.request().method() === "PATCH",
      { timeout: 30_000 }
    );
    await page.getByTestId("investigation-outcome-save").click();
    const saveResponse = await savePromise;
    expect(saveResponse.status()).toBe(200);

    const transitions = [
      "gathering_evidence",
      "testing",
      "resolving",
    ] as const;

    for (const nextStatus of transitions) {
      const transitionPromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/investigations/${linkedActivity.investigationId}`) &&
          response.request().method() === "PATCH",
        { timeout: 30_000 }
      );
      await page.getByTestId(`investigation-transition-${nextStatus}`).click();
      const transitionResponse = await transitionPromise;
      expect(transitionResponse.status()).toBe(200);
      await expect(page.getByTestId("investigation-status")).toContainText(nextStatus, {
        timeout: 60_000,
      });
    }

    const resolvePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/investigations/${linkedActivity.investigationId}`) &&
        response.request().method() === "PATCH",
      { timeout: 30_000 }
    );
    await page.getByTestId("investigation-transition-resolved").click();
    const resolveResponse = await resolvePromise;
    expect(resolveResponse.status()).toBe(200);

    await recoverAfterReloadToExploreTab(page, context, authState, baseURL, "questions");
    await expect(
      page.getByTestId("active-question-row").filter({ hasText: linkedActivity.investigationId })
    ).toHaveCount(0);

    await openClosedInvestigationFromExploreTab(
      page,
      context,
      authState,
      baseURL,
      linkedActivity.investigationId
    );
    await expect(page.getByTestId("investigation-status")).toContainText("resolved", {
      timeout: 60_000,
    });
    await expect(page.getByText("This investigation remains reviewable after closure")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Reopening is not exposed on this production surface.")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(OUTCOME_NOTE)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("investigation-linked-evidence-list")).toContainText(
      `Evidence ID ${linkedActivity.evidenceId}`,
      { timeout: 60_000 }
    );
    await expect(page.getByTestId("investigation-linked-fieldwork-list")).toContainText(
      `Fieldwork ID ${linkedActivity.watchForId}`,
      { timeout: 60_000 }
    );
    const inspectorPanel = await waitForInspectorIdentity(page, linkedActivity.investigationId);
    await expect(inspectorPanel).toContainText(OUTCOME_NOTE, { timeout: 60_000 });
    await expect(inspectorPanel).toContainText(`Evidence ID ${linkedActivity.evidenceId}`, {
      timeout: 60_000,
    });
    await expect(inspectorPanel).toContainText(`Fieldwork ID ${linkedActivity.watchForId}`, {
      timeout: 60_000,
    });

    const detail = await fetchInvestigationRow(linkedActivity.investigationId, authState);
    expect(detail.response.status).toBe(200);
    expect(detail.payload?.item?.status).toBe("resolved");
    expect(detail.payload?.item?.resolutionSummary).toBe(OUTCOME_NOTE);

    const inspectorStatus = await inspectorPanel
      .getByTestId("inspector-investigation-status")
      .innerText();

    console.log(
      `[investigations-production-assault] closed investigation=${linkedActivity.investigationId} status=${detail.payload?.item?.status} resolvedAt=${detail.payload?.item?.resolvedAt}`
    );

    return {
      ...linkedActivity,
      outcome: OUTCOME_NOTE,
      finalStatus: detail.payload?.item?.status ?? "unknown",
      resolvedAt: detail.payload?.item?.resolvedAt ?? null,
      inspectorStatus,
    };
  }

  test.beforeAll(async () => {
    env = loadBestAvailableEnv();
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
    process.env.NODE_ENV = process.env.NODE_ENV === "production" ? "test" : process.env.NODE_ENV;
    assertRealClerkEnv(env);

    if (!investigationsAssaultFixtureAllowed(process.env)) {
      throw new Error("Investigations assault fixture safety gate refused local DB setup");
    }

    clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });

    primaryAuth = await createAuthState("investigations-assault-primary");
    crossAuth = await createAuthState("investigations-assault-cross");
    emptyAuth = await createAuthState("investigations-assault-empty");
    devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;

    prisma = new PrismaClient({ datasources: { db: { url: LOCAL_DATABASE_URL } } });
  });

  test.beforeEach(async () => {
    if (!primaryAuth || !crossAuth) {
      throw new Error("Auth runtime was not initialized before fixture seeding.");
    }

    const seeded = await seedInvestigationsAssaultRuntimeFixture({
      userId: primaryAuth.userId,
      crossUserId: crossAuth.userId,
      db: prisma,
    });
    crossInvestigationId = seeded.crossInvestigationId;
    crossEvidenceId = seeded.crossEvidenceId;
  });

  test.afterAll(async () => {
    try {
      if (primaryAuth && crossAuth && prisma) {
        artifacts.cleanup = await cleanupInvestigationsAssaultRuntimeFixture({
          userId: primaryAuth.userId,
          crossUserId: crossAuth.userId,
          db: prisma,
        });
      }

      mkdirSync(RECEIPTS_DIR, { recursive: true });
      writeFileSync(PLAYWRIGHT_ARTIFACT_PATH, JSON.stringify(artifacts, null, 2));
      if (artifacts.cleanup) {
        console.log(
          `[investigations-production-assault] cleanup remaining=${JSON.stringify(artifacts.cleanup.remaining)}`
        );
      }
    } finally {
      await prisma?.$disconnect();
    }

    const authStates = [primaryAuth, crossAuth, emptyAuth].filter(
      (value): value is AuthState => Boolean(value)
    );
    for (const authState of authStates) {
      try {
        if (authState.sessionId) {
          await clerk.sessions.revokeSession(authState.sessionId);
        }
      } catch {
        // best-effort
      }
      try {
        if (authState.userId) {
          await clerk.users.deleteUser(authState.userId);
        }
      } catch {
        // best-effort
      }
    }
  });

  test("TEST 1 — create and reload", async ({ browser, baseURL }) => {
    if (!primaryAuth) {
      throw new Error("Primary auth session was not initialized.");
    }
    const { context, page } = await openAuthenticatedPage(browser, primaryAuth, baseURL);

    try {
      const created = await createInvestigationViaUi(
        page,
        context,
        primaryAuth,
        baseURL,
        "create-and-reload"
      );
      await expect(
        page.getByTestId("active-question-row").filter({ hasText: created.investigationId })
      ).toHaveCount(1);

      await recoverAfterReloadToExploreTab(page, context, primaryAuth, baseURL, "questions");
      await expect(
        page.getByTestId("active-question-row").filter({ hasText: created.investigationId })
      ).toHaveCount(1);

      await openInvestigationDetailFromList(page, created.investigationId, created.title);
      const inspectorPanel = await waitForInspectorIdentity(page, created.investigationId);
      await expect(inspectorPanel).toContainText(created.organizingQuestion, { timeout: 60_000 });

      await recoverAfterReloadToExploreTab(page, context, primaryAuth, baseURL, "questions");
      await expect(
        page.getByTestId("active-question-row").filter({ hasText: created.investigationId })
      ).toHaveCount(1);
      await openInvestigationDetailFromList(page, created.investigationId, created.title);
      await waitForInspectorIdentity(page, created.investigationId);

      artifacts.createAndReload = created;
    } finally {
      await context.close();
    }
  });

  test("TEST 2 — watch-for, evidence and fieldwork activity", async ({ browser, baseURL }) => {
    if (!primaryAuth) {
      throw new Error("Primary auth session was not initialized.");
    }
    const { context, page } = await openAuthenticatedPage(browser, primaryAuth, baseURL);

    try {
      const linkedActivity = await createInvestigationWithLinkedActivity(
        page,
        context,
        primaryAuth,
        baseURL,
        "linkage",
        INVESTIGATIONS_ASSAULT_PRIMARY_EVIDENCE_ID
      );

      expect(linkedActivity.inspectorId).toContain(linkedActivity.investigationId);
      artifacts.linkage = linkedActivity;
    } finally {
      await context.close();
    }
  });

  test("TEST 3 — outcome and closure", async ({ browser, baseURL }) => {
    if (!primaryAuth) {
      throw new Error("Primary auth session was not initialized.");
    }
    const { context, page } = await openAuthenticatedPage(browser, primaryAuth, baseURL);

    try {
      const linkedActivity = await createInvestigationWithLinkedActivity(
        page,
        context,
        primaryAuth,
        baseURL,
        "closure",
        INVESTIGATIONS_ASSAULT_SECONDARY_EVIDENCE_ID
      );
      const closure = await saveOutcomeAndCloseInvestigation(
        page,
        context,
        primaryAuth,
        baseURL,
        linkedActivity
      );
      expect(closure.inspectorStatus).toContain("Resolved");
      artifacts.closure = closure;
    } finally {
      await context.close();
    }
  });

  test("TEST 4 — empty/reference isolation", async ({ browser, baseURL }) => {
    if (!emptyAuth) {
      throw new Error("Empty-state auth session was not initialized.");
    }
    const { context, page } = await openAuthenticatedPage(browser, emptyAuth, baseURL);

    try {
      await openExploreTab(page, context, emptyAuth, baseURL, "questions");
      await expect(page.getByText("No active questions are open yet.")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByTestId("active-question-row")).toHaveCount(0);

      await openExploreTab(page, context, emptyAuth, baseURL, "investigations");
      await expect(page.getByText("No investigations are active yet.")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText(REFERENCE_INVESTIGATION_TITLE)).toHaveCount(0);

      await page.getByTestId("explore-tab-questions").click();
      await expect(page.getByText("No active questions are open yet.")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText(REFERENCE_QUESTION_TITLE)).toHaveCount(0);

      await page.goto("/dev/orvek-v0-reference", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("orvek-v0-reference-route")).toBeVisible({ timeout: 60_000 });
      await expect
        .poll(
          async () => {
            await page.getByTestId("nav-explore").click();
            return page.getByTestId("orvek-v0-explore-page").isVisible().catch(() => false);
          },
          { timeout: 60_000 }
        )
        .toBe(true);
      await expect
        .poll(
          async () => {
            await page.getByTestId("explore-tab-investigations").click();
            return page.getByTestId("explore-tab-investigations").getAttribute("aria-current");
          },
          { timeout: 30_000 }
        )
        .toBe("page");
      await expect(
        page.getByTestId("investigation-row").filter({ hasText: REFERENCE_INVESTIGATION_TITLE }).first()
      ).toBeVisible({ timeout: 60_000 });
      await expect
        .poll(
          async () => {
            await page.getByTestId("explore-tab-questions").click();
            return page.getByTestId("explore-tab-questions").getAttribute("aria-current");
          },
          { timeout: 30_000 }
        )
        .toBe("page");
      await expect(
        page.getByTestId("active-question-row").filter({ hasText: REFERENCE_QUESTION_TITLE }).first()
      ).toBeVisible({ timeout: 60_000 });
    } finally {
      await context.close();
    }
  });

  test("TEST 5 — authentication, ownership and malformed requests", async () => {
    if (!primaryAuth || !crossAuth) {
      throw new Error("Auth runtime was not initialized.");
    }
    await refreshSessionToken(primaryAuth);
    await refreshSessionToken(crossAuth);

    const primaryCreate = await fetch(`${ORIGIN}/api/investigations`, {
      method: "POST",
      headers: authenticatedHeaders(primaryAuth, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        title: `${INVESTIGATIONS_ASSAULT_UI_TITLE_PREFIX} negative ${Date.now()}`,
        organizingQuestion: `${INVESTIGATIONS_ASSAULT_UI_QUESTION_PREFIX} negative ${Date.now()}`,
        status: "open",
        seedType: "user_curiosity",
        competingTheories: [],
        evidenceNeeded: [],
      }),
    });
    expect(primaryCreate.status).toBe(201);
    const primaryCreatePayload = (await primaryCreate.json()) as { item?: { id?: string } };
    const primaryInvestigationId = primaryCreatePayload.item?.id;
    expect(primaryInvestigationId).toBeTruthy();

    const baselineBefore = await fetchInvestigationRow(primaryInvestigationId!, primaryAuth);
    expect(baselineBefore.response.status).toBe(200);
    expect(baselineBefore.payload?.item?.status).toBe("open");

    const evidenceLinkBaseline = await prisma.understandingEvidenceLink.count({
      where: {
        userId: primaryAuth.userId,
        targetType: "investigation",
        targetId: primaryInvestigationId!,
      },
    });
    const fieldworkBaseline = await prisma.fieldworkAssignment.count({
      where: {
        userId: primaryAuth.userId,
        linkedObjectType: "investigation",
        linkedObjectId: primaryInvestigationId!,
      },
    });

    const unauthenticatedList = await fetch(`${ORIGIN}/api/investigations`);
    expect(unauthenticatedList.status).toBe(404);

    const unauthenticatedDetail = await fetch(
      `${ORIGIN}/api/investigations/${encodeURIComponent(primaryInvestigationId!)}`
    );
    expect(unauthenticatedDetail.status).toBe(404);

    const unauthenticatedCreate = await fetch(`${ORIGIN}/api/investigations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "unauthenticated",
        organizingQuestion: "unauthenticated",
        status: "open",
        seedType: "user_curiosity",
        competingTheories: [],
        evidenceNeeded: [],
      }),
    });
    expect(unauthenticatedCreate.status).toBe(404);

    const unauthenticatedUpdate = await fetch(
      `${ORIGIN}/api/investigations/${encodeURIComponent(primaryInvestigationId!)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "unauthenticated update" }),
      }
    );
    expect(unauthenticatedUpdate.status).toBe(404);

    const unauthenticatedClosure = await fetch(
      `${ORIGIN}/api/investigations/${encodeURIComponent(primaryInvestigationId!)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "resolved",
          resolvedAt: new Date().toISOString(),
        }),
      }
    );
    expect(unauthenticatedClosure.status).toBe(404);

    const crossUserList = await fetch(`${ORIGIN}/api/investigations`, {
      headers: authenticatedHeaders(crossAuth),
    });
    expect(crossUserList.status).toBe(200);
    const crossUserListPayload = (await crossUserList.json()) as { items?: Array<{ id: string }> };
    expect(crossUserListPayload.items?.some((item) => item.id === primaryInvestigationId)).toBe(
      false
    );

    const crossUserDetail = await fetch(
      `${ORIGIN}/api/investigations/${encodeURIComponent(primaryInvestigationId!)}`,
      {
        headers: authenticatedHeaders(crossAuth),
      }
    );
    expect(crossUserDetail.status).toBe(404);

    const crossUserUpdate = await fetch(
      `${ORIGIN}/api/investigations/${encodeURIComponent(primaryInvestigationId!)}`,
      {
        method: "PATCH",
        headers: authenticatedHeaders(crossAuth, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ title: "cross-user blocked" }),
      }
    );
    expect(crossUserUpdate.status).toBe(404);

    const crossUserClosure = await fetch(
      `${ORIGIN}/api/investigations/${encodeURIComponent(primaryInvestigationId!)}`,
      {
        method: "PATCH",
        headers: authenticatedHeaders(crossAuth, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          status: "resolved",
          resolvedAt: new Date().toISOString(),
        }),
      }
    );
    expect(crossUserClosure.status).toBe(404);

    const crossUserEvidenceAttachment = await fetch(
      `${ORIGIN}/api/understanding/evidence-links`,
      {
        method: "POST",
        headers: authenticatedHeaders(primaryAuth, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          targetType: "investigation",
          targetId: primaryInvestigationId!,
          sourceType: "evidence_span",
          sourceId: crossEvidenceId,
          role: "supports",
        }),
      }
    );
    expect(crossUserEvidenceAttachment.status).toBe(400);

    const crossUserFieldworkAssociation = await fetch(`${ORIGIN}/api/fieldwork`, {
      method: "POST",
      headers: authenticatedHeaders(primaryAuth, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        prompt: `${INVESTIGATIONS_ASSAULT_UI_WATCH_FOR_PREFIX} cross-user blocked`,
        reason: "Should not link to another user's investigation.",
        status: "assigned",
        linkedObjectType: "investigation",
        linkedObjectId: crossInvestigationId,
      }),
    });
    expect(crossUserFieldworkAssociation.status).toBe(400);

    const missingInvestigation = await fetch(
      `${ORIGIN}/api/investigations/${encodeURIComponent("missing-investigation-assault")}`,
      {
        headers: authenticatedHeaders(primaryAuth),
      }
    );
    expect(missingInvestigation.status).toBe(404);

    const missingEvidence = await fetch(`${ORIGIN}/api/understanding/evidence-links`, {
      method: "POST",
      headers: authenticatedHeaders(primaryAuth, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        targetType: "investigation",
        targetId: primaryInvestigationId!,
        sourceType: "evidence_span",
        sourceId: "missing-evidence-assault",
        role: "supports",
      }),
    });
    expect(missingEvidence.status).toBe(400);

    const missingFieldwork = await fetch(
      `${ORIGIN}/api/fieldwork/${encodeURIComponent("missing-fieldwork-assault")}`,
      {
        method: "PATCH",
        headers: authenticatedHeaders(primaryAuth, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          status: "active",
          observationNote: "missing",
        }),
      }
    );
    expect(missingFieldwork.status).toBe(404);

    const malformedCreate = await fetch(`${ORIGIN}/api/investigations`, {
      method: "POST",
      headers: authenticatedHeaders(primaryAuth, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({}),
    });
    expect(malformedCreate.status).toBe(400);

    const malformedUpdate = await fetch(
      `${ORIGIN}/api/investigations/${encodeURIComponent(primaryInvestigationId!)}`,
      {
        method: "PATCH",
        headers: authenticatedHeaders(primaryAuth, {
          "Content-Type": "application/json",
        }),
        body: "{not-json",
      }
    );
    expect(malformedUpdate.status).toBe(400);

    const malformedClosure = await fetch(
      `${ORIGIN}/api/investigations/${encodeURIComponent(primaryInvestigationId!)}`,
      {
        method: "PATCH",
        headers: authenticatedHeaders(primaryAuth, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          status: "resolved",
          resolvedAt: "not-a-date",
        }),
      }
    );
    expect(malformedClosure.status).toBe(400);

    const invalidLifecycleTransition = await fetch(
      `${ORIGIN}/api/investigations/${encodeURIComponent(primaryInvestigationId!)}`,
      {
        method: "PATCH",
        headers: authenticatedHeaders(primaryAuth, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          status: "resolved",
          resolvedAt: new Date().toISOString(),
        }),
      }
    );
    expect(invalidLifecycleTransition.status).toBe(422);

    const evidenceLinkAfter = await prisma.understandingEvidenceLink.count({
      where: {
        userId: primaryAuth.userId,
        targetType: "investigation",
        targetId: primaryInvestigationId!,
      },
    });
    const fieldworkAfter = await prisma.fieldworkAssignment.count({
      where: {
        userId: primaryAuth.userId,
        linkedObjectType: "investigation",
        linkedObjectId: primaryInvestigationId!,
      },
    });
    expect(evidenceLinkAfter).toBe(evidenceLinkBaseline);
    expect(fieldworkAfter).toBe(fieldworkBaseline);

    const baselineAfter = await fetchInvestigationRow(primaryInvestigationId!, primaryAuth);
    expect(baselineAfter.response.status).toBe(200);
    expect(baselineAfter.payload?.item?.status).toBe("open");
    expect(baselineAfter.payload?.item?.title).toBe(baselineBefore.payload?.item?.title);

    artifacts.negativeStatuses = {
      unauthenticatedList: unauthenticatedList.status,
      unauthenticatedDetail: unauthenticatedDetail.status,
      unauthenticatedCreate: unauthenticatedCreate.status,
      unauthenticatedUpdate: unauthenticatedUpdate.status,
      unauthenticatedClosure: unauthenticatedClosure.status,
      crossUserList: crossUserList.status,
      crossUserDetail: crossUserDetail.status,
      crossUserUpdate: crossUserUpdate.status,
      crossUserClosure: crossUserClosure.status,
      crossUserEvidenceAttachment: crossUserEvidenceAttachment.status,
      crossUserFieldworkAssociation: crossUserFieldworkAssociation.status,
      missingInvestigation: missingInvestigation.status,
      missingEvidence: missingEvidence.status,
      missingFieldwork: missingFieldwork.status,
      malformedCreate: malformedCreate.status,
      malformedUpdate: malformedUpdate.status,
      malformedClosure: malformedClosure.status,
      invalidLifecycleTransition: invalidLifecycleTransition.status,
    };

    console.log(
      `[investigations-production-assault] negative-statuses=${JSON.stringify(artifacts.negativeStatuses)}`
    );

    const remaining = await countInvestigationsAssaultRuntimeFixture({
      userId: primaryAuth.userId,
      crossUserId: crossAuth.userId,
      db: prisma,
    });
    console.log(
      `[investigations-production-assault] pre-cleanup fixture-counts=${JSON.stringify(remaining)}`
    );
  });
});
