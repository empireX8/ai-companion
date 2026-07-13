import type { V0TodayMovementRow } from "../../orvek-adapters/types";
import type { OrvekDataApi } from "../data-provider";
import type { OrvekObject } from "../orvek-types";
import {
  isCanonicalMovementReportObject,
  resolveSelectedMovementReportId,
} from "../../model-movement-report-contract";
import { TODAY_RESULT_STATE_UNAVAILABLE_COPY } from "../../orvek-adapters/today";

export const REFERENCE_WEEKLY_REPORT_ID = "rep-weekly";

export type LiveMovementTarget = {
  objectId: string;
  inspectorTab: "movement";
  before: string;
  after: string;
  provenanceLabel: string;
};

export type LiveReportTarget = {
  reportId: string;
  openable: true;
  title: string;
  provenanceLabel: string;
};

export function isMovementObject(
  object: OrvekObject | undefined,
): object is OrvekObject & { type: "model-update" } {
  return object?.type === "model-update";
}

export function hasRecordedBeforeAfterMovement(
  object: OrvekObject | undefined,
): boolean {
  if (!object) {
    return false;
  }

  return Boolean(object.before?.trim() && object.after?.trim());
}

export function hasInspectableMovementDelta(
  object: OrvekObject | undefined,
): boolean {
  return isMovementObject(object) && hasRecordedBeforeAfterMovement(object);
}

export function formatMovementProvenanceLabel(object: OrvekObject): string {
  return object.lastUpdated?.trim() || object.eventType?.trim() || "Model movement";
}

export function canUseLiveTodaySeeWhyMoved(
  api: OrvekDataApi,
  movementId: string | null | undefined,
): boolean {
  if (!movementId) {
    return false;
  }

  return hasInspectableMovementDelta(api.getObject(movementId));
}

export function canUseLiveTodayMovementRow(
  api: OrvekDataApi,
  row: V0TodayMovementRow,
): boolean {
  if (!row.id || !row.updated?.trim()) {
    return false;
  }

  if (row.updated.trim() === TODAY_RESULT_STATE_UNAVAILABLE_COPY) {
    return false;
  }

  return canUseLiveTodaySeeWhyMoved(api, row.id);
}

export function resolveLiveMovementTarget(
  api: OrvekDataApi,
  movementId: string | null | undefined,
): LiveMovementTarget | null {
  if (!canUseLiveTodaySeeWhyMoved(api, movementId) || !movementId) {
    return null;
  }

  const object = api.getObject(movementId);
  if (!object || !hasInspectableMovementDelta(object)) {
    return null;
  }

  return {
    objectId: movementId,
    inspectorTab: "movement",
    before: object.before!.trim(),
    after: object.after!.trim(),
    provenanceLabel: formatMovementProvenanceLabel(object),
  };
}

export function resolveSelectedObjectMovementTarget(
  api: OrvekDataApi,
  selectedObjectId: string | null | undefined,
): LiveMovementTarget | null {
  return resolveLiveMovementTarget(api, selectedObjectId);
}

export function getParitySafeMovementTargets(api: OrvekDataApi): LiveMovementTarget[] {
  const targets: LiveMovementTarget[] = [];
  const seen = new Set<string>();

  for (const row of api.today?.movements ?? []) {
    const target = resolveLiveMovementTarget(api, row.id);
    if (!target || seen.has(target.objectId)) {
      continue;
    }
    seen.add(target.objectId);
    targets.push(target);
  }

  const heroMovementId = api.today?.hero?.movementId;
  const heroTarget = resolveLiveMovementTarget(api, heroMovementId);
  if (heroTarget && !seen.has(heroTarget.objectId)) {
    targets.push(heroTarget);
  }

  return targets;
}

export function buildParitySafeMovementObjects(api: OrvekDataApi): Map<string, OrvekObject> {
  const objects = new Map<string, OrvekObject>();

  for (const target of getParitySafeMovementTargets(api)) {
    const object = api.getObject(target.objectId);
    if (object && hasInspectableMovementDelta(object)) {
      objects.set(target.objectId, object);
    }
  }

  return objects;
}

