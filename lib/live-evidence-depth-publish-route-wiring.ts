/**
 * Publish-route wiring for Evidence Pointer depth materialization.
 *
 * Calls #118 write hook after model-update candidate publish when stored
 * rationale (#119) and graphSlot UEL links (#120) were authored upstream (#121).
 *
 * Does NOT touch UI, Today depth gate, or read-time rationale generation.
 */

import type { PrismaClient } from "@prisma/client";
import { UnderstandingLinkTargetType } from "@prisma/client";

import {
  createEvidenceDepthAuthoringHookDeps,
  type EvidenceDepthAuthoringPathDeps,
} from "./live-evidence-depth-authoring-path";
import {
  assessEvidencePointerSurfacingRationale,
  resolveStoredEvidencePointerSurfacingRationale,
} from "./live-evidence-depth-rationale-source";
import {
  maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish,
  type ModelUpdatePublishEvidenceDepthInput,
} from "./live-evidence-depth-write-hook";
import { upsertSurfacedEvidencePointerRecord } from "./live-evidence-depth-write-path";
import { isEvidenceLinkTargetPublicEligible } from "./understanding-evidence-link-public-eligibility";
import { createUnderstandingEvidenceLinkForUser } from "./understanding-evidence-link-writer";

export const EVIDENCE_DEPTH_PUBLISH_SUPPORTED_AFFECTED_TYPES = new Set<
  UnderstandingLinkTargetType
>([
  UnderstandingLinkTargetType.pattern_claim,
  UnderstandingLinkTargetType.contradiction_node,
]);

export const EVIDENCE_DEPTH_SOURCE_ORIGIN = {
  pattern_claim: "Recent Pattern",
  contradiction_node: "Active Tension",
} as const;

export type EvidenceDepthPublishMaterializationStatus =
  | "skipped_unsupported_source"
  | "skipped_missing_rationale"
  | "skipped_missing_eligible_links"
  | "skipped_invalid_rationale"
  | "skipped_missing_source_text"
  | "skipped_materialization_blocked"
  | "materialized"
  | "failed_unexpected";

export type EvidenceDepthPublishMaterializationResult = {
  status: EvidenceDepthPublishMaterializationStatus;
  pointerId: string | null;
  blockers: string[];
};

export type EvidenceDepthPublishRouteWiringDb = EvidenceDepthAuthoringPathDeps["db"] &
  Pick<
    PrismaClient,
    | "modelUpdate"
    | "patternClaim"
    | "patternClaimEvidence"
    | "contradictionNode"
    | "contradictionEvidence"
  >;

export type EvidenceDepthPublishSourceEvidence = {
  sourceText: string;
  sourceOrigin: string;
  sourceEvidenceId?: string;
};

export type EvidenceDepthPublishSourceEvidenceLookup = (args: {
  userId: string;
  sourceObjectType: "pattern_claim" | "contradiction_node";
  sourceObjectId: string;
}) => Promise<EvidenceDepthPublishSourceEvidence | null>;

export type EvidenceDepthPublishRouteWiringDeps = {
  db: EvidenceDepthPublishRouteWiringDb;
  now?: () => Date;
  checkPublicTargetEligibility?: EvidenceDepthAuthoringPathDeps["checkPublicTargetEligibility"];
  findSourceEvidence?: EvidenceDepthPublishSourceEvidenceLookup;
  materializeFromModelUpdatePublish?: typeof maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish;
};

const INVALID_RATIONALE_BLOCKERS = new Set([
  "generic_stored_rationale",
  "movement_copy_rationale",
  "rationale_equals_source_text",
]);

const MISSING_LINK_BLOCKERS = new Set([
  "missing_eligible_links",
  "links_missing_graph_slot",
  "all_links_excluded",
]);

function mapHookBlockersToStatus(
  blockers: string[],
): EvidenceDepthPublishMaterializationStatus {
  if (blockers.includes("unsupported_source_object_type")) {
    return "skipped_unsupported_source";
  }
  if (blockers.includes("missing_stored_rationale")) {
    return "skipped_missing_rationale";
  }
  if (blockers.some((blocker) => INVALID_RATIONALE_BLOCKERS.has(blocker))) {
    return "skipped_invalid_rationale";
  }
  if (blockers.some((blocker) => MISSING_LINK_BLOCKERS.has(blocker))) {
    return "skipped_missing_eligible_links";
  }
  if (blockers.includes("missing_source_text")) {
    return "skipped_missing_source_text";
  }
  return "skipped_materialization_blocked";
}

export function createFindSourceEvidenceForEvidenceDepthPublish(args: {
  db: Pick<
    PrismaClient,
    "patternClaim" | "patternClaimEvidence" | "contradictionNode" | "contradictionEvidence"
  >;
}): EvidenceDepthPublishSourceEvidenceLookup {
  return async ({ userId, sourceObjectType, sourceObjectId }) => {
    if (sourceObjectType === "pattern_claim") {
      const claim = await args.db.patternClaim.findFirst({
        where: { id: sourceObjectId, userId },
        select: { id: true, summary: true },
      });
      if (!claim) {
        return null;
      }

      const evidence = await args.db.patternClaimEvidence.findFirst({
        where: {
          claimId: sourceObjectId,
          quote: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, quote: true },
      });

      const sourceText = evidence?.quote?.trim() || claim.summary?.trim();
      if (!sourceText) {
        return null;
      }

      return {
        sourceText,
        sourceOrigin: EVIDENCE_DEPTH_SOURCE_ORIGIN.pattern_claim,
        sourceEvidenceId: evidence?.id,
      };
    }

    if (sourceObjectType === "contradiction_node") {
      const node = await args.db.contradictionNode.findFirst({
        where: { id: sourceObjectId, userId },
        select: { id: true, title: true, sideA: true, sideB: true },
      });
      if (!node) {
        return null;
      }

      const evidence = await args.db.contradictionEvidence.findFirst({
        where: {
          nodeId: sourceObjectId,
          quote: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, quote: true },
      });

      const sourceText =
        evidence?.quote?.trim() ||
        [node.sideA, node.sideB].filter(Boolean).join(" · ").trim() ||
        node.title?.trim();
      if (!sourceText) {
        return null;
      }

      return {
        sourceText,
        sourceOrigin: EVIDENCE_DEPTH_SOURCE_ORIGIN.contradiction_node,
        sourceEvidenceId: evidence?.id,
      };
    }

    return null;
  };
}

