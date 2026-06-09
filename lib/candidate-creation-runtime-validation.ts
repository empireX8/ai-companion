import type { PrismaClient } from "@prisma/client";

import { persistInternalCandidateFromNoWriteDarkRunOutput } from "./understanding-dark-engine/candidate-bridge-dark-run-persistence";
import { shouldRunAppMessageCandidateBridgeForSession } from "./understanding-dark-engine/app-message-candidate-bridge";
import { evaluateNoWriteDarkRunOutput } from "./understanding-dark-engine/dark-run-evaluation-harness";
import {
  runNoWriteUnderstandingDarkRun,
  type RunNoWriteUnderstandingDarkRunResult,
} from "./understanding-dark-engine/dark-run-orchestrator";
import { extractStructuredFieldworkCandidateProposal } from "./understanding-dark-engine/fieldwork-candidate-proposal";
import { extractStructuredInvestigationCandidateProposal } from "./understanding-dark-engine/investigation-candidate-proposal";
import { extractStructuredModelUpdateCandidateProposal } from "./understanding-dark-engine/model-update-candidate-proposal";
import { extractStructuredUserMapCandidateProposal } from "./understanding-dark-engine/user-map-candidate-proposal";
import {
  evaluateNoWriteDarkRunTriggerEligibility,
  type NoWriteDarkRunTriggerEligibilityResult,
} from "./understanding-dark-engine/no-write-trigger-eligibility";
import {
  loadNoWriteDarkRunTriggerRuntimeState,
  UNDERSTANDING_DARK_ENGINE_NO_WRITE_DERIVATION_SCOPE,
  UNDERSTANDING_DARK_ENGINE_NO_WRITE_PROCESSOR_VERSION,
} from "./understanding-dark-engine/no-write-trigger-runtime-state";

export type CandidateCreationRuntimeValidationCliArgs = {
  userId: string;
  dryRun: boolean;
};

export type ParseCandidateCreationRuntimeValidationCliResult =
  | { ok: true; args: CandidateCreationRuntimeValidationCliArgs }
  | { ok: false; message: string };

export type CandidateFamilyCounts = {
  userMapConclusion: number;
  investigation: number;
  fieldworkAssignment: number;
  modelUpdate: number;
};

export type CandidateCreationInputCounts = {
  session: number;
  message: number;
  evidenceSpan: number;
  patternClaim: number;
};

export type CandidateCreationImportSessionSummary = {
  id: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  sessionsCreated: number | null;
  messagesCreated: number | null;
} | null;

export type CandidateCreationDerivationRunSummary = {
  id: string;
  scope: string;
  processorVersion: string;
  status: string;
  createdAt: string;
} | null;

export type CandidateCreationSessionTriggerSummary = {
  totalSessions: number;
  appBridgeEligibleSessions: number;
  origins: Array<{ origin: string | null; count: number }>;
  surfaceTypes: Array<{ surfaceType: string | null; count: number }>;
};

export type CandidateCreationTriggerEligibilitySummary = {
  importCompleted: NoWriteDarkRunTriggerEligibilityResult;
  appUserMessage: NoWriteDarkRunTriggerEligibilityResult;
  manualInternal: NoWriteDarkRunTriggerEligibilityResult;
};

export type CandidateCreationProposalPresence = {
  userMap: boolean;
  userMapArea: string | null;
  investigation: boolean;
  fieldwork: boolean;
  modelUpdate: boolean;
};

export type CandidateCreationDarkRunSummary = {
  harnessPassed: boolean;
  harnessFailureCount: number;
  userMapGateDecision: string;
  userMapGateReasons: string[];
  proposalPresence: CandidateCreationProposalPresence;
};

export type CandidateCreationPersistenceSummary = {
  attempted: boolean;
  dryRun: boolean;
  decision: string | null;
  reason: string | null;
  persistedConclusionId: string | null;
  persistedInvestigationId: string | null;
  persistedFieldworkAssignmentId: string | null;
  persistedModelUpdateId: string | null;
  blockedWriteReasons: string[];
};

