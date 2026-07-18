import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanupSemanticTwinRuntimeFixture } from "../lib/semantic-twin-runtime-fixture";

async function main() {
  const userId = process.argv[2];
  if (!userId) throw new Error("usage: cleanup-semantic-twin-user.ts <userId>");
  process.env.ORVEK_ALLOW_LOCAL_EVIDENCE_DEPTH_FIXTURE = "1";
  const env = Object.fromEntries(
    readFileSync(resolve(".env"), "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1).trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        return [l.slice(0, i).trim(), v] as const;
      }),
  );
  const db = new PrismaClient({
    datasources: { db: { url: "postgresql://postgres:postgres@localhost:5432/companion" } },
  });
  await cleanupSemanticTwinRuntimeFixture({ userId, db });
  await db.$disconnect();
  const clerk = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY!,
    publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!,
  });
  try {
    await clerk.users.deleteUser(userId);
  } catch {
    /* ignore */
  }
  console.log("cleaned", userId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
