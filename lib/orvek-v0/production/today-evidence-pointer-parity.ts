import type { OrvekDataApi } from "../data-provider";
import type { OrvekObject } from "../orvek-types";

export type LiveEvidencePointerTarget = {
  objectId: string;
  inspectorTab: "evidence";
  sourceText: string;
  provenanceLabel: string;
};

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

export function isReceiptEvidencePointerObject(
  object: OrvekObject | undefined,
): object is OrvekObject & { type: "receipt" } {
  return object?.type === "receipt";
}

export function hasInspectableEvidencePointerSourceText(
  object: OrvekObject | undefined,
): boolean {
  if (!object) {
    return false;
  }

  const sourceText = object.sourceText?.trim();
  return Boolean(sourceText && sourceText !== "Receipt");
}

export function hasEvidencePointerProvenance(object: OrvekObject | undefined): boolean {
  if (!object) {
    return false;
  }

  const date = object.date?.trim() || object.lastUpdated?.trim();
  if (date) {
    return true;
  }

  const origin = object.sourceOrigin?.trim();
  return Boolean(origin && origin !== "Receipt");
}

export function hasInspectableEvidencePointerContent(
  object: OrvekObject | undefined,
): boolean {
  return (
    isReceiptEvidencePointerObject(object) &&
    hasInspectableEvidencePointerSourceText(object) &&
    hasEvidencePointerProvenance(object)
  );
}

export function formatEvidencePointerProvenanceLabel(object: OrvekObject): string {
  const origin = object.sourceOrigin?.trim() || "Receipt";
  const date = object.date?.trim() || object.lastUpdated?.trim();
  return date ? `${origin} · ${date}` : origin;
}

export function canUseLiveTodayEvidencePointer(
  api: OrvekDataApi,
  objectId: string | null | undefined,
): boolean {
  if (!objectId) {
    return false;
  }

  return hasInspectableEvidencePointerContent(api.getObject(objectId));
}

export function filterInspectableEvidencePointerIds(
  api: OrvekDataApi,
  ids: string[] | undefined,
): string[] {
  return normalizeIds(ids).filter((id) => canUseLiveTodayEvidencePointer(api, id));
}

export function getInspectableEvidencePointers(
  api: OrvekDataApi,
  ids?: string[] | undefined,
): LiveEvidencePointerTarget[] {
  const targets: LiveEvidencePointerTarget[] = [];

  for (const objectId of filterInspectableEvidencePointerIds(api, ids ?? api.todayResurfacedIds)) {
    const object = api.getObject(objectId);
    if (!object || !hasInspectableEvidencePointerContent(object)) {
      continue;
    }

    targets.push({
      objectId,
      inspectorTab: "evidence",
      sourceText: object.sourceText!.trim(),
      provenanceLabel: formatEvidencePointerProvenanceLabel(object),
    });
  }

  return targets;
}

export function resolveLiveEvidencePointerTarget(
  api: OrvekDataApi,
  objectId: string | null | undefined,
): LiveEvidencePointerTarget | null {
  if (!canUseLiveTodayEvidencePointer(api, objectId) || !objectId) {
    return null;
  }

  const object = api.getObject(objectId);
  if (!object || !hasInspectableEvidencePointerContent(object)) {
    return null;
  }

  return {
    objectId,
    inspectorTab: "evidence",
    sourceText: object.sourceText!.trim(),
    provenanceLabel: formatEvidencePointerProvenanceLabel(object),
  };
}

export function buildParitySafeEvidencePointerObjects(
  api: OrvekDataApi,
): Map<string, OrvekObject> {
  const objects = new Map<string, OrvekObject>();

  for (const id of filterInspectableEvidencePointerIds(api, api.todayResurfacedIds)) {
    const object = api.getObject(id);
    if (object && isReceiptEvidencePointerObject(object)) {
      objects.set(id, object);
    }
  }

  return objects;
}

export function canUseLiveTodayEvidencePointerList(
  api: OrvekDataApi,
  ids: string[] | undefined,
): boolean {
  const normalized = normalizeIds(ids);
  if (normalized.length === 0) {
    return false;
  }

  return normalized.every((id) => canUseLiveTodayEvidencePointer(api, id));
}

/** Evidence counts or movement ids alone do not qualify as evidence pointers. */
export function isBlockedAsEvidencePointer(api: OrvekDataApi, objectId: string): boolean {
  const object = api.getObject(objectId);
  if (!object) {
    return true;
  }

  if (!isReceiptEvidencePointerObject(object)) {
    return true;
  }

  return !hasInspectableEvidencePointerContent(object);
}
