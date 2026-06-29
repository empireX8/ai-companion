import { createClerkClient } from "@clerk/backend";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type EnvMap = Record<string, string>;

type RouteSmokeCase = {
  label: string;
  path: string;
  heading: string;
  level?: number;
};

type GhostRouteCase = {
  label: string;
  path: string;
};

type PreservedRouteCase = {
  label: string;
  path: string;
  expectMount?: boolean;
  testId?: string;
};

const V0_ROUTE_SMOKE_CASES: RouteSmokeCase[] = [
  { label: "Today / Re-entry", path: "/", heading: "What matters now" },
  { label: "Capture", path: "/journal-chat", heading: "Journal Chat", level: 2 },
  { label: "Reports", path: "/what-changed", heading: "What Changed" },
  { label: "Explore / Analytical Log", path: "/explore", heading: "Explore" },
  { label: "Map", path: "/your-map", heading: "Map" },
  { label: "Timeline", path: "/timeline", heading: "Timeline" },
  { label: "Fieldwork", path: "/watch-for", heading: "Fieldwork" },
  { label: "Decisions / Outcomes", path: "/actions", heading: "Decisions" },
];

const LEGACY_PUBLIC_BLOCKED_ROUTE_CASES: GhostRouteCase[] = [
  { label: "Help", path: "/help" },
  { label: "Chat", path: "/chat" },
  { label: "Journal", path: "/journal" },
  { label: "Patterns", path: "/patterns" },
  { label: "History", path: "/history" },
  { label: "Contradictions", path: "/contradictions" },
  { label: "Check-ins", path: "/check-ins" },
  { label: "Active Questions", path: "/active-questions" },
  { label: "Library", path: "/library" },
  { label: "Settings", path: "/settings" },
  { label: "Account", path: "/account" },
  { label: "Import", path: "/import" },
  { label: "Context", path: "/context" },
  { label: "Memories", path: "/memories" },
  { label: "Projections", path: "/projections" },
  { label: "References", path: "/references" },
  { label: "Audit", path: "/audit" },
  { label: "Evidence", path: "/evidence" },
  { label: "Metrics", path: "/metrics" },
];

const INTERNAL_OR_DEV_PRESERVED_ROUTE_CASES: PreservedRouteCase[] = [
  { label: "Internal user-map review", path: "/internal/user-map/review" },
  {
    label: "Dev reference",
    path: "/dev/orvek-v0-reference",
    expectMount: true,
    testId: "orvek-v0-reference-route",
  },
];

const ROOT = resolve(process.cwd());

function readEnvFile(relativePath = ".env"): EnvMap {
  const file = readFileSync(resolve(ROOT, relativePath), "utf8");
  const env: EnvMap = {};

  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

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
  if (!value) {
    throw new Error(`Missing ${key} in .env`);
  }
  return value;
}

function uniqueSmokeEmail(): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return `v0-route-smoke-${stamp}@example.com`;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) {
    return {};
  }

  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);

  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeText(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

test.describe("v0 route smoke", () => {
  let sessionToken = "";
  let devBrowserToken = "";
  let clientUat = "1";
  let userId = "";
  let sessionId = "";
  let baseURL = "http://localhost:3000";

  test.beforeAll(async () => {
    const env = readEnvFile();
    const clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });

    baseURL = env.PLAYWRIGHT_BASE_URL || baseURL;

    const user = await clerk.users.createUser({
      emailAddress: [uniqueSmokeEmail()],
      skipPasswordRequirement: true,
      skipPasswordChecks: true,
      skipLegalChecks: true,
      firstName: "Route",
      lastName: "Smoke",
    });

    userId = user.id;

    const session = await clerk.sessions.createSession({ userId });
    sessionId = session.id;

    const token = await clerk.sessions.getToken(sessionId);
    sessionToken = token.jwt;
    const payload = decodeJwtPayload(sessionToken);
    const sessionIat = Number(payload.iat ?? 0);
    clientUat = Number.isFinite(sessionIat) && sessionIat > 0 ? String(sessionIat) : "1";

    const testingToken = await clerk.testingTokens.createTestingToken();
    devBrowserToken = testingToken.token;
  });

  test.afterAll(async () => {
    const env = readEnvFile();
    const clerk = createClerkClient({
      secretKey: requireEnv(env, "CLERK_SECRET_KEY"),
      publishableKey: requireEnv(env, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    });

    if (sessionId) {
      try {
        await clerk.sessions.revokeSession(sessionId);
      } catch {
        // Best-effort cleanup.
      }
    }

    if (userId) {
      try {
        await clerk.users.deleteUser(userId);
      } catch {
        // Best-effort cleanup.
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      {
        name: "__session",
        value: sessionToken,
        url: baseURL,
      },
      {
        name: "__clerk_db_jwt",
        value: devBrowserToken,
        url: baseURL,
      },
      {
        name: "__client_uat",
        value: clientUat,
        url: baseURL,
      },
    ]);
  });

  for (const routeCase of V0_ROUTE_SMOKE_CASES) {
    test(`mounts ${routeCase.label}`, async ({ page }) => {
      const response = await page.goto(routeCase.path, { waitUntil: "domcontentloaded" });
      expect(response, `${routeCase.label} response`).not.toBeNull();
      expect(response?.status(), `${routeCase.label} status`).toBe(200);

      await expect(page.locator("main")).toBeVisible();
      await expect(
        page.getByRole("heading", {
          level: routeCase.level ?? 1,
          name: routeCase.heading,
          exact: true,
        })
      ).toBeVisible();

      await expect.poll(async () => normalizeText(await page.locator("main").innerText()).length)
        .toBeGreaterThan(20);
    });
  }

  for (const routeCase of LEGACY_PUBLIC_BLOCKED_ROUTE_CASES) {
    test(`returns 404 for ghost route ${routeCase.label}`, async ({ page }) => {
      const response = await page.goto(routeCase.path, { waitUntil: "domcontentloaded" });
      expect(response, `${routeCase.label} response`).not.toBeNull();
      expect(response?.status(), `${routeCase.label} status`).toBe(404);
    });
  }

  for (const routeCase of INTERNAL_OR_DEV_PRESERVED_ROUTE_CASES) {
    test(`preserves ${routeCase.label}`, async ({ page }) => {
      const response = await page.goto(routeCase.path, { waitUntil: "domcontentloaded" });
      expect(response, `${routeCase.label} response`).not.toBeNull();
      expect(response?.headers()["content-type"] ?? "", `${routeCase.label} content type`).not.toContain(
        "text/plain"
      );
      expect(await response?.text()).not.toBe("Not Found");

      if (routeCase.expectMount && routeCase.testId) {
        await expect(page.getByTestId(routeCase.testId)).toBeVisible();
      }
    });
  }
});
