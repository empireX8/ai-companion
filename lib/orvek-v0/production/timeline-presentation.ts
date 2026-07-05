import type { OrvekDataApi, OrvekTimelineGroup } from "../data-provider";
import type { OrvekObject } from "../orvek-types";

export const TIMELINE_TITLE_MAX_LENGTH = 120;
export const TIMELINE_SUMMARY_MAX_LENGTH = 200;
export const TIMELINE_RAW_TEXT_REJECT_LENGTH = 320;
export const MIN_TIMELINE_READY_ROW_COUNT = 1;

export const REFERENCE_TIMELINE_GROUP_HEADINGS = [
  "Today",
  "This week",
  "Last week",
  "Earlier",
  "Imported history",
] as const;

export const REFERENCE_TIMELINE_FILTERS = [
  "All",
  "Model Updates",
  "Receipts",
  "Decisions",
  "Reports",
  "Fieldwork",
  "Context Profile",
  "Imports",
] as const;

const PRIOR_READ_UNAVAILABLE_COPY = "Prior read not shown in this stream.";

const RAW_TEXT_PATTERNS = [
  /\b(?:Error|Exception|Traceback|TypeError|ReferenceError|SyntaxError|Cannot\s+(?:find|read)|undefined\s+is\s+not)\b/,
  /^[$%#>]\s/m,
];

export function collapseTimelineDisplayWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeTimelineTitle(value: string | null | undefined): string | null {
  const collapsed = collapseTimelineDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= TIMELINE_TITLE_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, TIMELINE_TITLE_MAX_LENGTH - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > TIMELINE_TITLE_MAX_LENGTH * 0.6
      ? truncated.slice(0, lastSpace)
      : truncated;
  return `${safe}…`;
}

export function normalizeTimelineSummary(value: string | null | undefined): string | null {
  const collapsed = collapseTimelineDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= TIMELINE_SUMMARY_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, TIMELINE_SUMMARY_MAX_LENGTH - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > TIMELINE_SUMMARY_MAX_LENGTH * 0.6
      ? truncated.slice(0, lastSpace)
      : truncated;
  return `${safe}…`;
}

export function looksLikeUnsafeRawTimelineText(value: string | null | undefined): boolean {
  const collapsed = collapseTimelineDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return false;
  }

  if (collapsed.length > TIMELINE_RAW_TEXT_REJECT_LENGTH) {
    return true;
  }

  return RAW_TEXT_PATTERNS.some((pattern) => pattern.test(collapsed));
}

