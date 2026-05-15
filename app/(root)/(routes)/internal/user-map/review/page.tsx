import React from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { isInternalUserMapReviewer } from "../../../../../../lib/internal-review-auth";
import {
  INTERNAL_USER_MAP_REVIEW_DEFAULT_LIMIT,
  listInternalUserMapReviewCandidates,
  type InternalUserMapReviewCandidate,
} from "../../../../../../lib/internal-user-map-review-candidates";

export const dynamic = "force-dynamic";

function renderSourceTypeSummary(item: InternalUserMapReviewCandidate): string {
  const entries = Object.entries(item.evidence.sourceTypes);
  if (entries.length === 0) {
    return "None";
  }

  return entries
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sourceType, count]) => `${sourceType} (${count})`)
    .join(", ");
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
}

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
              Internal read-only surface for reviewing hidden candidate conclusions.
            </p>
          </div>

          {internalCandidates.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                No internal candidates found for this reviewer.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {internalCandidates.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-border bg-card p-5"
                >
                  <header className="mb-3">
                    <h2 className="text-base font-semibold text-foreground">
                      {item.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.summary}
                    </p>
                  </header>

                  <dl className="grid grid-cols-1 gap-2 text-sm text-foreground md:grid-cols-2">
                    <div>
                      <dt className="label-meta text-xs">Area</dt>
                      <dd>{item.area}</dd>
                    </div>
                    <div>
                      <dt className="label-meta text-xs">Status</dt>
                      <dd>{item.status}</dd>
                    </div>
                    <div>
                      <dt className="label-meta text-xs">Confidence</dt>
                      <dd>{item.confidenceLevel}</dd>
                    </div>
                    <div>
                      <dt className="label-meta text-xs">Visibility</dt>
                      <dd>{item.visibility}</dd>
                    </div>
                    <div>
                      <dt className="label-meta text-xs">Created</dt>
                      <dd>{formatTimestamp(item.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="label-meta text-xs">Updated</dt>
                      <dd>{formatTimestamp(item.updatedAt)}</dd>
                    </div>
                    <div>
                      <dt className="label-meta text-xs">Evidence link count</dt>
                      <dd>{item.evidence.linkCount}</dd>
                    </div>
                    <div>
                      <dt className="label-meta text-xs">Evidence source types</dt>
                      <dd>{renderSourceTypeSummary(item)}</dd>
                    </div>
                    <div>
                      <dt className="label-meta text-xs">Latest run id</dt>
                      <dd>{item.diagnostics.latestRunId ?? "None"}</dd>
                    </div>
                    <div>
                      <dt className="label-meta text-xs">Latest artifact id</dt>
                      <dd>{item.diagnostics.latestArtifactId ?? "None"}</dd>
                    </div>
                    <div>
                      <dt className="label-meta text-xs">Latest artifact type</dt>
                      <dd>{item.diagnostics.latestArtifactType ?? "None"}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
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
