import type {
  CanonicalModelMovementReportRecord,
  CanonicalTodayCompositionPayload,
} from "./canonical-today-composition-contract";
import type { CanonicalWorkbenchBundle } from "./canonical-today-composition";

export const CANONICAL_TODAY_COMPOSITION_ENDPOINT =
  "/api/canonical-today-composition";

export async function fetchCanonicalWorkbenchBundle(): Promise<CanonicalWorkbenchBundle | null> {
  const res = await fetch(CANONICAL_TODAY_COMPOSITION_ENDPOINT, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) {
    return null;
  }
  const body = (await res.json()) as {
    composition: CanonicalTodayCompositionPayload | null;
    report: CanonicalModelMovementReportRecord | null;
  };
  if (!body.composition) {
    return null;
  }
  return {
    composition: body.composition,
    report: body.report,
  };
}