export type CandidateCreationRuntimeValidationReport = {
  userId: string;
  dryRun: boolean;
  generatedAt: string;
  inputCounts: CandidateCreationInputCounts;
  candidateCountsBefore: CandidateFamilyCounts;
  candidateCountsAfter: CandidateFamilyCounts;
  latestImportSession: CandidateCreationImportSessionSummary;
  latestDerivationRun: CandidateCreationDerivationRunSummary;
  latestUnderstandingDarkEngineDerivationRun: CandidateCreationDerivationRunSummary;
  understandingDarkEngineDerivationRunCount: number;
  sessionTriggerSummary: CandidateCreationSessionTriggerSummary;
  triggerEligibility: CandidateCreationTriggerEligibilitySummary;
  darkRun: CandidateCreationDarkRunSummary | null;
  persistence: CandidateCreationPersistenceSummary;
  diagnosis: {
    importCompletionBridgeRerunnable: boolean;
    appMessageBridgeWouldRunForAnySession: boolean;
    likelyRootCause: string;
  };
};

export function parseCandidateCreationRuntimeValidationCliArgs(
  argv: string[]
): ParseCandidateCreationRuntimeValidationCliResult {
  let userId: string | undefined;
  let dryRun = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;

    if (arg === "--user-id" && argv[index + 1]) {
      userId = argv[index + 1]!.trim();
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--execute" || arg === "--no-dry-run") {
      dryRun = false;
    }
  }

  if (!userId) {
    return { ok: false, message: "Missing required --user-id argument." };
  }

  return {
    ok: true,
    args: {
      userId,
      dryRun,
    },
  };
}

function summarizeDerivationRun(
  run: {
    id: string;
    scope: string;
    processorVersion: string;
    status: string;
    createdAt: Date;
  } | null
): CandidateCreationDerivationRunSummary {
  if (!run) {
    return null;
  }

  return {
    id: run.id,
    scope: run.scope,
    processorVersion: run.processorVersion,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
  };
}

function summarizeProposalPresence(
  darkRunOutput: RunNoWriteUnderstandingDarkRunResult
): CandidateCreationProposalPresence {
  const userMapProposal = extractStructuredUserMapCandidateProposal(darkRunOutput);
  return {
    userMap: Boolean(userMapProposal),
    userMapArea: userMapProposal?.area ?? null,
    investigation: Boolean(extractStructuredInvestigationCandidateProposal(darkRunOutput)),
    fieldwork: Boolean(extractStructuredFieldworkCandidateProposal(darkRunOutput)),
    modelUpdate: Boolean(extractStructuredModelUpdateCandidateProposal(darkRunOutput)),
  };
}

async function loadTriggerEligibility(args: {
  userId: string;
  now: Date;
  db: PrismaClient;
}): Promise<CandidateCreationTriggerEligibilitySummary> {
  const runtimeState = await loadNoWriteDarkRunTriggerRuntimeState({
    userId: args.userId,
    db: args.db,
    triggerEvidenceAt: args.now,
  });

  const sharedInput = {
    userId: args.userId,
    now: args.now,
    lastRunAt: runtimeState.lastRunAt,
    lastEvidenceCutoffAt: runtimeState.lastEvidenceCutoffAt,
    inFlight: runtimeState.inFlight,
    noWriteOnly: true as const,
    lastEvidenceAt: runtimeState.triggerEvidenceAt ?? undefined,
  };

  return {
    importCompleted: evaluateNoWriteDarkRunTriggerEligibility({
      ...sharedInput,
      eventType: "import_completed",
    }),
    appUserMessage: evaluateNoWriteDarkRunTriggerEligibility({
      ...sharedInput,
      eventType: "app_user_message",
    }),
    manualInternal: evaluateNoWriteDarkRunTriggerEligibility({
      ...sharedInput,
      eventType: "manual_internal",
      allowManualOverride: true,
    }),
  };
}

async function countCandidateFamilies(
  db: PrismaClient,
  userId: string
): Promise<CandidateFamilyCounts> {
  const [userMapConclusion, investigation, fieldworkAssignment, modelUpdate] =
    await Promise.all([
      db.userMapConclusion.count({ where: { userId } }),
      db.investigation.count({ where: { userId } }),
      db.fieldworkAssignment.count({ where: { userId } }),
      db.modelUpdate.count({ where: { userId } }),
    ]);

  return {
    userMapConclusion,
    investigation,
    fieldworkAssignment,
    modelUpdate,
  };
}

