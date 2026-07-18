/**
 * Canonical TopBar model-status card contract (frozen reference authority).
 * These are model-evaluation measures for the living-status cluster —
 * not densograph row counts of map slots.
 */

export const CANONICAL_REFERENCE_MODEL_STATUS_CARD = {
  movementPlaceCount: 4,
  openQuestionCount: 7,
  openReviewCount: 3,
  title: "Model moved · 4 places",
  meta: "7 questions · 3 reviews open",
  compactLabel: "4 moved",
  destination: { kind: "workbench-page" as const, page: "map" as const },
};

export type CanonicalReferenceModelStatusCard =
  typeof CANONICAL_REFERENCE_MODEL_STATUS_CARD;

/** Format title/meta when a card supplies counts but no explicit copy. */
export function formatModelStatusCardCopy(card: {
  movementPlaceCount: number;
  openQuestionCount: number;
  openReviewCount: number;
  title?: string;
  meta?: string;
  compactLabel?: string;
}): { title: string; meta: string; compactLabel: string } {
  const places = card.movementPlaceCount;
  const title =
    card.title?.trim() ||
    `Model moved · ${places} place${places === 1 ? "" : "s"}`;
  const meta =
    card.meta?.trim() ||
    `${card.openQuestionCount} questions · ${card.openReviewCount} reviews open`;
  const compactLabel =
    card.compactLabel?.trim() || `${places} moved`;
  return { title, meta, compactLabel };
}
