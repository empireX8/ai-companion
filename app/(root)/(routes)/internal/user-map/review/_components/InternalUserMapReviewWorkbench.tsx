"use client";

import type { CandidateLifecycleStatus } from "@prisma/client";
import React, { useCallback, useState } from "react";

import type { InternalFieldworkReviewCandidate } from "@/lib/internal-fieldwork-review-candidates";
import type { InternalInvestigationReviewCandidate } from "../../../../../../../lib/internal-investigation-review-candidates";
import {
  INTERNAL_OPERATOR_LIFECYCLE_ACTION_LABELS,
  canPublishInternalCandidate,
  canPublishInternalFieldworkCandidate,
  canPublishInternalInvestigationCandidate,
  getInternalOperatorLifecycleActions,
  lifecycleActionToStatus,
  type InternalOperatorLifecycleAction,
} from "../../../../../../../lib/internal-user-map-review-operator-actions";
import {
  postInternalCandidateLifecycle,
  postInternalCandidatePublish,
  postInternalFieldworkCandidateLifecycle,
  postInternalFieldworkCandidatePublish,
  postInternalInvestigationCandidateLifecycle,
  postInternalInvestigationCandidatePublish,
} from "../../../../../../../lib/internal-user-map-review-operator-client";
import type { InternalUserMapReviewCandidate } from "../../../../../../../lib/internal-user-map-review-candidates";
import { cn } from "../../../../../../../lib/utils";
import { useRouter } from "next/navigation";

type ReviewTab = "usermap" | "investigation" | "fieldwork";

export type PendingActionKeys = Set<string>;

