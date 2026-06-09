import type { PrismaClient } from "@prisma/client";

import {
  runCandidateCreationRuntimeValidation,
  type CandidateCreationInputCounts,
  type CandidateCreationProposalPresence,
  type CandidateCreationRuntimeValidationReport,
} from "./candidate-creation-runtime-validation";
import { loadCandidateUserIdsForScan } from "./discover-investigation-candidate-proposal";

export type DiscoverCandidateFamilyProposalsCliArgs = {
  limit: number;
  userIds: string[];
};

export type ParseDiscoverCandidateFamilyProposalsCliResult =
  | { ok: true; args: DiscoverCandidateFamilyProposalsCliArgs }
  | { ok: false; message: string };

export type FieldworkCandidateDiscoveryRecommendation =
  | "safe_for_fieldwork_execute"
  | "not_fieldwork_candidate"
  | "skipped"
  | "error";

export type ModelUpdateCandidateDiscoveryRecommendation =
  | "safe_for_model_update_execute"
  | "not_model_update_candidate"
  | "skipped"
  | "error";

export type CandidateFamilyDiscoveryUserSummary = {
  userId: string;
  inputCounts: CandidateCreationInputCounts | null;
  harnessPassed: boolean | null;
  userMapGateDecision: string | null;
  proposalPresence: CandidateCreationProposalPresence | null;
  fieldworkRecommendation: FieldworkCandidateDiscoveryRecommendation;
  modelUpdateRecommendation: ModelUpdateCandidateDiscoveryRecommendation;
  errorMessage: string | null;
  fieldworkSkippedReason: string | null;
  modelUpdateSkippedReason: string | null;
};

export type CandidateFamilyDiscoverySafeUser = {
  rank: number;
  userId: string;
  inputCounts: CandidateCreationInputCounts;
  harnessPassed: boolean;
  userMapGateDecision: string;
  proposalPresence: CandidateCreationProposalPresence;
};

export type CandidateFamilyDiscoveryReport = {
  dryRun: true;
  generatedAt: string;
  limit: number;
  explicitUserIds: string[] | null;
  scannedUserCount: number;
  perUser: CandidateFamilyDiscoveryUserSummary[];
  safeForFieldworkExecute: CandidateFamilyDiscoverySafeUser[];
  safeForModelUpdateExecute: CandidateFamilyDiscoverySafeUser[];
  fieldworkDiscoverySucceeded: boolean;
  modelUpdateDiscoverySucceeded: boolean;
  fieldworkDiagnosticMessage: string;
  modelUpdateDiagnosticMessage: string;
};

const DEFAULT_SCAN_LIMIT = 10;

