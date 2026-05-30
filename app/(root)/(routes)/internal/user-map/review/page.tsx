import React from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { isInternalUserMapReviewer } from "../../../../../../lib/internal-review-auth";
import {
  INTERNAL_USER_MAP_REVIEW_DEFAULT_LIMIT,
  listInternalUserMapReviewCandidates,
} from "../../../../../../lib/internal-user-map-review-candidates";

import { InternalUserMapReviewWorkbench } from "./_components/InternalUserMapReviewWorkbench";

export const dynamic = "force-dynamic";

export default async function InternalUserMapReviewPage() {
  const { userId } = await auth();
  if (!userId || !isInternalUserMapReviewer(userId)) {
    notFound();
  }

  try {
    const candidates = await listInternalUserMapReviewCandidates({
      userId,
      limit: INTERNAL_USER_MAP_REVIEW_DEFAULT_LIMIT,
    });

    // Defense-in-depth: only render internal-only rows even if upstream data regresses.
    const internalCandidates = candidates.filter(
      (candidate) => candidate.visibility === "internal_only"
    );

    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-foreground">
              Internal User Map Review
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Internal operator workbench for reviewing and publishing hidden candidate
              conclusions.
            </p>
          </div>

          <InternalUserMapReviewWorkbench candidates={internalCandidates} />
        </div>
      </div>
    );
  } catch (error) {
    console.error("[INTERNAL_USER_MAP_REVIEW_PAGE_ERROR]", error);
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Could not load internal review candidates right now.
          </p>
        </div>
      </div>
    );
  }
}
