/**
 * SUBSYS-004 Slice B — authenticated Inspector-safe canonical concept projection.
 *
 * Server-side authority → browser-safe related-object drill-down only.
 * Identity is stable across revision changes. Title and summary come from the
 * same current revision. Legacy seed is historical label-only. Never a truth store.
 */

import "server-only";

import { createHash } from "crypto";

import { CanonicalModelAuthorityError } from "./canonical-model-authority-errors";
import type { CanonicalModelUpdateConceptDrilldownProjection } from "./inspector-object-api";
import type { CanonicalProductConceptV1 } from "./canonical-model-product-projection";

const SELECTION_NAMESPACE = "orvek:canonical-concept-drilldown:v1";
const CONCEPT_LABEL = "Canonical concept";
const HISTORICAL_SOURCE_LABEL = "Historical source";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function safeText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = normalizeWhitespace(value);
  return normalized.length > 0 ? normalized : null;
}

function formatInspectorRecordedLabel(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

/**
 * Opaque selection identity derived only from the stable canonical concept id.
 * Revision changes must not change this id.
 */
export function buildCanonicalConceptSelectionId(conceptId: string): string {
  const normalized = safeText(conceptId);
  if (!normalized) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Canonical concept drill-down requires a stable concept id",
    );
  }
  const digest = createHash("sha256")
    .update(SELECTION_NAMESPACE)
    .update("\0")
    .update(normalized)
    .digest("hex");
  return `canonical-concept-${digest}`;
}

function requireCurrentTitle(concept: CanonicalProductConceptV1): string {
  const title = safeText(concept.title);
  if (!title) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Canonical concept drill-down requires a non-empty current revision title",
    );
  }
  return title;
}

function requireCurrentAcceptedAt(concept: CanonicalProductConceptV1): string {
  const acceptedAt = safeText(concept.acceptedAt);
  if (!acceptedAt) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Canonical concept drill-down requires current revision acceptedAt",
    );
  }
  const parsed = new Date(acceptedAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Canonical concept drill-down current revision acceptedAt is invalid",
    );
  }
  return acceptedAt;
}

function requireCurrentVersion(concept: CanonicalProductConceptV1): number {
  if (
    typeof concept.version !== "number" ||
    !Number.isFinite(concept.version) ||
    concept.version < 1
  ) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Canonical concept drill-down requires a valid current revision version",
    );
  }
  return concept.version;
}

function historicalSourcesFromLegacySeed(
  concept: CanonicalProductConceptV1,
): CanonicalModelUpdateConceptDrilldownProjection["historicalSources"] {
  const seed = concept.legacySeed;
  if (
    !seed ||
    seed.objectType !== "usermap_conclusion" ||
    !safeText(seed.objectId)
  ) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Canonical concept drill-down requires exactly one verified legacy_seed binding",
    );
  }
  // Label-only. Never expose raw seed id, title, summary, or payload.
  return [{ label: HISTORICAL_SOURCE_LABEL }];
}

/**
 * Build one Inspector-safe related-concept drill-down from an already-verified
 * CanonicalProductConceptV1. Throws on missing/invalid current truth rather than
 * falling back to legacy seed wording.
 */
export function projectCanonicalInspectorConceptDrilldown(args: {
  concept: CanonicalProductConceptV1;
  returnSelectionId: string;
}): CanonicalModelUpdateConceptDrilldownProjection {
  const { concept, returnSelectionId } = args;

  if (!concept || typeof concept !== "object") {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Canonical concept drill-down requires a verified product concept projection",
    );
  }

  const conceptId = safeText(concept.conceptId);
  if (!conceptId) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Canonical concept drill-down requires a stable concept id",
    );
  }

  const returnId = safeText(returnSelectionId);
  if (!returnId) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Canonical concept drill-down requires returnSelectionId",
    );
  }

  // Title and summary must come from the same current product projection fields
  // (already bound to one current revision by CanonicalProductConceptV1).
  const title = requireCurrentTitle(concept);
  const summary = safeText(concept.summary);
  const version = requireCurrentVersion(concept);
  const acceptedAt = requireCurrentAcceptedAt(concept);
  const rationale = safeText(concept.rationale);
  const evidenceCount =
    typeof concept.evidenceCount === "number" &&
    Number.isFinite(concept.evidenceCount) &&
    concept.evidenceCount >= 0
      ? concept.evidenceCount
      : 0;

  const historicalSources = historicalSourcesFromLegacySeed(concept);
  const sourceProvenanceLabel =
    historicalSources.length > 0 ? HISTORICAL_SOURCE_LABEL : null;

  const selectionId = buildCanonicalConceptSelectionId(conceptId);
  if (selectionId.includes(conceptId)) {
    throw new CanonicalModelAuthorityError(
      "BROKEN_CANONICAL_PROJECTION",
      "Canonical concept selection id must not embed the raw concept id",
    );
  }

  return {
    selectionId,
    conceptLabel: CONCEPT_LABEL,
    title,
    summary,
    currentRevisionVersion: version,
    currentRevisionAcceptedAt: acceptedAt,
    currentRevisionRecordedLabel: formatInspectorRecordedLabel(acceptedAt),
    rationale,
    evidenceCount,
    sourceProvenanceLabel,
    historicalSources,
    returnSelectionId: returnId,
  };
}

export type CanonicalRelatedConceptObject = {
  selectionId: string;
  title: string;
  inspectorObjectType: "canonical_concept";
  canonicalConceptDrilldown: CanonicalModelUpdateConceptDrilldownProjection;
};

/**
 * Exactly one related canonical concept when current concept projection is valid.
 * Invalid current truth returns [] (fail closed) — never legacy title/summary fallback.
 */
export function projectCanonicalRelatedConceptObjects(args: {
  concept: CanonicalProductConceptV1;
  returnSelectionId: string;
}): CanonicalRelatedConceptObject[] {
  try {
    const drilldown = projectCanonicalInspectorConceptDrilldown(args);
    return [
      {
        selectionId: drilldown.selectionId,
        title: drilldown.title,
        inspectorObjectType: "canonical_concept",
        canonicalConceptDrilldown: drilldown,
      },
    ];
  } catch (error) {
    if (error instanceof CanonicalModelAuthorityError) {
      return [];
    }
    throw error;
  }
}
