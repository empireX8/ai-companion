import { createClerkClient } from "@clerk/backend";
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const ORIGIN = process.env.DESKTOP_PARITY_BASE_URL ?? "http://localhost:3000";
const RECEIPTS = resolve(
  ROOT,
  "docs/agent-runs/receipts/DESKTOP-FROZEN-REFERENCE-INSPECTOR-RESTORATION-001",
);
const KAY_USER_ID = "user_34TUYA53pI1QRLK73O22Kve1a1G";
const KAY_EMAIL = "empirexkay@gmail.com";
const LIVE = "/dev/orvek-v0-canonical-live";
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

async function main() {
  mkdirSync(resolve(RECEIPTS, "screenshots"), { recursive: true });
  const env = readEnv();
  process.env.CLERK_SECRET_KEY = env.CLERK_SECRET_KEY;
  process.env.CLERK_PUBLISHABLE_KEY = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY! });

  const signInToken = await clerk.signInTokens.createSignInToken({
    userId: KAY_USER_ID,
    expiresInSeconds: 600,
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: ORIGIN,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Establish Clerk testing / ticket session in the browser.
  const dbJwt = (await clerk.testingTokens.createTestingToken()).token;
  await context.addCookies([
    { name: "__clerk_db_jwt", value: dbJwt, url: ORIGIN, sameSite: "Lax" },
  ]);

  // Ticket-based sign-in via Clerk frontend
  await page.goto(`${ORIGIN}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    async ({ ticket, publishableKey }) => {
      // Load Clerk if needed via window.Clerk after a short wait
      const start = Date.now();
      while (!(window as unknown as { Clerk?: unknown }).Clerk && Date.now() - start < 15000) {
        await new Promise((r) => setTimeout(r, 200));
      }
      const Clerk = (window as unknown as {
        Clerk?: {
          load: () => Promise<void>;
          client: {
            signIn: {
              create: (args: unknown) => Promise<{
                status: string;
                createdSessionId?: string | null;
              }>;
            };
          };
          setActive: (args: { session: string }) => Promise<void>;
        };
      }).Clerk;
      if (!Clerk) throw new Error("Clerk not on window");
      await Clerk.load();
      const attempt = await Clerk.client.signIn.create({
        strategy: "ticket",
        ticket,
      });
      if (attempt.status === "complete" && attempt.createdSessionId) {
        await Clerk.setActive({ session: attempt.createdSessionId });
        return { ok: true, status: attempt.status };
      }
      return { ok: false, status: attempt.status, publishableKeyPresent: Boolean(publishableKey) };
    },
    {
      ticket: signInToken.token,
      publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    },
  );

  await page.goto(LIVE, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const checks: Record<string, unknown> = {
    userId: KAY_USER_ID,
    email: KAY_EMAIL,
    url: page.url(),
  };

  if (page.url().includes("/sign-in")) {
    writeFileSync(
      resolve(RECEIPTS, "34-import-review-active-browser-proof.json"),
      `${JSON.stringify({ at: new Date().toISOString(), pass: false, checks, failReason: "still_on_sign_in" }, null, 2)}\n`,
    );
    console.log("FAIL — ACTIVE LIVE BUTTON REMAINS DEAD");
    console.error("still on sign-in", page.url());
    await browser.close();
    process.exit(1);
  }

  await page
    .locator('[data-testid="orvek-v0-canonical-live-route"]')
    .waitFor({ state: "visible", timeout: 45_000 })
    .catch(() => null);

  await page.waitForTimeout(3500);

  const apiCount = await page.evaluate(async () => {
    const res = await fetch("/api/canonical-today-composition", {
      cache: "no-store",
    });
    if (!res.ok) return -1;
    const json = await res.json();
    return json?.composition?.workbench?.importReview?.candidates?.length ?? 0;
  });
  checks.apiImportCandidates = apiCount;

  const importBtn = page.getByTestId("orvek-import-button");
  await importBtn.waitFor({ state: "visible", timeout: 20_000 });
  checks.disabledAttr = await importBtn.getAttribute("disabled");
  checks.ariaDisabled = await importBtn.getAttribute("aria-disabled");
  checks.className = await importBtn.getAttribute("class");

  let pass = false;
  let failReason = "";
  try {
    if (checks.disabledAttr !== null) {
      throw new Error(`Import still disabled; apiCandidates=${apiCount}`);
    }
    await importBtn.click();
    const heading = page.getByRole("heading", { name: "Review import" });
    await heading.waitFor({ state: "visible", timeout: 10_000 });
    const body = await page.locator("body").innerText();
    checks.subtitle = body.includes(SUBTITLE);
    checks.proposals = PROPOSALS.map((p) => body.includes(p));
    const shot = resolve(
      RECEIPTS,
      "screenshots/34-import-review-modal-open-canonical-live.png",
    );
    await page.screenshot({ path: shot, fullPage: false });
    checks.screenshot = shot;

    await page.getByRole("button", { name: "Close" }).click();
    await heading.waitFor({ state: "hidden", timeout: 10_000 });
    checks.urlClosed = page.url();
    checks.stayedOnLive = page.url().includes("/dev/orvek-v0-canonical-live");

    pass =
      checks.subtitle === true &&
      (checks.proposals as boolean[]).every(Boolean) &&
      checks.stayedOnLive === true &&
      !(checks.className as string)?.includes("pointer-events-none");
    if (!pass) failReason = JSON.stringify(checks, null, 2);
  } catch (e) {
    failReason = e instanceof Error ? e.message : String(e);
    pass = false;
  } finally {
    await browser.close();
  }

  writeFileSync(
    resolve(RECEIPTS, "34-import-review-active-browser-proof.json"),
    `${JSON.stringify({ at: new Date().toISOString(), pass, failReason: failReason || null, checks }, null, 2)}\n`,
  );

  if (pass) {
    console.log(
      "IMPORT MODAL VISIBLY OPEN ON CANONICAL LIVE — READY FOR KAY TO REFRESH",
    );
    process.exit(0);
  }
  console.log("FAIL — ACTIVE LIVE BUTTON REMAINS DEAD");
  console.error(failReason || JSON.stringify(checks, null, 2));
  process.exit(1);
}

main();
