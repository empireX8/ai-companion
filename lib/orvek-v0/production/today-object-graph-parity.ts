import type { V0TodayHeroSlot, V0TodayMovementRow } from "../../orvek-adapters/types";
import type { OrvekDataApi } from "../data-provider";
import type { OrvekObject } from "../orvek-types";
import {
  buildParitySafeEvidencePointerObjects,
  canUseLiveTodayEvidencePointer,
  canUseLiveTodayEvidencePointerList,
  filterInspectableEvidencePointerIds,
  getInspectableEvidencePointers,
  hasInspectableEvidencePointerContent,
  type LiveEvidencePointerTarget,
} from "./today-evidence-pointer-parity";

export const REFERENCE_WEEKLY_REPORT_ID = "rep-weekly";

export type LiveTodayGraphParity = {
  /** True only when every resurfaced id is an inspectable evidence-pointer row. */
  evidencePointerListReady: boolean;
  inspectableEvidencePointerIds: string[];
  blockedEvidencePointerIds: string[];
  paritySafeEvidencePointers: LiveEvidencePointerTarget[];
  heroReady: boolean;
  heroBlockers: string[];
  seeWhyMovedReady: boolean;
  seeWhyMovementId: string | null;
  reportReady: boolean;
  reportId: string | null;
  movementRowsReady: boolean;
  readyMovementRowIds: string[];
  blockedMovementRowIds: string[];
  /** Any parity-safe object may be merged into the hybrid graph without UI flip. */
  paritySafeObjectCount: number;
};

export {
  buildParitySafeEvidencePointerObjects,
  canUseLiveTodayEvidencePointer,
  canUseLiveTodayEvidencePointerList,
  filterInspectableEvidencePointerIds,
  getInspectableEvidencePointers,
  hasInspectableEvidencePointerContent,
  isBlockedAsEvidencePointer,
  isReceiptEvidencePointerObject,
  resolveLiveEvidencePointerTarget,
  type LiveEvidencePointerTarget,
} from "./today-evidence-pointer-parity";

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

export function hasRecordedBeforeAfterMovement(
  object: OrvekObject | undefined,
): boolean {
  if (!object) {
    return false;
  }

  return Boolean(object.before?.trim() || object.after?.trim());
}

export function hasInspectableEvidenceContent(object: OrvekObject | undefined): boolean {
  return hasInspectableEvidencePointerContent(object);
}

export function isEvidencePointerInspectable(
  api: OrvekDataApi,
  objectId: string | null | undefined,
): boolean {
  return canUseLiveTodayEvidencePointer(api, objectId);
}

export function canUseLiveTodaySeeWhyMoved(
  api: OrvekDataApi,
  movementId: string | null | undefined,
): boolean {
  if (!movementId) {
    return false;
  }

  return hasRecordedBeforeAfterMovement(api.getObject(movementId));
}

export function hasOpenableReportObject(
  api: OrvekDataApi,
  reportId: string | null | undefined,
): boolean {
  if (!reportId) {
    return false;
  }

  const report = api.getObject(reportId);
  return report?.type === "report" && Boolean(report.title?.trim());
}

function hasInspectableHeroTarget(api: OrvekDataApi, hero: V0TodayHeroSlot): boolean {
  const inspectId = hero.inspectSelectId ?? hero.selectionId;
  if (!inspectId) {
    return false;
  }

  const object = api.getObject(inspectId);
  return Boolean(object?.title?.trim());
}

export function canUseLiveTodayHero(api: OrvekDataApi): boolean {
  const hero = api.today?.hero;
  if (!hero) {
    return false;
  }

  if (!hasInspectableHeroTarget(api, hero)) {
    return false;
  }

  if (hero.showSeeWhyMoved && !canUseLiveTodaySeeWhyMoved(api, hero.movementId)) {
    return false;
  }

  return true;
}

export function canUseLiveTodayMovementRow(
  api: OrvekDataApi,
  row: V0TodayMovementRow,
): boolean {
  if (!row.id || !row.updated?.trim()) {
    return false;
  }

  if (row.previous?.trim()) {
    return canUseLiveTodaySeeWhyMoved(api, row.id);
  }

  return hasRecordedBeforeAfterMovement(api.getObject(row.id));
}

