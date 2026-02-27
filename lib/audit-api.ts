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
  status: string;
  lockedAt: string | null;
  inputHash: string | null;
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

export type ExplainPayload = {
  densityCategory: "low" | "moderate" | "high";
  stabilityCategory: "stable" | "stressed" | "critical";
  topWeightConcentration: boolean;
  integrity: "immutable" | "mutable";
  drivers: string[];
};

export async function fetchWeeklyAuditById(id: string): Promise<WeeklyAudit | null> {
  const response = await fetch(`/api/audit/weekly/${id}`, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch weekly audit by id");
  }

  return (await response.json()) as WeeklyAudit;
}

export async function fetchWeeklyAuditExplain(id: string): Promise<ExplainPayload | null> {
  const response = await fetch(`/api/audit/weekly/${id}/explain`, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch weekly audit explain");
  }

  return (await response.json()) as ExplainPayload;
}

export async function createWeeklyAuditSnapshot(): Promise<WeeklyAudit> {
  const response = await fetch("/api/audit/weekly", {
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to create snapshot");
  }

  return (await response.json()) as WeeklyAudit;
}

export async function lockWeeklyAudit(id: string): Promise<WeeklyAudit> {
  const response = await fetch(`/api/audit/lock/${id}`, {
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to lock audit");
  }

  return (await response.json()) as WeeklyAudit;
}

export type BackfillResponse = {
  weeksRequested: number;
  weeksConsidered: number;
  createdCount: number;
  skippedExistingCount: number;
  skippedLockedCount: number;
  createdWeekStarts: string[];
  skippedExistingWeekStarts: string[];
  skippedLockedWeekStarts: string[];
  errors: string[];
};

export async function createWeeklyAuditBackfill(weeks = 8): Promise<BackfillResponse> {
  const response = await fetch(`/api/audit/weekly/backfill?weeks=${weeks}`, {
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to backfill");
  }

  return (await response.json()) as BackfillResponse;
}

export type Top3Movement = {
  id: string;
  status: "entered" | "exited" | "moved" | "unchanged";
  fromRank: number | null;
  toRank: number | null;
};

export type WeeklyAuditDiffResult = {
  activeReferenceCountDelta: number;
  openContradictionCountDelta: number;
  totalContradictionCountDelta: number;
  top3AvgComputedWeightDelta: number;
  contradictionDensityDelta: number;
  stabilityProxyDelta: number;
  totalAvoidanceDelta: number;
  totalSnoozeDelta: number;
  top3Movement: Top3Movement[];
};

export type WeeklyAuditCompareResponse = {
  from: WeeklyAudit;
  to: WeeklyAudit;
  diff: WeeklyAuditDiffResult;
  summary: string[];
};

export async function fetchWeeklyAuditCompare(
  fromId: string,
  toId: string
): Promise<WeeklyAuditCompareResponse | null> {
  const response = await fetch(
    `/api/audit/weekly/compare?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}`,
    { method: "GET", cache: "no-store" }
  );

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch compare");
  }

  return (await response.json()) as WeeklyAuditCompareResponse;
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
