import type { PrismaClient } from "@prisma/client";

import prismadb from "../prismadb";
import {
  evaluateNoWriteDarkRunTriggerEligibility,
  type NoWriteDarkRunTriggerEligibilityResult,
  type NoWriteDarkRunTriggerEventType,
} from "./no-write-trigger-eligibility";

export const UNDERSTANDING_DARK_ENGINE_NO_WRITE_PROCESSOR_VERSION =
  "understanding-dark-engine-v1";

export const UNDERSTANDING_DARK_ENGINE_NO_WRITE_DERIVATION_SCOPE = "manual";

const IN_FLIGHT_DERIVATION_RUN_STATUSES = ["created", "running"] as const;

export type NoWriteDarkRunTriggerRuntimeState = {
  /** Latest matching run creation time; used for cooldown suppression. */
  lastRunAt: Date | null;
  /**
   * Latest matching run evidence window end, falling back to createdAt when absent.
   * Used as the no-new-evidence cutoff passed to eligibility.
   */
  lastEvidenceCutoffAt: Date | null;
  inFlight: boolean;
  /**
   * Timestamp for evidence introduced by the current trigger event itself.
   * Passed through as eligibility `lastEvidenceAt` when provided.
   */
  triggerEvidenceAt: Date | null;
};

export type LoadNoWriteDarkRunTriggerRuntimeStateInput = {
  userId: string;
  db?: PrismaClient;
  triggerEvidenceAt?: Date | null;
};

function parseTriggerEvidenceAt(value: Date | null | undefined): Date | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return null;
  }
  return value;
}

function resolveEvidenceCutoffAt(run: {
  createdAt: Date;
  windowEnd: Date | null;
}): Date {
  if (run.windowEnd instanceof Date && !Number.isNaN(run.windowEnd.getTime())) {
    return run.windowEnd;
  }
  return run.createdAt;
}

/**
 * Loads no-write dark-run trigger runtime state from existing DerivationRun rows
 * created by understanding-dark-engine manual persistence paths.
 */
export async function loadNoWriteDarkRunTriggerRuntimeState(
  input: LoadNoWriteDarkRunTriggerRuntimeStateInput
): Promise<NoWriteDarkRunTriggerRuntimeState> {
  const db = input.db ?? prismadb;

  const [latestRun, inFlightRun] = await Promise.all([
    db.derivationRun.findFirst({
      where: {
        userId: input.userId,
        scope: UNDERSTANDING_DARK_ENGINE_NO_WRITE_DERIVATION_SCOPE,
        processorVersion: UNDERSTANDING_DARK_ENGINE_NO_WRITE_PROCESSOR_VERSION,
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, windowEnd: true },
    }),
    db.derivationRun.findFirst({
      where: {
        userId: input.userId,
        scope: UNDERSTANDING_DARK_ENGINE_NO_WRITE_DERIVATION_SCOPE,
        processorVersion: UNDERSTANDING_DARK_ENGINE_NO_WRITE_PROCESSOR_VERSION,
        status: { in: [...IN_FLIGHT_DERIVATION_RUN_STATUSES] },
      },
      select: { id: true },
    }),
  ]);

  return {
    lastRunAt: latestRun?.createdAt ?? null,
    lastEvidenceCutoffAt: latestRun ? resolveEvidenceCutoffAt(latestRun) : null,
    inFlight: Boolean(inFlightRun),
    triggerEvidenceAt: parseTriggerEvidenceAt(input.triggerEvidenceAt),
  };
}

export type ResolveCandidateBridgeNoWriteTriggerEligibilityInput = {
  userId: string;
  eventType: NoWriteDarkRunTriggerEventType;
  now?: Date;
  triggerEvidenceAt?: Date | null;
  db?: PrismaClient;
  logTag: string;
  context?: Record<string, unknown>;
};

/**
 * Loads runtime state (fail-open) and evaluates no-write trigger eligibility
 * for internal candidate bridge paths.
 */
export async function resolveCandidateBridgeNoWriteTriggerEligibility(
  input: ResolveCandidateBridgeNoWriteTriggerEligibilityInput
): Promise<NoWriteDarkRunTriggerEligibilityResult> {
  const now = input.now ?? new Date();
  const db = input.db ?? prismadb;

  let lastRunAt: Date | null = null;
  let lastEvidenceCutoffAt: Date | null = null;
  let inFlight = false;
  let triggerEvidenceAt: Date | null = null;

  try {
    const runtimeState = await loadNoWriteDarkRunTriggerRuntimeState({
      userId: input.userId,
      db,
      ...(input.triggerEvidenceAt !== undefined && input.triggerEvidenceAt !== null
        ? { triggerEvidenceAt: input.triggerEvidenceAt }
        : {}),
    });
    lastRunAt = runtimeState.lastRunAt;
    lastEvidenceCutoffAt = runtimeState.lastEvidenceCutoffAt;
    inFlight = runtimeState.inFlight;
    triggerEvidenceAt = runtimeState.triggerEvidenceAt;
  } catch (error) {
    console.warn(
      input.logTag,
      "Failed to load no-write trigger runtime state; proceeding without cooldown/inFlight gates.",
      {
        userId: input.userId,
        ...input.context,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    );
  }

  const eligibilityInput: Parameters<typeof evaluateNoWriteDarkRunTriggerEligibility>[0] = {
    userId: input.userId,
    eventType: input.eventType,
    now,
    lastRunAt,
    inFlight,
    noWriteOnly: true,
  };

  if (lastEvidenceCutoffAt) {
    eligibilityInput.lastEvidenceCutoffAt = lastEvidenceCutoffAt;
  }

  if (triggerEvidenceAt) {
    eligibilityInput.lastEvidenceAt = triggerEvidenceAt;
  }

  return evaluateNoWriteDarkRunTriggerEligibility(eligibilityInput);
}
