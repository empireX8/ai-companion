import { isProductionDisplay } from "../display-contract";
import type { OrvekDataApi } from "../data-provider";

/**
 * Live Today presentation without a global displayContract flip.
 * Activated when production Today props were merged onto the hybrid API and
 * movement/report parity reports readiness — same pattern as hasLiveQuestions.
 */
export function hasLiveTodayPresentation(api: OrvekDataApi): boolean {
  if (isProductionDisplay(api)) {
    return true;
  }

  const parity = api.todayObjectGraphParity;
  if (!parity || !api.today) {
    return false;
  }

  return (
    parity.movementRowsReady ||
    parity.reportReady ||
    parity.readyMovementRowIds.length > 0 ||
    parity.seeWhyMovedReady ||
    Boolean(parity.paritySafeReportTarget)
  );
}
