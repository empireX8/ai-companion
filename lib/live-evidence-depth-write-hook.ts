/**
 * Publish/surfacing write hook for SurfacedEvidencePointer materialization.
 *
 * Bridges honest publish/surfacing events to `materializeSurfacedEvidencePointerForUser`.
 * Does NOT touch Today UI, read adapters, or fabricate rationale/links.
 *
 * Durable spec: docs/live-evidence-depth-write-contract.md
 * Materializer: lib/live-evidence-depth-write-path.ts
 */

import type {
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
} from "@prisma/client";
import { UnderstandingLinkTargetType } from "@prisma/client";

import type { UnderstandingEvidenceLinkRow } from "./live-evidence-depth-linkage";
import {
  graphSlotFromUelMeta,
  type EvidencePointerGraphSlot,
} from "./live-evidence-depth-write-contract";
import {
  materializeSurfacedEvidencePointerForUser,
  type SurfacedEvidencePointerMaterializationDeps,
  type SurfacedEvidencePointerMaterializationInput,
  type SurfacedEvidencePointerMaterializationResult,
} from "./live-evidence-depth-write-path";
import {
  assessStoredPublishRationaleForEvidencePointer,
  isModelUpdateMovementRationale,
} from "./live-evidence-depth-rationale-source";
import { isEvidenceLinkTargetPublicEligible } from "./understanding-evidence-link-public-eligibility";

export { assessStoredPublishRationaleForEvidencePointer, isModelUpdateMovementRationale };

export const EVIDENCE_DEPTH_WRITE_HOOK_MATERIALIZED_FROM = {
  modelUpdatePublish: "model_update_publish",
  explicitPublishEvent: "evidence_depth_publish_event",
} as const;

export type EvidenceDepthWriteHookLinkCandidate = {
  targetId: string;
  targetType: UnderstandingLinkTargetType;
  role: UnderstandingLinkRole;
  graphSlot: EvidencePointerGraphSlot;
  summary?: string;
  publicEligible?: boolean;
};

export type EvidenceDepthWriteHookPublishEvent = {
  userId: string;
  materializedFrom: string;
  sourceObjectType: "pattern_claim" | "contradiction_node";
  sourceObjectId: string;
  /** Stored non-generic surfacing rationale — never synthesized at read time. */
  storedRationale: string;
  sourceText: string;
  sourceOrigin: string;
  surfacedAt?: Date;
  whyResurfaced?: string;
  sourceEvidenceId?: string;
  libraryReceiptId?: string;
  detailHref?: string;
  links?: EvidenceDepthWriteHookLinkCandidate[];
};

export type EvidenceDepthWriteHookBlocker =
  | "missing_stored_rationale"
  | "generic_stored_rationale"
  | "movement_copy_rationale"
  | "rationale_equals_source_text"
  | "missing_source_text"
  | "missing_source_origin"
  | "unsupported_source_object_type"
  | "missing_eligible_links"
  | "links_missing_graph_slot"
  | "all_links_excluded";

export type EvidenceDepthWriteHookAssessment = {
  hookReady: boolean;
  blockers: EvidenceDepthWriteHookBlocker[];
};

export type ModelUpdatePublishEvidenceDepthInput = {
  userId: string;
  modelUpdateId: string;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  userFacingSummary: string;
  publishedAt: Date;
};

export type EvidenceDepthWriteHookDeps = SurfacedEvidencePointerMaterializationDeps & {
  findEligibleLinks?: (args: {
    userId: string;
    sourceObjectType: UnderstandingLinkSourceType;
    sourceObjectId: string;
  }) => Promise<EvidenceDepthWriteHookLinkCandidate[]>;
  /**
   * Returns a stored surfacing rationale when one exists upstream.
   * When absent, model-update publish falls back to userFacingSummary (usually movement copy).
   */
  resolveStoredSurfacingRationale?: (args: {
    input: ModelUpdatePublishEvidenceDepthInput;
  }) => Promise<string | null>;
  findSourceEvidence?: (args: {
    userId: string;
    sourceObjectType: "pattern_claim" | "contradiction_node";
    sourceObjectId: string;
  }) => Promise<{
    sourceText: string;
    sourceOrigin: string;
    sourceEvidenceId?: string;
  } | null>;
};

