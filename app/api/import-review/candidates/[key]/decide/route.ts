import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  decideImportCandidate,
  ImportCandidateReviewError,
  type ImportCandidateDecision,
} from "@/lib/import-candidate-review-actions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };

/**
 * POST /api/import-review/candidates/[key]/decide
 * Body: { decision: "accept" | "reject" }
 *
 * Key is URL-encoded review key: reference_item:<id> | contradiction_node:<id>
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resolved = await Promise.resolve(params);
    const rawKey = resolved?.key ? decodeURIComponent(resolved.key) : "";
    if (!rawKey.trim()) {
      return new NextResponse("Candidate key is required", { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as {
      decision?: string;
    } | null;
    const decision = body?.decision;
    if (decision !== "accept" && decision !== "reject") {
      return NextResponse.json(
        { error: "decision must be accept or reject" },
        { status: 400 },
      );
    }

    const result = await decideImportCandidate({
      userId,
      reviewKey: rawKey,
      decision: decision as ImportCandidateDecision,
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof ImportCandidateReviewError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.httpStatus },
      );
    }
    console.log("[IMPORT_REVIEW_DECIDE_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
