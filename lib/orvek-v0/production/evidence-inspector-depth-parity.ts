import type { OrvekDataApi } from "../data-provider";
import type { OrvekObject } from "../orvek-types";
import {
  formatEvidencePointerProvenanceLabel,
  hasEvidencePointerProvenance,
  hasInspectableEvidencePointerSourceText,
  isReceiptEvidencePointerObject,
} from "./today-evidence-pointer-parity";

/**
 * Inspector-depth parity for live evidence objects.
 *
 * Traced contract: docs/agent-runs/receipts/DESKTOP-REFERENCE-EVIDENCE-INSPECTOR-TRACE-001.
 * The accepted reference Evidence Pointer objects (`r6`, `r5`, `r2` in
 * lib/orvek-v0/orvek-data.ts) feed the existing ObjectDetail path with
 * source text, `whyItMatters`, and resolvable `contextIds`/`relatedIds`
 * whose targets are themselves rich enough to render a meaningful
 * Inspector context.
 *
 * Two distinct safety levels exist:
 * - source-safe (today-evidence-pointer-parity.ts): receipt type +
 *   non-generic sourceText + provenance. Enough for graph merge and
 *   receipt integrity, NOT enough for reference-depth UI consumption.
 * - inspector-depth-safe (this module): source-safe AND whyItMatters AND
 *   at least one resolvable, non-near-empty context/related target.
 *
 * This module never fabricates ids or edges. It only reads fields the
 * object truthfully carries; missing depth means blocked, never faked.
 */

export type EvidenceInspectorDepthBlocker =
  | "missing_object"
  | "not_receipt_type"
  | "generic_title"
  | "generic_source_text"
  | "missing_provenance"
  | "missing_why_it_matters"
  | "no_context_or_related_ids"
  | "unresolved_linked_ids"
  | "near_empty_linked_objects";

export type EvidenceInspectorDepthAssessment = {
  objectId: string | null;
  inspectorDepthSafe: boolean;
  blockers: EvidenceInspectorDepthBlocker[];
  resolvedContextIds: string[];
  resolvedRelatedIds: string[];
  unresolvedLinkedIds: string[];
  nearEmptyLinkedIds: string[];
};

export type LiveEvidenceInspectorDepthTarget = {
  objectId: string;
  inspectorTab: "evidence";
  sourceText: string;
  provenanceLabel: string;
  whyItMatters: string;
  contextIds: string[];
  relatedIds: string[];
};

type GetObject = (id: string | null | undefined) => OrvekObject | undefined;

