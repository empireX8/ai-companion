import type { PrismaClient } from "@prisma/client";

import {
  runCandidateCreationRuntimeValidation,
  type CandidateCreationInputCounts,
  type CandidateCreationProposalPresence,
  type CandidateCreationRuntimeValidationReport,
} from "./candidate-creation-runtime-validation";

export type DiscoverInvestigationCandidateProposalCliArgs = {
  limit: number;
  userIds: string[];
};

export type ParseDiscoverInvestigationCandidateProposalCliResult =
  | { ok: true; args: DiscoverInvestigationCandidateProposalCliArgs }
  | { ok: false; message: string };

export type InvestigationCandidateDiscoveryRecommendation =
  | "safe_for_investigation_execute"
  | "not_investigation_candidate"
  | "skipped"
  | "error";

export type InvestigationCandidateDiscoveryUserSummary = {
  userId: string;
  inputCounts: CandidateCreationInputCounts | null;
  harnessPassed: boolean | null;
  userMapGateDecision: string | null;
  proposalPresence: CandidateCreationProposalPresence | null;
  recommendation: InvestigationCandidateDiscoveryRecommendation;
  errorMessage: string | null;
  skippedReason: string | null;
};

export type InvestigationCandidateDiscoverySafeUser = {
  rank: number;
  userId: string;
  inputCounts: CandidateCreationInputCounts;
  harnessPassed: boolean;
  userMapGateDecision: string;
  proposalPresence: CandidateCreationProposalPresence;
};

export type InvestigationCandidateDiscoveryReport = {
  dryRun: true;
  generatedAt: string;
  limit: number;
  explicitUserIds: string[] | null;
  scannedUserCount: number;
  perUser: InvestigationCandidateDiscoveryUserSummary[];
  safeForInvestigationExecute: InvestigationCandidateDiscoverySafeUser[];
  discoverySucceeded: boolean;
  diagnosticMessage: string;
};

const DEFAULT_SCAN_LIMIT = 10;

export function parseDiscoverInvestigationCandidateProposalCliArgs(
  argv: string[]
): ParseDiscoverInvestigationCandidateProposalCliResult {
  let limit = DEFAULT_SCAN_LIMIT;
  const userIds: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;

    if (arg === "--limit" && argv[index + 1]) {
      const parsedLimit = Number.parseInt(argv[index + 1]!, 10);
      if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
        return { ok: false, message: "--limit must be a positive integer." };
      }
      limit = parsedLimit;
      index += 1;
      continue;
    }

    if (arg === "--user-id" && argv[index + 1]) {
      const rawValue = argv[index + 1]!.trim();
      for (const part of rawValue.split(",")) {
        const userId = part.trim();
        if (userId) {
          userIds.push(userId);
        }
      }
      index += 1;
    }
  }

  return {
    ok: true,
    args: {
      limit,
      userIds,
    },
  };
}

export async function loadCandidateUserIdsForScan(args: {
  db: PrismaClient;
  explicitUserIds: string[];
  limit: number;
}): Promise<string[]> {
  if (args.explicitUserIds.length > 0) {
    const uniqueUserIds = [...new Set(args.explicitUserIds)];
    return uniqueUserIds.slice(0, args.limit);
  }

  const messageGroups = await args.db.message.groupBy({
    by: ["userId"],
    _count: { _all: true },
  });

  return messageGroups
    .sort((left, right) => right._count._all - left._count._all)
    .slice(0, args.limit)
    .map((group) => group.userId);
}

export function classifyInvestigationCandidateDiscoveryRecommendation(
  report: CandidateCreationRuntimeValidationReport
): Pick<
  InvestigationCandidateDiscoveryUserSummary,
  "recommendation" | "skippedReason"
> {
  if (!report.darkRun) {
    return {
      recommendation: "skipped",
      skippedReason:
        report.persistence.reason ?? "Dark run was not attempted for this user.",
    };
  }

  const { investigation, userMap } = report.darkRun.proposalPresence;
  if (investigation && !userMap && report.darkRun.harnessPassed) {
    return {
      recommendation: "safe_for_investigation_execute",
      skippedReason: null,
    };
  }

  return {
    recommendation: "not_investigation_candidate",
    skippedReason: null,
  };
}

