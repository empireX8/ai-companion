/**
 * Internal operator create path for ModelUpdate candidates with optional
 * evidence-depth authoring (#121).
 *
 * Does not invent rationale or graphSlot links — callers must supply explicit
 * evidenceDepthAuthoring when depth materialization is desired.
 */

import {
  ModelUpdateType,
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
} from "@prisma/client";
import { z } from "zod";

import type { EvidenceDepthAuthoringInput } from "./live-evidence-depth-authoring-path";
import {
  persistInternalModelUpdateCandidate,
  type PersistInternalModelUpdateCandidateInput,
  type PersistInternalModelUpdateCandidateResult,
} from "./understanding-dark-engine/model-update-candidate-persistence";
import type { StructuredModelUpdateCandidateProposal } from "./understanding-dark-engine/model-update-candidate-proposal";

const nonEmptyString = z.string().trim().min(1);

export const INTERNAL_MODEL_UPDATE_CANDIDATE_CREATE_AUTHORED_FROM =
  "internal_model_update_candidate_create" as const;

export const evidenceDepthAuthoringRequestSchema = z.object({
  authoredRationale: nonEmptyString,
  authoredFrom: nonEmptyString,
  whyResurfaced: nonEmptyString.optional(),
  sourceEvidenceId: nonEmptyString.optional(),
  sourceTextForValidation: nonEmptyString.optional(),
  graphSlotLinks: z
    .array(
      z.object({
        targetType: z.nativeEnum(UnderstandingLinkTargetType),
        targetId: nonEmptyString,
        role: z.nativeEnum(UnderstandingLinkRole),
        graphSlot: z.enum(["related", "context"]),
        summary: nonEmptyString.optional(),
      }),
    )
    .min(1),
});

export const internalModelUpdateCandidateCreateBodySchema = z.object({
  proposal: z.object({
    updateType: z.literal(ModelUpdateType.link_detected),
    userFacingSummary: nonEmptyString,
    affectedObjectType: z.nativeEnum(UnderstandingLinkTargetType),
    affectedObjectId: nonEmptyString,
    evidenceSelections: z
      .array(
        z.object({
          sourceType: z.nativeEnum(UnderstandingLinkSourceType),
          sourceId: nonEmptyString,
          role: z.nativeEnum(UnderstandingLinkRole).optional(),
          summary: nonEmptyString.optional(),
          snippet: nonEmptyString.optional(),
          quote: nonEmptyString.optional(),
          weight: z.number().nullable().optional(),
          confidenceContribution: z.number().nullable().optional(),
        }),
      )
      .min(1),
  }),
  evidenceDepthAuthoring: evidenceDepthAuthoringRequestSchema.optional(),
});

export type InternalModelUpdateCandidateCreateBody = z.infer<
  typeof internalModelUpdateCandidateCreateBodySchema
>;

export type CreateInternalModelUpdateCandidateFromOperatorInput = {
  userId: string;
  body: InternalModelUpdateCandidateCreateBody;
  db?: PersistInternalModelUpdateCandidateInput["db"];
  now?: Date;
  persistCandidate?: typeof persistInternalModelUpdateCandidate;
};

export type CreateInternalModelUpdateCandidateFromOperatorResult = {
  persistence: PersistInternalModelUpdateCandidateResult;
  evidenceDepthAuthoringProvided: boolean;
  evidenceDepthAuthoringReady: boolean;
  evidenceDepthAuthoringBlockers: string[];
  evidenceDepthAuthoringSkippedReason: string | null;
};

function parseAuthoringNotes(notes: string[]): {
  ready: boolean;
  blockers: string[];
  skippedReason: string | null;
} {
  let ready = false;
  const blockers: string[] = [];
  let skippedReason: string | null = null;

  for (const note of notes) {
    if (note === "evidenceDepthAuthoringReady:true") {
      ready = true;
      continue;
    }
    if (note.startsWith("evidenceDepthAuthoringBlockers:")) {
      const raw = note.slice("evidenceDepthAuthoringBlockers:".length);
      blockers.push(...raw.split(",").filter(Boolean));
      continue;
    }
    if (note.startsWith("evidenceDepthAuthoringSkipped:")) {
      skippedReason = note.slice("evidenceDepthAuthoringSkipped:".length);
    }
  }

  return { ready, blockers, skippedReason };
}

export function toEvidenceDepthAuthoringInput(
  body: NonNullable<InternalModelUpdateCandidateCreateBody["evidenceDepthAuthoring"]>,
): EvidenceDepthAuthoringInput {
  return {
    authoredRationale: body.authoredRationale,
    authoredFrom: body.authoredFrom,
    whyResurfaced: body.whyResurfaced,
    sourceEvidenceId: body.sourceEvidenceId,
    sourceTextForValidation: body.sourceTextForValidation,
    graphSlotLinks: body.graphSlotLinks.map((link) => ({
      targetType: link.targetType,
      targetId: link.targetId,
      role: link.role,
      graphSlot: link.graphSlot,
      summary: link.summary,
    })),
  };
}

export function toStructuredModelUpdateCandidateProposal(
  body: InternalModelUpdateCandidateCreateBody["proposal"],
): StructuredModelUpdateCandidateProposal {
  return {
    updateType: "link_detected",
    userFacingSummary: body.userFacingSummary,
    affectedObjectType: body.affectedObjectType,
    affectedObjectId: body.affectedObjectId,
    evidenceSelections: body.evidenceSelections.map((selection) => ({
      sourceType: selection.sourceType,
      sourceId: selection.sourceId,
      role: selection.role,
      summary: selection.summary,
      snippet: selection.snippet,
      quote: selection.quote,
      weight: selection.weight,
      confidenceContribution: selection.confidenceContribution,
    })),
  };
}

/**
 * Operator/internal create entrypoint: persists candidate and optionally
 * evidenceDepthAuthoring via #121 helpers (never invents authoring).
 */
export async function createInternalModelUpdateCandidateFromOperator(
  input: CreateInternalModelUpdateCandidateFromOperatorInput,
): Promise<CreateInternalModelUpdateCandidateFromOperatorResult> {
  const persistCandidate = input.persistCandidate ?? persistInternalModelUpdateCandidate;
  const evidenceDepthAuthoring = input.body.evidenceDepthAuthoring
    ? toEvidenceDepthAuthoringInput(input.body.evidenceDepthAuthoring)
    : undefined;

  const persistence = await persistCandidate({
    userId: input.userId,
    proposal: toStructuredModelUpdateCandidateProposal(input.body.proposal),
    evidenceDepthAuthoring,
    db: input.db,
    now: input.now,
  });

  const parsed = parseAuthoringNotes(persistence.payload.notes);

  return {
    persistence,
    evidenceDepthAuthoringProvided: Boolean(input.body.evidenceDepthAuthoring),
    evidenceDepthAuthoringReady: parsed.ready,
    evidenceDepthAuthoringBlockers: parsed.blockers,
    evidenceDepthAuthoringSkippedReason: parsed.skippedReason,
  };
}
