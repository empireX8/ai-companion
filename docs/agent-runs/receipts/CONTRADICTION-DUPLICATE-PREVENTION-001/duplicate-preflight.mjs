/**
 * READ-ONLY duplicate preflight for CONTRADICTION-DUPLICATE-PREVENTION-001 (CEQR-007).
 *
 * FORBIDDEN: create, update, upsert, delete, migrate, transaction write.
 *
 * Exact duplicate group query (complete repaired rows only):
 *   GROUP BY userId, sideASourceSpanId, sideBSourceSpanId
 *   WHERE both span FKs IS NOT NULL
 *   HAVING COUNT(*) > 1
 *
 * Usage:
 *   set -a && source /Users/user/ai-companion/.env && set +a
 *   node docs/agent-runs/receipts/CONTRADICTION-DUPLICATE-PREVENTION-001/duplicate-preflight.mjs
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(join(process.cwd(), "package.json"));
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const KAY = "user_34TUYA53pI1QRLK73O22Kve1a1G";
const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(OUT_DIR, "duplicate-preflight.json");

function serialize(obj) {
  return JSON.stringify(
    obj,
    (_, v) => (typeof v === "bigint" ? Number(v) : v),
    2,
  );
}

function classifyLineage(row) {
  const a = row.sideASourceSpanId;
  const b = row.sideBSourceSpanId;
  const aPresent = typeof a === "string" && a.length > 0;
  const bPresent = typeof b === "string" && b.length > 0;
  if (aPresent && bPresent) return "complete_exact_dual_side";
  if (!aPresent && !bPresent) return "legacy_incomplete";
  return "invalid_partial";
}

async function main() {
  const queriedAt = new Date().toISOString();

  const [duplicateGroups, kayNodes] = await Promise.all([
    db.$queryRaw`
      SELECT
        "userId",
        "sideASourceSpanId",
        "sideBSourceSpanId",
        COUNT(*)::int AS "count"
      FROM "ContradictionNode"
      WHERE
        "sideASourceSpanId" IS NOT NULL
        AND "sideBSourceSpanId" IS NOT NULL
      GROUP BY
        "userId",
        "sideASourceSpanId",
        "sideBSourceSpanId"
      HAVING COUNT(*) > 1
      ORDER BY "count" DESC, "userId", "sideASourceSpanId", "sideBSourceSpanId"
    `,
    db.contradictionNode.findMany({
      where: { userId: KAY },
      select: {
        id: true,
        status: true,
        sideASourceSpanId: true,
        sideBSourceSpanId: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const lineageCounts = {
    complete_exact_dual_side: 0,
    legacy_incomplete: 0,
    invalid_partial: 0,
  };
  for (const row of kayNodes) {
    lineageCounts[classifyLineage(row)] += 1;
  }

  // When duplicate groups exist, list member node IDs for inspection (still read-only).
  let duplicateGroupMembers = [];
  if (duplicateGroups.length > 0) {
    duplicateGroupMembers = await Promise.all(
      duplicateGroups.map(async (g) => {
        const members = await db.contradictionNode.findMany({
          where: {
            userId: g.userId,
            sideASourceSpanId: g.sideASourceSpanId,
            sideBSourceSpanId: g.sideBSourceSpanId,
          },
          select: {
            id: true,
            status: true,
            sideASourceSpanId: true,
            sideBSourceSpanId: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        });
        return {
          userId: g.userId,
          sideASourceSpanId: g.sideASourceSpanId,
          sideBSourceSpanId: g.sideBSourceSpanId,
          count: Number(g.count),
          memberIds: members.map((m) => m.id),
          members,
        };
      }),
    );
  }

  const counts = {
    totalNodes: kayNodes.length,
    completeDualSide: lineageCounts.complete_exact_dual_side,
    invalidPartial: lineageCounts.invalid_partial,
    legacyIncomplete: lineageCounts.legacy_incomplete,
    duplicateGroupsCount: duplicateGroups.length,
  };

  const out = {
    campaign: "CONTRADICTION-EXTRACTION-QUALITY-REPAIR-001",
    slice: "CONTRADICTION-DUPLICATE-PREVENTION-001",
    campaignSlice: "CEQR-007",
    phase: "duplicate_preflight_readonly",
    userId: KAY,
    queriedAt,
    mode: "read_only",
    mutationsPerformed: false,
    exactDuplicateQuery: {
      description:
        "Complete repaired ContradictionNode groups with identical ordered span pair",
      sql: [
        'SELECT "userId", "sideASourceSpanId", "sideBSourceSpanId", COUNT(*)',
        'FROM "ContradictionNode"',
        'WHERE "sideASourceSpanId" IS NOT NULL AND "sideBSourceSpanId" IS NOT NULL',
        'GROUP BY "userId", "sideASourceSpanId", "sideBSourceSpanId"',
        "HAVING COUNT(*) > 1",
      ].join(" "),
    },
    counts,
    lineageCounts,
    duplicateGroups: duplicateGroups.map((g) => ({
      userId: g.userId,
      sideASourceSpanId: g.sideASourceSpanId,
      sideBSourceSpanId: g.sideBSourceSpanId,
      count: Number(g.count),
    })),
    duplicateGroupMembers,
    kayContradictionNodes: kayNodes,
    migrationSafe: duplicateGroups.length === 0,
  };

  writeFileSync(OUT_PATH, serialize(out));
  console.log("Wrote", OUT_PATH);
  console.log(
    serialize({
      counts,
      lineageCounts,
      migrationSafe: out.migrationSafe,
      duplicateGroupsCount: counts.duplicateGroupsCount,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
