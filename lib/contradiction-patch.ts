import type { z } from "zod";
import type { ContradictionStatus } from "@prisma/client";

import { patchContradictionSchema } from "./contradiction-schema";

type PatchInput = z.infer<typeof patchContradictionSchema>;

export function buildContradictionPatchData(
  input: PatchInput,
  evidenceAddedCount: number,
  now: Date,
  options?: {
    statusOverride?: ContradictionStatus;
    forceSnoozedUntilNull?: boolean;
  }
) {
  const effectiveStatus = options?.statusOverride ?? input.status;
  const isSnoozedStatus = effectiveStatus === "snoozed";

  return {
    title: input.title,
    sideA: input.sideA,
    sideB: input.sideB,
    type: input.type,
    confidence: input.confidence,
    status: effectiveStatus,
    rung: input.rung,
    snoozedUntil:
      options?.forceSnoozedUntilNull
        ? null
        : input.snoozedUntil === undefined
          ? undefined
          : input.snoozedUntil === null
            ? null
            : new Date(input.snoozedUntil),
    weight:
      input.weightDelta === undefined ? undefined : { increment: input.weightDelta },
    snoozeCount: isSnoozedStatus ? { increment: 1 } : undefined,
    avoidanceCount: input.action === "avoid" ? { increment: 1 } : undefined,
    lastAvoidedAt: input.action === "avoid" ? now : undefined,
    evidenceCount: evidenceAddedCount > 0 ? { increment: evidenceAddedCount } : undefined,
    lastEvidenceAt: evidenceAddedCount > 0 ? now : undefined,
    lastTouchedAt: now,
  };
}
