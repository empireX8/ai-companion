import type { CanonicalProductConceptV1 } from "@/lib/canonical-model-product-projection";

export type CanonicalConceptInspectorLoadState =
  | "loading"
  | "ready"
  | "missing"
  | "unavailable";

/** Pure resolver for panel failure/ready states — tested independently of React. */
export function resolveCanonicalConceptInspectorLoadState(args: {
  conceptId: string | null;
  fetchResult:
    | CanonicalProductConceptV1
    | null
    | "unavailable"
    | "pending"
    | "rejected";
}): {
  loadState: CanonicalConceptInspectorLoadState;
  concept: CanonicalProductConceptV1 | null;
} {
  if (!args.conceptId) {
    return { loadState: "missing", concept: null };
  }
  if (args.fetchResult === "pending") {
    return { loadState: "loading", concept: null };
  }
  if (args.fetchResult === "unavailable" || args.fetchResult === "rejected") {
    return { loadState: "unavailable", concept: null };
  }
  if (args.fetchResult === null) {
    return { loadState: "missing", concept: null };
  }
  return { loadState: "ready", concept: args.fetchResult };
}
