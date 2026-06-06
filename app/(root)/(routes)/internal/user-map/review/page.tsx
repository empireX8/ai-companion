import React from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import {
  INTERNAL_FIELDWORK_REVIEW_DEFAULT_LIMIT,
  listInternalFieldworkReviewCandidates,
} from "@/lib/internal-fieldwork-review-candidates";
import {
  INTERNAL_MODEL_UPDATE_REVIEW_DEFAULT_LIMIT,
  listInternalModelUpdateReviewCandidates,
} from "@/lib/internal-model-update-review-candidates";
import {
  INTERNAL_INVESTIGATION_REVIEW_DEFAULT_LIMIT,
  listInternalInvestigationReviewCandidates,
} from "../../../../../../lib/internal-investigation-review-candidates";
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
    const [userMapSettled, investigationSettled, fieldworkSettled, modelUpdateSettled] =
      await Promise.allSettled([
        listInternalUserMapReviewCandidates({
          userId,
          limit: INTERNAL_USER_MAP_REVIEW_DEFAULT_LIMIT,
        }),
        listInternalInvestigationReviewCandidates({
          userId,
          limit: INTERNAL_INVESTIGATION_REVIEW_DEFAULT_LIMIT,
        }),
        listInternalFieldworkReviewCandidates({
          userId,
          limit: INTERNAL_FIELDWORK_REVIEW_DEFAULT_LIMIT,
        }),
        listInternalModelUpdateReviewCandidates({
          userId,
          limit: INTERNAL_MODEL_UPDATE_REVIEW_DEFAULT_LIMIT,
        }),
      ]);

    if (userMapSettled.status === "rejected") {
      throw userMapSettled.reason;
    }

    let investigationCandidates: Awaited<
      ReturnType<typeof listInternalInvestigationReviewCandidates>
    > = [];

    if (investigationSettled.status === "fulfilled") {
      investigationCandidates = investigationSettled.value;
    } else {
      console.error(
        "[INTERNAL_INVESTIGATION_REVIEW_LIST_ERROR]",
        investigationSettled.reason
      );
    }

    let fieldworkCandidates: Awaited<
      ReturnType<typeof listInternalFieldworkReviewCandidates>
    > = [];

    if (fieldworkSettled.status === "fulfilled") {
      fieldworkCandidates = fieldworkSettled.value;
    } else {
      console.error(
        "[INTERNAL_FIELDWORK_REVIEW_LIST_ERROR]",
        fieldworkSettled.reason
      );
    }

    let modelUpdateCandidates: Awaited<
      ReturnType<typeof listInternalModelUpdateReviewCandidates>
    > = [];

    if (modelUpdateSettled.status === "fulfilled") {
      modelUpdateCandidates = modelUpdateSettled.value;
    } else {
      console.error(
        "[INTERNAL_MODEL_UPDATE_REVIEW_LIST_ERROR]",
        modelUpdateSettled.reason
      );
    }

    // Defense-in-depth: only render internal-only rows even if upstream data regresses.
    const internalUserMapCandidates = userMapSettled.value.filter(
      (candidate) => candidate.visibility === "internal_only"
    );
    const internalInvestigationCandidates = investigationCandidates.filter(
      (candidate) => candidate.visibility === "internal_only"
    );
    const internalFieldworkCandidates = fieldworkCandidates.filter(
      (candidate) => candidate.visibility === "internal_only"
    );
    const internalModelUpdateCandidates = modelUpdateCandidates.filter(
      (candidate) =>
        candidate.visibility === "internal_only" && candidate.isMeaningful === false
    );

    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-foreground">
              Internal Candidate Review
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Internal operator workbench for reviewing and publishing hidden User Map,
              Investigation, Fieldwork, and ModelUpdate candidates.
            </p>
          </div>

          <InternalUserMapReviewWorkbench
            userMapCandidates={internalUserMapCandidates}
            investigationCandidates={internalInvestigationCandidates}
            fieldworkCandidates={internalFieldworkCandidates}
            modelUpdateCandidates={internalModelUpdateCandidates}
          />
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