function buildDiagnosis(args: {
  latestUnderstandingDarkEngineDerivationRun: CandidateCreationDerivationRunSummary;
  latestImportSession: CandidateCreationImportSessionSummary;
  appMessageBridgeWouldRunForAnySession: boolean;
}): CandidateCreationRuntimeValidationReport["diagnosis"] {
  if (args.latestUnderstandingDarkEngineDerivationRun) {
    return {
      importCompletionBridgeRerunnable: Boolean(args.latestImportSession),
      appMessageBridgeWouldRunForAnySession:
        args.appMessageBridgeWouldRunForAnySession,
      likelyRootCause:
        "Candidate bridge has run before for this user; inspect dark-run gate/persistence diagnostics for skip reasons.",
    };
  }

  if (!args.appMessageBridgeWouldRunForAnySession && args.latestImportSession) {
    return {
      importCompletionBridgeRerunnable: true,
      appMessageBridgeWouldRunForAnySession: false,
      likelyRootCause:
        "Import completed before candidate bridge wiring or import-completion hook did not rerun; sessions are IMPORTED_ARCHIVE only so APP message bridge never fires.",
    };
  }

  if (!args.appMessageBridgeWouldRunForAnySession) {
    return {
      importCompletionBridgeRerunnable: Boolean(args.latestImportSession),
      appMessageBridgeWouldRunForAnySession: false,
      likelyRootCause:
        "No APP journal_chat/explore_chat sessions exist; candidate bridge only triggers on import completion or new APP user messages.",
    };
  }

  return {
    importCompletionBridgeRerunnable: Boolean(args.latestImportSession),
    appMessageBridgeWouldRunForAnySession: true,
    likelyRootCause:
      "Candidate bridge triggers exist but no understanding-dark-engine derivation runs were recorded for this user.",
  };
}

