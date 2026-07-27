import type { InvestigationStatus } from "@prisma/client";

import { isInspectorSelectableObjectType } from "../../inspector-selection";
import { ACTIVE_QUESTION_SAFE_VISIBLE_STATUSES } from "../../active-questions";
import {
  EXPLORE_INVESTIGATION_VISIBLE_STATUSES,
  type ExploreInvestigationItem,
} from "../../investigations";
import { formatLinkedObjectType } from "../../public-intelligence-safe-slice";
import type { OrvekDataApi } from "../data-provider";
import { ORVEK_DISPLAY_CONTRACT_PRODUCTION } from "../display-contract";
import type { OrvekObject } from "../orvek-types";
import { withResolvedCanonicalSourceType } from "../../orvek-intelligence-object-authority";

export const INVESTIGATIONS_TITLE_MAX_LENGTH = 120;
export const INVESTIGATIONS_SUMMARY_MAX_LENGTH = 200;
export const INVESTIGATIONS_FIELD_MAX_LENGTH = 180;
export const INVESTIGATIONS_RAW_TEXT_REJECT_LENGTH = 320;
export const MIN_INVESTIGATIONS_READY_ROW_COUNT = 1;

export const REFERENCE_INVESTIGATIONS_TAG = "Investigation" as const;
export const EXPLORE_INVESTIGATION_SAFE_VISIBLE_STATUSES = EXPLORE_INVESTIGATION_VISIBLE_STATUSES;

const RAW_TEXT_PATTERNS = [
  /\b(?:Error|Exception|Traceback|TypeError|ReferenceError|SyntaxError|Cannot\s+(?:find|read)|undefined\s+is\s+not)\b/,
  /^[$%#>]\s/m,
];

export type InvestigationRowEnrichment = {
  hypotheses?: string[];
  missingEvidence?: string[];
  relatedIds?: string[];
  receiptIds?: string[];
  evidenceCount?: number;
};

/** Map inspector investigation detail into canonical typed-object enrichment (path B). */
export function enrichmentFromInspectorInvestigationDetail(detail: {
  competingTheories?: string[] | null;
  evidenceNeeded?: string[] | null;
  linkedEvidence?: Array<{ evidenceId: string; excerpt: string }> | null;
  linkedFieldwork?: Array<{ id: string; prompt: string; reason: string }> | null;
  resolvedConclusionId?: string | null;
}): {
  enrichment: InvestigationRowEnrichment;
  linkedObjects: OrvekObject[];
} {
  const competingTheories = Array.isArray(detail.competingTheories)
    ? detail.competingTheories
    : [];
  const evidenceNeeded = Array.isArray(detail.evidenceNeeded) ? detail.evidenceNeeded : [];
  const linkedEvidence = Array.isArray(detail.linkedEvidence) ? detail.linkedEvidence : [];
  const linkedFieldwork = Array.isArray(detail.linkedFieldwork) ? detail.linkedFieldwork : [];
  const linkedObjects: OrvekObject[] = [];

  for (const evidence of linkedEvidence) {
    const excerpt = collapseInvestigationsDisplayWhitespace(evidence.excerpt);
    if (!excerpt) continue;
    linkedObjects.push({
      id: evidence.evidenceId,
      type: "receipt",
      title: excerpt.slice(0, INVESTIGATIONS_TITLE_MAX_LENGTH),
      summary: excerpt.slice(0, INVESTIGATIONS_SUMMARY_MAX_LENGTH),
    });
  }

  for (const fieldwork of linkedFieldwork) {
    const prompt = collapseInvestigationsDisplayWhitespace(fieldwork.prompt);
    if (!prompt) continue;
    linkedObjects.push({
      id: fieldwork.id,
      type: "fieldwork",
      title: prompt.slice(0, INVESTIGATIONS_TITLE_MAX_LENGTH),
      summary: collapseInvestigationsDisplayWhitespace(fieldwork.reason).slice(
        0,
        INVESTIGATIONS_SUMMARY_MAX_LENGTH,
      ),
    });
  }

  const relatedIds = [
    ...linkedFieldwork.map((item) => item.id),
    ...(detail.resolvedConclusionId ? [detail.resolvedConclusionId] : []),
  ].filter(Boolean);

  return {
    enrichment: {
      hypotheses: competingTheories
        .map((value) => collapseInvestigationsDisplayWhitespace(value))
        .filter(Boolean),
      missingEvidence: evidenceNeeded
        .map((value) => collapseInvestigationsDisplayWhitespace(value))
        .filter(Boolean),
      relatedIds,
      receiptIds: linkedEvidence.map((item) => item.evidenceId).filter(Boolean),
      evidenceCount: linkedEvidence.length,
    },
    linkedObjects,
  };
}

export function collapseInvestigationsDisplayWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeInvestigationsTitle(value: string | null | undefined): string | null {
  const collapsed = collapseInvestigationsDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= INVESTIGATIONS_TITLE_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, INVESTIGATIONS_TITLE_MAX_LENGTH - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > INVESTIGATIONS_TITLE_MAX_LENGTH * 0.6
      ? truncated.slice(0, lastSpace)
      : truncated;
  return `${safe}…`;
}

export function normalizeInvestigationsSummary(value: string | null | undefined): string | null {
  const collapsed = collapseInvestigationsDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= INVESTIGATIONS_SUMMARY_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, INVESTIGATIONS_SUMMARY_MAX_LENGTH - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > INVESTIGATIONS_SUMMARY_MAX_LENGTH * 0.6
      ? truncated.slice(0, lastSpace)
      : truncated;
  return `${safe}…`;
}

export function looksLikeUnsafeRawInvestigationsText(
  value: string | null | undefined,
): boolean {
  const collapsed = collapseInvestigationsDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return false;
  }

  if (collapsed.length > INVESTIGATIONS_RAW_TEXT_REJECT_LENGTH) {
    return true;
  }

  return RAW_TEXT_PATTERNS.some((pattern) => pattern.test(collapsed));
}

