import type { FamilyKey } from "./patterns-api";

export type ActionBucket = "stabilize" | "build";
export type ActionStatus = "not_started" | "done" | "helped" | "didnt_help";
export type ActionEffortLevel = "Low" | "Medium" | "High";

export type ActionPriorityClaim = {
  id: string;
  summary: string;
  patternType: FamilyKey;
  status: "candidate" | "active";
};

export type ActionPrioritySnapshot = {
  featured: ActionPriorityClaim[];
  totalActive: number;
  totalCandidate: number;
  hasData: boolean;
};

export type SurfacedActionView = {
  id: string;
  title: string;
  whySuggested: string;
  bucket: ActionBucket;
  effort: ActionEffortLevel;
  linkedFamily: FamilyKey | null;
  linkedFamilyLabel: string | null;
  linkedClaimId: string | null;
  linkedClaimSummary: string | null;
  linkedGoalId: string | null;
  linkedGoalStatement: string | null;
  linkedSourceLabel: string;
  status: ActionStatus;
  note: string | null;
  surfacedAt: string;
  updatedAt: string;
};

export type ActionsPageData = {
  currentPriority: ActionPrioritySnapshot;
  stabilizeNow: SurfacedActionView[];
  buildForward: SurfacedActionView[];
};

export async function fetchActionsPageData(): Promise<ActionsPageData | null> {
  try {
    const res = await fetch("/api/actions", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ActionsPageData;
  } catch {
    return null;
  }
}

export async function updateSurfacedAction(
  id: string,
  patch: { status?: ActionStatus; note?: string | null }
): Promise<
  Pick<SurfacedActionView, "id" | "status" | "note" | "updatedAt"> | null
> {
  try {
    const res = await fetch(`/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    return (await res.json()) as Pick<
      SurfacedActionView,
      "id" | "status" | "note" | "updatedAt"
    >;
  } catch {
    return null;
  }
}
