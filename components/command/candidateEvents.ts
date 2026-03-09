export const CANDIDATE_EVENTS = {
  UPDATED: "candidates:updated",
} as const;

export function dispatchCandidatesUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CANDIDATE_EVENTS.UPDATED));
  }
}
