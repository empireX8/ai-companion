import type { V0TodayHeroSlot } from "../../orvek-adapters/types";
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
import {
  buildParitySafeMovementObjects,
  buildParitySafeReportObjects,
  canUseLiveTodayMovementRow,
  canUseLiveTodayReport,
  canUseLiveTodaySeeWhyMoved,
  getParitySafeMovementTargets,
  hasOpenableReportObject,
  hasRecordedBeforeAfterMovement,
  REFERENCE_WEEKLY_REPORT_ID,
  resolveLiveReportTarget,
  type LiveMovementTarget,
  type LiveReportTarget,
} from "./today-movement-report-parity";

export { REFERENCE_WEEKLY_REPORT_ID } from "./today-movement-report-parity";

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
  paritySafeMovementTargets: LiveMovementTarget[];
  reportReady: boolean;
  reportId: string | null;
  paritySafeReportTarget: LiveReportTarget | null;
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

export {
  buildParitySafeMovementObjects,
  buildParitySafeReportObjects,
  canUseLiveTodayMovementRow,
  canUseLiveTodayReport,
  canUseLiveTodaySeeWhyMoved,
  getParitySafeMovementTargets,
  hasInspectableMovementDelta,
  hasMeaningfulReportContent,
  hasOpenableReportObject,
  hasRecordedBeforeAfterMovement,
  isBlockedAsMovementTarget,
  isMovementObject,
  isReferenceReportSlotWithoutLiveObject,
  isReportObject,
  mustNotSubstituteGlobalMovementForSelectedObject,
  resolveLiveMovementTarget,
  resolveLiveReportTarget,
  resolveSelectedObjectMovementTarget,
  type LiveMovementTarget,
  type LiveReportTarget,
} from "./today-movement-report-parity";

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

export function hasInspectableEvidenceContent(object: OrvekObject | undefined): boolean {
  return hasInspectableEvidencePointerContent(object);
}

export function isEvidencePointerInspectable(
  api: OrvekDataApi,
  objectId: string | null | undefined,
): boolean {
  return canUseLiveTodayEvidencePointer(api, objectId);
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
  const paritySafeMovementTargets = getParitySafeMovementTargets(api);

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
    paritySafeMovementTargets,
    reportReady: canUseLiveTodayReport(api, reportId),
    reportId,
    paritySafeReportTarget: resolveLiveReportTarget(api, reportId),
    ...movementAssessment,
    paritySafeObjectCount: paritySafeObjects.size,
  };
}

export function buildParitySafeTodayObjectMap(api: OrvekDataApi): Map<string, OrvekObject> {
  const objects = new Map<string, OrvekObject>();

  for (const [id, object] of buildParitySafeEvidencePointerObjects(api)) {
    objects.set(id, object);
  }

  for (const [id, object] of buildParitySafeMovementObjects(api)) {
    objects.set(id, object);
  }

  for (const [id, object] of buildParitySafeReportObjects(api)) {
    objects.set(id, object);
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
