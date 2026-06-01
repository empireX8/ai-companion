"use client";

import React, { useCallback, useState } from "react";

import {
  INTERNAL_OPERATOR_LIFECYCLE_ACTION_LABELS,
  canPublishInternalCandidate,
  getInternalOperatorLifecycleActions,
  lifecycleActionToStatus,
  type InternalOperatorLifecycleAction,
} from "../../../../../../../lib/internal-user-map-review-operator-actions";
import {
  postInternalCandidateLifecycle,
  postInternalCandidatePublish,
} from "../../../../../../../lib/internal-user-map-review-operator-client";
import type { InternalUserMapReviewCandidate } from "../../../../../../../lib/internal-user-map-review-candidates";
import { cn } from "../../../../../../../lib/utils";
import { useRouter } from "next/navigation";

type Props = {
  candidates: InternalUserMapReviewCandidate[];
};

function formatLifecycleStatus(
  status: InternalUserMapReviewCandidate["candidateLifecycleStatus"]
): string {
  if (status === null) {
    return "Not lifecycle-managed (legacy)";
  }

  return status.replaceAll("_", " ");
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
}

function renderSourceTypeSummary(sourceTypes: Record<string, number>): string {
  const entries = Object.entries(sourceTypes);
  if (entries.length === 0) {
    return "None";
  }

  return entries
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sourceType, count]) => `${sourceType}: ${count}`)
    .join(", ");
}

function renderSafetyLevelSummary(safetyLevels: Record<string, number>): string {
  const entries = Object.entries(safetyLevels);
  if (entries.length === 0) {
    return "Not recorded";
  }

  return entries
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([level, count]) => `${level}: ${count}`)
    .join(", ");
}

function renderLinkedSourceIds(item: InternalUserMapReviewCandidate): string {
  if (item.evidence.linkedSources.length === 0) {
    return "None";
  }

  return item.evidence.linkedSources
    .map((source) => {
      const safetySuffix = source.safetyLevel ? ` · ${source.safetyLevel}` : "";
      return `${source.sourceType}/${source.sourceId}${safetySuffix}`;
    })
    .join("; ");
}

function hasProvenanceMetadata(item: InternalUserMapReviewCandidate): boolean {
  return (
    item.evidence.linkCount > 0 ||
    Boolean(item.diagnostics.latestRunId) ||
    Boolean(item.diagnostics.latestArtifactId) ||
    item.diagnostics.blockedWriteReasons.length > 0 ||
    item.diagnostics.warnings.length > 0
  );
}

