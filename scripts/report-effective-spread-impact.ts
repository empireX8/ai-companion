import fs from "node:fs";
import path from "node:path";

import prismadb from "../lib/prismadb";
import {
  buildCanonicalVisibleSupportBundle,
  scoreVisiblePatternClaim,
  VISIBLE_CLAIM_EVIDENCE_SATURATION,
  VISIBLE_CLAIM_SESSION_SATURATION,
  VISIBLE_CLAIM_WEIGHT_EVIDENCE,
  VISIBLE_CLAIM_WEIGHT_QUOTE,
  VISIBLE_CLAIM_WEIGHT_SESSION,
  type VisiblePatternClaimRecord,
} from "../lib/pattern-visible-claim";

type CliArgs = {
  userId?: string;
  limit?: number;
  outputPath?: string;
};

type ImpactRow = {
  claimId: string;
  patternType: string;
  oldScore: number;
  newScore: number;
  threshold: number;
  oldSurfaced: boolean;
  newSurfaced: boolean;
  sessionCount: number;
  journalEntrySpread: number;
  journalDaySpread: number;
  supportContainerSpread: number;
  journalEvidenceCount: number;
  evidenceCount: number;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--user-id" && argv[i + 1]) {
      args.userId = argv[i + 1]!;
      i += 1;
      continue;
    }
    if (arg === "--limit" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.limit = Math.floor(parsed);
      }
      i += 1;
      continue;
    }
    if (arg === "--output" && argv[i + 1]) {
      args.outputPath = argv[i + 1]!;
      i += 1;
    }
  }
  return args;
}

function scoreWithSessionOnlySpread(inputs: {
  evidenceCount: number;
  sessionCount: number;
  hasDisplaySafeQuote: boolean;
}): number {
  const evidenceFraction = Math.min(
    inputs.evidenceCount / VISIBLE_CLAIM_EVIDENCE_SATURATION,
    1
  );
  const sessionFraction = Math.min(
    inputs.sessionCount / VISIBLE_CLAIM_SESSION_SATURATION,
    1
  );
  const quoteFraction = inputs.hasDisplaySafeQuote ? 1 : 0;
  return (
    VISIBLE_CLAIM_WEIGHT_EVIDENCE * evidenceFraction +
    VISIBLE_CLAIM_WEIGHT_SESSION * sessionFraction +
    VISIBLE_CLAIM_WEIGHT_QUOTE * quoteFraction
  );
}