export function looksLikeRawJsonInvestigationsBlob(value: string | null | undefined): boolean {
  const collapsed = collapseInvestigationsDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return false;
  }

  if (
    (collapsed.startsWith("{") && collapsed.endsWith("}")) ||
    (collapsed.startsWith("[") && collapsed.includes("{"))
  ) {
    return true;
  }

  return /\bcompetingTheories\b|\bevidenceNeeded\b/.test(collapsed);
}

export function areInvestigationsTextsNearIdentical(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = collapseInvestigationsDisplayWhitespace(left ?? "").toLowerCase();
  const normalizedRight = collapseInvestigationsDisplayWhitespace(right ?? "").toLowerCase();

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

export function isExploreInvestigationBridgeStatus(
  status: string | null | undefined,
): status is InvestigationStatus {
  return EXPLORE_INVESTIGATION_SAFE_VISIBLE_STATUSES.includes(status as InvestigationStatus);
}

export function isActiveQuestionOwnedInvestigationStatus(
  status: string | null | undefined,
): boolean {
  return ACTIVE_QUESTION_SAFE_VISIBLE_STATUSES.includes(status as InvestigationStatus);
}

export function isInvestigationItemBridgeEligible(item: ExploreInvestigationItem): boolean {
  if (isActiveQuestionOwnedInvestigationStatus(item.status)) {
    return false;
  }

  return isExploreInvestigationBridgeStatus(item.status);
}

export function mapInvestigationStatusToReferenceDisplay(
  status: InvestigationStatus,
): string {
  switch (status) {
    case "resolved":
      return "resolved";
    case "abandoned":
      return "abandoned";
    default:
      return "open";
  }
}

export function referenceTagsForInvestigationStatus(
  status: InvestigationStatus,
  statusLabel: string,
): string[] {
  if (status === "resolved") {
    return [REFERENCE_INVESTIGATIONS_TAG, statusLabel];
  }

  if (status === "abandoned") {
    return [REFERENCE_INVESTIGATIONS_TAG, statusLabel];
  }

  return [REFERENCE_INVESTIGATIONS_TAG, statusLabel];
}

function normalizeMeaningfulField(value: string | null | undefined): string | undefined {
  const normalized = normalizeInvestigationsSummary(value);
  if (
    !normalized ||
    looksLikeUnsafeRawInvestigationsText(normalized) ||
    looksLikeRawJsonInvestigationsBlob(normalized)
  ) {
    return undefined;
  }

  if (normalized.length <= INVESTIGATIONS_FIELD_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, INVESTIGATIONS_FIELD_MAX_LENGTH - 1).trimEnd()}…`;
}

export function normalizeInvestigationsBullets(
  bullets: string[] | null | undefined,
): string[] | undefined {
  const normalized = (bullets ?? [])
    .map((bullet) => normalizeMeaningfulField(bullet))
    .filter((bullet): bullet is string => Boolean(bullet));

  return normalized.length > 0 ? normalized : undefined;
}

export function buildLinkedInvestigationObjectAlias(input: {
  linkedObjectType: string;
  linkedObjectId: string;
}): OrvekObject | null {
  if (!isInspectorSelectableObjectType(input.linkedObjectType)) {
    return null;
  }

  const title = formatLinkedObjectType(
    input.linkedObjectType as Parameters<typeof formatLinkedObjectType>[0],
  );

  return {
    id: input.linkedObjectId,
    type: "receipt",
    title,
    summary: title,
    inspectorObjectType: input.linkedObjectType,
    inspectorObjectId: input.linkedObjectId,
  };
}

export function normalizeInvestigationsOrvekObject(object: OrvekObject): OrvekObject {
  const title = normalizeInvestigationsTitle(object.title) ?? object.title;
  const summary = normalizeInvestigationsSummary(object.summary);
  const whyItMatters =
    object.whyItMatters && !areInvestigationsTextsNearIdentical(object.whyItMatters, summary)
      ? normalizeMeaningfulField(object.whyItMatters)
      : summary
        ? normalizeMeaningfulField(summary)
        : normalizeMeaningfulField(object.whyItMatters);

  const evidenceCount =
    typeof object.evidenceCount === "number" &&
    Number.isInteger(object.evidenceCount) &&
    object.evidenceCount >= 0
      ? object.evidenceCount
      : undefined;

  return {
    ...object,
    title,
    summary: summary ?? undefined,
    whyItMatters,
    hypotheses: normalizeInvestigationsBullets(object.hypotheses),
    missingEvidence: normalizeInvestigationsBullets(object.missingEvidence),
    tags: object.tags?.filter((tag) => !looksLikeUnsafeRawInvestigationsText(tag)),
    relatedIds: object.relatedIds?.filter((id) => Boolean(id?.trim())),
    receiptIds: object.receiptIds?.filter((id) => Boolean(id?.trim())),
    evidenceCount,
  };
}

export function hasPartialButInvalidInvestigationsRichFields(object: OrvekObject): boolean {
  if (object.hypotheses !== undefined && !normalizeInvestigationsBullets(object.hypotheses)?.length) {
    return true;
  }

  if (
    object.missingEvidence !== undefined &&
    !normalizeInvestigationsBullets(object.missingEvidence)?.length
  ) {
    return true;
  }

  if (object.whyItMatters !== undefined && !normalizeMeaningfulField(object.whyItMatters)) {
    return true;
  }

  for (const bullet of [...(object.hypotheses ?? []), ...(object.missingEvidence ?? [])]) {
    if (looksLikeRawJsonInvestigationsBlob(bullet)) {
      return true;
    }
  }

  return false;
}

export function hasInvestigationThreadDetailRichness(object: OrvekObject): boolean {
  const hypotheses = normalizeInvestigationsBullets(object.hypotheses);
  const missingEvidence = normalizeInvestigationsBullets(object.missingEvidence);

  return Boolean(hypotheses?.length || missingEvidence?.length);
}

export function isInvestigationsRowPresentationReady(object: OrvekObject): boolean {
  if (object.type !== "investigation") {
    return false;
  }

  if (looksLikeUnsafeRawInvestigationsText(object.title)) {
    return false;
  }

  if (object.summary && looksLikeUnsafeRawInvestigationsText(object.summary)) {
    return false;
  }

  if (hasPartialButInvalidInvestigationsRichFields(object)) {
    return false;
  }

  const normalized = normalizeInvestigationsOrvekObject(object);

  if (!normalizeInvestigationsTitle(normalized.title)) {
    return false;
  }

  if (!normalizeMeaningfulField(normalized.whyItMatters ?? normalized.summary)) {
    return false;
  }

  const statusTag = normalized.tags?.[0];
  if (statusTag !== REFERENCE_INVESTIGATIONS_TAG) {
    return false;
  }

  const referenceStatus = normalized.status;
  if (
    referenceStatus &&
    (referenceStatus === "active" ||
      referenceStatus === "open" ||
      referenceStatus === "resolving" ||
      referenceStatus === "reopened")
  ) {
    return false;
  }

  return true;
}

function collectInvestigationsRowIds(api: OrvekDataApi): string[] {
  return Array.from(new Set(api.exploreInvestigationIds ?? []));
}

export function findDuplicateInvestigationRowIds(api: OrvekDataApi): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of api.exploreInvestigationIds ?? []) {
    if (seen.has(id)) {
      duplicates.add(id);
    } else {
      seen.add(id);
    }
  }

  return Array.from(duplicates);
}

function dedupeInvestigationRowIds(ids: string[] | undefined): string[] {
  const seen = new Set<string>();

  return (ids ?? []).filter((id) => {
    if (!id?.trim() || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function canResolveInvestigationLinkedObjects(api: OrvekDataApi, object: OrvekObject): boolean {
  for (const relatedId of object.relatedIds ?? []) {
    const related = api.getObject(relatedId);
    if (!related) {
      return false;
    }

    if (looksLikeUnsafeRawInvestigationsText(related.summary ?? related.title)) {
      return false;
    }
  }

  for (const receiptId of object.receiptIds ?? []) {
    const receipt = api.getObject(receiptId);
    if (!receipt) {
      return false;
    }

    if (looksLikeUnsafeRawInvestigationsText(receipt.summary ?? receipt.title)) {
      return false;
    }
  }

  if (object.inspectorObjectId && object.inspectorObjectId !== object.id) {
    const target = api.getObject(object.inspectorObjectId);
    if (!target) {
      return false;
    }
  }

  return true;
}

export function hasInvestigationsProductionDisplayContractLeak(
  api: OrvekDataApi | undefined,
): boolean {
  return api?.displayContract === ORVEK_DISPLAY_CONTRACT_PRODUCTION;
}

export function isInvestigationsPresentationReady(api: OrvekDataApi | undefined): boolean {
  if (!api || api.investigationsIsLoading) {
    return false;
  }

  if (hasInvestigationsProductionDisplayContractLeak(api)) {
    return false;
  }

  const rowIds = collectInvestigationsRowIds(api);
  if (rowIds.length < MIN_INVESTIGATIONS_READY_ROW_COUNT) {
    return false;
  }

  if (findDuplicateInvestigationRowIds(api).length > 0) {
    return false;
  }

  for (const id of rowIds) {
    const object = api.getObject(id);
    if (!object || !isInvestigationsRowPresentationReady(object)) {
      return false;
    }

    if (!canResolveInvestigationLinkedObjects(api, object)) {
      return false;
    }
  }

  return true;
}

export function shouldMergeInvestigationsProductionApi(api: OrvekDataApi | undefined): boolean {
  if (!api || api.investigationsIsLoading) {
    return false;
  }

  return isInvestigationsPresentationReady(normalizeInvestigationsProductionDataApi(api));
}

export function resolveInvestigationsOpenSelectionId(
  rowId: string,
  getObject: (id: string | null | undefined) => OrvekObject | undefined,
): string {
  const row = getObject(rowId);
  const inspectorObjectId = row?.inspectorObjectId?.trim();

  if (!inspectorObjectId || inspectorObjectId === rowId) {
    return rowId;
  }

  return getObject(inspectorObjectId) ? inspectorObjectId : rowId;
}

export function exploreInvestigationItemToInvestigationObject(
  item: ExploreInvestigationItem,
  enrichment: InvestigationRowEnrichment = {},
): OrvekObject | null {
  if (!isInvestigationItemBridgeEligible(item)) {
    return null;
  }

  const evidenceCount =
    typeof enrichment.evidenceCount === "number" &&
    Number.isInteger(enrichment.evidenceCount) &&
    enrichment.evidenceCount >= 0
      ? enrichment.evidenceCount
      : undefined;

  return withResolvedCanonicalSourceType<OrvekObject>({
    id: item.id,
    type: "investigation",
    title: item.title,
    summary: item.organizingQuestion,
    whyItMatters: item.organizingQuestion,
    status: mapInvestigationStatusToReferenceDisplay(item.status),
    tags: referenceTagsForInvestigationStatus(item.status, item.statusLabel),
    inspectorObjectId: item.id,
    lastUpdated: item.updatedAt,
    hypotheses: enrichment.hypotheses,
    missingEvidence: enrichment.missingEvidence,
    relatedIds: enrichment.relatedIds,
    receiptIds: enrichment.receiptIds,
    evidenceCount,
  });
}

export function normalizeInvestigationsProductionDataApi(api: OrvekDataApi): OrvekDataApi {
  const exploreInvestigationIds = dedupeInvestigationRowIds(api.exploreInvestigationIds);
  const objectIds = new Set(exploreInvestigationIds);
  const normalizedObjects = new Map<string, OrvekObject>();

  for (const id of objectIds) {
    const object = api.getObject(id);
    if (object?.type === "investigation") {
      normalizedObjects.set(id, normalizeInvestigationsOrvekObject(object));
    }
  }

  for (const id of objectIds) {
    const object = normalizedObjects.get(id);
    if (!object) {
      continue;
    }

    for (const relatedId of object.relatedIds ?? []) {
      if (normalizedObjects.has(relatedId) || api.getObject(relatedId)) {
        const existing = normalizedObjects.get(relatedId) ?? api.getObject(relatedId);
        if (existing) {
          normalizedObjects.set(relatedId, existing);
        }
      }
    }

    for (const receiptId of object.receiptIds ?? []) {
      if (normalizedObjects.has(receiptId) || api.getObject(receiptId)) {
        const existing = normalizedObjects.get(receiptId) ?? api.getObject(receiptId);
        if (existing) {
          normalizedObjects.set(receiptId, existing);
        }
      }
    }
  }

  const mergedGetObject = (id: string | null | undefined): OrvekObject | undefined => {
    if (!id) {
      return undefined;
    }

    if (normalizedObjects.has(id)) {
      return normalizedObjects.get(id);
    }

    const object = api.getObject(id);
    if (!object) {
      return undefined;
    }

    if (object.type === "investigation") {
      return normalizeInvestigationsOrvekObject(object);
    }

    return object.type === "receipt" ? object : undefined;
  };

  const {
    displayContract: _displayContract,
    explore: _explore,
    ...apiWithoutProductionShell
  } = api;

  return {
    ...apiWithoutProductionShell,
    exploreInvestigationIds,
    getObject: mergedGetObject,
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = mergedGetObject(id);
        if (object) {
          resolved.push(object);
        }
      }

      return resolved;
    },
  };
}
