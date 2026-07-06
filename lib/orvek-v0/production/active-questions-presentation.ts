import type { InvestigationStatus } from "@prisma/client";

import { isInspectorSelectableObjectType } from "../../inspector-selection";
import {
  ACTIVE_QUESTION_SAFE_VISIBLE_STATUSES,
  type ActiveQuestionItem,
} from "../../active-questions";
import { formatLinkedObjectType } from "../../public-intelligence-safe-slice";
import type { OrvekDataApi } from "../data-provider";
import { ORVEK_DISPLAY_CONTRACT_PRODUCTION } from "../display-contract";
import type { OrvekObject } from "../orvek-types";

export const ACTIVE_QUESTIONS_TITLE_MAX_LENGTH = 120;
export const ACTIVE_QUESTIONS_SUMMARY_MAX_LENGTH = 200;
export const ACTIVE_QUESTIONS_FIELD_MAX_LENGTH = 180;
export const ACTIVE_QUESTIONS_RAW_TEXT_REJECT_LENGTH = 320;
export const MIN_ACTIVE_QUESTIONS_READY_ROW_COUNT = 1;

export const REFERENCE_ACTIVE_QUESTIONS_TAG = "Active Question" as const;

const RAW_TEXT_PATTERNS = [
  /\b(?:Error|Exception|Traceback|TypeError|ReferenceError|SyntaxError|Cannot\s+(?:find|read)|undefined\s+is\s+not)\b/,
  /^[$%#>]\s/m,
];

export function collapseActiveQuestionsDisplayWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeActiveQuestionsTitle(value: string | null | undefined): string | null {
  const collapsed = collapseActiveQuestionsDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= ACTIVE_QUESTIONS_TITLE_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, ACTIVE_QUESTIONS_TITLE_MAX_LENGTH - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > ACTIVE_QUESTIONS_TITLE_MAX_LENGTH * 0.6
      ? truncated.slice(0, lastSpace)
      : truncated;
  return `${safe}…`;
}

export function normalizeActiveQuestionsSummary(value: string | null | undefined): string | null {
  const collapsed = collapseActiveQuestionsDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= ACTIVE_QUESTIONS_SUMMARY_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, ACTIVE_QUESTIONS_SUMMARY_MAX_LENGTH - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > ACTIVE_QUESTIONS_SUMMARY_MAX_LENGTH * 0.6
      ? truncated.slice(0, lastSpace)
      : truncated;
  return `${safe}…`;
}

export function looksLikeUnsafeRawActiveQuestionsText(
  value: string | null | undefined,
): boolean {
  const collapsed = collapseActiveQuestionsDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return false;
  }

  if (collapsed.length > ACTIVE_QUESTIONS_RAW_TEXT_REJECT_LENGTH) {
    return true;
  }

  return RAW_TEXT_PATTERNS.some((pattern) => pattern.test(collapsed));
}

