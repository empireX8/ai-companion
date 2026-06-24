import type { PatternClaimView } from "./patterns-api";
import type {
  UserMapConclusionPublicApiDetailItem,
  WhatChangedListItem,
} from "./public-intelligence-safe-slice";

export const INSPECTOR_USER_MAP_DETAIL_ENDPOINT = (id: string) =>
  `/api/user-map/conclusions/${encodeURIComponent(id)}`;

export const INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT = (id: string) =>
  `/api/user-map/conclusions/${encodeURIComponent(id)}/evidence`;

export const INSPECTOR_MODEL_UPDATE_DETAIL_ENDPOINT = (id: string) =>
  `/api/what-changed/${encodeURIComponent(id)}`;

export const INSPECTOR_MODEL_UPDATE_EVIDENCE_ENDPOINT = (id: string) =>
  `/api/what-changed/${encodeURIComponent(id)}/evidence`;

export const INSPECTOR_PATTERN_CLAIM_ENDPOINT = (id: string) =>
  `/api/inspector/pattern-claims/${encodeURIComponent(id)}`;

export const INSPECTOR_CONTRADICTION_ENDPOINT = (id: string) =>
  `/api/inspector/contradictions/${encodeURIComponent(id)}`;

export type InspectorEvidenceLinkItem = {
  sourceTypeLabel: string;
  evidenceSummaryLabel: string;
  sourceObjectHref: string;
  createdAt: string;
  hasEvidence: true;
};

export type InspectorContradictionProjection = {
  id: string;
  title: string;
  sideA: string;
  sideB: string;
  status: string;
  evidenceCount: number;
  lastEvidenceAt: string | null;
  lastTouchedAt: string;
};

export async function fetchInspectorUserMapDetail(
  id: string
): Promise<UserMapConclusionPublicApiDetailItem | null> {
  const response = await fetch(INSPECTOR_USER_MAP_DETAIL_ENDPOINT(id), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { item?: UserMapConclusionPublicApiDetailItem };
  return payload.item ?? null;
}

export async function fetchInspectorEvidenceLinks(
  endpoint: string
): Promise<InspectorEvidenceLinkItem[]> {
  const response = await fetch(endpoint, { method: "GET", cache: "no-store" });
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { items?: InspectorEvidenceLinkItem[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function fetchInspectorModelUpdateDetail(
  id: string
): Promise<WhatChangedListItem | null> {
  const response = await fetch(INSPECTOR_MODEL_UPDATE_DETAIL_ENDPOINT(id), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { item?: WhatChangedListItem };
  return payload.item ?? null;
}

export async function fetchInspectorPatternClaim(id: string): Promise<PatternClaimView | null> {
  const response = await fetch(INSPECTOR_PATTERN_CLAIM_ENDPOINT(id), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { item?: PatternClaimView };
  return payload.item ?? null;
}

export async function fetchInspectorContradiction(
  id: string
): Promise<InspectorContradictionProjection | null> {
  const response = await fetch(INSPECTOR_CONTRADICTION_ENDPOINT(id), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { item?: InspectorContradictionProjection };
  return payload.item ?? null;
}
