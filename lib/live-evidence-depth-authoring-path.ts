/**
 * Authoring path bridge for Evidence Pointer depth inputs.
 *
 * Persists upstream #119 rationale + #120 graphSlot UEL links together when
 * explicitly authored — never from ModelUpdate.userFacingSummary or Today copy.
 *
 * Consumers: dark-engine candidate persistence, future internal review publish prep.
 * Does NOT call #118 materializer or touch UI.
 */

import type {
  PrismaClient,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import {
  assessEvidenceDepthGraphSlotLinkInput,
  createFindEligibleLinksForEvidenceDepthHook,
  type EvidenceDepthGraphSlotLinkWriterDb,
  upsertEvidenceDepthGraphSlotLinksForSource,
} from "./live-evidence-depth-graphslot-link-source";
import type { EvidencePointerGraphSlot } from "./live-evidence-depth-write-contract";
import {
  createResolveStoredSurfacingRationaleForModelUpdatePublish,
  type EvidencePointerSurfacingRationaleBlocker,
  type EvidencePointerSurfacingRationaleWriterDb,
  upsertEvidencePointerSurfacingRationale,
  assessEvidencePointerSurfacingRationale,
  EvidencePointerSurfacingRationaleValidationError,
} from "./live-evidence-depth-rationale-source";
import {
  maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish,
  type ModelUpdatePublishEvidenceDepthInput,
} from "./live-evidence-depth-write-hook";
import { isEvidenceLinkTargetPublicEligible } from "./understanding-evidence-link-public-eligibility";

export const EVIDENCE_DEPTH_AUTHORING_SUPPORTED_SOURCE_TYPES = new Set<
  UnderstandingLinkSourceType
>(["pattern_claim", "contradiction_node"]);

export type EvidenceDepthAuthoringGraphSlotLinkIntent = {
  targetType: UnderstandingLinkTargetType;
  targetId: string;
  role: UnderstandingLinkRole;
  graphSlot: EvidencePointerGraphSlot;
  summary?: string;
};

export type EvidenceDepthAuthoringInput = {
  /** Pointer-specific rationale — must not be movement copy or sourceText. */
  authoredRationale: string;
  whyResurfaced?: string;
  sourceEvidenceId?: string;
  /** Used only to block rationale === source evidence quote. */
  sourceTextForValidation?: string;
  authoredFrom: string;
  graphSlotLinks: EvidenceDepthAuthoringGraphSlotLinkIntent[];
};

export type EvidenceDepthAuthoringBlocker =
  | EvidencePointerSurfacingRationaleBlocker
  | "unsupported_source_object_type"
  | "missing_source_object_id"
  | "missing_graph_slot_links"
  | "invalid_graph_slot_link"
  | "no_eligible_graph_slot_links"
  | "movement_copy_used_as_rationale";

export type EvidenceDepthAuthoringAssessment = {
  ready: boolean;
  blockers: EvidenceDepthAuthoringBlocker[];
  rationaleAccepted: boolean;
  validLinkIntentCount: number;
};

export type EvidenceDepthAuthoringPersistResult = {
  ready: boolean;
  blockers: EvidenceDepthAuthoringBlocker[];
  rationalePersisted: boolean;
  rationaleId: string | null;
  linksWritten: Array<{ id: string; created: boolean }>;
  linksSkippedIneligible: number;
  invalidLinkBlockers: string[];
};

export type EvidenceDepthAuthoringPathDb = EvidencePointerSurfacingRationaleWriterDb &
  EvidenceDepthGraphSlotLinkWriterDb &
  Pick<PrismaClient, "understandingEvidenceLink">;

export type EvidenceDepthAuthoringPathDeps = {
  db: EvidenceDepthAuthoringPathDb;
  now?: Date;
  checkPublicTargetEligibility?: (args: {
    userId: string;
    targetType: UnderstandingLinkTargetType;
    targetId: string;
  }) => Promise<boolean>;
  upsertRationale?: typeof upsertEvidencePointerSurfacingRationale;
  upsertGraphSlotLinks?: typeof upsertEvidenceDepthGraphSlotLinksForSource;
};

export type ModelUpdateCandidateEvidenceDepthAuthoringContext = {
  userId: string;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  /** Movement copy — never used as authoredRationale. */
  userFacingSummary: string;
  authoring: EvidenceDepthAuthoringInput;
};

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function isSupportedSourceObjectType(
  value: UnderstandingLinkTargetType | UnderstandingLinkSourceType,
): value is "pattern_claim" | "contradiction_node" {
  return value === "pattern_claim" || value === "contradiction_node";
}

export function assessEvidenceDepthAuthoringInput(args: {
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
  input: EvidenceDepthAuthoringInput;
}): EvidenceDepthAuthoringAssessment {
  const blockers: EvidenceDepthAuthoringBlocker[] = [];

  if (!EVIDENCE_DEPTH_AUTHORING_SUPPORTED_SOURCE_TYPES.has(args.sourceObjectType)) {
    blockers.push("unsupported_source_object_type");
  }
  if (!hasText(args.sourceObjectId)) {
    blockers.push("missing_source_object_id");
  }

  const rationaleAssessment = assessEvidencePointerSurfacingRationale({
    rationale: args.input.authoredRationale,
    sourceText: args.input.sourceTextForValidation,
    sourceObjectType: args.sourceObjectType,
  });
  blockers.push(...rationaleAssessment.blockers);

  if (args.input.graphSlotLinks.length === 0) {
    blockers.push("missing_graph_slot_links");
  }

  let validLinkIntentCount = 0;
  for (const link of args.input.graphSlotLinks) {
    const linkAssessment = assessEvidenceDepthGraphSlotLinkInput({
      sourceObjectType: isSupportedSourceObjectType(args.sourceObjectType)
        ? args.sourceObjectType
        : "pattern_claim",
      sourceObjectId: args.sourceObjectId,
      targetId: link.targetId,
      graphSlot: link.graphSlot,
    });
    if (!linkAssessment.accepted) {
      blockers.push("invalid_graph_slot_link");
    } else {
      validLinkIntentCount += 1;
    }
  }

  const uniqueBlockers = [...new Set(blockers)];

  return {
    ready:
      rationaleAssessment.accepted &&
      validLinkIntentCount > 0 &&
      !uniqueBlockers.includes("unsupported_source_object_type") &&
      !uniqueBlockers.includes("missing_source_object_id") &&
      !uniqueBlockers.includes("missing_graph_slot_links") &&
      !uniqueBlockers.includes("invalid_graph_slot_link"),
    blockers: uniqueBlockers,
    rationaleAccepted: rationaleAssessment.accepted,
    validLinkIntentCount,
  };
}

export function buildEvidenceDepthAuthoringInputsFromCandidate(
  context: ModelUpdateCandidateEvidenceDepthAuthoringContext,
): {
  sourceObjectType: "pattern_claim" | "contradiction_node";
  sourceObjectId: string;
  input: EvidenceDepthAuthoringInput;
} | null {
  if (!isSupportedSourceObjectType(context.affectedObjectType)) {
    return null;
  }

  return {
    sourceObjectType: context.affectedObjectType,
    sourceObjectId: context.affectedObjectId,
    input: context.authoring,
  };
}

export async function persistEvidenceDepthAuthoringInputsForSource(args: {
  userId: string;
  sourceObjectType: "pattern_claim" | "contradiction_node";
  sourceObjectId: string;
  input: EvidenceDepthAuthoringInput;
  deps: EvidenceDepthAuthoringPathDeps;
}): Promise<EvidenceDepthAuthoringPersistResult> {
  const assessment = assessEvidenceDepthAuthoringInput({
    sourceObjectType: args.sourceObjectType,
    sourceObjectId: args.sourceObjectId,
    input: args.input,
  });

  const invalidLinkBlockers: string[] = [];
  let linksSkippedIneligible = 0;
  const linksWritten: Array<{ id: string; created: boolean }> = [];
  let rationaleId: string | null = null;
  let rationalePersisted = false;

  const upsertRationale = args.deps.upsertRationale ?? upsertEvidencePointerSurfacingRationale;
  const upsertGraphSlotLinks =
    args.deps.upsertGraphSlotLinks ?? upsertEvidenceDepthGraphSlotLinksForSource;

  if (assessment.rationaleAccepted) {
    try {
      const persisted = await upsertRationale({
        input: {
          userId: args.userId,
          sourceObjectType: args.sourceObjectType,
          sourceObjectId: args.sourceObjectId,
          rationale: args.input.authoredRationale,
          whyResurfaced: args.input.whyResurfaced,
          sourceEvidenceId: args.input.sourceEvidenceId,
          authoredFrom: args.input.authoredFrom,
          sourceTextForValidation: args.input.sourceTextForValidation,
        },
        db: args.deps.db,
        now: args.deps.now,
      });
      rationaleId = persisted.id;
      rationalePersisted = true;
    } catch (error) {
      if (error instanceof EvidencePointerSurfacingRationaleValidationError) {
        return {
          ready: false,
          blockers: error.blockers,
          rationalePersisted: false,
          rationaleId: null,
          linksWritten: [],
          linksSkippedIneligible: 0,
          invalidLinkBlockers: error.blockers,
        };
      }
      throw error;
    }
  }

  if (assessment.validLinkIntentCount > 0) {
    const linkOutcome = await upsertGraphSlotLinks({
      userId: args.userId,
      sourceObjectType: args.sourceObjectType,
      sourceObjectId: args.sourceObjectId,
      links: args.input.graphSlotLinks.map((link) => ({
        targetType: link.targetType,
        targetId: link.targetId,
        role: link.role,
        graphSlot: link.graphSlot,
        summary: link.summary,
      })),
      db: args.deps.db,
      checkPublicTargetEligibility: args.deps.checkPublicTargetEligibility,
    });
    linksWritten.push(...linkOutcome.written);
    linksSkippedIneligible = linkOutcome.skippedIneligible;
  }

  for (const link of args.input.graphSlotLinks) {
    const linkAssessment = assessEvidenceDepthGraphSlotLinkInput({
      sourceObjectType: args.sourceObjectType,
      sourceObjectId: args.sourceObjectId,
      targetId: link.targetId,
      graphSlot: link.graphSlot,
    });
    if (!linkAssessment.accepted) {
      invalidLinkBlockers.push(...linkAssessment.blockers);
    }
  }

  const blockers = [...assessment.blockers];
  if (rationalePersisted && linksWritten.length === 0) {
    if (!blockers.includes("no_eligible_graph_slot_links")) {
      blockers.push("no_eligible_graph_slot_links");
    }
  }

  const ready = rationalePersisted && linksWritten.length > 0;

  return {
    ready,
    blockers: [...new Set(blockers)],
    rationalePersisted,
    rationaleId,
    linksWritten,
    linksSkippedIneligible,
    invalidLinkBlockers: [...new Set(invalidLinkBlockers)],
  };
}

export async function maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate(
  context: ModelUpdateCandidateEvidenceDepthAuthoringContext,
  deps: EvidenceDepthAuthoringPathDeps,
): Promise<EvidenceDepthAuthoringPersistResult | { skipped: true; reason: string }> {
  const built = buildEvidenceDepthAuthoringInputsFromCandidate(context);
  if (!built) {
    return { skipped: true, reason: "unsupported_affected_object_type" };
  }

  if (
    context.authoring.authoredRationale.trim() ===
    context.userFacingSummary.trim()
  ) {
    return {
      ready: false,
      blockers: ["movement_copy_used_as_rationale"],
      rationalePersisted: false,
      rationaleId: null,
      linksWritten: [],
      linksSkippedIneligible: 0,
      invalidLinkBlockers: ["movement_copy_used_as_rationale"],
    };
  }

  return persistEvidenceDepthAuthoringInputsForSource({
    userId: context.userId,
    sourceObjectType: built.sourceObjectType,
    sourceObjectId: built.sourceObjectId,
    input: built.input,
    deps,
  });
}

export function createEvidenceDepthAuthoringHookDeps(
  deps: EvidenceDepthAuthoringPathDeps,
): {
  resolveStoredSurfacingRationale: ReturnType<
    typeof createResolveStoredSurfacingRationaleForModelUpdatePublish
  >;
  findEligibleLinks: ReturnType<typeof createFindEligibleLinksForEvidenceDepthHook>;
} {
  return {
    resolveStoredSurfacingRationale:
      createResolveStoredSurfacingRationaleForModelUpdatePublish({
        db: deps.db,
      }),
    findEligibleLinks: createFindEligibleLinksForEvidenceDepthHook({
      db: deps.db,
      checkPublicTargetEligibility:
        deps.checkPublicTargetEligibility ?? isEvidenceLinkTargetPublicEligible,
    }),
  };
}

export async function assessAuthoredEvidenceDepthHookReadiness(args: {
  publishInput: ModelUpdatePublishEvidenceDepthInput;
  sourceText: string;
  sourceOrigin: string;
  deps: EvidenceDepthAuthoringPathDeps;
}): Promise<{ hookReady: boolean; authoringReady: boolean; blockers: string[] }> {
  const hookDeps = createEvidenceDepthAuthoringHookDeps(args.deps);
  const outcome = await maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish(
    args.publishInput,
    {
      ...hookDeps,
      findSourceEvidence: async () => ({
        sourceText: args.sourceText,
        sourceOrigin: args.sourceOrigin,
      }),
    },
  );

  if (outcome.ok) {
    return { hookReady: true, authoringReady: true, blockers: [] };
  }

  return {
    hookReady: false,
    authoringReady: false,
    blockers: outcome.blockers,
  };
}
