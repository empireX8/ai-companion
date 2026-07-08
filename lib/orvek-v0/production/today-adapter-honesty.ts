import type { V0TodayViewProps } from "../../orvek-adapters/types";
import type { OrvekDataApi } from "../data-provider";
import {
  canUseLiveTodayEvidencePointerList,
  filterInspectableEvidencePointerIds,
} from "./today-evidence-pointer-parity";
import {
  canUseLiveTodayMovementRow,
  canUseLiveTodayReport,
  canUseLiveTodaySeeWhyMoved,
  resolveLiveMovementTarget,
  resolveLiveReportTarget,
} from "./today-movement-report-parity";

export function shouldExposeSeeWhyMoved(
  api: OrvekDataApi,
  movementId: string | null | undefined,
  inspectSelectId?: string | null,
): boolean {
  if (!movementId || !canUseLiveTodaySeeWhyMoved(api, movementId)) {
    return false;
  }

  const movementTarget = resolveLiveMovementTarget(api, movementId);
  if (!movementTarget) {
    return false;
  }

  if (inspectSelectId && inspectSelectId !== movementId) {
    return Boolean(resolveLiveMovementTarget(api, movementId));
  }

  return true;
}

export function shouldExposeLiveReport(
  api: OrvekDataApi,
  reportId?: string | null,
): boolean {
  return canUseLiveTodayReport(api, reportId);
}

export function shouldExposeEvidencePointerAffordance(api: OrvekDataApi): boolean {
  const ids = filterInspectableEvidencePointerIds(api, api.todayResurfacedIds);
  return canUseLiveTodayEvidencePointerList(api, ids);
}

export function normalizeTodayResurfacedIdsForParity(api: OrvekDataApi): string[] {
  return filterInspectableEvidencePointerIds(api, api.todayResurfacedIds);
}

export function normalizeTodayAffordancesForParity(
  today: V0TodayViewProps,
  api: OrvekDataApi,
): V0TodayViewProps {
  const safeResurfacedIds = normalizeTodayResurfacedIdsForParity(api);
  const evidenceAffordanceReady = shouldExposeEvidencePointerAffordance({
    ...api,
    todayResurfacedIds: safeResurfacedIds,
  });

  let hero = today.hero;
  if (hero) {
    hero = {
      ...hero,
      showSeeWhyMoved: shouldExposeSeeWhyMoved(api, hero.movementId, hero.inspectSelectId),
      linkedReceipts: evidenceAffordanceReady ? hero.linkedReceipts : "—",
      reportId: shouldExposeLiveReport(api, hero.reportId) ? hero.reportId ?? null : null,
    };

    if (hero.primaryAction?.reportId && !shouldExposeLiveReport(api, hero.primaryAction.reportId)) {
      const { reportId: _removed, ...primaryAction } = hero.primaryAction;
      hero = {
        ...hero,
        primaryAction: primaryAction as typeof hero.primaryAction,
      };
    }
  }

  let report = today.report;
  if (report) {
    if (!shouldExposeLiveReport(api, report.reportId)) {
      report = null;
    } else {
      const liveReportTarget = resolveLiveReportTarget(api, report.reportId);
      const primaryMovement =
        report.primaryMovement &&
        shouldExposeSeeWhyMoved(
          api,
          report.primaryMovement.movementId,
          report.primaryMovement.inspectSelectId,
        )
          ? report.primaryMovement
          : null;

      report = {
        ...report,
        reportId: liveReportTarget?.reportId ?? report.reportId,
        fullReportAvailable: Boolean(liveReportTarget),
        primaryMovement,
      };
    }
  }

  const primaryActions = today.primaryActions.map((action) => {
    if (action.reportId && !shouldExposeLiveReport(api, action.reportId)) {
      const { reportId: _removed, ...rest } = action;
      return rest;
    }
    return action;
  });

  const movements = today.movements.filter((row) => canUseLiveTodayMovementRow(api, row));

  return {
    ...today,
    hero,
    report,
    primaryActions,
    movements,
    receipts: today.receipts.filter((receipt) => safeResurfacedIds.includes(receipt.id)),
  };
}

export function withTodayAdapterHonesty(api: OrvekDataApi): OrvekDataApi {
  if (!api.today) {
    return {
      ...api,
      todayResurfacedIds: normalizeTodayResurfacedIdsForParity(api),
    };
  }

  const todayResurfacedIds = normalizeTodayResurfacedIdsForParity(api);
  const honestApi: OrvekDataApi = {
    ...api,
    todayResurfacedIds,
  };

  return {
    ...honestApi,
    today: normalizeTodayAffordancesForParity(api.today, honestApi),
  };
}
