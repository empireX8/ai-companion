/**
 * Browser client helpers for current-understanding APIs.
 */

import type { CanonicalProductConceptV1 } from "./canonical-model-product-projection";
import type {
  CurrentUnderstandingProductProjectionV1,
  CurrentUnderstandingSurfaceListItem,
} from "./current-understanding-product-projection";
import { toCurrentUnderstandingSurfaceListItem } from "./current-understanding-product-projection";

export const CURRENT_UNDERSTANDING_ENDPOINT = "/api/current-understanding";

export const CURRENT_UNDERSTANDING_CANONICAL_CONCEPT_ENDPOINT = (id: string) =>
  `/api/current-understanding/canonical-concepts/${encodeURIComponent(id)}`;

export async function fetchCurrentUnderstandingProjection(): Promise<
  | { ok: true; projection: CurrentUnderstandingProductProjectionV1 }
  | { ok: false; status: number; code?: string }
> {
  const response = await fetch(CURRENT_UNDERSTANDING_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 401) {
    return { ok: false, status: 401 };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const code =
      typeof payload === "object" &&
      payload !== null &&
      "code" in payload &&
      typeof (payload as { code?: unknown }).code === "string"
        ? (payload as { code: string }).code
        : undefined;
    return { ok: false, status: response.status, code };
  }

  return {
    ok: true,
    projection: payload as CurrentUnderstandingProductProjectionV1,
  };
}

export async function fetchCurrentUnderstandingSurfaceListItems(): Promise<
  | { ok: true; items: CurrentUnderstandingSurfaceListItem[] }
  | { ok: false; status: number; code?: string }
> {
  const result = await fetchCurrentUnderstandingProjection();
  if (!result.ok) return result;
  return {
    ok: true,
    items: result.projection.items.map(toCurrentUnderstandingSurfaceListItem),
  };
}

export async function fetchCanonicalProductConcept(
  conceptId: string,
): Promise<CanonicalProductConceptV1 | null | "unavailable"> {
  try {
    const response = await fetch(
      CURRENT_UNDERSTANDING_CANONICAL_CONCEPT_ENDPOINT(conceptId),
      { method: "GET", cache: "no-store" },
    );
    if (response.status === 404) return null;
    if (!response.ok) return "unavailable";
    try {
      return (await response.json()) as CanonicalProductConceptV1;
    } catch {
      return "unavailable";
    }
  } catch {
    return "unavailable";
  }
}