function assessMovementRows(api: OrvekDataApi): Pick<
  LiveTodayGraphParity,
  "movementRowsReady" | "readyMovementRowIds" | "blockedMovementRowIds"
> {
  const readyMovementRowIds: string[] = [];
  const blockedMovementRowIds: string[] = [];

  for (const row of api.today?.movements ?? []) {
    if (canUseLiveTodayMovementRow(api, row)) {
      readyMovementRowIds.push(row.id);
    } else if (row.id) {
      blockedMovementRowIds.push(row.id);
    }
  }

  return {
    movementRowsReady:
      (api.today?.movements.length ?? 0) > 0 &&
      blockedMovementRowIds.length === 0 &&
      readyMovementRowIds.length > 0,
    readyMovementRowIds,
    blockedMovementRowIds,
  };
}

export function assessLiveTodayObjectGraphParity(api: OrvekDataApi): LiveTodayGraphParity {
  const resurfacedIds = normalizeIds(api.todayResurfacedIds);
  const inspectableEvidencePointerIds = filterInspectableEvidencePointerIds(api, resurfacedIds);
  const blockedEvidencePointerIds = resurfacedIds.filter(
    (id) => !inspectableEvidencePointerIds.includes(id),
  );
  const paritySafeEvidencePointers = getInspectableEvidencePointers(api, resurfacedIds);

  const hero = api.today?.hero;
  const heroBlockers: string[] = [];
  if (!hero) {
    heroBlockers.push("missing_hero");
  } else {
    if (!hasInspectableHeroTarget(api, hero)) {
      heroBlockers.push("hero_inspect_target_missing");
    }
    if (hero.showSeeWhyMoved && !canUseLiveTodaySeeWhyMoved(api, hero.movementId)) {
      heroBlockers.push("see_why_without_before_after");
    }
  }

  const reportId = hero?.reportId ?? api.today?.report?.reportId ?? null;
  const movementAssessment = assessMovementRows(api);
  const paritySafeObjects = buildParitySafeTodayObjectMap(api);

  return {
    evidencePointerListReady: canUseLiveTodayEvidencePointerList(api, resurfacedIds),
    inspectableEvidencePointerIds,
    blockedEvidencePointerIds,
    paritySafeEvidencePointers,
    heroReady: canUseLiveTodayHero(api),
    heroBlockers,
    seeWhyMovedReady: canUseLiveTodaySeeWhyMoved(api, hero?.movementId),
    seeWhyMovementId: hero?.movementId ?? null,
    reportReady: hasOpenableReportObject(api, reportId),
    reportId,
    ...movementAssessment,
    paritySafeObjectCount: paritySafeObjects.size,
  };
}

export function buildParitySafeTodayObjectMap(api: OrvekDataApi): Map<string, OrvekObject> {
  const objects = buildParitySafeEvidencePointerObjects(api);

  for (const row of api.today?.movements ?? []) {
    if (!canUseLiveTodayMovementRow(api, row)) {
      continue;
    }
    const object = api.getObject(row.id);
    if (object) {
      objects.set(row.id, object);
    }
  }

  const hero = api.today?.hero;
  if (hero && canUseLiveTodayHero(api)) {
    for (const id of [hero.inspectSelectId, hero.movementId, hero.selectionId]) {
      if (!id) {
        continue;
      }
      const object = api.getObject(id);
      if (object) {
        objects.set(id, object);
      }
    }
  }

  if (hero?.showSeeWhyMoved && hero.movementId) {
    const movement = api.getObject(hero.movementId);
    if (movement && hasRecordedBeforeAfterMovement(movement)) {
      objects.set(hero.movementId, movement);
    }
  }

  return objects;
}

export function shouldMergeTodayObjectGraph(api: OrvekDataApi | undefined): boolean {
  if (!api) {
    return false;
  }

  return buildParitySafeTodayObjectMap(api).size > 0;
}

export function withTodayObjectGraphParity(
  api: OrvekDataApi,
  parity: LiveTodayGraphParity,
): OrvekDataApi {
  return {
    ...api,
    todayObjectGraphParity: parity,
  };
}