function buildUserSummaryFromValidationReport(
  report: CandidateCreationRuntimeValidationReport
): InvestigationCandidateDiscoveryUserSummary {
  const classification = classifyInvestigationCandidateDiscoveryRecommendation(report);

  return {
    userId: report.userId,
    inputCounts: report.inputCounts,
    harnessPassed: report.darkRun?.harnessPassed ?? null,
    userMapGateDecision: report.darkRun?.userMapGateDecision ?? null,
    proposalPresence: report.darkRun?.proposalPresence ?? null,
    recommendation: classification.recommendation,
    errorMessage: null,
    skippedReason: classification.skippedReason,
  };
}

function rankSafeUsers(
  summaries: InvestigationCandidateDiscoveryUserSummary[]
): InvestigationCandidateDiscoverySafeUser[] {
  return summaries
    .filter((summary) => summary.recommendation === "safe_for_investigation_execute")
    .sort((left, right) => {
      const leftMessages = left.inputCounts?.message ?? 0;
      const rightMessages = right.inputCounts?.message ?? 0;
      if (rightMessages !== leftMessages) {
        return rightMessages - leftMessages;
      }

      const leftEvidence = left.inputCounts?.evidenceSpan ?? 0;
      const rightEvidence = right.inputCounts?.evidenceSpan ?? 0;
      return rightEvidence - leftEvidence;
    })
    .map((summary, index) => ({
      rank: index + 1,
      userId: summary.userId,
      inputCounts: summary.inputCounts!,
      harnessPassed: summary.harnessPassed!,
      userMapGateDecision: summary.userMapGateDecision!,
      proposalPresence: summary.proposalPresence!,
    }));
}

function buildDiscoveryDiagnosticMessage(args: {
  scannedUserCount: number;
  safeCount: number;
}): string {
  if (args.safeCount > 0) {
    return `Found ${args.safeCount} user(s) with proposalPresence.investigation=true and proposalPresence.userMap=false across ${args.scannedUserCount} scanned user(s). These users are safe for the existing candidate-creation validation --execute path for Investigation.`;
  }

  if (args.scannedUserCount === 0) {
    return (
      "Natural Investigation proposal discovery failed: no users were available to scan. " +
      "Recommend waiting for natural evidence, or adding a dev-only seed script in a later slice " +
      "that persists only through the real Investigation persistence helper when the real proposal builder returns non-null."
    );
  }

  return (
    `Natural Investigation proposal discovery failed across ${args.scannedUserCount} scanned user(s). ` +
    "No user produced proposalPresence.investigation=true with proposalPresence.userMap=false. " +
    "Recommend waiting for natural evidence, or adding a dev-only seed script in a later slice " +
    "that persists only through the real Investigation persistence helper when the real proposal builder returns non-null."
  );
}

export async function runDiscoverInvestigationCandidateProposal(args: {
  limit?: number;
  userIds?: string[];
  now?: Date;
  db: PrismaClient;
  runValidation?: typeof runCandidateCreationRuntimeValidation;
}): Promise<InvestigationCandidateDiscoveryReport> {
  const now = args.now ?? new Date();
  const limit = args.limit ?? DEFAULT_SCAN_LIMIT;
  const explicitUserIds = args.userIds ?? [];
  const runValidation = args.runValidation ?? runCandidateCreationRuntimeValidation;

  const userIdsToScan = await loadCandidateUserIdsForScan({
    db: args.db,
    explicitUserIds,
    limit,
  });

  const perUser: InvestigationCandidateDiscoveryUserSummary[] = [];

  for (const userId of userIdsToScan) {
    try {
      const validationReport = await runValidation({
        userId,
        dryRun: true,
        now,
        db: args.db,
      });
      perUser.push(buildUserSummaryFromValidationReport(validationReport));
    } catch (error: unknown) {
      perUser.push({
        userId,
        inputCounts: null,
        harnessPassed: null,
        userMapGateDecision: null,
        proposalPresence: null,
        recommendation: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
        skippedReason: null,
      });
    }
  }

  const safeForInvestigationExecute = rankSafeUsers(perUser);
  const discoverySucceeded = safeForInvestigationExecute.length > 0;

  return {
    dryRun: true,
    generatedAt: now.toISOString(),
    limit,
    explicitUserIds: explicitUserIds.length > 0 ? explicitUserIds : null,
    scannedUserCount: userIdsToScan.length,
    perUser,
    safeForInvestigationExecute,
    discoverySucceeded,
    diagnosticMessage: buildDiscoveryDiagnosticMessage({
      scannedUserCount: userIdsToScan.length,
      safeCount: safeForInvestigationExecute.length,
    }),
  };
}
