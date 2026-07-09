/**
 * Upstream stored surfacing rationale for Evidence Pointer depth.
 *
 * Durable source of truth for pointer-specific whyItMatters before materialization.
 * Distinct from ModelUpdate.userFacingSummary (movement copy) and from
 * SurfacedEvidencePointer (materialized output).
 *
 * Durable spec: docs/live-evidence-depth-write-contract.md
 * Consumer: lib/live-evidence-depth-write-hook.ts (#118)
 */

import type {
  Prisma,
  PrismaClient,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import {
  isGenericSurfacingRationale,
} from "./live-evidence-depth-write-contract";
import { MODEL_UPDATE_CANDIDATE_SAFE_SUMMARY_PATTERNS } from "./understanding-dark-engine/model-update-candidate-proposal";

export const EVIDENCE_POINTER_SURFACING_RATIONALE_SUPPORTED_SOURCE_TYPES =
  new Set<UnderstandingLinkSourceType>(["pattern_claim", "contradiction_node"]);

const CONCLUSION_PUBLISH_MOVEMENT_PATTERN = /^New conclusion:/i;

export type EvidencePointerSurfacingRationaleBlocker =
  | "missing_stored_rationale"
  | "generic_stored_rationale"
  | "movement_copy_rationale"
  | "rationale_equals_source_text"
  | "unsupported_source_object_type";

export type EvidencePointerSurfacingRationaleAssessment = {
  accepted: boolean;
  blockers: EvidencePointerSurfacingRationaleBlocker[];
};

export type EvidencePointerSurfacingRationaleUpsertInput = {
  userId: string;
  sourceObjectType: "pattern_claim" | "contradiction_node";
  sourceObjectId: string;
  rationale: string;
  whyResurfaced?: string;
  sourceEvidenceId?: string;
  authoredFrom: string;
  /** When provided, blocks persistence when rationale equals source evidence quote. */
  sourceTextForValidation?: string;
};

export type EvidencePointerSurfacingRationaleRecord = {
  rationale: string;
  whyResurfaced: string | null;
  sourceEvidenceId: string | null;
  authoredFrom: string | null;
};

export type EvidencePointerSurfacingRationaleWriterDb = Pick<
  PrismaClient,
  "evidencePointerSurfacingRationale"
>;

export class EvidencePointerSurfacingRationaleValidationError extends Error {
  constructor(
    message: string,
    public readonly blockers: EvidencePointerSurfacingRationaleBlocker[],
  ) {
    super(message);
    this.name = "EvidencePointerSurfacingRationaleValidationError";
  }
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function isModelUpdateMovementRationale(value: string | undefined): boolean {
  const collapsed = value?.trim();
  if (!collapsed) {
    return true;
  }

  if (CONCLUSION_PUBLISH_MOVEMENT_PATTERN.test(collapsed)) {
    return true;
  }

  return MODEL_UPDATE_CANDIDATE_SAFE_SUMMARY_PATTERNS.some((pattern) =>
    pattern.test(collapsed),
  );
}

export function assessEvidencePointerSurfacingRationale(args: {
  rationale: string | undefined;
  sourceText?: string | undefined;
  sourceObjectType?: UnderstandingLinkSourceType;
}): EvidencePointerSurfacingRationaleAssessment {
  const blockers: EvidencePointerSurfacingRationaleBlocker[] = [];

  if (
    args.sourceObjectType &&
    !EVIDENCE_POINTER_SURFACING_RATIONALE_SUPPORTED_SOURCE_TYPES.has(
      args.sourceObjectType,
    )
  ) {
    blockers.push("unsupported_source_object_type");
  }

  if (!hasText(args.rationale)) {
    blockers.push("missing_stored_rationale");
  } else if (isGenericSurfacingRationale(args.rationale)) {
    blockers.push("generic_stored_rationale");
  } else if (isModelUpdateMovementRationale(args.rationale)) {
    blockers.push("movement_copy_rationale");
  } else if (
    hasText(args.sourceText) &&
    args.rationale!.trim() === args.sourceText!.trim()
  ) {
    blockers.push("rationale_equals_source_text");
  }

  return { accepted: blockers.length === 0, blockers };
}

/** Compatibility alias for #118 hook assessment naming. */
export function assessStoredPublishRationaleForEvidencePointer(args: {
  storedRationale: string | undefined;
  sourceText: string | undefined;
}): { hookReady: boolean; blockers: EvidencePointerSurfacingRationaleBlocker[] } {
  const assessment = assessEvidencePointerSurfacingRationale({
    rationale: args.storedRationale,
    sourceText: args.sourceText,
  });
  return {
    hookReady: assessment.accepted,
    blockers: assessment.blockers,
  };
}

export async function upsertEvidencePointerSurfacingRationale(args: {
  input: EvidencePointerSurfacingRationaleUpsertInput;
  db: EvidencePointerSurfacingRationaleWriterDb;
  now?: Date;
}): Promise<{ id: string }> {
  const assessment = assessEvidencePointerSurfacingRationale({
    rationale: args.input.rationale,
    sourceText: args.input.sourceTextForValidation,
    sourceObjectType: args.input.sourceObjectType,
  });

  if (!assessment.accepted) {
    throw new EvidencePointerSurfacingRationaleValidationError(
      `Cannot persist evidence pointer surfacing rationale: ${assessment.blockers.join(",")}`,
      assessment.blockers,
    );
  }

  const now = args.now ?? new Date();
  const shared: Omit<
    Prisma.EvidencePointerSurfacingRationaleUncheckedCreateInput,
    "createdAt"
  > = {
    userId: args.input.userId,
    sourceObjectType: args.input.sourceObjectType,
    sourceObjectId: args.input.sourceObjectId,
    rationale: args.input.rationale.trim(),
    whyResurfaced: args.input.whyResurfaced?.trim() ?? null,
    sourceEvidenceId: args.input.sourceEvidenceId ?? null,
    authoredFrom: args.input.authoredFrom,
    updatedAt: now,
  };

  const row = await args.db.evidencePointerSurfacingRationale.upsert({
    where: {
      userId_sourceObjectType_sourceObjectId: {
        userId: args.input.userId,
        sourceObjectType: args.input.sourceObjectType,
        sourceObjectId: args.input.sourceObjectId,
      },
    },
    create: {
      ...shared,
      createdAt: now,
    },
    update: shared,
    select: { id: true },
  });

  return row;
}

export async function resolveStoredEvidencePointerSurfacingRationale(args: {
  userId: string;
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
  db: EvidencePointerSurfacingRationaleWriterDb;
}): Promise<EvidencePointerSurfacingRationaleRecord | null> {
  if (
    !EVIDENCE_POINTER_SURFACING_RATIONALE_SUPPORTED_SOURCE_TYPES.has(
      args.sourceObjectType,
    )
  ) {
    return null;
  }

  const row = await args.db.evidencePointerSurfacingRationale.findFirst({
    where: {
      userId: args.userId,
      sourceObjectType: args.sourceObjectType,
      sourceObjectId: args.sourceObjectId,
    },
    select: {
      rationale: true,
      whyResurfaced: true,
      sourceEvidenceId: true,
      authoredFrom: true,
    },
  });

  if (!row) {
    return null;
  }

  return row;
}

export function createResolveStoredSurfacingRationaleForModelUpdatePublish(args: {
  db: EvidencePointerSurfacingRationaleWriterDb;
}): (hookArgs: {
  input: {
    userId: string;
    affectedObjectType: UnderstandingLinkTargetType;
    affectedObjectId: string;
  };
}) => Promise<string | null> {
  return async ({ input }) => {
    if (
      input.affectedObjectType !== "pattern_claim" &&
      input.affectedObjectType !== "contradiction_node"
    ) {
      return null;
    }

    const stored = await resolveStoredEvidencePointerSurfacingRationale({
      userId: input.userId,
      sourceObjectType: input.affectedObjectType,
      sourceObjectId: input.affectedObjectId,
      db: args.db,
    });

    if (!stored) {
      return null;
    }

    const assessment = assessEvidencePointerSurfacingRationale({
      rationale: stored.rationale,
    });
    if (!assessment.accepted) {
      return null;
    }

    return stored.rationale;
  };
}
