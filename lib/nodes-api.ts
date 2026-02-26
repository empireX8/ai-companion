export type ContradictionListStatus = "open" | "snoozed" | "explored";
export type ContradictionTerminalStatus =
  | "resolved"
  | "accepted_tradeoff"
  | "archived_tension";
export type ContradictionFilter =
  | ContradictionListStatus
  | "activeish"
  | "terminal";

export type ContradictionListItem = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  type: string;
  status: string;
  weight: number;
  escalationLevel: number;
  recommendedRung: string | null;
  lastEvidenceAt: string | null;
  lastTouchedAt: string;
  snoozedUntil: string | null;
};

export type ContradictionDetail = {
  id: string;
  title: string;
  type: string;
  status: string;
  sideA: string;
  sideB: string;
  escalationLevel: number;
  recommendedRung: string | null;
  createdAt: string;
  lastTouchedAt: string;
  lastEvidenceAt: string | null;
  evidenceCount: number;
  snoozedUntil: string | null;
  evidence: Array<{
    id: string;
    createdAt: string;
    source: string;
    quote: string | null;
    sessionId: string | null;
    messageId: string | null;
  }>;
};

export type ReferenceListItem = {
  id: string;
  type: string;
  confidence: string;
  statement: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ReferenceDetailItem = {
  id: string;
  type: string;
  confidence: string;
  statement: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  supersedesId: string | null;
};

export type ReferenceDetail = {
  current: ReferenceDetailItem;
  previousVersion: ReferenceDetailItem | null;
  nextVersions: ReferenceDetailItem[];
};

const ACTIVEISH_STATUSES: ContradictionListStatus[] = ["open", "explored", "snoozed"];
const TERMINAL_STATUSES: ContradictionTerminalStatus[] = [
  "resolved",
  "accepted_tradeoff",
  "archived_tension",
];

export const buildContradictionUrls = (
  filter: ContradictionFilter
): string[] => {
  if (filter === "activeish") {
    return ACTIVEISH_STATUSES.map((status) => `/api/contradiction?status=${status}`);
  }

  if (filter === "terminal") {
    return TERMINAL_STATUSES.map((status) => `/api/contradiction?status=${status}`);
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

export async function fetchContradictionById(
  id: string,
  fetchImpl: typeof fetch = fetch
): Promise<ContradictionDetail | null> {
  const response = await fetchImpl(`/api/contradiction/${id}`, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch contradiction: ${response.status}`);
  }

  return (await response.json()) as ContradictionDetail;
}

export async function performContradictionAction(
  id: string,
  action: string,
  snoozedUntil?: string
): Promise<void> {
  const body: Record<string, unknown> = { action };
  if (action === "snooze") {
    body.snoozedUntil = snoozedUntil ?? null;
  }

  const response = await fetch(`/api/contradiction/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed with status ${response.status}`);
  }
}

export type AddEvidencePayload = {
  source: "user_input" | "reflection" | "session";
  note: string;
  sessionId?: string;
};

export async function addContradictionEvidence(
  id: string,
  payload: AddEvidencePayload
): Promise<void> {
  const response = await fetch(`/api/contradiction/${id}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed with status ${response.status}`);
  }
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

export async function fetchReferenceDetail(
  id: string,
  fetchImpl: typeof fetch = fetch
): Promise<ReferenceDetail | null> {
  const response = await fetchImpl(`/api/reference/${id}/detail`, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch reference detail: ${response.status}`);
  }

  return (await response.json()) as ReferenceDetail;
}

export type LinkedReference = {
  id: string;
  type: string;
  confidence: string;
  statement: string;
  status: string;
  updatedAt: string;
  link: {
    asserted: boolean;
    assertedAt: string | null;
    createdAt: string;
  };
};

export async function fetchLinkedReferences(
  contradictionId: string,
  fetchImpl: typeof fetch = fetch
): Promise<LinkedReference[]> {
  const response = await fetchImpl(
    `/api/contradiction/${contradictionId}/references`,
    { method: "GET", cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch linked references: ${response.status}`);
  }
  return (await response.json()) as LinkedReference[];
}

export async function linkReferenceToContradiction(
  contradictionId: string,
  referenceId: string
): Promise<LinkedReference[]> {
  const response = await fetch(`/api/contradiction/${contradictionId}/references`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ referenceId }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return (await response.json()) as LinkedReference[];
}

export async function unlinkReferenceFromContradiction(
  contradictionId: string,
  referenceId: string
): Promise<LinkedReference[]> {
  const response = await fetch(`/api/contradiction/${contradictionId}/references`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ referenceId }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return (await response.json()) as LinkedReference[];
}

export async function setContradictionReferenceAsserted(
  contradictionId: string,
  referenceId: string,
  asserted: boolean
): Promise<LinkedReference[]> {
  const response = await fetch(`/api/contradiction/${contradictionId}/references`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ referenceId, asserted }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return (await response.json()) as LinkedReference[];
}

export async function performReferenceActionApi(
  id: string,
  action: string,
  payload?: Record<string, unknown>
) {
  const res = await fetch(`/api/reference/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}