export function areActiveQuestionsTextsNearIdentical(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = collapseActiveQuestionsDisplayWhitespace(left ?? "").toLowerCase();
  const normalizedRight = collapseActiveQuestionsDisplayWhitespace(right ?? "").toLowerCase();

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

export function isKnownActiveQuestionStatus(
  status: string | null | undefined,
): status is InvestigationStatus {
  return ACTIVE_QUESTION_SAFE_VISIBLE_STATUSES.includes(status as InvestigationStatus);
}

export function mapActiveQuestionStatusToReferenceDisplay(
  status: InvestigationStatus,
): string {
  switch (status) {
    case "open":
      return "open";
    case "gathering_evidence":
    case "testing":
      return "active";
    case "resolving":
      return "resolving";
    case "reopened":
      return "reopened";
    default:
      return "open";
  }
}

export function referenceTagsForActiveQuestionStatus(
  status: InvestigationStatus,
  statusLabel: string,
): string[] {
  if (status === "gathering_evidence" || status === "testing") {
    return [REFERENCE_ACTIVE_QUESTIONS_TAG, "Active"];
  }

  if (status === "open" || status === "reopened") {
    return [REFERENCE_ACTIVE_QUESTIONS_TAG, statusLabel];
  }

  return [REFERENCE_ACTIVE_QUESTIONS_TAG, statusLabel];
}

function normalizeMeaningfulField(value: string | null | undefined): string | undefined {
  const normalized = normalizeActiveQuestionsSummary(value);
  if (!normalized || looksLikeUnsafeRawActiveQuestionsText(normalized)) {
    return undefined;
  }

  if (normalized.length <= ACTIVE_QUESTIONS_FIELD_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, ACTIVE_QUESTIONS_FIELD_MAX_LENGTH - 1).trimEnd()}…`;
}

export function normalizeActiveQuestionsBullets(
  bullets: string[] | null | undefined,
): string[] | undefined {
  const normalized = (bullets ?? [])
    .map((bullet) => normalizeMeaningfulField(bullet))
    .filter((bullet): bullet is string => Boolean(bullet));

  return normalized.length > 0 ? normalized : undefined;
}

export function buildLinkedActiveQuestionObjectAlias(input: {
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

export function normalizeActiveQuestionsOrvekObject(object: OrvekObject): OrvekObject {
  const title = normalizeActiveQuestionsTitle(object.title) ?? object.title;
  const summary = normalizeActiveQuestionsSummary(object.summary);
  const whyItMatters =
    object.whyItMatters && !areActiveQuestionsTextsNearIdentical(object.whyItMatters, summary)
      ? normalizeMeaningfulField(object.whyItMatters)
      : summary
        ? normalizeMeaningfulField(summary)
        : normalizeMeaningfulField(object.whyItMatters);

  return {
    ...object,
    title,
    summary: summary ?? undefined,
    whyItMatters,
    supporting: normalizeActiveQuestionsBullets(object.supporting),
    conflicting: normalizeActiveQuestionsBullets(object.conflicting),
    tags: object.tags?.filter((tag) => !looksLikeUnsafeRawActiveQuestionsText(tag)),
    relatedIds: object.relatedIds?.filter((id) => Boolean(id?.trim())),
    receiptIds: object.receiptIds?.filter((id) => Boolean(id?.trim())),
  };
}

export function hasPartialButInvalidActiveQuestionsRichFields(object: OrvekObject): boolean {
  if (object.supporting !== undefined && !normalizeActiveQuestionsBullets(object.supporting)?.length) {
    return true;
  }

  if (object.conflicting !== undefined && !normalizeActiveQuestionsBullets(object.conflicting)?.length) {
    return true;
  }

  if (object.whyItMatters !== undefined && !normalizeMeaningfulField(object.whyItMatters)) {
    return true;
  }

  return false;
}

export function isActiveQuestionsRowPresentationReady(object: OrvekObject): boolean {
  if (object.type !== "active-question") {
    return false;
  }

  if (looksLikeUnsafeRawActiveQuestionsText(object.title)) {
    return false;
  }

  if (object.summary && looksLikeUnsafeRawActiveQuestionsText(object.summary)) {
    return false;
  }

  if (hasPartialButInvalidActiveQuestionsRichFields(object)) {
    return false;
  }

  const normalized = normalizeActiveQuestionsOrvekObject(object);

  if (!normalizeActiveQuestionsTitle(normalized.title)) {
    return false;
  }

  if (!normalizeMeaningfulField(normalized.whyItMatters ?? normalized.summary)) {
    return false;
  }

  const statusTag = normalized.tags?.[0];
  if (statusTag !== REFERENCE_ACTIVE_QUESTIONS_TAG) {
    return false;
  }

  return true;
}

function collectActiveQuestionsRowIds(api: OrvekDataApi): string[] {
  return Array.from(new Set(api.exploreQuestionIds ?? []));
}

export function findDuplicateActiveQuestionRowIds(api: OrvekDataApi): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of api.exploreQuestionIds ?? []) {
    if (seen.has(id)) {
      duplicates.add(id);
    } else {
      seen.add(id);
    }
  }

  return Array.from(duplicates);
}

function dedupeActiveQuestionRowIds(ids: string[] | undefined): string[] {
  const seen = new Set<string>();

  return (ids ?? []).filter((id) => {
    if (!id?.trim() || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function canResolveActiveQuestionLinkedObjects(api: OrvekDataApi, object: OrvekObject): boolean {
  for (const relatedId of object.relatedIds ?? []) {
    const related = api.getObject(relatedId);
    if (!related) {
      return false;
    }

    if (looksLikeUnsafeRawActiveQuestionsText(related.summary ?? related.title)) {
      return false;
    }
  }

  for (const receiptId of object.receiptIds ?? []) {
    const receipt = api.getObject(receiptId);
    if (!receipt) {
      return false;
    }

    if (looksLikeUnsafeRawActiveQuestionsText(receipt.summary ?? receipt.title)) {
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

export function hasProductionDisplayContractLeak(api: OrvekDataApi | undefined): boolean {
  return api?.displayContract === ORVEK_DISPLAY_CONTRACT_PRODUCTION;
}

export function isActiveQuestionsPresentationReady(api: OrvekDataApi | undefined): boolean {
  if (!api || api.activeQuestionsIsLoading) {
    return false;
  }

  if (hasProductionDisplayContractLeak(api)) {
    return false;
  }

  const rowIds = collectActiveQuestionsRowIds(api);
  if (rowIds.length < MIN_ACTIVE_QUESTIONS_READY_ROW_COUNT) {
    return false;
  }

  if (findDuplicateActiveQuestionRowIds(api).length > 0) {
    return false;
  }

  for (const id of rowIds) {
    const object = api.getObject(id);
    if (!object || !isActiveQuestionsRowPresentationReady(object)) {
      return false;
    }

    if (!canResolveActiveQuestionLinkedObjects(api, object)) {
      return false;
    }
  }

  return true;
}

export function shouldMergeActiveQuestionsProductionApi(api: OrvekDataApi | undefined): boolean {
  if (!api || api.activeQuestionsIsLoading) {
    return false;
  }

  return isActiveQuestionsPresentationReady(normalizeActiveQuestionsProductionDataApi(api));
}

export function resolveActiveQuestionsOpenSelectionId(
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

export function activeQuestionItemToActiveQuestionObject(item: ActiveQuestionItem): OrvekObject {
  return {
    id: item.id,
    type: "active-question",
    title: item.title,
    summary: item.organizingQuestion,
    whyItMatters: item.organizingQuestion,
    status: mapActiveQuestionStatusToReferenceDisplay(item.status),
    tags: referenceTagsForActiveQuestionStatus(item.status, item.statusLabel),
    inspectorObjectId: item.id,
    lastUpdated: item.updatedAt,
  };
}

export function normalizeActiveQuestionsProductionDataApi(api: OrvekDataApi): OrvekDataApi {
  const exploreQuestionIds = dedupeActiveQuestionRowIds(api.exploreQuestionIds);
  const objectIds = new Set(exploreQuestionIds);
  const normalizedObjects = new Map<string, OrvekObject>();

  for (const id of objectIds) {
    const object = api.getObject(id);
    if (object?.type === "active-question") {
      normalizedObjects.set(id, normalizeActiveQuestionsOrvekObject(object));
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

    if (object.type === "active-question") {
      return normalizeActiveQuestionsOrvekObject(object);
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
    exploreQuestionIds,
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