export function parseDiscoverCandidateFamilyProposalsCliArgs(
  argv: string[]
): ParseDiscoverCandidateFamilyProposalsCliResult {
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

export function classifyFieldworkCandidateDiscoveryRecommendation(
  report: CandidateCreationRuntimeValidationReport
): Pick<
  CandidateFamilyDiscoveryUserSummary,
  "fieldworkRecommendation" | "fieldworkSkippedReason"
> {
  if (!report.darkRun) {
    return {
      fieldworkRecommendation: "skipped",
      fieldworkSkippedReason:
        report.persistence.reason ?? "Dark run was not attempted for this user.",
    };
  }

  const { fieldwork, userMap, investigation } = report.darkRun.proposalPresence;
  if (fieldwork && !userMap && !investigation && report.darkRun.harnessPassed) {
    return {
      fieldworkRecommendation: "safe_for_fieldwork_execute",
      fieldworkSkippedReason: null,
    };
  }

  return {
    fieldworkRecommendation: "not_fieldwork_candidate",
    fieldworkSkippedReason: null,
  };
}

export function classifyModelUpdateCandidateDiscoveryRecommendation(
  report: CandidateCreationRuntimeValidationReport
): Pick<
  CandidateFamilyDiscoveryUserSummary,
  "modelUpdateRecommendation" | "modelUpdateSkippedReason"
> {
  if (!report.darkRun) {
    return {
      modelUpdateRecommendation: "skipped",
      modelUpdateSkippedReason:
        report.persistence.reason ?? "Dark run was not attempted for this user.",
    };
  }

  const { modelUpdate, userMap, investigation, fieldwork } = report.darkRun.proposalPresence;
  if (
    modelUpdate &&
    !userMap &&
    !investigation &&
    !fieldwork &&
    report.darkRun.harnessPassed
  ) {
    return {
      modelUpdateRecommendation: "safe_for_model_update_execute",
      modelUpdateSkippedReason: null,
    };
  }

  return {
    modelUpdateRecommendation: "not_model_update_candidate",
    modelUpdateSkippedReason: null,
  };
}

function buildUserSummaryFromValidationReport(
  report: CandidateCreationRuntimeValidationReport
): CandidateFamilyDiscoveryUserSummary {
  const fieldworkClassification = classifyFieldworkCandidateDiscoveryRecommendation(report);
  const modelUpdateClassification = classifyModelUpdateCandidateDiscoveryRecommendation(report);

  return {
    userId: report.userId,
    inputCounts: report.inputCounts,
    harnessPassed: report.darkRun?.harnessPassed ?? null,
    userMapGateDecision: report.darkRun?.userMapGateDecision ?? null,
    proposalPresence: report.darkRun?.proposalPresence ?? null,
    fieldworkRecommendation: fieldworkClassification.fieldworkRecommendation,
    modelUpdateRecommendation: modelUpdateClassification.modelUpdateRecommendation,
    errorMessage: null,
    fieldworkSkippedReason: fieldworkClassification.fieldworkSkippedReason,
    modelUpdateSkippedReason: modelUpdateClassification.modelUpdateSkippedReason,
  };
}

function rankSafeUsersForFamily(
  summaries: CandidateFamilyDiscoveryUserSummary[],
  family: "fieldwork" | "modelUpdate"
): CandidateFamilyDiscoverySafeUser[] {
  const safeRecommendation =
    family === "fieldwork"
      ? "safe_for_fieldwork_execute"
      : "safe_for_model_update_execute";

  return summaries
    .filter((summary) =>
      family === "fieldwork"
        ? summary.fieldworkRecommendation === safeRecommendation
        : summary.modelUpdateRecommendation === safeRecommendation
    )
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

function buildFieldworkDiagnosticMessage(args: {
  scannedUserCount: number;
  safeCount: number;
}): string {
  if (args.safeCount > 0) {
    return (
      `Found ${args.safeCount} user(s) with proposalPresence.fieldwork=true while ` +
      `proposalPresence.userMap=false and proposalPresence.investigation=false across ` +
      `${args.scannedUserCount} scanned user(s). These users are safe for the existing ` +
      `candidate-creation validation --execute path for FieldworkAssignment.`
    );
  }

  if (args.scannedUserCount === 0) {
    return (
      "Natural Fieldwork proposal discovery failed: no users were available to scan. " +
      "Recommend waiting for natural evidence, or adding a dev-only seed script in a later slice " +
      "that persists only through the real Fieldwork persistence helper when the real proposal builder returns non-null."
    );
  }

  return (
    `Natural Fieldwork proposal discovery failed across ${args.scannedUserCount} scanned user(s). ` +
    "No user produced proposalPresence.fieldwork=true with higher-priority families absent. " +
    "Recommend waiting for natural evidence, or adding a dev-only seed script in a later slice " +
    "that persists only through the real Fieldwork persistence helper when the real proposal builder returns non-null."
  );
}

function buildModelUpdateDiagnosticMessage(args: {
  scannedUserCount: number;
  safeCount: number;
}): string {
  if (args.safeCount > 0) {
    return (
      `Found ${args.safeCount} user(s) with proposalPresence.modelUpdate=true while ` +
      `proposalPresence.userMap=false, proposalPresence.investigation=false, and ` +
      `proposalPresence.fieldwork=false across ${args.scannedUserCount} scanned user(s). ` +
      "These users are safe for the existing candidate-creation validation --execute path for ModelUpdate."
    );
  }

  if (args.scannedUserCount === 0) {
    return (
      "Natural ModelUpdate proposal discovery failed: no users were available to scan. " +
      "Recommend waiting for natural evidence, or adding a dev-only seed script in a later slice " +
      "that persists only through the real ModelUpdate persistence helper when the real proposal builder returns non-null."
    );
  }

  return (
    `Natural ModelUpdate proposal discovery failed across ${args.scannedUserCount} scanned user(s). ` +
    "No user produced proposalPresence.modelUpdate=true with higher-priority families absent. " +
    "Recommend waiting for natural evidence, or adding a dev-only seed script in a later slice " +
    "that persists only through the real ModelUpdate persistence helper when the real proposal builder returns non-null."
  );
}

export async function runDiscoverCandidateFamilyProposals(args: {
  limit?: number;
  userIds?: string[];
  now?: Date;
  db: PrismaClient;
  runValidation?: typeof runCandidateCreationRuntimeValidation;
}): Promise<CandidateFamilyDiscoveryReport> {
  const now = args.now ?? new Date();
  const limit = args.limit ?? DEFAULT_SCAN_LIMIT;
  const explicitUserIds = args.userIds ?? [];
  const runValidation = args.runValidation ?? runCandidateCreationRuntimeValidation;

  const userIdsToScan = await loadCandidateUserIdsForScan({
    db: args.db,
    explicitUserIds,
    limit,
  });

  const perUser: CandidateFamilyDiscoveryUserSummary[] = [];

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
        fieldworkRecommendation: "error",
        modelUpdateRecommendation: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
        fieldworkSkippedReason: null,
        modelUpdateSkippedReason: null,
      });
    }
  }

  const safeForFieldworkExecute = rankSafeUsersForFamily(perUser, "fieldwork");
  const safeForModelUpdateExecute = rankSafeUsersForFamily(perUser, "modelUpdate");

  return {
    dryRun: true,
    generatedAt: now.toISOString(),
    limit,
    explicitUserIds: explicitUserIds.length > 0 ? explicitUserIds : null,
    scannedUserCount: userIdsToScan.length,
    perUser,
    safeForFieldworkExecute,
    safeForModelUpdateExecute,
    fieldworkDiscoverySucceeded: safeForFieldworkExecute.length > 0,
    modelUpdateDiscoverySucceeded: safeForModelUpdateExecute.length > 0,
    fieldworkDiagnosticMessage: buildFieldworkDiagnosticMessage({
      scannedUserCount: userIdsToScan.length,
      safeCount: safeForFieldworkExecute.length,
    }),
    modelUpdateDiagnosticMessage: buildModelUpdateDiagnosticMessage({
      scannedUserCount: userIdsToScan.length,
      safeCount: safeForModelUpdateExecute.length,
    }),
  };
}
