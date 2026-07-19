/**
 * Map Active-conflicts projection for open ContradictionNode records.
 * Read-only client + projection helpers — no writes, no accept/reject.
 */

export const MAP_OPEN_CONTRADICTION_STATUS = "open" as const;

/** Stable rail / object id prefix — collision-safe vs m-conflict-* seed ids. */
export const MAP_CONTRADICTION_OBJECT_ID_PREFIX = "contradiction-" as const;

export type MapOpenContradictionItem = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  status: typeof MAP_OPEN_CONTRADICTION_STATUS | string;
  confidence: string;
  evidenceCount: number;
  lastTouchedAt: string;
  sessionOrigin?: "APP" | "IMPORTED_ARCHIVE" | null;
};

type ContradictionListApiItem = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  status: string;
  confidence?: string;
  evidenceCount?: number;
  lastTouchedAt: string;
  sessionOrigin?: "APP" | "IMPORTED_ARCHIVE" | null;
};

type ContradictionPage = {
  items: ContradictionListApiItem[];
  page: number;
  limit: number;
  hasMore: boolean;
};

export function mapContradictionObjectId(rawId: string): string {
  return `${MAP_CONTRADICTION_OBJECT_ID_PREFIX}${rawId}`;
}

export function parseMapContradictionRawId(
  selectionId: string | null | undefined,
): string | null {
  const normalized = selectionId?.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith(MAP_CONTRADICTION_OBJECT_ID_PREFIX)) {
    const raw = normalized.slice(MAP_CONTRADICTION_OBJECT_ID_PREFIX.length).trim();
    return raw || null;
  }
  return null;
}

export function isMapOpenContradictionStatus(status: string | null | undefined): boolean {
  return status === MAP_OPEN_CONTRADICTION_STATUS;
}

export function formatMapContradictionStatusLabel(status: string): string {
  const trimmed = status.trim();
  if (!trimmed) {
    return "Unknown";
  }
  return trimmed
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatMapContradictionConfidenceLabel(confidence: string): string {
  const trimmed = confidence.trim();
  if (!trimmed) {
    return "Unknown";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function buildMapContradictionSidesSummary(item: {
  sideA: string;
  sideB: string;
}): string {
  const sideA = item.sideA.trim();
  const sideB = item.sideB.trim();
  if (sideA && sideB) {
    return `A: ${sideA} · B: ${sideB}`;
  }
  return sideA || sideB || "";
}

export function toMapOpenContradictionItem(
  row: ContradictionListApiItem,
): MapOpenContradictionItem | null {
  const id = row.id?.trim();
  if (!id) {
    return null;
  }
  if (!isMapOpenContradictionStatus(row.status)) {
    return null;
  }

  return {
    id,
    title: row.title?.trim() || "Untitled contradiction",
    sideA: row.sideA?.trim() || "",
    sideB: row.sideB?.trim() || "",
    status: MAP_OPEN_CONTRADICTION_STATUS,
    confidence: row.confidence?.trim() || "low",
    evidenceCount: typeof row.evidenceCount === "number" ? row.evidenceCount : 0,
    lastTouchedAt: row.lastTouchedAt,
    sessionOrigin: row.sessionOrigin ?? null,
  };
}

/**
 * Authenticated Map read: open ContradictionNodes for the current user only.
 * Reuses GET /api/contradiction?status=open (user-scoped; excludes candidates).
 */
export async function fetchMapOpenContradictions(
  fetchImpl: typeof fetch = fetch,
): Promise<MapOpenContradictionItem[]> {
  const response = await fetchImpl(
    `/api/contradiction?status=${MAP_OPEN_CONTRADICTION_STATUS}&limit=50&page=1`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  if (response.status === 401 || response.status === 403) {
    return [];
  }

  if (!response.ok) {
    throw new Error("Could not load open contradictions for Map.");
  }

  const payload = (await response.json()) as ContradictionPage;
  const items = Array.isArray(payload.items) ? payload.items : [];
  const mapped: MapOpenContradictionItem[] = [];
  const seen = new Set<string>();

  for (const row of items) {
    const item = toMapOpenContradictionItem(row);
    if (!item || seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    mapped.push(item);
  }

  return mapped;
}

export function resolveMapContradictionSelectionId(
  selectionId: string | null | undefined,
  openContradictions: MapOpenContradictionItem[],
): string | null {
  const normalized = selectionId?.trim();
  if (!normalized || openContradictions.length === 0) {
    return null;
  }

  const prefixedRaw = parseMapContradictionRawId(normalized);
  const match = openContradictions.find(
    (item) =>
      item.id === normalized ||
      mapContradictionObjectId(item.id) === normalized ||
      (prefixedRaw !== null && item.id === prefixedRaw),
  );

  return match ? mapContradictionObjectId(match.id) : null;
}
