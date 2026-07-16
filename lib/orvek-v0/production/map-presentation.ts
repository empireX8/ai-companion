import {
  V0_MAP_ONTOLOGY_RAIL_LABELS,
  V0_MAP_ONTOLOGY_RAIL_ORDER,
} from "../../orvek-adapters/map";
import type { OrvekDataApi, OrvekMapCategory } from "../data-provider";
import type { OrvekObject } from "../orvek-types";

export const MAP_TITLE_MAX_LENGTH = 120;
export const MAP_SUMMARY_MAX_LENGTH = 200;
export const MAP_BULLET_MAX_LENGTH = 140;
export const MAP_BULLETS_MAX_COUNT = 4;
export const MAP_RAW_TEXT_REJECT_LENGTH = 320;

const PLACEHOLDER_BEFORE_COPY = "Previously held understanding";
const LINKED_PATH_PREFIX = "Linked path:";

const RAW_TEXT_PATTERNS = [
  /\b(?:Error|Exception|Traceback|TypeError|ReferenceError|SyntaxError|Cannot\s+(?:find|read)|undefined\s+is\s+not)\b/,
  /^[$%#>]\s/m,
];

export function collapseMapDisplayWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeMapTitle(value: string | null | undefined): string | null {
  const collapsed = collapseMapDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= MAP_TITLE_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, MAP_TITLE_MAX_LENGTH - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > MAP_TITLE_MAX_LENGTH * 0.6
      ? truncated.slice(0, lastSpace)
      : truncated;
  return `${safe}…`;
}

export function normalizeMapSummary(value: string | null | undefined): string | null {
  const collapsed = collapseMapDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return null;
  }

  if (collapsed.length <= MAP_SUMMARY_MAX_LENGTH) {
    return collapsed;
  }

  const truncated = collapsed.slice(0, MAP_SUMMARY_MAX_LENGTH - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const safe =
    lastSpace > MAP_SUMMARY_MAX_LENGTH * 0.6
      ? truncated.slice(0, lastSpace)
      : truncated;
  return `${safe}…`;
}

export function looksLikeUnsafeRawMapText(value: string | null | undefined): boolean {
  const collapsed = collapseMapDisplayWhitespace(value ?? "");
  if (!collapsed) {
    return false;
  }

  if (collapsed.length > MAP_RAW_TEXT_REJECT_LENGTH) {
    return true;
  }

  return RAW_TEXT_PATTERNS.some((pattern) => pattern.test(collapsed));
}

export function areMapTextsNearIdentical(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = collapseMapDisplayWhitespace(left ?? "").toLowerCase();
  const normalizedRight = collapseMapDisplayWhitespace(right ?? "").toLowerCase();

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

export function normalizeMapBullets(
  bullets: string[] | null | undefined,
): string[] | undefined {
  const normalized: string[] = [];

  for (const bullet of bullets ?? []) {
    const collapsed = collapseMapDisplayWhitespace(bullet);
    if (!collapsed || collapsed.startsWith(LINKED_PATH_PREFIX)) {
      continue;
    }

    if (looksLikeUnsafeRawMapText(collapsed)) {
      continue;
    }

    const capped =
      collapsed.length <= MAP_BULLET_MAX_LENGTH
        ? collapsed
        : `${collapsed.slice(0, MAP_BULLET_MAX_LENGTH - 1).trimEnd()}…`;

    normalized.push(capped);
    if (normalized.length >= MAP_BULLETS_MAX_COUNT) {
      break;
    }
  }

  return normalized.length > 0 ? normalized : undefined;
}

export function resolveMapMovementPair(input: {
  before?: string | null;
  after?: string | null;
}): { before?: string; after?: string } {
  const before = normalizeMapSummary(input.before);
  const after = normalizeMapSummary(input.after);

  if (!before || !after) {
    return {};
  }

  if (before === PLACEHOLDER_BEFORE_COPY) {
    return {};
  }

  if (areMapTextsNearIdentical(before, after)) {
    return {};
  }

  return { before, after };
}

export function normalizeMapOrvekObject(object: OrvekObject): OrvekObject {
  const title = normalizeMapTitle(object.title) ?? object.title;
  const summary = normalizeMapSummary(object.summary);
  const recommendation =
    object.recommendation && !areMapTextsNearIdentical(object.recommendation, summary)
      ? normalizeMapSummary(object.recommendation) ?? undefined
      : undefined;
  const whyItMatters =
    object.whyItMatters &&
    !areMapTextsNearIdentical(object.whyItMatters, summary) &&
    !areMapTextsNearIdentical(object.whyItMatters, recommendation)
      ? normalizeMapSummary(object.whyItMatters) ?? undefined
      : undefined;
  const movement = resolveMapMovementPair({
    before: object.before,
    after: object.after,
  });

  return {
    ...object,
    title,
    summary: summary ?? undefined,
    recommendation,
    whyItMatters,
    supporting: normalizeMapBullets(object.supporting),
    conflicting: normalizeMapBullets(object.conflicting),
    missingEvidence: normalizeMapBullets(object.missingEvidence),
    before: movement.before,
    after: movement.after,
  };
}

function isRelatedOnlyMapObject(object: OrvekObject): boolean {
  return (
    !object.summary &&
    !object.recommendation &&
    !object.before &&
    !object.after &&
    !object.supporting?.length &&
    !object.conflicting?.length &&
    (object.evidenceCount ?? 0) === 0
  );
}

export function isMapObjectPresentationReady(object: OrvekObject): boolean {
  if (looksLikeUnsafeRawMapText(object.title) || looksLikeUnsafeRawMapText(object.summary)) {
    return false;
  }

  if (isRelatedOnlyMapObject(object)) {
    return Boolean(normalizeMapTitle(object.title));
  }

  const normalized = normalizeMapOrvekObject(object);

  if (!normalizeMapTitle(normalized.title)) {
    return false;
  }

  if (object.before || object.after) {
    const movement = resolveMapMovementPair({
      before: object.before,
      after: object.after,
    });
    if (!movement.before || !movement.after) {
      return false;
    }
  }

  const isDetailLike =
    object.inspectorObjectType === "usermap_conclusion" &&
    object.relatedIds !== undefined;

  if (isDetailLike) {
    if ((object.evidenceCount ?? 0) > 0 && !normalized.supporting?.length) {
      return false;
    }

    if (object.conflicting !== undefined && !normalized.conflicting?.length) {
      return false;
    }

    if (!normalized.summary) {
      return false;
    }
  }

  return Boolean(normalized.summary || normalized.whyItMatters || normalized.title);
}

export function hasValidMapCategoryStructure(categories: OrvekMapCategory[] | undefined): boolean {
  if (!categories || categories.length !== V0_MAP_ONTOLOGY_RAIL_ORDER.length) {
    return false;
  }

  for (let index = 0; index < V0_MAP_ONTOLOGY_RAIL_ORDER.length; index += 1) {
    const expectedKey = V0_MAP_ONTOLOGY_RAIL_ORDER[index];
    const category = categories[index];

    if (category.id !== expectedKey) {
      return false;
    }

    if (category.label !== V0_MAP_ONTOLOGY_RAIL_LABELS[expectedKey]) {
      return false;
    }
  }

  return categories.some((category) => category.ids.length > 0);
}

export function isMapPresentationReady(api: OrvekDataApi | undefined): boolean {
  if (!api) {
    return false;
  }

  if (!api.mapHasContent) {
    return false;
  }

  if (api.mapLoadError) {
    return false;
  }

  if (api.mapIsLoading) {
    return false;
  }

  if (!hasValidMapCategoryStructure(api.mapCategories)) {
    return false;
  }

  const objectIds = Array.from(
    new Set(api.mapCategories?.flatMap((category) => category.ids) ?? []),
  );

  if (objectIds.length === 0) {
    return false;
  }

  for (const id of objectIds) {
    const object = api.getObject(id);
    if (!object || !isMapObjectPresentationReady(object)) {
      return false;
    }
  }

  return true;
}

export function shouldMergeMapProductionApi(api: OrvekDataApi | undefined): boolean {
  return isMapPresentationReady(api);
}

export function normalizeMapProductionDataApi(api: OrvekDataApi): OrvekDataApi {
  const objectIds = new Set<string>();

  for (const category of api.mapCategories ?? []) {
    for (const id of category.ids) {
      objectIds.add(id);
    }
  }

  if (api.mapSelectedId) {
    objectIds.add(api.mapSelectedId);
  }

  const normalizedObjects = new Map<string, OrvekObject>();

  for (const id of objectIds) {
    const object = api.getObject(id);
    if (object) {
      normalizedObjects.set(id, normalizeMapOrvekObject(object));
    }
  }

  return {
    ...api,
    getObject: (id) => {
      if (!id) {
        return undefined;
      }
      if (normalizedObjects.has(id)) {
        return normalizedObjects.get(id);
      }
      const object = api.getObject(id);
      return object ? normalizeMapOrvekObject(object) : undefined;
    },
    getObjects: (ids) => {
      const resolved: OrvekObject[] = [];

      for (const id of ids ?? []) {
        if (!id) {
          continue;
        }
        const object = normalizedObjects.get(id) ?? api.getObject(id);
        if (object) {
          resolved.push(normalizeMapOrvekObject(object));
        }
      }

      return resolved;
    },
  };
}