export function candidateHasPendingAction(
  pendingActions: ReadonlySet<string>,
  candidateId: string
): boolean {
  const prefix = `${candidateId}:`;
  for (const actionKey of pendingActions) {
    if (actionKey.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

export function startPendingAction(
  pendingActions: ReadonlySet<string>,
  actionKey: string
): PendingActionKeys {
  return new Set(pendingActions).add(actionKey);
}

export function endPendingAction(
  pendingActions: ReadonlySet<string>,
  actionKey: string
): PendingActionKeys {
  const next = new Set(pendingActions);
  next.delete(actionKey);
  return next;
}

type Props = {
  userMapCandidates: InternalUserMapReviewCandidate[];
  investigationCandidates: InternalInvestigationReviewCandidate[];
  fieldworkCandidates: InternalFieldworkReviewCandidate[];
  initialTab?: ReviewTab;
};

type EvidenceSummary = InternalUserMapReviewCandidate["evidence"];
type DiagnosticsSummary = InternalUserMapReviewCandidate["diagnostics"];

function formatLifecycleStatus(
  status: CandidateLifecycleStatus | null
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

function renderLinkedSourceIds(
  linkedSources: EvidenceSummary["linkedSources"]
): string {
  if (linkedSources.length === 0) {
    return "None";
  }

  return linkedSources
    .map((source) => {
      const safetySuffix = source.safetyLevel ? ` · ${source.safetyLevel}` : "";
      return `${source.sourceType}/${source.sourceId}${safetySuffix}`;
    })
    .join("; ");
}

function hasProvenanceMetadata(input: {
  evidence: EvidenceSummary;
  diagnostics: DiagnosticsSummary;
}): boolean {
  return (
    input.evidence.linkCount > 0 ||
    Boolean(input.diagnostics.latestRunId) ||
    Boolean(input.diagnostics.latestArtifactId) ||
    input.diagnostics.blockedWriteReasons.length > 0 ||
    input.diagnostics.warnings.length > 0
  );
}

function ProvenanceSection({
  itemId,
  evidence,
  diagnostics,
}: {
  itemId: string;
  evidence: EvidenceSummary;
  diagnostics: DiagnosticsSummary;
}) {
  return (
    <section
      className="mt-4 rounded-md border border-border/60 bg-muted/20 p-4"
      aria-label="Evidence and provenance"
      data-testid={`provenance-${itemId}`}
    >
      <h3 className="label-meta mb-3 text-xs font-semibold uppercase tracking-wide">
        Evidence / Provenance
      </h3>

      {hasProvenanceMetadata({ evidence, diagnostics }) ? (
        <dl className="grid grid-cols-1 gap-2 text-sm text-foreground md:grid-cols-2">
          <div>
            <dt className="label-meta text-xs">Linked evidence count</dt>
            <dd>{evidence.linkCount}</dd>
          </div>
          <div>
            <dt className="label-meta text-xs">Source type breakdown</dt>
            <dd>{renderSourceTypeSummary(evidence.sourceTypes)}</dd>
          </div>
          <div>
            <dt className="label-meta text-xs">Safety / projection levels</dt>
            <dd>{renderSafetyLevelSummary(evidence.safetyLevels)}</dd>
          </div>
          <div>
            <dt className="label-meta text-xs">Linked source ids</dt>
            <dd className="break-all">{renderLinkedSourceIds(evidence.linkedSources)}</dd>
          </div>
          <div>
            <dt className="label-meta text-xs">Derivation run</dt>
            <dd>{diagnostics.latestRunId ?? "None"}</dd>
          </div>
          <div>
            <dt className="label-meta text-xs">Derivation artifact</dt>
            <dd>
              {diagnostics.latestArtifactId
                ? `${diagnostics.latestArtifactId}${
                    diagnostics.latestArtifactType
                      ? ` (${diagnostics.latestArtifactType})`
                      : ""
                  }`
                : "None"}
            </dd>
          </div>
          {diagnostics.processorVersion && (
            <div>
              <dt className="label-meta text-xs">Processor version</dt>
              <dd>{diagnostics.processorVersion}</dd>
            </div>
          )}
          {diagnostics.warnings.length > 0 && (
            <div className="md:col-span-2">
              <dt className="label-meta text-xs">Persisted warnings</dt>
              <dd>{diagnostics.warnings.join(", ")}</dd>
            </div>
          )}
          {diagnostics.blockedWriteReasons.length > 0 && (
            <div className="md:col-span-2">
              <dt className="label-meta text-xs">Persisted blocked reasons</dt>
              <dd>{diagnostics.blockedWriteReasons.join(", ")}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          No provenance metadata recorded for this candidate.
        </p>
      )}
    </section>
  );
}

function OperatorActionsSection({
  candidateId,
  candidateLifecycleStatus,
  publishAllowed,
  cardPending,
  pendingActions,
  errorMessage,
  successMessage,
  onLifecycle,
  onPublish,
}: {
  candidateId: string;
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  publishAllowed: boolean;
  cardPending: boolean;
  pendingActions: ReadonlySet<string>;
  errorMessage?: string;
  successMessage?: string;
  onLifecycle: (
    candidateId: string,
    operatorAction: InternalOperatorLifecycleAction
  ) => void;
  onPublish: (candidateId: string) => void;
}) {
  const lifecycleActions = getInternalOperatorLifecycleActions(candidateLifecycleStatus);

  return (
    <div className="mt-4 border-t border-border/40 pt-4">
      <p className="label-meta mb-2 text-xs">Operator actions</p>

      {candidateLifecycleStatus === null ? (
        <p className="text-sm text-muted-foreground">
          Lifecycle actions are unavailable until this candidate has an explicit
          lifecycle status.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {lifecycleActions.map((action) => {
            const actionKey = `${candidateId}:lifecycle:${lifecycleActionToStatus(action)}`;
            const isPending = pendingActions.has(actionKey);

            return (
              <button
                key={action}
                type="button"
                disabled={cardPending}
                onClick={() => onLifecycle(candidateId, action)}
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
            onClick={() => onPublish(candidateId)}
            className={cn(
              "rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors",
              "hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {pendingActions.has(`${candidateId}:publish`) ? "Publishing…" : "Publish"}
          </button>
        </div>
      )}

      {errorMessage && (
        <p
          className="mt-3 text-sm text-destructive"
          role="alert"
          data-testid={`operator-error-${candidateId}`}
        >
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p
          className="mt-3 text-sm text-primary"
          role="status"
          data-testid={`operator-success-${candidateId}`}
        >
          {successMessage}
        </p>
      )}
    </div>
  );
}

export function InternalUserMapReviewWorkbench({
  userMapCandidates,
  investigationCandidates,
  fieldworkCandidates,
  initialTab = "usermap",
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReviewTab>(initialTab);
  const [pendingActions, setPendingActions] = useState<PendingActionKeys>(new Set());
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
      setPendingActions((prev) => startPendingAction(prev, actionKey));
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
        setPendingActions((prev) => endPendingAction(prev, actionKey));
      }
    },
    [clearCardFeedback, router]
  );

  const handleUserMapLifecycle = useCallback(
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

  const handleUserMapPublish = useCallback(
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

  const handleInvestigationLifecycle = useCallback(
    (candidateId: string, operatorAction: InternalOperatorLifecycleAction) => {
      const newStatus = lifecycleActionToStatus(operatorAction);
      const actionKey = `${candidateId}:lifecycle:${newStatus}`;

      return runAction(candidateId, actionKey, async () => {
        const result = await postInternalInvestigationCandidateLifecycle(
          candidateId,
          newStatus
        );
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

  const handleInvestigationPublish = useCallback(
    (candidateId: string) => {
      const actionKey = `${candidateId}:publish`;

      return runAction(candidateId, actionKey, async () => {
        const result = await postInternalInvestigationCandidatePublish(candidateId);
        if (!result.ok) {
          const codeSuffix = result.code ? ` (${result.code})` : "";
          return {
            ok: false,
            message: `${result.message}${codeSuffix}`,
          };
        }

        return {
          ok: true,
          message:
            "Published to active questions. What Changed will reflect the investigation_opened update.",
        };
      });
    },
    [runAction]
  );

  const handleFieldworkLifecycle = useCallback(
    (candidateId: string, operatorAction: InternalOperatorLifecycleAction) => {
      const newStatus = lifecycleActionToStatus(operatorAction);
      const actionKey = `${candidateId}:lifecycle:${newStatus}`;

      return runAction(candidateId, actionKey, async () => {
        const result = await postInternalFieldworkCandidateLifecycle(
          candidateId,
          newStatus
        );
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

  const handleFieldworkPublish = useCallback(
    (candidateId: string) => {
      const actionKey = `${candidateId}:publish`;

      return runAction(candidateId, actionKey, async () => {
        const result = await postInternalFieldworkCandidatePublish(candidateId);
        if (!result.ok) {
          const codeSuffix = result.code ? ` (${result.code})` : "";
          return {
            ok: false,
            message: `${result.message}${codeSuffix}`,
          };
        }

        return {
          ok: true,
          message:
            "Published to Watch For. What Changed will reflect the fieldwork_assigned update.",
        };
      });
    },
    [runAction]
  );

  const tabButtonClass = (tab: ReviewTab) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      activeTab === tab
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    );

  return (
    <div>
      <div
        className="mb-6 flex gap-2 border-b border-border/60 pb-4"
        role="tablist"
        aria-label="Candidate family"
      >
        <button
          type="button"
          role="tab"
          id="review-tab-usermap"
          aria-controls="review-panel-usermap"
          aria-selected={activeTab === "usermap"}
          className={tabButtonClass("usermap")}
          onClick={() => setActiveTab("usermap")}
          data-testid="review-tab-usermap"
        >
          User Map
        </button>
        <button
          type="button"
          role="tab"
          id="review-tab-investigation"
          aria-controls="review-panel-investigation"
          aria-selected={activeTab === "investigation"}
          className={tabButtonClass("investigation")}
          onClick={() => setActiveTab("investigation")}
          data-testid="review-tab-investigation"
        >
          Investigation
        </button>
        <button
          type="button"
          role="tab"
          id="review-tab-fieldwork"
          aria-controls="review-panel-fieldwork"
          aria-selected={activeTab === "fieldwork"}
          className={tabButtonClass("fieldwork")}
          onClick={() => setActiveTab("fieldwork")}
          data-testid="review-tab-fieldwork"
        >
          Fieldwork
        </button>
      </div>

      {activeTab === "usermap" && (
        <div
          role="tabpanel"
          id="review-panel-usermap"
          aria-labelledby="review-tab-usermap"
          data-testid="review-panel-usermap"
        >
          {userMapCandidates.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                No internal User Map candidates found for this reviewer.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {userMapCandidates.map((item) => {
                const publishAllowed = canPublishInternalCandidate({
                  candidateLifecycleStatus: item.candidateLifecycleStatus,
                  visibility: item.visibility,
                });
                const cardPending = candidateHasPendingAction(pendingActions, item.id);

                return (
                  <article
                    key={item.id}
                    className="rounded-lg border border-border bg-card p-5"
                  >
                    <header className="mb-3">
                      <h2 className="text-base font-semibold text-foreground">
                        {item.title}
                      </h2>
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

                    <ProvenanceSection
                      itemId={item.id}
                      evidence={item.evidence}
                      diagnostics={item.diagnostics}
                    />

                    <OperatorActionsSection
                      candidateId={item.id}
                      candidateLifecycleStatus={item.candidateLifecycleStatus}
                      publishAllowed={publishAllowed}
                      cardPending={cardPending}
                      pendingActions={pendingActions}
                      errorMessage={cardErrors[item.id]}
                      successMessage={cardSuccess[item.id]}
                      onLifecycle={handleUserMapLifecycle}
                      onPublish={handleUserMapPublish}
                    />
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "investigation" && (
        <div
          role="tabpanel"
          id="review-panel-investigation"
          aria-labelledby="review-tab-investigation"
          data-testid="review-panel-investigation"
        >
          {investigationCandidates.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                No internal Investigation candidates found for this reviewer.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {investigationCandidates.map((item) => {
                const publishAllowed = canPublishInternalInvestigationCandidate({
                  candidateLifecycleStatus: item.candidateLifecycleStatus,
                  visibility: item.visibility,
                  status: item.status,
                });
                const cardPending = candidateHasPendingAction(pendingActions, item.id);

                return (
                  <article
                    key={item.id}
                    className="rounded-lg border border-border bg-card p-5"
                  >
                    <header className="mb-3">
                      <h2 className="text-base font-semibold text-foreground">
                        {item.title}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.organizingQuestion}
                      </p>
                      {item.summary !== item.organizingQuestion && (
                        <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
                      )}
                    </header>

                    <dl className="grid grid-cols-1 gap-2 text-sm text-foreground md:grid-cols-2">
                      <div>
                        <dt className="label-meta text-xs">Lifecycle status</dt>
                        <dd>{formatLifecycleStatus(item.candidateLifecycleStatus)}</dd>
                      </div>
                      <div>
                        <dt className="label-meta text-xs">Investigation status</dt>
                        <dd>{item.status}</dd>
                      </div>
                      <div>
                        <dt className="label-meta text-xs">Seed type</dt>
                        <dd>{item.seedType}</dd>
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

                    <ProvenanceSection
                      itemId={item.id}
                      evidence={item.evidence}
                      diagnostics={item.diagnostics}
                    />

                    <OperatorActionsSection
                      candidateId={item.id}
                      candidateLifecycleStatus={item.candidateLifecycleStatus}
                      publishAllowed={publishAllowed}
                      cardPending={cardPending}
                      pendingActions={pendingActions}
                      errorMessage={cardErrors[item.id]}
                      successMessage={cardSuccess[item.id]}
                      onLifecycle={handleInvestigationLifecycle}
                      onPublish={handleInvestigationPublish}
                    />
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "fieldwork" && (
        <div
          role="tabpanel"
          id="review-panel-fieldwork"
          aria-labelledby="review-tab-fieldwork"
          data-testid="review-panel-fieldwork"
        >
          {fieldworkCandidates.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                No internal Fieldwork candidates found for this reviewer.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {fieldworkCandidates.map((item) => {
                const publishAllowed = canPublishInternalFieldworkCandidate({
                  candidateLifecycleStatus: item.candidateLifecycleStatus,
                  visibility: item.visibility,
                  status: item.status,
                });
                const cardPending = candidateHasPendingAction(pendingActions, item.id);

                return (
                  <article
                    key={item.id}
                    className="rounded-lg border border-border bg-card p-5"
                  >
                    <header className="mb-3">
                      <h2 className="text-base font-semibold text-foreground">
                        {item.prompt}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
                    </header>

                    <dl className="grid grid-cols-1 gap-2 text-sm text-foreground md:grid-cols-2">
                      <div>
                        <dt className="label-meta text-xs">Lifecycle status</dt>
                        <dd>{formatLifecycleStatus(item.candidateLifecycleStatus)}</dd>
                      </div>
                      <div>
                        <dt className="label-meta text-xs">Fieldwork status</dt>
                        <dd>{item.status}</dd>
                      </div>
                      <div>
                        <dt className="label-meta text-xs">Visibility</dt>
                        <dd>{item.visibility}</dd>
                      </div>
                      <div>
                        <dt className="label-meta text-xs">Linked object</dt>
                        <dd>
                          {item.linkedObjectType}/{item.linkedObjectId}
                        </dd>
                      </div>
                      {item.expiresAt && (
                        <div>
                          <dt className="label-meta text-xs">Expires</dt>
                          <dd>{formatTimestamp(item.expiresAt)}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="label-meta text-xs">Created</dt>
                        <dd>{formatTimestamp(item.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="label-meta text-xs">Updated</dt>
                        <dd>{formatTimestamp(item.updatedAt)}</dd>
                      </div>
                    </dl>

                    <ProvenanceSection
                      itemId={item.id}
                      evidence={item.evidence}
                      diagnostics={item.diagnostics}
                    />

                    <OperatorActionsSection
                      candidateId={item.id}
                      candidateLifecycleStatus={item.candidateLifecycleStatus}
                      publishAllowed={publishAllowed}
                      cardPending={cardPending}
                      pendingActions={pendingActions}
                      errorMessage={cardErrors[item.id]}
                      successMessage={cardSuccess[item.id]}
                      onLifecycle={handleFieldworkLifecycle}
                      onPublish={handleFieldworkPublish}
                    />
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
