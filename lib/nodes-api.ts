export type ContradictionListStatus = "open" | "snoozed" | "explored";
export type ContradictionFilter = ContradictionListStatus | "activeish";

export type ContradictionListItem = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  type: string;
  status: string;
  weight: number;
  recommendedRung: string | null;
  lastEvidenceAt: string | null;
  lastTouchedAt: string;
};

export type ReferenceListItem = {
  id: string;
  type: string;
  confidence: string;
  statement: string;
  createdAt: string;
  updatedAt: string;
};

const ACTIVEISH_STATUSES: ContradictionListStatus[] = ["open", "explored", "snoozed"];

export const buildContradictionUrls = (
  filter: ContradictionFilter
): string[] => {
  if (filter === "activeish") {
    return ACTIVEISH_STATUSES.map((status) => `/api/contradiction?status=${status}`);
  }

  return [`/api/contradiction?status=${filter}`];
};

export async function fetchContradictions(
  filter: ContradictionFilter,
  fetchImpl: typeof fetch = fetch
): Promise<ContradictionListItem[] | null> {
  const urls = buildContradictionUrls(filter);
  const responses = await Promise.all(
    urls.map((url) =>
      fetchImpl(url, {
        method: "GET",
        cache: "no-store",
      })
    )
  );

  if (responses.some((response) => response.status === 401)) {
    return null;
  }

  if (responses.some((response) => !response.ok)) {
    throw new Error("Failed to fetch contradictions");
  }

  const payloads = (await Promise.all(
    responses.map(async (response) => response.json())
  )) as ContradictionListItem[][];

  const deduped = new Map<string, ContradictionListItem>();
  for (const payload of payloads) {
    for (const item of payload) {
      deduped.set(item.id, item);
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    if (right.weight !== left.weight) {
      return right.weight - left.weight;
    }

    return (
      new Date(right.lastTouchedAt).getTime() - new Date(left.lastTouchedAt).getTime()
    );
  });
}

export async function fetchReferences(
  fetchImpl: typeof fetch = fetch
): Promise<ReferenceListItem[] | null> {
  const response = await fetchImpl("/api/reference/list", {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch references");
  }

  return (await response.json()) as ReferenceListItem[];
}
