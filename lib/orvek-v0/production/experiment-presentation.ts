import type { FieldworkStatus } from "@prisma/client";

import { isInspectorSelectableObjectType } from "../../inspector-selection";
import { formatLinkedObjectType } from "../../public-intelligence-safe-slice";
import { WATCH_FOR_SAFE_VISIBLE_STATUSES } from "../../watch-for";
import type { WatchForItem } from "../../watch-for";
import type { OrvekDataApi } from "../data-provider";
import { ORVEK_DISPLAY_CONTRACT_PRODUCTION } from "../display-contract";
import type { OrvekObject } from "../orvek-types";

export const EXPERIMENT_TITLE_MAX_LENGTH = 120;
export const EXPERIMENT_SUMMARY_MAX_LENGTH = 200;
export const EXPERIMENT_FIELD_MAX_LENGTH = 180;
export const EXPERIMENT_RAW_TEXT_REJECT_LENGTH = 320;
export const MIN_EXPERIMENT_READY_ROW_COUNT = 1;

export const REFERENCE_FIELDWORK_BRIDGE_HEADING = "Fieldwork Bridge" as const;

const RAW_TEXT_PATTERNS = [
  /\b(?:Error|Exception|Traceback|TypeError|ReferenceError|SyntaxError|Cannot\s+(?:find|read)|undefined\s+is\s+not)\b/,
  /^[$%#>]\s/m,
];

export function collapseExperimentDisplayWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeExperimentTitle(value: string | null | undefined): string | null {
  const collapsed = collapseExperimentDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= EXPERIMENT_TITLE_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, EXPERIMENT_TITLE_MAX_LENGTH - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > EXPERIMENT_TITLE_MAX_LENGTH * 0.6
      ? truncated.slice(0, lastSpace)
      : truncated;
  return `${safe}…`;
}

export function normalizeExperimentSummary(value: string | null | undefined): string | null {
  const collapsed = collapseExperimentDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= EXPERIMENT_SUMMARY_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, EXPERIMENT_SUMMARY_MAX_LENGTH - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > EXPERIMENT_SUMMARY_MAX_LENGTH * 0.6
      ? truncated.slice(0, lastSpace)
      : truncated;
  return `${safe}…`;
}

export function looksLikeUnsafeRawExperimentText(value: string | null | undefined): boolean {
  const collapsed = collapseExperimentDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return false;
  }

  if (collapsed.length > EXPERIMENT_RAW_TEXT_REJECT_LENGTH) {
    return true;
  }

  return RAW_TEXT_PATTERNS.some((pattern) => pattern.test(collapsed));
}