export function InternalUserMapReviewWorkbench({ candidates }: Props) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [cardSuccess, setCardSuccess] = useState<Record<string, string>>({});

  const clearCardFeedback = useCallback((candidateId: string) => {
    setCardErrors((prev) => {
      if (!(candidateId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[candidateId];
      return next;
    });
    setCardSuccess((prev) => {
      if (!(candidateId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[candidateId];
      return next;
    });
  }, []);

  const runAction = useCallback(
    async (
      candidateId: string,
      actionKey: string,
      action: () => Promise<{ ok: boolean; message?: string }>
    ) => {
      setPendingKey(actionKey);
      clearCardFeedback(candidateId);

      try {
        const result = await action();
        if (!result.ok) {
          setCardErrors((prev) => ({
            ...prev,
            [candidateId]: result.message ?? "Action failed.",
          }));
          return;
        }

        setCardSuccess((prev) => ({
          ...prev,
          [candidateId]: result.message ?? "Updated.",
        }));
        router.refresh();
      } catch {
        setCardErrors((prev) => ({
          ...prev,
          [candidateId]: "Unexpected error. Try again.",
        }));
      } finally {
        setPendingKey(null);
      }
    },
    [clearCardFeedback, router]
  );

  const handleLifecycle = useCallback(
    (candidateId: string, operatorAction: InternalOperatorLifecycleAction) => {
      const newStatus = lifecycleActionToStatus(operatorAction);
      const actionKey = `${candidateId}:lifecycle:${newStatus}`;

      return runAction(candidateId, actionKey, async () => {
        const result = await postInternalCandidateLifecycle(candidateId, newStatus);
        if (!result.ok) {
          const codeSuffix = result.code ? ` (${result.code})` : "";
          return {
            ok: false,
            message: `${result.message}${codeSuffix}`,
          };
        }

        if (result.data.kind !== "lifecycle") {
          return { ok: false, message: "Unexpected publish response for lifecycle action." };
        }

        return {
          ok: true,
          message: `Lifecycle updated to ${result.data.newStatus.replaceAll("_", " ")}.`,
        };
      });
    },
    [runAction]
  );

  const handlePublish = useCallback(
    (candidateId: string) => {
      const actionKey = `${candidateId}:publish`;

      return runAction(candidateId, actionKey, async () => {
        const result = await postInternalCandidatePublish(candidateId);
        if (!result.ok) {
          const codeSuffix = result.code ? ` (${result.code})` : "";
          return {
            ok: false,
            message: `${result.message}${codeSuffix}`,
          };
        }

        return {
          ok: true,
          message: "Published to user-visible map. What Changed will reflect the ModelUpdate.",
        };
      });
    },
    [runAction]
  );

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          No internal candidates found for this reviewer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {candidates.map((item) => {
        const lifecycleActions = getInternalOperatorLifecycleActions(
          item.candidateLifecycleStatus
        );
        const publishAllowed = canPublishInternalCandidate({
          candidateLifecycleStatus: item.candidateLifecycleStatus,
          visibility: item.visibility,
        });
        const cardPending = pendingKey?.startsWith(`${item.id}:`) ?? false;
        const errorMessage = cardErrors[item.id];
        const successMessage = cardSuccess[item.id];

        return (
          <article
            key={item.id}
            className="rounded-lg border border-border bg-card p-5"
          >
            <header className="mb-3">
              <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
            </header>

            <dl className="grid grid-cols-1 gap-2 text-sm text-foreground md:grid-cols-2">
              <div>
                <dt className="label-meta text-xs">Lifecycle status</dt>
                <dd>{formatLifecycleStatus(item.candidateLifecycleStatus)}</dd>
              </div>
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
            </dl>

            <section
              className="mt-4 rounded-md border border-border/60 bg-muted/20 p-4"
              aria-label="Evidence and provenance"
              data-testid={`provenance-${item.id}`}
            >
              <h3 className="label-meta mb-3 text-xs font-semibold uppercase tracking-wide">
                Evidence / Provenance
              </h3>

              {hasProvenanceMetadata(item) ? (
                <dl className="grid grid-cols-1 gap-2 text-sm text-foreground md:grid-cols-2">
                  <div>
                    <dt className="label-meta text-xs">Linked evidence count</dt>
                    <dd>{item.evidence.linkCount}</dd>
                  </div>
                  <div>
                    <dt className="label-meta text-xs">Source type breakdown</dt>
                    <dd>{renderSourceTypeSummary(item.evidence.sourceTypes)}</dd>
                  </div>
                  <div>
                    <dt className="label-meta text-xs">Safety / projection levels</dt>
                    <dd>{renderSafetyLevelSummary(item.evidence.safetyLevels)}</dd>
                  </div>
                  <div>
                    <dt className="label-meta text-xs">Linked source ids</dt>
                    <dd className="break-all">{renderLinkedSourceIds(item)}</dd>
                  </div>
                  <div>
                    <dt className="label-meta text-xs">Derivation run</dt>
                    <dd>{item.diagnostics.latestRunId ?? "None"}</dd>
                  </div>
                  <div>
                    <dt className="label-meta text-xs">Derivation artifact</dt>
                    <dd>
                      {item.diagnostics.latestArtifactId
                        ? `${item.diagnostics.latestArtifactId}${
                            item.diagnostics.latestArtifactType
                              ? ` (${item.diagnostics.latestArtifactType})`
                              : ""
                          }`
                        : "None"}
                    </dd>
                  </div>
                  {item.diagnostics.processorVersion && (
                    <div>
                      <dt className="label-meta text-xs">Processor version</dt>
                      <dd>{item.diagnostics.processorVersion}</dd>
                    </div>
                  )}
                  {item.diagnostics.warnings.length > 0 && (
                    <div className="md:col-span-2">
                      <dt className="label-meta text-xs">Persisted warnings</dt>
                      <dd>{item.diagnostics.warnings.join(", ")}</dd>
                    </div>
                  )}
                  {item.diagnostics.blockedWriteReasons.length > 0 && (
                    <div className="md:col-span-2">
                      <dt className="label-meta text-xs">Persisted blocked reasons</dt>
                      <dd>{item.diagnostics.blockedWriteReasons.join(", ")}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No provenance metadata recorded for this candidate.
                </p>
              )}
            </section>

            <div className="mt-4 border-t border-border/40 pt-4">
              <p className="label-meta mb-2 text-xs">Operator actions</p>

              {item.candidateLifecycleStatus === null ? (
                <p className="text-sm text-muted-foreground">
                  Lifecycle actions are unavailable until this conclusion has an explicit
                  lifecycle status.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {lifecycleActions.map((action) => {
                    const actionKey = `${item.id}:lifecycle:${lifecycleActionToStatus(action)}`;
                    const isPending = pendingKey === actionKey;

                    return (
                      <button
                        key={action}
                        type="button"
                        disabled={cardPending}
                        onClick={() => handleLifecycle(item.id, action)}
                        className={cn(
                          "rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors",
                          "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                          action === "reject" &&
                            "border-destructive/30 text-destructive hover:bg-destructive/10",
                          action === "promote" &&
                            "border-primary/30 text-primary hover:bg-primary/10"
                        )}
                      >
                        {isPending
                          ? "Working…"
                          : INTERNAL_OPERATOR_LIFECYCLE_ACTION_LABELS[action]}
                      </button>
                    );
                  })}

                  {lifecycleActions.length === 0 && !publishAllowed && (
                    <p className="text-sm text-muted-foreground">
                      No lifecycle actions available for this status.
                    </p>
                  )}
                </div>
              )}

              {publishAllowed && (
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={cardPending}
                    onClick={() => handlePublish(item.id)}
                    className={cn(
                      "rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors",
                      "hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                  >
                    {pendingKey === `${item.id}:publish` ? "Publishing…" : "Publish"}
                  </button>
                </div>
              )}

              {errorMessage && (
                <p
                  className="mt-3 text-sm text-destructive"
                  role="alert"
                  data-testid={`operator-error-${item.id}`}
                >
                  {errorMessage}
                </p>
              )}

              {successMessage && (
                <p
                  className="mt-3 text-sm text-primary"
                  role="status"
                  data-testid={`operator-success-${item.id}`}
                >
                  {successMessage}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
