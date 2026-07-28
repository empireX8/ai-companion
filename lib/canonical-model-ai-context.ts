/**
 * Pure AI prompt builder for canonical model authority context.
 */

import type { CanonicalModelProjectionV1 } from "./canonical-model-projection";
import {
  toCanonicalProductAuthoritySnapshotV1,
  type CanonicalProductConceptV1,
} from "./canonical-model-product-projection";

export const CANONICAL_MODEL_PROMPT_HEADING =
  "CANONICAL CURRENT MODEL — AUTHORITATIVE ACCEPTED UNDERSTANDING" as const;

const CANONICAL_MODEL_PROMPT_INSTRUCTIONS = [
  "- These are Orvek’s accepted current concept revisions.",
  "- Treat the current revision as authoritative for that concept.",
  "- Historical revisions and ModelUpdate receipts do not override it.",
  "- Reference memory, patterns and contradictions may provide context or evidence, but must not silently replace an accepted canonical revision.",
  "- Do not claim a concept is canonical when it is absent from this block.",
].join("\n");

export function buildCanonicalModelPromptBlockFromProductConcepts(args: {
  concepts: CanonicalProductConceptV1[];
}): string {
  if (args.concepts.length === 0) return "";

  const lines: string[] = [
    CANONICAL_MODEL_PROMPT_HEADING,
    CANONICAL_MODEL_PROMPT_INSTRUCTIONS,
    "",
  ];

  for (const concept of args.concepts) {
    lines.push(`concept_id: ${concept.conceptId}`);
    lines.push(`current_revision_id: ${concept.currentRevisionId}`);
    lines.push(`version: ${concept.version}`);
    lines.push(`title: ${concept.title}`);
    lines.push(`summary: ${concept.summary}`);
    lines.push(`status: ${concept.status}`);
    lines.push(`confidence_score: ${concept.confidenceScore}`);
    lines.push(`confidence_level: ${concept.confidenceLevel}`);
    lines.push(`evidence_count: ${concept.evidenceCount}`);
    lines.push(`accepted_at: ${concept.acceptedAt}`);
    if (concept.rationale && concept.rationale.trim().length > 0) {
      lines.push(`rationale: ${concept.rationale}`);
    }
    const latest = concept.movementHistory[concept.movementHistory.length - 1];
    if (latest) {
      lines.push(`latest_model_update_id: ${latest.modelUpdateId}`);
      lines.push(`latest_explore_proposal_id: ${latest.exploreProposalId}`);
      lines.push(`latest_previous_revision_id: ${latest.previousRevisionId}`);
      lines.push(`latest_resulting_revision_id: ${latest.resultingRevisionId}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function buildCanonicalModelPromptBlock(args: {
  projection: CanonicalModelProjectionV1;
}): string {
  const concepts = args.projection.concepts.map((concept) =>
    toCanonicalProductAuthoritySnapshotV1(concept),
  );
  return buildCanonicalModelPromptBlockFromProductConcepts({ concepts });
}