export function areExperimentTextsNearIdentical(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = collapseExperimentDisplayWhitespace(left ?? "").toLowerCase();
  const normalizedRight = collapseExperimentDisplayWhitespace(right ?? "").toLowerCase();

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

export function isKnownFieldworkBridgeStatus(
  status: string | null | undefined,
): status is FieldworkStatus {
  return WATCH_FOR_SAFE_VISIBLE_STATUSES.includes(status as FieldworkStatus);
}

export function referenceTagsForFieldworkStatus(
  status: FieldworkStatus,
  statusLabel: string,
): string[] {
  if (status === "active") {
    return ["Fieldwork", "Active in the field"];
  }

  if (status === "assigned") {
    return ["Fieldwork", "Ready to try"];
  }

  return ["Fieldwork", statusLabel];
}

function normalizeMeaningfulField(value: string | null | undefined): string | undefined {
  const normalized = normalizeExperimentSummary(value);
  if (!normalized || looksLikeUnsafeRawExperimentText(normalized)) {
    return undefined;
  }

  if (normalized.length <= EXPERIMENT_FIELD_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, EXPERIMENT_FIELD_MAX_LENGTH - 1).trimEnd()}…`;
}

export function normalizeExperimentBullets(
  bullets: string[] | null | undefined,
): string[] | undefined {
  const normalized = (bullets ?? [])
    .map((bullet) => normalizeMeaningfulField(bullet))
    .filter((bullet): bullet is string => Boolean(bullet));

  return normalized.length > 0 ? normalized : undefined;
}

export function buildLinkedFieldworkObjectAlias(input: {
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

export function normalizeExperimentOrvekObject(object: OrvekObject): OrvekObject {
  const title = normalizeExperimentTitle(object.title) ?? object.title;
  const summary = normalizeExperimentSummary(object.summary ?? object.purpose);
  const purpose =
    object.purpose && !areExperimentTextsNearIdentical(object.purpose, summary)
      ? normalizeMeaningfulField(object.purpose)
      : summary
        ? undefined
        : normalizeMeaningfulField(object.purpose);
  const expectedSignal = normalizeMeaningfulField(object.expectedSignal);
  const whatToObserve = normalizeMeaningfulField(object.whatToObserve);
  const confirmIf = normalizeMeaningfulField(object.confirmIf);
  const weakenIf = normalizeMeaningfulField(object.weakenIf);
  const reviewWindow = normalizeMeaningfulField(object.reviewWindow);

  return {
    ...object,
    title,
    summary: summary ?? undefined,
    purpose,
    expectedSignal,
    whatToObserve,
    confirmIf,
    weakenIf,
    reviewWindow,
    supporting: normalizeExperimentBullets(object.supporting),
    conflicting: normalizeExperimentBullets(object.conflicting),
    hypotheses: normalizeExperimentBullets(object.hypotheses),
    tags: object.tags?.filter((tag) => !looksLikeUnsafeRawExperimentText(tag)),
    relatedIds: object.relatedIds?.filter((id) => Boolean(id?.trim())),
  };
}

export function hasPartialButInvalidExperimentRichFields(object: OrvekObject): boolean {
  if (object.hypotheses !== undefined && !normalizeExperimentBullets(object.hypotheses)?.length) {
    return true;
  }

  if (object.supporting !== undefined && !normalizeExperimentBullets(object.supporting)?.length) {
    return true;
  }

  if (object.conflicting !== undefined && !normalizeExperimentBullets(object.conflicting)?.length) {
    return true;
  }

  if (
    (object.expectedSignal !== undefined && !normalizeMeaningfulField(object.expectedSignal)) ||
    (object.whatToObserve !== undefined && !normalizeMeaningfulField(object.whatToObserve)) ||
    (object.confirmIf !== undefined && !normalizeMeaningfulField(object.confirmIf)) ||
    (object.weakenIf !== undefined && !normalizeMeaningfulField(object.weakenIf))
  ) {
    return true;
  }

  return false;
}

export function isExperimentRowPresentationReady(object: OrvekObject): boolean {
  if (object.type !== "fieldwork") {
    return false;
  }

  if (looksLikeUnsafeRawExperimentText(object.title)) {
    return false;
  }

  if (object.summary && looksLikeUnsafeRawExperimentText(object.summary)) {
    return false;
  }

  if (hasPartialButInvalidExperimentRichFields(object)) {
    return false;
  }

  const normalized = normalizeExperimentOrvekObject(object);

  if (!normalizeExperimentTitle(normalized.title)) {
    return false;
  }

  if (!normalizeExperimentSummary(normalized.summary ?? normalized.purpose)) {
    return false;
  }

  const statusTag = normalized.tags?.[0];
  if (statusTag !== "Fieldwork") {
    return false;
  }

  return true;
}

function collectExperimentRowIds(api: OrvekDataApi): string[] {
  return Array.from(new Set(api.exploreFieldworkIds ?? []));
}

export function findDuplicateExperimentRowIds(api: OrvekDataApi): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of api.exploreFieldworkIds ?? []) {
    if (seen.has(id)) {
      duplicates.add(id);
    } else {
      seen.add(id);
    }
  }

  return Array.from(duplicates);
}

function dedupeExperimentRowIds(ids: string[] | undefined): string[] {
  const seen = new Set<string>();

  return (ids ?? []).filter((id) => {
    if (!id?.trim() || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function canResolveFieldworkLinkedObjects(api: OrvekDataApi, object: OrvekObject): boolean {
  for (const relatedId of object.relatedIds ?? []) {
    const related = api.getObject(relatedId);
    if (!related) {
      return false;
    }

    if (looksLikeUnsafeRawExperimentText(related.summary ?? related.title)) {
      return false;
    }
  }

  return true;
}

export function hasProductionDisplayContractLeak(api: OrvekDataApi | undefined): boolean {
  return api?.displayContract === ORVEK_DISPLAY_CONTRACT_PRODUCTION;
}

export function isExperimentPresentationReady(api: OrvekDataApi | undefined): boolean {
  if (!api || api.experimentIsLoading) {
    return false;
  }

  if (hasProductionDisplayContractLeak(api)) {
    return false;
  }

  const rowIds = collectExperimentRowIds(api);
  if (rowIds.length < MIN_EXPERIMENT_READY_ROW_COUNT) {
    return false;
  }

  if (findDuplicateExperimentRowIds(api).length > 0) {
    return false;
  }

  for (const id of rowIds) {
    const object = api.getObject(id);
    if (!object || !isExperimentRowPresentationReady(object)) {
      return false;
    }

    if (!canResolveFieldworkLinkedObjects(api, object)) {
      return false;
    }
  }

  return true;
}

export function shouldMergeExperimentProductionApi(api: OrvekDataApi | undefined): boolean {
  if (!api || api.experimentIsLoading) {
    return false;
  }

  return isExperimentPresentationReady(normalizeExperimentProductionDataApi(api));
}

export function resolveExperimentOpenSelectionId(
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

export function watchForItemToFieldworkObject(item: WatchForItem): OrvekObject {
  const relatedIds: string[] = [];
  let inspectorObjectType: string | undefined;
  let inspectorObjectId: string | undefined;

  if (item.linkedObjectId && isInspectorSelectableObjectType(item.linkedObjectType)) {
    relatedIds.push(item.linkedObjectId);
    inspectorObjectType = item.linkedObjectType;
    inspectorObjectId = item.linkedObjectId;
  }

  return {
    id: item.id,
    type: "fieldwork",
    title: item.prompt,
    summary: item.reason,
    purpose: item.reason,
    tags: referenceTagsForFieldworkStatus(item.status, item.statusLabel),
    relatedIds: relatedIds.length > 0 ? relatedIds : undefined,
    inspectorObjectType,
    inspectorObjectId: inspectorObjectId ?? item.id,
    lastUpdated: item.updatedAt,
  };
}

export function normalizeExperimentProductionDataApi(api: OrvekDataApi): OrvekDataApi {
  const exploreFieldworkIds = dedupeExperimentRowIds(api.exploreFieldworkIds);
  const objectIds = new Set(exploreFieldworkIds);
  const normalizedObjects = new Map<string, OrvekObject>();

  for (const id of objectIds) {
    const object = api.getObject(id);
    if (object?.type === "fieldwork") {
      normalizedObjects.set(id, normalizeExperimentOrvekObject(object));
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
        continue;
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

    if (object.type === "fieldwork") {
      return normalizeExperimentOrvekObject(object);
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
    exploreFieldworkIds,
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
