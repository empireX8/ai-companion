/**
 * Adapter that bridges contradiction data shapes (ContradictionListItem,
 * ContradictionDetail, ContradictionListItemSource) to the computed-title
 * formatter so every surface displays pull-vs-pull titles.
 *
 * Step 15E — do not delete.
 */
import { formatContradictionPrimaryTitle } from "./pattern-contradiction-title";
import type { PatternContradictionView } from "./patterns-api";

/**
 * Minimal shape needed to compute a title.
 * Satisfied by ContradictionListItem, ContradictionDetail,
 * ContradictionListItemSource, and raw DB rows.
 */
export interface TitleableContradiction {
  id: string;
  title: string;
  sideA?: string;
  sideB?: string;
  type?: string;
  status: string;
  lastEvidenceAt?: string | null;
  lastTouchedAt?: string;
}

/**
 * Compute a pull-vs-pull title for any contradiction-shaped object.
 * Falls back to the raw title if summarisation fails.
 */
export function computeContradictionTitle(
  item: TitleableContradiction
): string {
  const view: PatternContradictionView = {
    id: item.id,
    title: item.title,
    sideA: item.sideA ?? "",
    sideB: item.sideB ?? "",
    type: item.type ?? "",
    status: item.status as PatternContradictionView["status"],
    lastEvidenceAt: item.lastEvidenceAt ?? null,
    lastTouchedAt: item.lastTouchedAt ?? new Date().toISOString(),
  };
  return formatContradictionPrimaryTitle(view);
}
