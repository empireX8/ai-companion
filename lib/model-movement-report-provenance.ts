/**
 * Explicit report provenance labels for the movement/report overlay.
 *
 * LIVE only when the object carries authenticated production ModelUpdate identity
 * (canonicalReportId from the live report builder). Zip / reference reports are
 * REFERENCE / SAMPLE — never labelled live from styling alone.
 */

import type { OrvekObject } from "./orvek-v0/orvek-types";
import { REFERENCE_WEEKLY_REPORT_ID } from "./orvek-v0/production/today-movement-report-parity";

export const LIVE_MODEL_UPDATE_REPORT_PROVENANCE_LABEL =
  "LIVE MODEL UPDATE REPORT" as const;

export const REFERENCE_SAMPLE_REPORT_PROVENANCE_LABEL =
  "REFERENCE / SAMPLE REPORT" as const;

export type ReportOverlayProvenance =
  | "live_model_update"
  | "reference_sample";

export function isReferenceReportObjectId(id: string | null | undefined): boolean {
  if (!id) {
    return false;
  }
  return id === REFERENCE_WEEKLY_REPORT_ID || /^rep-/.test(id);
}

export function resolveReportOverlayProvenance(
  object: OrvekObject | undefined,
): ReportOverlayProvenance | null {
  if (!object) {
    return null;
  }

  if (object.reportProvenance === "live_model_update") {
    return "live_model_update";
  }

  if (object.reportProvenance === "reference_sample") {
    return "reference_sample";
  }

  const canonical = object.canonicalReportId?.trim();
  if (canonical && !isReferenceReportObjectId(canonical) && !isReferenceReportObjectId(object.id)) {
    return "live_model_update";
  }

  if (object.type === "report" || isReferenceReportObjectId(object.id)) {
    return "reference_sample";
  }

  return null;
}

export function reportOverlayProvenanceLabel(
  provenance: ReportOverlayProvenance | null | undefined,
): string | null {
  if (provenance === "live_model_update") {
    return LIVE_MODEL_UPDATE_REPORT_PROVENANCE_LABEL;
  }
  if (provenance === "reference_sample") {
    return REFERENCE_SAMPLE_REPORT_PROVENANCE_LABEL;
  }
  return null;
}