export async function maybeMaterializeEvidenceDepthForPublishedModelUpdate(args: {
  userId: string;
  modelUpdateId: string;
  publishedAt: Date;
  deps: EvidenceDepthPublishRouteWiringDeps;
}): Promise<EvidenceDepthPublishMaterializationResult> {
  const modelUpdate = (await args.deps.db.modelUpdate.findFirst({
    where: {
      id: args.modelUpdateId,
      userId: args.userId,
    },
    select: {
      id: true,
      userId: true,
      affectedObjectType: true,
      affectedObjectId: true,
      userFacingSummary: true,
    },
  })) as {
    id: string;
    userId: string;
    affectedObjectType: UnderstandingLinkTargetType;
    affectedObjectId: string;
    userFacingSummary: string;
  } | null;

  if (!modelUpdate) {
    return {
      status: "skipped_materialization_blocked",
      pointerId: null,
      blockers: ["model_update_not_found"],
    };
  }

  if (!EVIDENCE_DEPTH_PUBLISH_SUPPORTED_AFFECTED_TYPES.has(modelUpdate.affectedObjectType)) {
    return {
      status: "skipped_unsupported_source",
      pointerId: null,
      blockers: ["unsupported_source_object_type"],
    };
  }

  const sourceObjectType = modelUpdate.affectedObjectType as
    | "pattern_claim"
    | "contradiction_node";

  const findSourceEvidence =
    args.deps.findSourceEvidence ??
    createFindSourceEvidenceForEvidenceDepthPublish({ db: args.deps.db });

  const sourceEvidence = await findSourceEvidence({
    userId: modelUpdate.userId,
    sourceObjectType,
    sourceObjectId: modelUpdate.affectedObjectId,
  });

  const storedRationaleRecord = await resolveStoredEvidencePointerSurfacingRationale({
    userId: modelUpdate.userId,
    sourceObjectType,
    sourceObjectId: modelUpdate.affectedObjectId,
    db: args.deps.db,
  });

  if (!storedRationaleRecord) {
    return {
      status: "skipped_missing_rationale",
      pointerId: null,
      blockers: ["missing_stored_rationale"],
    };
  }

  const storedRationaleAssessment = assessEvidencePointerSurfacingRationale({
    rationale: storedRationaleRecord.rationale,
    sourceText: sourceEvidence?.sourceText,
    sourceObjectType,
  });

  if (!storedRationaleAssessment.accepted) {
    return {
      status: "skipped_invalid_rationale",
      pointerId: null,
      blockers: storedRationaleAssessment.blockers,
    };
  }

  const publishInput: ModelUpdatePublishEvidenceDepthInput = {
    userId: modelUpdate.userId,
    modelUpdateId: modelUpdate.id,
    affectedObjectType: modelUpdate.affectedObjectType,
    affectedObjectId: modelUpdate.affectedObjectId,
    userFacingSummary: modelUpdate.userFacingSummary,
    publishedAt: args.publishedAt,
  };

  const authoringDeps: EvidenceDepthAuthoringPathDeps = {
    db: args.deps.db,
    now: args.deps.now?.(),
    checkPublicTargetEligibility: args.deps.checkPublicTargetEligibility,
  };

  const hookDeps = createEvidenceDepthAuthoringHookDeps(authoringDeps);
  const materialize =
    args.deps.materializeFromModelUpdatePublish ??
    maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish;

  const outcome = await materialize(publishInput, {
    now: args.deps.now,
    db: args.deps.db as never,
    ...hookDeps,
    findSourceEvidence,
    upsertSurfacedEvidencePointer: upsertSurfacedEvidencePointerRecord,
    createUnderstandingEvidenceLink: async ({ userId, input }) =>
      createUnderstandingEvidenceLinkForUser({
        userId,
        input,
        db: args.deps.db as never,
      }),
    resolveLinkPublicEligibility: async ({ userId, link }) => {
      if (typeof link.publicEligible === "boolean") {
        return link.publicEligible;
      }
      const check =
        args.deps.checkPublicTargetEligibility ?? isEvidenceLinkTargetPublicEligible;
      return check({
        userId,
        targetType: link.targetType,
        targetId: link.targetId,
      });
    },
  });

  if (outcome.ok) {
    return {
      status: "materialized",
      pointerId: outcome.pointerId ?? outcome.persistedPointerId ?? null,
      blockers: [],
    };
  }

  return {
    status: mapHookBlockersToStatus(outcome.blockers),
    pointerId: null,
    blockers: outcome.blockers,
  };
}