export function assessEvidenceDepthWriteHookInput(
  event: EvidenceDepthWriteHookPublishEvent,
  links: EvidenceDepthWriteHookLinkCandidate[],
): EvidenceDepthWriteHookAssessment {
  const blockers: EvidenceDepthWriteHookBlocker[] = [];

  blockers.push(
    ...assessStoredPublishRationaleForEvidencePointer({
      storedRationale: event.storedRationale,
      sourceText: event.sourceText,
    }).blockers,
  );

  if (!event.sourceText?.trim()) {
    blockers.push("missing_source_text");
  }
  if (!event.sourceOrigin?.trim()) {
    blockers.push("missing_source_origin");
  }
  if (
    event.sourceObjectType !== "pattern_claim" &&
    event.sourceObjectType !== "contradiction_node"
  ) {
    blockers.push("unsupported_source_object_type");
  }
  if (links.length === 0) {
    blockers.push("missing_eligible_links");
  }

  return { hookReady: blockers.length === 0, blockers: [...new Set(blockers)] };
}

export async function getEligibleEvidenceDepthLinksForSource(args: {
  userId: string;
  sourceObjectType: UnderstandingLinkSourceType;
  sourceObjectId: string;
  linkRows: UnderstandingEvidenceLinkRow[];
  checkPublicTargetEligibility?: (args: {
    userId: string;
    targetType: UnderstandingLinkTargetType;
    targetId: string;
  }) => Promise<boolean>;
}): Promise<{
  eligible: EvidenceDepthWriteHookLinkCandidate[];
  excludedMissingGraphSlot: number;
  excludedIneligible: number;
}> {
  const check =
    args.checkPublicTargetEligibility ?? isEvidenceLinkTargetPublicEligible;

  const eligible: EvidenceDepthWriteHookLinkCandidate[] = [];
  let excludedMissingGraphSlot = 0;
  let excludedIneligible = 0;

  const rowsForSource = args.linkRows.filter(
    (row) =>
      row.sourceType === args.sourceObjectType &&
      row.sourceId === args.sourceObjectId,
  );

  for (const row of rowsForSource) {
    const graphSlot = graphSlotFromUelMeta(row.meta);
    if (!graphSlot) {
      excludedMissingGraphSlot += 1;
      continue;
    }

    const publicEligible = await check({
      userId: args.userId,
      targetType: row.targetType,
      targetId: row.targetId,
    });
    if (!publicEligible) {
      excludedIneligible += 1;
      continue;
    }

    eligible.push({
      targetId: row.targetId,
      targetType: row.targetType,
      role: row.role,
      graphSlot,
      summary: row.summary ?? undefined,
      publicEligible: true,
    });
  }

  return { eligible, excludedMissingGraphSlot, excludedIneligible };
}

export function buildSurfacedEvidencePointerCandidateFromPublishEvent(
  event: EvidenceDepthWriteHookPublishEvent,
  links: EvidenceDepthWriteHookLinkCandidate[],
): SurfacedEvidencePointerMaterializationInput {
  return {
    userId: event.userId,
    sourceObjectType: event.sourceObjectType,
    sourceObjectId: event.sourceObjectId,
    sourceText: event.sourceText,
    sourceOrigin: event.sourceOrigin,
    surfacedAt: event.surfacedAt,
    whyItMatters: event.storedRationale,
    whyResurfaced: event.whyResurfaced,
    sourceEvidenceId: event.sourceEvidenceId,
    libraryReceiptId: event.libraryReceiptId,
    detailHref: event.detailHref,
    materializedFrom: event.materializedFrom,
    links: links.map((link) => ({
      targetId: link.targetId,
      targetType: link.targetType,
      role: link.role,
      graphSlot: link.graphSlot,
      publicEligible: link.publicEligible,
      summary: link.summary,
    })),
  };
}

export type EvidenceDepthWriteHookMaterializationOutcome =
  | { ok: false; assessment: EvidenceDepthWriteHookAssessment }
  | (SurfacedEvidencePointerMaterializationResult & {
      hookAssessment: EvidenceDepthWriteHookAssessment;
    });

