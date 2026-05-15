import { type PrismaClient, UserMapConclusionStatus } from "@prisma/client";

import {
  UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE,
  completeDerivationRun,
  createDerivationArtifact,
  createDerivationRun,
  failDerivationRun,
  startDerivationRun,
} from "../derivation-layer";
import prismadb from "../prismadb";
import { evaluateDarkRunUserMapCandidate } from "./dark-run-evaluator";
import {
  assembleEvidencePacketV1,
  type AssembleEvidencePacketInput,
} from "./evidence-packet";
import type {
  DarkRunDiagnostics,
  EvidencePacket,
  EvidencePacketMetrics,
  GateEvaluationTarget,
} from "./types";

const DEFAULT_PROCESSOR_VERSION = "understanding-dark-engine-v1";

type DarkRunPersistenceDb = PrismaClient &
  NonNullable<AssembleEvidencePacketInput["db"]>;

export type UnderstandingDarkRunDiagnosticsPayload = {
  runId: string;
  userId: string;
  runCreatedAt: string;
  persistedAt: string;
  processorVersion: string;
  packetMetrics: EvidencePacketMetrics;
  candidatesProposed: number;
  candidatesWritten: number;
  abstentions: number;
  rejectionCountsByReason: DarkRunDiagnostics["rejectionCountsByReason"];
  sourceCounts: DarkRunDiagnostics["sourceCounts"];
  sourceDiversity: number;
  timeSpreadDays: number;
  importedVsNative: DarkRunDiagnostics["importedVsNative"];
  highEmotionCaps: number;
  singleEpisodeBlocks: number;
  nonLinkableContextItems: number;
  linkIntegrityWarnings: string[];
  warnings: string[];
  notes: string[];
  dryRunOnly: true;
  candidateWritesEnabled: false;
  evidenceLinkWritesEnabled: false;
};

export type RunManualUnderstandingDarkEngineDarkRunInput = {
  userId: string;
  db?: DarkRunPersistenceDb;
  now?: Date;
  windowDays?: number;
  processorVersion?: string;
  target?: GateEvaluationTarget;
};

export type RunManualUnderstandingDarkEngineDarkRunResult = {
  runId: string;
  artifactId: string;
  artifactType: string;
  processorVersion: string;
  runCreatedAt: string;
  persistedAt: string;
  diagnostics: DarkRunDiagnostics;
  payload: UnderstandingDarkRunDiagnosticsPayload;
};

function defaultGateTarget(): GateEvaluationTarget {
  return {
    requestedStatus: UserMapConclusionStatus.emerging,
    identityLevelClaim: false,
    proposedSummary: "Manual dark-run diagnostics candidate.",
    requiresReceipt: true,
  };
}

function buildRunMessageIdsFromPacket(packet: EvidencePacket): string[] {
  return [...new Set(
    packet.items
      .map((item) => item.provenanceRefs.messageId)
      .filter((id): id is string => Boolean(id))
  )];
}

function buildRunSessionCountFromPacket(
  packet: EvidencePacket
): number {
  return new Set(
    packet.items
      .map((item) => item.provenanceRefs.sessionId)
      .filter((id): id is string => Boolean(id))
  ).size;
}

export async function runManualUnderstandingDarkEngineDarkRun(
  input: RunManualUnderstandingDarkEngineDarkRunInput
): Promise<RunManualUnderstandingDarkEngineDarkRunResult> {
  const db = (input.db ?? prismadb) as unknown as DarkRunPersistenceDb;
  const now = input.now ?? new Date();
  const processorVersion = input.processorVersion ?? DEFAULT_PROCESSOR_VERSION;
  const target = input.target ?? defaultGateTarget();

  const packet = await assembleEvidencePacketV1({
    userId: input.userId,
    now,
    windowDays: input.windowDays,
    db,
  });

  const evaluation = evaluateDarkRunUserMapCandidate({
    packet,
    target,
  });

  const messageIds = buildRunMessageIdsFromPacket(packet);
  const sessionCount = buildRunSessionCountFromPacket(packet);

  const run = await createDerivationRun(
    {
      userId: input.userId,
      scope: "manual",
      processorVersion,
      messageIds,
      batchMeta: {
        messageCount: messageIds.length,
        sessionCount,
        windowStart: packet.windowStart,
        windowEnd: packet.windowEnd,
      },
    },
    db
  );

  try {
    await startDerivationRun(run.id, db);

    const persistedAt = new Date();
    const notes = [...evaluation.diagnostics.notes];
    notes.push(`decision:${evaluation.result.decision}`);
    notes.push(`allowedStatus:${evaluation.result.allowedStatus}`);
    if (evaluation.result.reasons.length > 0) {
      notes.push(`reasons:${evaluation.result.reasons.join(",")}`);
    }

    const payload: UnderstandingDarkRunDiagnosticsPayload = {
      runId: run.id,
      userId: input.userId,
      runCreatedAt: run.createdAt.toISOString(),
      persistedAt: persistedAt.toISOString(),
      processorVersion,
      packetMetrics: packet.metrics,
      candidatesProposed: evaluation.diagnostics.candidatesProposed,
      candidatesWritten: 0,
      abstentions: evaluation.diagnostics.abstentions,
      rejectionCountsByReason: evaluation.diagnostics.rejectionCountsByReason,
      sourceCounts: evaluation.diagnostics.sourceCounts,
      sourceDiversity: evaluation.diagnostics.sourceDiversity,
      timeSpreadDays: evaluation.diagnostics.timeSpreadDays,
      importedVsNative: evaluation.diagnostics.importedVsNative,
      highEmotionCaps: evaluation.diagnostics.highEmotionCaps,
      singleEpisodeBlocks: evaluation.diagnostics.singleEpisodeBlocks,
      nonLinkableContextItems: evaluation.diagnostics.nonLinkableContextItems,
      linkIntegrityWarnings: [...evaluation.diagnostics.linkIntegrityWarnings],
      warnings: [...evaluation.result.warnings],
      notes,
      dryRunOnly: true,
      candidateWritesEnabled: false,
      evidenceLinkWritesEnabled: false,
    };

    const artifactId = await createDerivationArtifact(
      {
        userId: input.userId,
        runId: run.id,
        type: UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE,
        payload,
        confidenceScore: evaluation.result.confidenceCap,
        temporalStart: packet.windowStart,
        temporalEnd: packet.windowEnd,
      },
      db
    );

    await completeDerivationRun(run.id, db);

    return {
      runId: run.id,
      artifactId,
      artifactType: UNDERSTANDING_DARK_ENGINE_DIAGNOSTICS_ARTIFACT_TYPE,
      processorVersion,
      runCreatedAt: run.createdAt.toISOString(),
      persistedAt: persistedAt.toISOString(),
      diagnostics: evaluation.diagnostics,
      payload,
    };
  } catch (error) {
    await failDerivationRun(run.id, db).catch(() => {
      // best-effort failure transition
    });
    throw error;
  }
}
