/**
 * Minimal authenticated browser proof: production Explore composer → Ask enabled → POST /api/message.
 */
import { createClerkClient } from "@clerk/backend";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type EnvMap = Record<string, string>;

const ROOT = resolve(process.cwd());
const ORIGIN = "http://localhost:3000";
const EXPLORE_SESSION_STORAGE_KEY = "mindlabs:explore:session-id";
const SEND_PROBE_MESSAGE = "Send readiness probe: stop point after meetings.";

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

test.describe("explore send readiness isolated proof", () => {
  test.describe.configure({ timeout: 180_000 });

  let sessionToken = "";
  let devBrowserToken = "";
  let clientUat = "1";
  let userId = "";
  let clerkSessionId = "";
  let env: EnvMap;

  function cookieHeader(): string {
    return `__session=${sessionToken}; __clerk_db_jwt=${devBrowserToken}; __client_uat=${clientUat}`;
  }

  async function refreshSessionToken() {
    const clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });
    sessionToken = (await clerk.sessions.getToken(clerkSessionId)).jwt;
    const payload = decodeJwtPayload(sessionToken);
    if (typeof payload.iat === "number") {
      clientUat = String(payload.iat);
    }
  }

  async function refreshAuthCookies(context: BrowserContext, baseURL?: string) {
    const origin = baseURL ?? ORIGIN;
    await context.addCookies([
      { name: "__session", value: sessionToken, url: origin },
      { name: "__clerk_db_jwt", value: devBrowserToken, url: origin },
      { name: "__client_uat", value: clientUat, url: origin },
    ]);
  }

  async function stabilizeAuthenticatedSession(page: Page, context: BrowserContext, baseURL?: string) {
    await refreshSessionToken();
    await refreshAuthCookies(context, baseURL);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await refreshAuthCookies(context, baseURL);

    if (await page.getByRole("heading", { name: /Sign in/i }).isVisible().catch(() => false)) {
      await refreshSessionToken();
      await refreshAuthCookies(context, baseURL);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await refreshAuthCookies(context, baseURL);
    }

    await expect(page.getByTestId("nav-today")).toBeVisible({ timeout: 90_000 });
    await expect
      .poll(async () => {
        const list = await context.request.get("/api/user-map/conclusions", {
          headers: { Cookie: cookieHeader() },
        });
        return list.ok();
      }, { timeout: 90_000 })
      .toBe(true);

    await expect
      .poll(async () => {
        await refreshAuthCookies(context, baseURL);
        return page.evaluate(async () => {
          const response = await fetch("/api/user-map/conclusions", { cache: "no-store" });
          return response.ok;
        });
      }, { timeout: 90_000 })
      .toBe(true);
  }

  async function openAuthenticatedPage(browser: Browser, baseURL?: string) {
    const context = await browser.newContext({ baseURL: baseURL ?? ORIGIN });
    const page = await context.newPage();
    await stabilizeAuthenticatedSession(page, context, baseURL);
    return { context, page };
  }

  test.beforeAll(async () => {
    env = readEnvFile();

    const clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });

    const user = await clerk.users.createUser({
      emailAddress: [uniqueEmail("explore-send-readiness")],
      password: `Tmp-${Date.now()}-Aa1!`,
      skipPasswordChecks: true,
      skipPasswordRequirement: true,
    });
    userId = user.id;

    const session = await clerk.sessions.createSession({ userId });
    clerkSessionId = session.id;
    sessionToken = (await clerk.sessions.getToken(clerkSessionId)).jwt;
    devBrowserToken = (await clerk.testingTokens.createTestingToken()).token;

    const payload = decodeJwtPayload(sessionToken);
    if (typeof payload.iat === "number") clientUat = String(payload.iat);
  });

  test.afterAll(async () => {
    try {
      const clerk = createClerkClient({
        secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
        publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      });
      if (clerkSessionId) await clerk.sessions.revokeSession(clerkSessionId);
      if (userId) await clerk.users.deleteUser(userId);
    } catch {
      // best-effort
    }
  });

  test("Ask enables after composer input and triggers exactly one POST /api/message", async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await openAuthenticatedPage(browser, baseURL);

    try {
      let postCount = 0;
      page.on("request", (request) => {
        if (request.url().includes("/api/message") && request.method() === "POST") {
          postCount += 1;
        }
      });

      await page.evaluate((key) => {
        window.localStorage.removeItem(key);
      }, EXPLORE_SESSION_STORAGE_KEY);

      await stabilizeAuthenticatedSession(page, context, baseURL);

      await expect
        .poll(async () => {
          await page.getByTestId("nav-explore").click();
          return page.getByTestId("orvek-v0-explore-page").isVisible().catch(() => false);
        }, { timeout: 90_000 })
        .toBe(true);

      const explore = page.getByTestId("orvek-v0-explore-page");
      await expect(explore.getByRole("heading", { name: /^Explore$/i })).toBeVisible({
        timeout: 30_000,
      });

      const freeTab = explore.getByRole("button", { name: /Free Explore/i });
      if (await freeTab.isVisible().catch(() => false)) {
        await freeTab.click();
      }

      await expect
        .poll(async () => {
          await refreshSessionToken();
          await refreshAuthCookies(context, baseURL);
          return page.evaluate(async () => {
            const response = await fetch(
              "/api/session/list?origin=app&surfaceType=explore_chat",
              { cache: "no-store" },
            );
            if (!response.ok) return false;
            const sessions = (await response.json()) as Array<{ id: string }>;
            if (sessions.length > 0) return true;
            const created = await fetch("/api/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ surfaceType: "explore_chat" }),
            });
            return created.ok;
          });
        }, { timeout: 90_000 })
        .toBe(true);

      const composer = explore.locator(
        'input[placeholder*="Ask the model"], input[placeholder*="Ask your Mind Model"]',
      );
      await expect(composer).toBeVisible({ timeout: 60_000 });

      await expect
        .poll(async () => {
          const gates = await explore.getByTestId("explore-composer").evaluate((node) => ({
            sendHandler: node.getAttribute("data-free-explore-send-handler"),
            liveChat: node.getAttribute("data-has-live-explore-chat"),
            booting: node.getAttribute("data-explore-booting"),
            hasOnSend: node.getAttribute("data-has-send-handler"),
          }));
          return JSON.stringify(gates);
        }, { timeout: 90_000 })
        .toContain('"sendHandler":"true"');

      const gatesBeforeType = await explore.getByTestId("explore-composer").evaluate((node) => ({
        sendHandler: node.getAttribute("data-free-explore-send-handler"),
        liveChat: node.getAttribute("data-has-live-explore-chat"),
        booting: node.getAttribute("data-explore-booting"),
        hasOnSend: node.getAttribute("data-has-send-handler"),
      }));

      expect(gatesBeforeType.sendHandler).toBe("true");
      expect(gatesBeforeType.hasOnSend).toBe("true");
      expect(gatesBeforeType.booting).toBe("false");

      await composer.fill(SEND_PROBE_MESSAGE);
      await expect(composer).toHaveValue(SEND_PROBE_MESSAGE);

      const ask = explore.getByTestId("explore-ask-button");
      await expect
        .poll(async () => ask.getAttribute("data-can-send"), { timeout: 30_000 })
        .toBe("true");
      await expect(ask).toBeEnabled();

      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/message") && response.request().method() === "POST",
        { timeout: 120_000 },
      );

      await ask.click();
      const response = await responsePromise;
      expect(response.ok()).toBeTruthy();
      expect(postCount).toBe(1);

      await expect(explore.getByText(/architecture visually/i)).toHaveCount(0);
      await expect(explore.getByTestId("explore-grounding-empty")).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
