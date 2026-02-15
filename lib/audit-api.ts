export type Top3SnapshotItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  recommendedRung: string | null;
  lastEvidenceAt: string | null;
  computedWeight: number;
  sideA: string;
  sideB: string;
};

export type WeeklyAudit = {
  id: string;
  userId: string;
  weekStart: string;
  generatedAt: string;
  activeReferenceCount: number;
  openContradictionCount: number;
  totalContradictionCount: number;
  top3AvgComputedWeight: number;
  top3Ids: string[];
  totalAvoidanceCount: number;
  totalSnoozeCount: number;
  contradictionDensity: number;
  stabilityProxy: number;
  top3Snapshot: Top3SnapshotItem[] | null;
};

export type WeeklyAuditPreview = Omit<WeeklyAudit, "id" | "generatedAt"> & {
  preview: true;
};

export type WeeklyAuditDelta = {
  weekStart: string;
  deltaActiveReferenceCount: number;
  deltaOpenContradictionCount: number;
  deltaTotalContradictionCount: number;
  deltaTop3AvgComputedWeight: number;
  deltaTotalAvoidanceCount: number;
  deltaTotalSnoozeCount: number;
  deltaContradictionDensity: number;
  deltaStabilityProxy: number;
};

export type WeeklyTrendResponse = {
  weeks: number;
  items: WeeklyAudit[];
  deltas: WeeklyAuditDelta[];
};

export async function fetchWeeklyAudit(): Promise<WeeklyAudit | WeeklyAuditPreview | null> {
  const response = await fetch("/api/audit/weekly", {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch weekly audit");
  }

  return (await response.json()) as WeeklyAudit | WeeklyAuditPreview;
}

export async function fetchWeeklyTrend(weeks = 8): Promise<WeeklyTrendResponse | null> {
  const response = await fetch(`/api/audit/weekly/trend?weeks=${weeks}`, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch weekly trend");
  }

  return (await response.json()) as WeeklyTrendResponse;
}
