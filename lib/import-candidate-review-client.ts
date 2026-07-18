import type {
  OrvekImportReviewBatch,
  OrvekImportReviewCandidate,
} from "@/lib/orvek-v0/data-provider";
import { emptyImportReviewBatch } from "@/lib/import-candidate-review-presentation";

export const IMPORT_REVIEW_CANDIDATES_ENDPOINT =
  "/api/import-review/candidates";

export function importReviewDecideEndpoint(reviewKey: string): string {
  return `/api/import-review/candidates/${encodeURIComponent(reviewKey)}/decide`;
}

export async function fetchImportReviewCandidates(args?: {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
}): Promise<OrvekImportReviewBatch> {
  const params = new URLSearchParams();
  if (args?.limit != null) params.set("limit", String(args.limit));
  if (args?.offset != null) params.set("offset", String(args.offset));
  const qs = params.toString();
  const url = qs
    ? `${IMPORT_REVIEW_CANDIDATES_ENDPOINT}?${qs}`
    : IMPORT_REVIEW_CANDIDATES_ENDPOINT;

  const response = await fetch(url, {
    cache: "no-store",
    signal: args?.signal,
  });

  if (response.status === 401) {
    return emptyImportReviewBatch({
      error: "Sign in required to load import candidates.",
    });
  }

  if (!response.ok) {
    return emptyImportReviewBatch({
      error: `Could not load import candidates (${response.status}).`,
    });
  }

  const payload = (await response.json()) as OrvekImportReviewBatch;
  return {
    ...emptyImportReviewBatch(),
    ...payload,
    candidates: Array.isArray(payload.candidates) ? payload.candidates : [],
    loading: false,
    error: null,
  };
}

export async function decideImportReviewCandidate(args: {
  reviewKey: string;
  decision: "accept" | "reject";
}): Promise<{
  ok: boolean;
  status: number;
  body: unknown;
}> {
  const response = await fetch(importReviewDecideEndpoint(args.reviewKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision: args.decision }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

export type { OrvekImportReviewCandidate };