export function areTimelineTextsNearIdentical(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = collapseTimelineDisplayWhitespace(left ?? "").toLowerCase();
  const normalizedRight = collapseTimelineDisplayWhitespace(right ?? "").toLowerCase();

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

export function normalizeTimelineDateLabel(value: string | null | undefined): string | null {
  const collapsed = collapseTimelineDisplayWhitespace(value ?? "");
  if (!collapsed || collapsed === "—" || collapsed === "--:--") {
    return null;
  }

  return collapsed;
}

export function mapTimelineEventLabelToReferenceType(eventLabel: string | null | undefined): string | null {
  const normalized = collapseTimelineDisplayWhitespace(eventLabel ?? "").toLowerCase();
  if (!normalized) {
    return null;
  }

  if (/model|map update|movement|context profile|active question/.test(normalized)) {
    return "Model Update";
  }
  if (/decision/.test(normalized)) {
    return "Decision";
  }
  if (/report/.test(normalized)) {
    return "Report";
  }
  if (/fieldwork|investigation/.test(normalized)) {
    return "Fieldwork";
  }
  if (/import/.test(normalized)) {
    return "Import";
  }
  if (/check-in|journal|receipt|capture|explore/.test(normalized)) {
    return "Receipt resurfaced";
  }

  return null;
}

export function resolveTimelineMovementPair(input: {
  before?: string | null;
  after?: string | null;
}): { before?: string; after?: string } {
  const before = normalizeTimelineSummary(input.before);
  const after = normalizeTimelineSummary(input.after);

  if (!before || !after) {
    return {};
  }

  if (before === PRIOR_READ_UNAVAILABLE_COPY) {
    return {};
  }

  if (areTimelineTextsNearIdentical(before, after)) {
    return {};
  }

  return { before, after };
}

export function normalizeTimelineTags(eventType: string): string[] {
  return [eventType];
}

export function normalizeTimelineOrvekObject(object: OrvekObject): OrvekObject {
  const title = normalizeTimelineTitle(object.title) ?? object.title;
  const summary = normalizeTimelineSummary(object.summary);
  const eventType =
    mapTimelineEventLabelToReferenceType(object.eventType ?? object.tags?.[0]) ??
    normalizeTimelineTitle(object.eventType ?? object.tags?.[0] ?? "") ??
    object.eventType;
  const date =
    normalizeTimelineDateLabel(object.date) ??
    normalizeTimelineDateLabel(object.lastUpdated) ??
    undefined;
  const movement = resolveTimelineMovementPair({
    before: object.before,
    after: object.after,
  });
  const hasMovementFields = Boolean(object.before || object.after);
  const movementReady = Boolean(movement.before && movement.after);

  return {
    ...object,
    title,
    summary: summary ?? undefined,
    eventType,
    date,
    lastUpdated: date ?? object.lastUpdated,
    tags: eventType ? normalizeTimelineTags(eventType) : object.tags,
    before: movementReady ? movement.before : undefined,
    after: movementReady ? movement.after : hasMovementFields ? undefined : movement.after,
  };
}

export function isTimelineRowPresentationReady(object: OrvekObject): boolean {
  if (looksLikeUnsafeRawTimelineText(object.title)) {
    return false;
  }

  if (object.summary && looksLikeUnsafeRawTimelineText(object.summary)) {
    return false;
  }

  const normalized = normalizeTimelineOrvekObject(object);

  if (!normalizeTimelineTitle(normalized.title)) {
    return false;
  }

  if (!normalizeTimelineDateLabel(normalized.date ?? normalized.lastUpdated)) {
    return false;
  }

  if (!mapTimelineEventLabelToReferenceType(normalized.eventType ?? normalized.tags?.[0])) {
    return false;
  }

  if (object.before && object.after) {
    const movement = resolveTimelineMovementPair({
      before: object.before,
      after: object.after,
    });
    if (!movement.before || !movement.after) {
      return false;
    }
  }

  return true;
}

export function hasValidTimelineGroupStructure(groups: OrvekTimelineGroup[] | undefined): boolean {
  if (!groups || groups.length !== REFERENCE_TIMELINE_GROUP_HEADINGS.length) {
    return false;
  }

  for (let index = 0; index < REFERENCE_TIMELINE_GROUP_HEADINGS.length; index += 1) {
    if (groups[index]?.heading !== REFERENCE_TIMELINE_GROUP_HEADINGS[index]) {
      return false;
    }
  }

  return groups.some((group) => group.ids.length > 0);
}

export function hasReferenceTimelineFilters(filters: string[] | undefined): boolean {
  if (!filters || filters.length !== REFERENCE_TIMELINE_FILTERS.length) {
    return false;
  }

  return REFERENCE_TIMELINE_FILTERS.every((label, index) => filters[index] === label);
}

function collectTimelineRowIds(api: OrvekDataApi): string[] {
  return Array.from(new Set(api.timelineGroups?.flatMap((group) => group.ids) ?? []));
}

export function findDuplicateTimelineMovementRowIds(api: OrvekDataApi): string[] {
  const rowIds = collectTimelineRowIds(api);
  const modelRowByUpdateId = new Map<string, string>();
  const duplicates: string[] = [];

  for (const id of rowIds) {
    if (!id.startsWith("model-")) {
      continue;
    }

    const updateId = id.slice("model-".length);
    if (updateId) {
      modelRowByUpdateId.set(updateId, id);
    }
  }

  for (const id of rowIds) {
    const object = api.getObject(id);
    if (!object?.inspectorObjectId || object.inspectorObjectType !== "model_update") {
      continue;
    }

    const canonicalRowId = modelRowByUpdateId.get(object.inspectorObjectId);
    if (canonicalRowId && canonicalRowId !== id) {
      duplicates.push(id);
    }
  }

  return duplicates;
}

export function dedupeTimelineMovementRowIds(api: OrvekDataApi): Set<string> {
  return new Set(findDuplicateTimelineMovementRowIds(api));
}

function pruneTimelineGroups(
  groups: OrvekTimelineGroup[],
  idsToRemove: Set<string>,
): OrvekTimelineGroup[] {
  return groups.map((group) => ({
    ...group,
    ids: group.ids.filter((id) => !idsToRemove.has(id)),
  }));
}

export function isTimelinePresentationReady(api: OrvekDataApi | undefined): boolean {
  if (!api || api.timelineIsLoading) {
    return false;
  }

  if (!hasValidTimelineGroupStructure(api.timelineGroups)) {
    return false;
  }

  if (!hasReferenceTimelineFilters(api.timelineFilters)) {
    return false;
  }

  const rowIds = collectTimelineRowIds(api);
  if (rowIds.length < MIN_TIMELINE_READY_ROW_COUNT) {
    return false;
  }

  if (findDuplicateTimelineMovementRowIds(api).length > 0) {
    return false;
  }

  for (const id of rowIds) {
    const object = api.getObject(id);
    if (!object || !isTimelineRowPresentationReady(object)) {
      return false;
    }
  }

  return true;
}

export function shouldMergeTimelineProductionApi(api: OrvekDataApi | undefined): boolean {
  if (!api || api.timelineIsLoading) {
    return false;
  }

  return isTimelinePresentationReady(normalizeTimelineProductionDataApi(api));
}

export function normalizeTimelineProductionDataApi(api: OrvekDataApi): OrvekDataApi {
  const duplicateRowIds = dedupeTimelineMovementRowIds(api);
  const timelineGroups = pruneTimelineGroups(api.timelineGroups ?? [], duplicateRowIds);
  const objectIds = new Set(collectTimelineRowIds({ ...api, timelineGroups }));
  const normalizedObjects = new Map<string, OrvekObject>();

  for (const id of objectIds) {
    const object = api.getObject(id);
    if (object) {
      normalizedObjects.set(id, normalizeTimelineOrvekObject(object));
    }
  }

  return {
    ...api,
    timelineGroups,
    timelineFilters: [...REFERENCE_TIMELINE_FILTERS],
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      if (normalizedObjects.has(id)) {
        return normalizedObjects.get(id);
      }
      const object = api.getObject(id);
      return object ? normalizeTimelineOrvekObject(object) : undefined;
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = normalizedObjects.get(id) ?? api.getObject(id);
        if (object) {
          resolved.push(normalizeTimelineOrvekObject(object));
        }
      }

      return resolved;
    },
  };
}