export async function runEffectiveSpreadImpactReport(
  cliArgs: CliArgs = {}
): Promise<{
  scannedClaims: number;
  scoredClaims: number;
  claimsWithJournalEvidence: number;
  journalEntrySpreadDistribution: Record<string, number>;
  journalDaySpreadDistribution: Record<string, number>;
  supportContainerSpreadDistribution: Record<string, number>;
  scoreChangedClaims: number;
  outcomeChangedClaims: number;
  newlySurfacedClaims: number;
  changedRows: ImpactRow[];
  newlySurfacedRows: ImpactRow[];
}> {
  const claims = await prismadb.patternClaim.findMany({
    where: cliArgs.userId ? { userId: cliArgs.userId } : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: cliArgs.limit,
    include: {
      evidence: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          journalEntry: {
            select: {
              authoredAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const journalDaySpreadDistribution: Record<string, number> = {};
  const journalEntrySpreadDistribution: Record<string, number> = {};
  const supportContainerSpreadDistribution: Record<string, number> = {};
  let claimsWithJournalEvidence = 0;

  const changedRows: ImpactRow[] = [];
  const newlySurfacedRows: ImpactRow[] = [];
  let scoredClaims = 0;

  for (const claim of claims) {
    const visibleRecord: VisiblePatternClaimRecord = {
      id: claim.id,
      patternType: claim.patternType,
      summary: claim.summary,
      status: claim.status,
      strengthLevel: claim.strengthLevel,
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
      journalEvidenceCount: claim.journalEvidenceCount,
      journalEntrySpread: claim.journalEntrySpread,
      journalDaySpread: claim.journalDaySpread,
      supportContainerSpread: claim.supportContainerSpread,
      evidence: claim.evidence.map((evidence) => ({
        id: evidence.id,
        source: evidence.source,
        sessionId: evidence.sessionId,
        messageId: evidence.messageId,
        journalEntryId: evidence.journalEntryId,
        journalEntry: evidence.journalEntry,
        quote: evidence.quote,
        createdAt: evidence.createdAt,
      })),
      actions: [],
    };

    if (claim.journalEvidenceCount > 0) {
      claimsWithJournalEvidence += 1;
    }
    journalDaySpreadDistribution[String(claim.journalDaySpread)] =
      (journalDaySpreadDistribution[String(claim.journalDaySpread)] ?? 0) + 1;
    journalEntrySpreadDistribution[String(claim.journalEntrySpread)] =
      (journalEntrySpreadDistribution[String(claim.journalEntrySpread)] ?? 0) +
      1;
    supportContainerSpreadDistribution[String(claim.supportContainerSpread)] =
      (supportContainerSpreadDistribution[String(claim.supportContainerSpread)] ??
        0) + 1;

    const support = buildCanonicalVisibleSupportBundle(visibleRecord);
    if (claim.patternType === "contradiction_drift" || support.summaryText === null) {
      continue;
    }

    scoredClaims += 1;

    const oldScore = scoreWithSessionOnlySpread({
      evidenceCount: support.evidenceCount,
      sessionCount: support.sessionCount,
      hasDisplaySafeQuote: support.displaySafeQuoteStatus,
    });
    const newScore = scoreVisiblePatternClaim({
      evidenceCount: support.evidenceCount,
      sessionCount: support.sessionCount,
      journalEntrySpread: support.journalEntrySpread,
      supportContainerSpread: support.supportContainerSpread,
      hasDisplaySafeQuote: support.displaySafeQuoteStatus,
    }).score;
    const threshold = support.thresholdUsed;
    const oldSurfaced = oldScore >= threshold;
    const newSurfaced = newScore >= threshold;

    const row: ImpactRow = {
      claimId: claim.id,
      patternType: claim.patternType,
      oldScore,
      newScore,
      threshold,
      oldSurfaced,
      newSurfaced,
      sessionCount: support.sessionCount,
      journalEntrySpread: support.journalEntrySpread,
      journalDaySpread: support.journalDaySpread,
      supportContainerSpread: support.supportContainerSpread,
      journalEvidenceCount: support.journalEvidenceCount,
      evidenceCount: support.evidenceCount,
    };

    if (Math.abs(newScore - oldScore) > 1e-12) {
      changedRows.push(row);
    }
    if (oldSurfaced !== newSurfaced) {
      if (!oldSurfaced && newSurfaced) {
        newlySurfacedRows.push(row);
      }
    }
  }

  changedRows.sort((a, b) => Math.abs(b.newScore - b.oldScore) - Math.abs(a.newScore - a.oldScore));
  newlySurfacedRows.sort((a, b) => b.newScore - a.newScore);

  return {
    scannedClaims: claims.length,
    scoredClaims,
    claimsWithJournalEvidence,
    journalEntrySpreadDistribution,
    journalDaySpreadDistribution,
    supportContainerSpreadDistribution,
    scoreChangedClaims: changedRows.length,
    outcomeChangedClaims: changedRows.filter((row) => row.oldSurfaced !== row.newSurfaced).length,
    newlySurfacedClaims: newlySurfacedRows.length,
    changedRows,
    newlySurfacedRows,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await runEffectiveSpreadImpactReport(args);

  const outputPath =
    args.outputPath ??
    path.join(process.cwd(), "eval/patterns/reports/effective-spread-impact.json");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", "utf-8");

  console.log(`[effective-spread-impact] scannedClaims=${report.scannedClaims}`);
  console.log(`[effective-spread-impact] scoredClaims=${report.scoredClaims}`);
  console.log(
    `[effective-spread-impact] claimsWithJournalEvidence=${report.claimsWithJournalEvidence}`
  );
  console.log(
    `[effective-spread-impact] scoreChangedClaims=${report.scoreChangedClaims} outcomeChangedClaims=${report.outcomeChangedClaims} newlySurfacedClaims=${report.newlySurfacedClaims}`
  );
  console.log(`[effective-spread-impact] output=${outputPath}`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
