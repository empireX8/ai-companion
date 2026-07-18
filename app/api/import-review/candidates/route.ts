import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  DEFAULT_IMPORT_CANDIDATE_PAGE_LIMIT,
  listPendingImportCandidates,
  MAX_IMPORT_CANDIDATE_PAGE_LIMIT,
} from "@/lib/import-candidate-review-query";
import { mapPendingImportPageToReviewBatch } from "@/lib/import-candidate-review-presentation";

export const dynamic = "force-dynamic";

function parseIntParam(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * GET /api/import-review/candidates
 * Authenticated, user-scoped pending import candidates (ReferenceItem + ContradictionNode).
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseIntParam(
      searchParams.get("limit"),
      DEFAULT_IMPORT_CANDIDATE_PAGE_LIMIT,
      1,
      MAX_IMPORT_CANDIDATE_PAGE_LIMIT,
    );
    const offset = parseIntParam(searchParams.get("offset"), 0, 0, 1_000_000);

    const page = await listPendingImportCandidates({ userId, limit, offset });
    const batch = mapPendingImportPageToReviewBatch(page);

    return NextResponse.json(
      {
        ...batch,
        limit: page.limit,
        offset: page.offset,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.log("[IMPORT_REVIEW_CANDIDATES_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
