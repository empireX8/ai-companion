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
  lastEscalatedAt: string | null;
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
  cooldownActive: boolean;
  cooldownUntil: string | null;
  evidence: Array<{
    id: string;
    createdAt: string;
    source: string;
    quote: string | null;
    sessionId: string | null;
    messageId: string | null;
    spanId: string | null;
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
  sourceMessageId: string | null;
  spanId: string | null;
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

type ContradictionPage = {
  items: ContradictionListItem[];
  page: number;
  limit: number;
  hasMore: boolean;
};

export async function fetchContradictions(
  filter: ContradictionFilter,
  opts: { page?: number; limit?: number } = {},
  fetchImpl: typeof fetch = fetch
): Promise<ContradictionListItem[] | null> {
  const urls = buildContradictionUrls(filter);
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;

  const responses = await Promise.all(
    urls.map((url) =>
      fetchImpl(`${url}&page=${page}&limit=${limit}`, {
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
  )) as ContradictionPage[];

  const deduped = new Map<string, ContradictionListItem>();
  for (const payload of payloads) {
    for (const item of payload.items) {
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

// ── Session helpers ───────────────────────────────────────────────────────────

export type SessionListItem = {
  id: string;
  label: string | null;
  startedAt: string;
  endedAt: string | null;
};

/** Fetch the user's native (APP) sessions. Returns null on auth failure. */
export async function listSessions(): Promise<SessionListItem[] | null> {
  const res = await fetch("/api/session/list", { method: "GET" });
  if (!res.ok) return null;
  return (await res.json()) as SessionListItem[];
}

// ── Evidence helpers ──────────────────────────────────────────────────────────

export type EvidenceListItem = {
  id: string;
  createdAt: string;
  excerpt: string;
  sessionId: string | null;
  sessionLabel: string | null;
  origin: "APP" | "IMPORTED_ARCHIVE";
  artifactCount: number;
};

export type EvidenceArtifact = {
  id: string;
  type: string;
  claim: string;
  confidence: number;
  status: string;
};

export type EvidenceDetail = {
  id: string;
  createdAt: string;
  content: string;
  charStart: number;
  charEnd: number;
  messageId: string;
  sessionId: string | null;
  sessionLabel: string | null;
  origin: "APP" | "IMPORTED_ARCHIVE";
  artifacts: EvidenceArtifact[];
};

export type EvidenceListResponse = {
  items: EvidenceListItem[];
  nextCursor: string | null;
};

export async function fetchEvidenceList(opts: {
  q?: string;
  origin?: "app" | "imported" | "all";
  hasArtifacts?: boolean;
  limit?: number;
  cursor?: string;
} = {}): Promise<EvidenceListResponse | null> {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.origin) params.set("origin", opts.origin);
  if (opts.hasArtifacts !== undefined) params.set("hasArtifacts", String(opts.hasArtifacts));
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  const res = await fetch(`/api/evidence${qs ? `?${qs}` : ""}`, { method: "GET" });
  if (!res.ok) return null;
  return (await res.json()) as EvidenceListResponse;
}

export async function fetchEvidenceById(id: string): Promise<EvidenceDetail | null> {
  const res = await fetch(`/api/evidence/${id}`, { method: "GET" });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch evidence: ${res.status}`);
  return (await res.json()) as EvidenceDetail;
}