function normalizeIds(ids: string[] | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const id of ids ?? []) {
    const trimmed = id?.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function hasEntries(value: unknown[] | undefined): boolean {
  return Boolean(value && value.length > 0);
}

export function hasMeaningfulEvidenceTitle(object: OrvekObject | undefined): boolean {
  const title = object?.title?.trim();
  return Boolean(title && title !== "Receipt");
}

export function hasMeaningfulWhyItMatters(object: OrvekObject | undefined): boolean {
  return hasText(object?.whyItMatters);
}

/**
 * A linked context/related target is near-empty when, beyond id/title/type,
 * it carries nothing ObjectDetail would render as a meaningful section.
 * Selecting such an object would open a shell Inspector view (dead link).
 */
export function isNearEmptyInspectorObject(object: OrvekObject | undefined): boolean {
  if (!object || !hasText(object.title)) {
    return true;
  }

  const hasRenderableContent =
    hasText(object.summary) ||
    hasText(object.whyItMatters) ||
    hasText(object.whyResurfaced) ||
    (object.type === "receipt" && hasText(object.sourceText)) ||
    hasText(object.recommendation) ||
    hasText(object.projection) ||
    hasText(object.reportSummary) ||
    hasText(object.before) ||
    hasText(object.after) ||
    hasEntries(object.supporting) ||
    hasEntries(object.conflicting) ||
    hasEntries(object.whatWouldChange) ||
    hasEntries(object.options) ||
    hasEntries(object.decisionContext) ||
    hasEntries(object.hypotheses) ||
    hasEntries(object.missingEvidence) ||
    hasEntries(object.receiptIds);

  return !hasRenderableContent;
}

export function assessEvidenceInspectorDepth(
  object: OrvekObject | undefined,
  getObject: GetObject,
): EvidenceInspectorDepthAssessment {
  const blockers: EvidenceInspectorDepthBlocker[] = [];
  const resolvedContextIds: string[] = [];
  const resolvedRelatedIds: string[] = [];
  const unresolvedLinkedIds: string[] = [];
  const nearEmptyLinkedIds: string[] = [];

  if (!object) {
    return {
      objectId: null,
      inspectorDepthSafe: false,
      blockers: ["missing_object"],
      resolvedContextIds,
      resolvedRelatedIds,
      unresolvedLinkedIds,
      nearEmptyLinkedIds,
    };
  }

  if (!isReceiptEvidencePointerObject(object)) {
    blockers.push("not_receipt_type");
  }
  if (!hasMeaningfulEvidenceTitle(object)) {
    blockers.push("generic_title");
  }
  if (!hasInspectableEvidencePointerSourceText(object)) {
    blockers.push("generic_source_text");
  }
  if (!hasEvidencePointerProvenance(object)) {
    blockers.push("missing_provenance");
  }
  if (!hasMeaningfulWhyItMatters(object)) {
    blockers.push("missing_why_it_matters");
  }

  const contextIds = normalizeIds(object.contextIds);
  const relatedIds = normalizeIds(object.relatedIds);

  if (contextIds.length === 0 && relatedIds.length === 0) {
    blockers.push("no_context_or_related_ids");
  }

  for (const { ids, resolved } of [
    { ids: contextIds, resolved: resolvedContextIds },
    { ids: relatedIds, resolved: resolvedRelatedIds },
  ]) {
    for (const id of ids) {
      const target = getObject(id);
      if (!target) {
        unresolvedLinkedIds.push(id);
        continue;
      }
      if (isNearEmptyInspectorObject(target)) {
        nearEmptyLinkedIds.push(id);
        continue;
      }
      resolved.push(id);
    }
  }

  if (unresolvedLinkedIds.length > 0) {
    blockers.push("unresolved_linked_ids");
  }
  if (nearEmptyLinkedIds.length > 0) {
    blockers.push("near_empty_linked_objects");
  }

  return {
    objectId: object.id,
    inspectorDepthSafe: blockers.length === 0,
    blockers,
    resolvedContextIds,
    resolvedRelatedIds,
    unresolvedLinkedIds,
    nearEmptyLinkedIds,
  };
}

export function hasReferenceDepthEvidenceShape(
  object: OrvekObject | undefined,
  getObject: GetObject,
): boolean {
  return assessEvidenceInspectorDepth(object, getObject).inspectorDepthSafe;
}

export function canUseLiveEvidenceInspectorDepth(
  api: OrvekDataApi,
  objectId: string | null | undefined,
): boolean {
  if (!objectId) {
    return false;
  }

  return hasReferenceDepthEvidenceShape(api.getObject(objectId), api.getObject);
}

export function resolveEvidenceInspectorDepthTarget(
  api: OrvekDataApi,
  objectId: string | null | undefined,
): LiveEvidenceInspectorDepthTarget | null {
  if (!objectId) {
    return null;
  }

  const object = api.getObject(objectId);
  const assessment = assessEvidenceInspectorDepth(object, api.getObject);
  if (!object || !assessment.inspectorDepthSafe) {
    return null;
  }

  return {
    objectId,
    inspectorTab: "evidence",
    sourceText: object.sourceText!.trim(),
    provenanceLabel: formatEvidencePointerProvenanceLabel(object),
    whyItMatters: object.whyItMatters!.trim(),
    contextIds: assessment.resolvedContextIds,
    relatedIds: assessment.resolvedRelatedIds,
  };
}

export function filterInspectorDepthSafeEvidencePointerIds(
  api: OrvekDataApi,
  ids: string[] | undefined,
): string[] {
  return normalizeIds(ids).filter((id) => canUseLiveEvidenceInspectorDepth(api, id));
}

/**
 * All-or-nothing list gate for future UI consumption: every displayed row
 * must be inspector-depth-safe, and there must be at least one row.
 */
export function canUseLiveEvidenceInspectorDepthList(
  api: OrvekDataApi,
  ids: string[] | undefined,
): boolean {
  const normalized = normalizeIds(ids);
  if (normalized.length === 0) {
    return false;
  }

  return normalized.every((id) => canUseLiveEvidenceInspectorDepth(api, id));
}