export async function maybeMaterializeSurfacedEvidencePointerFromPublishEvent(
  event: EvidenceDepthWriteHookPublishEvent,
  deps: EvidenceDepthWriteHookDeps = {},
): Promise<EvidenceDepthWriteHookMaterializationOutcome> {
  const resolvedLinks =
    event.links ??
    (deps.findEligibleLinks
      ? await deps.findEligibleLinks({
          userId: event.userId,
          sourceObjectType: event.sourceObjectType,
          sourceObjectId: event.sourceObjectId,
        })
      : []);

  const hookAssessment = assessEvidenceDepthWriteHookInput(event, resolvedLinks);
  if (!hookAssessment.hookReady) {
    return { ok: false, assessment: hookAssessment };
  }

  const materializationInput = buildSurfacedEvidencePointerCandidateFromPublishEvent(
    event,
    resolvedLinks,
  );

  const result = await materializeSurfacedEvidencePointerForUser(
    materializationInput,
    deps,
  );

  return { ...result, hookAssessment };
}

export type ModelUpdatePublishEvidenceDepthOutcome =
  | { ok: false; blockers: string[] }
  | (SurfacedEvidencePointerMaterializationSuccess & {
      hookAssessment: EvidenceDepthWriteHookAssessment;
    });

type SurfacedEvidencePointerMaterializationSuccess = Extract<
  SurfacedEvidencePointerMaterializationResult,
  { ok: true }
>;

export async function maybeMaterializeSurfacedEvidencePointerFromModelUpdatePublish(
  input: ModelUpdatePublishEvidenceDepthInput,
  deps: EvidenceDepthWriteHookDeps = {},
): Promise<ModelUpdatePublishEvidenceDepthOutcome> {
  if (
    input.affectedObjectType !== UnderstandingLinkTargetType.pattern_claim &&
    input.affectedObjectType !== UnderstandingLinkTargetType.contradiction_node
  ) {
    return { ok: false, blockers: ["unsupported_source_object_type"] };
  }

  const sourceObjectType = input.affectedObjectType as
    | "pattern_claim"
    | "contradiction_node";

  const sourceEvidence = deps.findSourceEvidence
    ? await deps.findSourceEvidence({
        userId: input.userId,
        sourceObjectType,
        sourceObjectId: input.affectedObjectId,
      })
    : null;

  if (!sourceEvidence?.sourceText?.trim()) {
    return { ok: false, blockers: ["missing_source_text"] };
  }

  const storedRationale = deps.resolveStoredSurfacingRationale
    ? await deps.resolveStoredSurfacingRationale({ input })
    : null;

  const rationale = storedRationale ?? input.userFacingSummary;

  const rationaleAssessment = assessStoredPublishRationaleForEvidencePointer({
    storedRationale: rationale,
    sourceText: sourceEvidence.sourceText,
  });
  if (!rationaleAssessment.hookReady) {
    return { ok: false, blockers: rationaleAssessment.blockers };
  }

  const linkResolution = deps.findEligibleLinks
    ? await deps.findEligibleLinks({
        userId: input.userId,
        sourceObjectType,
        sourceObjectId: input.affectedObjectId,
      })
    : [];

  if (linkResolution.length === 0) {
    return { ok: false, blockers: ["missing_eligible_links"] };
  }

  const outcome = await maybeMaterializeSurfacedEvidencePointerFromPublishEvent(
    {
      userId: input.userId,
      materializedFrom: EVIDENCE_DEPTH_WRITE_HOOK_MATERIALIZED_FROM.modelUpdatePublish,
      sourceObjectType,
      sourceObjectId: input.affectedObjectId,
      storedRationale: rationale,
      sourceText: sourceEvidence.sourceText,
      sourceOrigin: sourceEvidence.sourceOrigin,
      surfacedAt: input.publishedAt,
      sourceEvidenceId: sourceEvidence.sourceEvidenceId,
      links: linkResolution,
    },
    deps,
  );

  if (!outcome.ok) {
    return { ok: false, blockers: outcome.assessment.blockers };
  }

  return outcome;
}

export async function materializeSurfacedEvidencePointersForPublishedUnderstanding(
  events: EvidenceDepthWriteHookPublishEvent[],
  deps: EvidenceDepthWriteHookDeps = {},
): Promise<SurfacedEvidencePointerMaterializationResult[]> {
  const results: SurfacedEvidencePointerMaterializationResult[] = [];

  for (const event of events) {
    const outcome = await maybeMaterializeSurfacedEvidencePointerFromPublishEvent(
      event,
      deps,
    );
    if (outcome.ok) {
      results.push(outcome);
    }
  }

  return results;
}