/**
 * Selected-object movement must come from the selected id's own recorded delta —
 * not from unrelated global recent movement ids.
 */
export function mustNotSubstituteGlobalMovementForSelectedObject(
  api: OrvekDataApi,
  selectedObjectId: string | null | undefined,
  globalMovementIds: string[] | undefined,
): boolean {
  if (!selectedObjectId) {
    return true;
  }

  if (canUseLiveTodaySeeWhyMoved(api, selectedObjectId)) {
    return true;
  }

  const globalIds = globalMovementIds ?? [];
  return !globalIds.some(
    (id) => id !== selectedObjectId && canUseLiveTodaySeeWhyMoved(api, id),
  );
}

export function isReportObject(
  object: OrvekObject | undefined,
): object is OrvekObject & { type: "report" } {
  return object?.type === "report";
}

export function hasMeaningfulReportContent(object: OrvekObject | undefined): boolean {
  if (!object) {
    return false;
  }

  if (isCanonicalMovementReportObject(object)) {
    return Boolean(object.title?.trim() && object.reportSummary?.trim());
  }

  if (!isReportObject(object)) {
    return false;
  }

  if (!object.title?.trim()) {
    return false;
  }

  return Boolean(object.summary?.trim() || object.reportSummary?.trim());
}

export function hasOpenableReportObject(
  api: OrvekDataApi,
  reportId: string | null | undefined,
): boolean {
  if (!reportId) {
    return false;
  }

  return hasMeaningfulReportContent(api.getObject(reportId));
}

export function isReferenceReportSlotWithoutLiveObject(
  api: OrvekDataApi,
  reportId: string | null | undefined,
): boolean {
  if (!reportId || reportId !== REFERENCE_WEEKLY_REPORT_ID) {
    return false;
  }

  return !hasOpenableReportObject(api, reportId);
}

export function canUseLiveTodayReport(
  api: OrvekDataApi,
  reportId?: string | null | undefined,
): boolean {
  const resolvedId = reportId ?? api.today?.report?.reportId ?? api.today?.hero?.reportId ?? null;
  if (!resolvedId) {
    return false;
  }

  return hasOpenableReportObject(api, resolvedId);
}

export function resolveLiveReportTarget(
  api: OrvekDataApi,
  reportId?: string | null | undefined,
): LiveReportTarget | null {
  const resolvedId = reportId ?? api.today?.report?.reportId ?? api.today?.hero?.reportId ?? null;
  if (!canUseLiveTodayReport(api, resolvedId) || !resolvedId) {
    return null;
  }

  const report = api.getObject(resolvedId);
  if (!report || !hasMeaningfulReportContent(report)) {
    return null;
  }

  const provenanceLabel =
    report.period?.trim() ||
    report.reportType?.trim() ||
    report.lastUpdated?.trim() ||
    "What Changed report";

  return {
    reportId: resolveSelectedMovementReportId(report) ?? resolvedId,
    openable: true,
    title: report.title.trim(),
    provenanceLabel,
  };
}

export function buildParitySafeReportObjects(api: OrvekDataApi): Map<string, OrvekObject> {
  const objects = new Map<string, OrvekObject>();
  const candidateIds = [api.today?.report?.reportId, api.today?.hero?.reportId].filter(
    (id): id is string => Boolean(id?.trim()),
  );

  for (const reportId of candidateIds) {
    if (!canUseLiveTodayReport(api, reportId)) {
      continue;
    }
    const report = api.getObject(reportId);
    if (report && hasMeaningfulReportContent(report)) {
      objects.set(reportId, report);
    }
  }

  return objects;
}

export function isBlockedAsMovementTarget(api: OrvekDataApi, objectId: string): boolean {
  return !canUseLiveTodaySeeWhyMoved(api, objectId);
}
