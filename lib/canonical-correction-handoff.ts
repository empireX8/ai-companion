/**
 * Canonical correction handoff — Explore context only.
 * Creating this payload never mutates canonical authority.
 *
 * Transport is in-memory Workbench React state only.
 * This module must never reference browser globals or browser storage APIs.
 */

import type { CanonicalProductConceptV1 } from "./canonical-model-product-projection";

export const CANONICAL_CORRECTION_HANDOFF_VERSION =
  "canonical_correction_handoff:v1" as const;

export const CANONICAL_CORRECTION_INTENT =
  "correct_canonical_understanding" as const;

export type CanonicalCorrectionHandoffV1 = {
  handoffVersion: typeof CANONICAL_CORRECTION_HANDOFF_VERSION;
  intent: typeof CANONICAL_CORRECTION_INTENT;
  conceptId: string;
  currentRevisionId: string;
  version: number;
  title: string;
  currentSummary: string;
};

export const CANONICAL_CORRECTION_PROPOSE_LABEL = "Propose a correction" as const;

export const CANONICAL_CORRECTION_HANDOFF_HINT =
  "Describe what is wrong or missing. Your model changes only after a proposal is accepted." as const;

export const CANONICAL_CORRECTION_CONTEXT_SECTION_LABEL =
  "Correction context" as const;

export function buildCanonicalCorrectionHandoffFromProductConcept(
  concept: CanonicalProductConceptV1,
): CanonicalCorrectionHandoffV1 {
  return {
    handoffVersion: CANONICAL_CORRECTION_HANDOFF_VERSION,
    intent: CANONICAL_CORRECTION_INTENT,
    conceptId: concept.conceptId,
    currentRevisionId: concept.currentRevisionId,
    version: concept.version,
    title: concept.title,
    currentSummary: concept.summary,
  };
}

/** Build handoff from a Map/Inspector OrvekObject projection. No writes. */
export function buildCanonicalCorrectionHandoffFromOrvekObject(args: {
  conceptId: string;
  currentRevisionId: string;
  version: number;
  title: string;
  currentSummary: string;
}): CanonicalCorrectionHandoffV1 {
  return {
    handoffVersion: CANONICAL_CORRECTION_HANDOFF_VERSION,
    intent: CANONICAL_CORRECTION_INTENT,
    conceptId: args.conceptId.trim(),
    currentRevisionId: args.currentRevisionId.trim(),
    version: args.version,
    title: args.title.trim(),
    currentSummary: args.currentSummary.trim(),
  };
}

export function tryBuildCanonicalCorrectionHandoffFromOrvekObject(object: {
  inspectorObjectType?: string;
  inspectorObjectId?: string;
  id: string;
  title: string;
  summary?: string;
  currentRevisionId?: string;
  canonicalVersion?: number;
}): CanonicalCorrectionHandoffV1 | null {
  if (object.inspectorObjectType !== "canonical_concept") return null;
  const conceptId = (object.inspectorObjectId ?? object.id).trim();
  const currentRevisionId = object.currentRevisionId?.trim() ?? "";
  const version = object.canonicalVersion;
  const title = object.title?.trim() ?? "";
  const currentSummary = object.summary?.trim() ?? "";
  if (!conceptId || !currentRevisionId || !title || !currentSummary) return null;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return null;
  }
  return buildCanonicalCorrectionHandoffFromOrvekObject({
    conceptId,
    currentRevisionId,
    version,
    title,
    currentSummary,
  });
}

export function formatCanonicalCorrectionContextCopy(
  handoff: CanonicalCorrectionHandoffV1,
): string {
  return [
    CANONICAL_CORRECTION_CONTEXT_SECTION_LABEL,
    `You are proposing a change to revision ${handoff.version} of this accepted understanding.`,
    "The current model will remain unchanged until a proposal is accepted.",
  ].join("\n");
}

export function parseCanonicalCorrectionHandoff(
  value: unknown,
): CanonicalCorrectionHandoffV1 | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.handoffVersion !== CANONICAL_CORRECTION_HANDOFF_VERSION) return null;
  if (row.intent !== CANONICAL_CORRECTION_INTENT) return null;
  if (typeof row.conceptId !== "string" || !row.conceptId.trim()) return null;
  if (typeof row.currentRevisionId !== "string" || !row.currentRevisionId.trim()) {
    return null;
  }
  if (typeof row.version !== "number" || !Number.isInteger(row.version) || row.version < 1) {
    return null;
  }
  if (typeof row.title !== "string" || !row.title.trim()) return null;
  if (typeof row.currentSummary !== "string" || !row.currentSummary.trim()) {
    return null;
  }
  return {
    handoffVersion: CANONICAL_CORRECTION_HANDOFF_VERSION,
    intent: CANONICAL_CORRECTION_INTENT,
    conceptId: row.conceptId.trim(),
    currentRevisionId: row.currentRevisionId.trim(),
    version: row.version,
    title: row.title.trim(),
    currentSummary: row.currentSummary.trim(),
  };
}

/** Explore href — conceptId only as stable selector; no private summary in the URL. */
export function buildCanonicalCorrectionExploreHref(conceptId: string): string {
  const params = new URLSearchParams();
  params.set("canonicalCorrection", conceptId.trim());
  return `/explore?${params.toString()}`;
}