export async function runCandidateCreationRuntimeValidation(args: {
  userId: string;
  dryRun?: boolean;
  now?: Date;
  db: PrismaClient;
}): Promise<CandidateCreationRuntimeValidationReport> {
  const now = args.now ?? new Date();
  const dryRun = args.dryRun ?? true;
  const db = args.db;

  const candidateCountsBefore = await countCandidateFamilies(db, args.userId);

  const [
    sessionCount,
    messageCount,
    evidenceSpanCount,
    patternClaimCount,
    latestImportSession,
    latestDerivationRun,
    latestUnderstandingDarkEngineDerivationRun,
    understandingDarkEngineDerivationRunCount,
    sessionGroups,
    surfaceGroups,
    sessionsForTriggerCheck,
    triggerEligibility,
  ] = await Promise.all([
    db.session.count({ where: { userId: args.userId } }),
    db.message.count({ where: { userId: args.userId } }),
    db.evidenceSpan.count({ where: { userId: args.userId } }),
    db.patternClaim.count({ where: { userId: args.userId } }),
    db.importUploadSession.findFirst({
      where: { userId: args.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        finishedAt: true,
        sessionsCreated: true,
        messagesCreated: true,
      },
    }),
    db.derivationRun.findFirst({
      where: { userId: args.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        scope: true,
        processorVersion: true,
        status: true,
        createdAt: true,
      },
    }),
    db.derivationRun.findFirst({
      where: {
        userId: args.userId,
        scope: UNDERSTANDING_DARK_ENGINE_NO_WRITE_DERIVATION_SCOPE,
        processorVersion: UNDERSTANDING_DARK_ENGINE_NO_WRITE_PROCESSOR_VERSION,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        scope: true,
        processorVersion: true,
        status: true,
        createdAt: true,
      },
    }),
    db.derivationRun.count({
      where: {
        userId: args.userId,
        scope: UNDERSTANDING_DARK_ENGINE_NO_WRITE_DERIVATION_SCOPE,
        processorVersion: UNDERSTANDING_DARK_ENGINE_NO_WRITE_PROCESSOR_VERSION,
      },
    }),
    db.session.groupBy({
      by: ["origin"],
      where: { userId: args.userId },
      _count: { _all: true },
    }),
    db.session.groupBy({
      by: ["surfaceType"],
      where: { userId: args.userId },
      _count: { _all: true },
    }),
    db.session.findMany({
      where: { userId: args.userId },
      select: { origin: true, surfaceType: true },
    }),
    loadTriggerEligibility({ userId: args.userId, now, db }),
  ]);

  const appBridgeEligibleSessions = sessionsForTriggerCheck.filter((session) =>
    shouldRunAppMessageCandidateBridgeForSession(session)
  ).length;

  let darkRun: CandidateCreationDarkRunSummary | null = null;
  const persistence: CandidateCreationPersistenceSummary = {
    attempted: false,
    dryRun,
    decision: null,
    reason: null,
    persistedConclusionId: null,
    persistedInvestigationId: null,
    persistedFieldworkAssignmentId: null,
    persistedModelUpdateId: null,
    blockedWriteReasons: [],
  };

  if (triggerEligibility.manualInternal.eligible) {
    const darkRunOutput = (await runNoWriteUnderstandingDarkRun({
      userId: args.userId,
      now,
      db: db as unknown as Parameters<typeof runNoWriteUnderstandingDarkRun>[0]["db"],
    })) as RunNoWriteUnderstandingDarkRunResult;

    const harness = evaluateNoWriteDarkRunOutput(darkRunOutput);
    darkRun = {
      harnessPassed: harness.passed,
      harnessFailureCount: harness.summary.failureCount,
      userMapGateDecision: darkRunOutput.userMapEvaluation.decision,
      userMapGateReasons: darkRunOutput.userMapEvaluation.reasons,
      proposalPresence: summarizeProposalPresence(darkRunOutput),
    };

    if (!dryRun && harness.passed) {
      persistence.attempted = true;
      const persistenceOutcome = await persistInternalCandidateFromNoWriteDarkRunOutput({
        userId: args.userId,
        darkRunOutput,
        now,
        db,
        logTag: "[CANDIDATE_CREATION_RUNTIME_VALIDATION]",
      });
      persistence.decision = persistenceOutcome.decision;
      persistence.reason = persistenceOutcome.reason;
      persistence.persistedConclusionId = persistenceOutcome.persistedConclusionId ?? null;
      persistence.persistedInvestigationId =
        persistenceOutcome.persistedInvestigationId ?? null;
      persistence.persistedFieldworkAssignmentId =
        persistenceOutcome.persistedFieldworkAssignmentId ?? null;
      persistence.persistedModelUpdateId = persistenceOutcome.persistedModelUpdateId ?? null;
      persistence.blockedWriteReasons = persistenceOutcome.blockedWriteReasons ?? [];
    } else if (!dryRun && !harness.passed) {
      persistence.attempted = false;
      persistence.decision = "skipped_harness_failed";
      persistence.reason = "No-write evaluation harness failed.";
    } else if (dryRun) {
      persistence.decision = "dry_run_skipped_persistence";
      persistence.reason = "Dry-run mode; persistence was not attempted.";
    }
  } else {
    persistence.decision = "skipped_ineligible_trigger";
    persistence.reason = triggerEligibility.manualInternal.reason;
  }

  const candidateCountsAfter = await countCandidateFamilies(db, args.userId);

  const latestImportSummary: CandidateCreationImportSessionSummary = latestImportSession
    ? {
        id: latestImportSession.id,
        status: latestImportSession.status,
        createdAt: latestImportSession.createdAt.toISOString(),
        finishedAt: latestImportSession.finishedAt?.toISOString() ?? null,
        sessionsCreated: latestImportSession.sessionsCreated,
        messagesCreated: latestImportSession.messagesCreated,
      }
    : null;

  const latestUdeDerivation = summarizeDerivationRun(
    latestUnderstandingDarkEngineDerivationRun
  );

  return {
    userId: args.userId,
    dryRun,
    generatedAt: now.toISOString(),
    inputCounts: {
      session: sessionCount,
      message: messageCount,
      evidenceSpan: evidenceSpanCount,
      patternClaim: patternClaimCount,
    },
    candidateCountsBefore,
    candidateCountsAfter,
    latestImportSession: latestImportSummary,
    latestDerivationRun: summarizeDerivationRun(latestDerivationRun),
    latestUnderstandingDarkEngineDerivationRun: latestUdeDerivation,
    understandingDarkEngineDerivationRunCount,
    sessionTriggerSummary: {
      totalSessions: sessionCount,
      appBridgeEligibleSessions,
      origins: sessionGroups.map((group) => ({
        origin: group.origin,
        count: group._count._all,
      })),
      surfaceTypes: surfaceGroups.map((group) => ({
        surfaceType: group.surfaceType,
        count: group._count._all,
      })),
    },
    triggerEligibility,
    darkRun,
    persistence,
    diagnosis: buildDiagnosis({
      latestUnderstandingDarkEngineDerivationRun: latestUdeDerivation,
      latestImportSession: latestImportSummary,
      appMessageBridgeWouldRunForAnySession: appBridgeEligibleSessions > 0,
    }),
  };
}
