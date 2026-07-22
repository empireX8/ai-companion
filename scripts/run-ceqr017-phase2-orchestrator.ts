/**
 * CEQR-017 Phase-2 orchestrator (NOT authorised for Phase 1).
 *
 * Thin entry around runCeqr017Phase2Orchestration.
 * Do not execute during Phase 1.
 */

import { createRequire } from "module";
import { join } from "path";

import {
  runCeqr017ReadonlyAccountGate,
  writeCeqr017AccountGateResult,
} from "../lib/ceqr017-readonly-account-gate";
import {
  runCeqr017Phase2Orchestration,
} from "../lib/ceqr017-phase2-orchestration";
import {
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  ceqr017ReceiptDir,
  isCeqr017LiveOptedIn,
} from "../lib/contradiction-controlled-live-authority-reproof";

type PrismaAccountGateDb = {
  evidenceSpan: { count: (args: unknown) => Promise<number> };
  contradictionNode: {
    groupBy: (args: unknown) => Promise<Array<{ status: string; _count: { _all: number } }>>;
    findMany: (args: unknown) => Promise<
      Array<{
        sideASourceSpanId: string | null;
        sideBSourceSpanId: string | null;
        status: string;
      }>
    >;
  };
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
  $disconnect: () => Promise<void>;
};

function createPrismaReader(db: PrismaAccountGateDb) {
  return {
    async countEvidenceSpans(userId: string) {
      return db.evidenceSpan.count({ where: { userId } });
    },
    async groupContradictionStatuses(userId: string) {
      const groups = await db.contradictionNode.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
      });
      return Object.fromEntries(
        groups.map((r) => [r.status, r._count._all]),
      ) as Record<string, number>;
    },
    async findContradictionLineageRows(userId: string) {
      return db.contradictionNode.findMany({
        where: { userId },
        select: {
          status: true,
          sideASourceSpanId: true,
          sideBSourceSpanId: true,
        },
        orderBy: { id: "asc" },
      });
    },
    async countCompletePairDuplicateGroups(userId: string) {
      const duplicateGroups = await db.$queryRaw`
      SELECT
        "userId",
        "sideASourceSpanId",
        "sideBSourceSpanId",
        COUNT(*)::int AS "count"
      FROM "ContradictionNode"
      WHERE
        "userId" = ${userId}
        AND "sideASourceSpanId" IS NOT NULL
        AND "sideBSourceSpanId" IS NOT NULL
      GROUP BY
        "userId",
        "sideASourceSpanId",
        "sideBSourceSpanId"
      HAVING COUNT(*) > 1
    `;
      return Array.isArray(duplicateGroups) ? duplicateGroups.length : 0;
    },
  };
}

async function main(): Promise<void> {
  const outDir = ceqr017ReceiptDir();

  if (!isCeqr017LiveOptedIn()) {
    console.log(
      `${CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV} not set — no provider calls.`,
    );
  }

  let db: PrismaAccountGateDb | null = null;
  if (isCeqr017LiveOptedIn()) {
    const require = createRequire(join(process.cwd(), "package.json"));
    const { PrismaClient } = require("@prisma/client") as {
      PrismaClient: new () => PrismaAccountGateDb;
    };
    db = new PrismaClient();
  }

  const reader = db ? createPrismaReader(db) : null;

  const result = await runCeqr017Phase2Orchestration({
    env: process.env,
    receiptDir: outDir,
    runAccountGate: reader
      ? async ({ label, receiptDir, write }) =>
          runCeqr017ReadonlyAccountGate({
            label,
            reader,
            receiptDir,
            write,
          })
      : undefined,
    writeAccountGateResult: reader
      ? ({ result: gateResult, receiptDir }) => {
          writeCeqr017AccountGateResult({
            result: gateResult,
            receiptDir,
          });
        }
      : undefined,
    disconnect: db ? () => db!.$disconnect() : undefined,
  });

  console.log(JSON.stringify(result.receipt, null, 2));
  process.exitCode = result.exitCode;
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "CEQR-017 Phase-2 orchestrator failed",
  );
  process.exitCode = 1;
});
