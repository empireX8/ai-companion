"use client";

import type { CandidateLifecycleStatus } from "@prisma/client";
import React, { useCallback, useState } from "react";

import type { InternalFieldworkReviewCandidate } from "@/lib/internal-fieldwork-review-candidates";
import type { InternalModelUpdateReviewCandidate } from "@/lib/internal-model-update-review-candidates";
import type { InternalInvestigationReviewCandidate } from "../../../../../../../lib/internal-investigation-review-candidates";
import {
  INTERNAL_OPERATOR_LIFECYCLE_ACTION_LABELS,
  LIFECYCLE_TRIAGE_BUCKET_LABELS,
  LIFECYCLE_TRIAGE_BUCKET_ORDER,
  MODEL_UPDATE_TRIAGE_BUCKET_LABELS,
  MODEL_UPDATE_TRIAGE_BUCKET_ORDER,
  canPublishInternalCandidate,
  canPublishInternalFieldworkCandidate,
  canPublishInternalInvestigationCandidate,
  canPublishInternalModelUpdateCandidate,
  formatReviewTabLabel,
  getFieldworkReviewTriageBucket,
  getInternalOperatorLifecycleActions,
  getInvestigationReviewTriageBucket,
  getModelUpdateReviewTriageBucket,
  getUserMapReviewTriageBucket,
  groupReviewCandidatesByTriage,
  lifecycleActionToStatus,
  type InternalOperatorLifecycleAction,
  type ReviewTriageFilter,
} from "../../../../../../../lib/internal-user-map-review-operator-actions";
import {
  postInternalCandidateLifecycle,
  postInternalCandidatePublish,
  postInternalFieldworkCandidateLifecycle,
  postInternalFieldworkCandidatePublish,
  postInternalInvestigationCandidateLifecycle,
  postInternalInvestigationCandidatePublish,
  postInternalModelUpdateCandidatePublish,
} from "../../../../../../../lib/internal-user-map-review-operator-client";
import type { InternalUserMapReviewCandidate } from "../../../../../../../lib/internal-user-map-review-candidates";
import { cn } from "../../../../../../../lib/utils";
import { useRouter } from "next/navigation";

type ReviewTab = "usermap" | "investigation" | "fieldwork" | "modelupdate";

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
  modelUpdateCandidates: InternalModelUpdateReviewCandidate[];
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

const TRIAGE_FILTER_OPTIONS: Array<{ value: ReviewTriageFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "publish_ready", label: "Ready to publish" },
  { value: "needs_action", label: "Needs action" },
];

function reviewCardClass(cardPending: boolean, hasError: boolean): string {
  return cn(
    "rounded-lg border bg-card p-5 transition-colors",
    cardPending && "border-primary/40 shadow-sm",
    hasError && "border-destructive/50",
    !cardPending && !hasError && "border-border"
  );
}

function ReviewTriageBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
  );
}

function ReviewTriageFilterBar({
  family,
  filter,
  onChange,
  visibleCount,
  totalCount,
}: {
  family: ReviewTab;
  filter: ReviewTriageFilter;
  onChange: (filter: ReviewTriageFilter) => void;
  visibleCount: number;
  totalCount: number;
}) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/10 px-4 py-3"
      data-testid={`review-filter-bar-${family}`}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Triage filter">
        {TRIAGE_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            data-testid={`review-filter-${family}-${option.value}`}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              filter === option.value
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p
        className="text-xs text-muted-foreground"
        data-testid={`review-filter-summary-${family}`}
      >
        Showing {visibleCount} of {totalCount}
      </p>
    </div>
  );
}

function ReviewEmptyState({
  family,
  variant,
}: {
  family: ReviewTab;
  variant: "none" | "filtered";
}) {
  const copy: Record<
    ReviewTab,
    { none: { title: string; body: string }; filtered: { title: string; body: string } }
  > = {
    usermap: {
      none: {
        title: "No User Map candidates",
        body: "Internal-only User Map conclusions awaiting review will appear here.",
      },
      filtered: {
        title: "No User Map candidates match this filter",
        body: "Try another triage filter or check other families.",
      },
    },
    investigation: {
      none: {
        title: "No Investigation candidates",
        body: "Internal-only investigations awaiting lifecycle review will appear here.",
      },
      filtered: {
        title: "No Investigation candidates match this filter",
        body: "Try another triage filter or check other families.",
      },
    },
    fieldwork: {
      none: {
        title: "No Fieldwork candidates",
        body: "Internal-only fieldwork assignments awaiting review will appear here.",
      },
      filtered: {
        title: "No Fieldwork candidates match this filter",
        body: "Try another triage filter or check other families.",
      },
    },
    modelupdate: {
      none: {
        title: "No ModelUpdate candidates",
        body: "Internal-only, non-meaningful ModelUpdates awaiting publish will appear here.",
      },
      filtered: {
        title: "No ModelUpdate candidates match this filter",
        body: "Try another triage filter or check other families.",
      },
    },
  };

  const content = copy[family][variant];

  return (
    <div
      className="rounded-lg border border-dashed border-border/70 bg-card p-6"
      data-testid={`review-empty-${family}-${variant}`}
    >
      <p className="text-sm font-medium text-foreground">{content.title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{content.body}</p>
    </div>
  );
}

function TriageGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <h3
      className="label-meta text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      data-testid="review-triage-group-header"
    >
      {label} ({count})
    </h3>
  );
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
    <div className="mt-4 border-t border-border/40 pt-4" data-testid={`operator-actions-${candidateId}`}>
      <p className="label-meta mb-3 text-xs font-semibold uppercase tracking-wide">
        Operator actions
      </p>

      {candidateLifecycleStatus === null ? (
        <p className="text-sm text-muted-foreground">
          Lifecycle actions are unavailable until this candidate has an explicit
          lifecycle status.
        </p>
      ) : lifecycleActions.length > 0 ? (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">Lifecycle review</p>
          <div className="flex flex-wrap gap-2">
            {lifecycleActions.map((action) => {
              const actionKey = `${candidateId}:lifecycle:${lifecycleActionToStatus(action)}`;
              const isPending = pendingActions.has(actionKey);

              return (
                <button
                  key={action}
                  type="button"
                  disabled={cardPending}
                  aria-busy={isPending}
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
          </div>
        </div>
      ) : !publishAllowed ? (
        <p className="text-sm text-muted-foreground">
          No lifecycle actions available for this status.
        </p>
      ) : null}

      {publishAllowed && (
        <div className={lifecycleActions.length > 0 ? "mt-4" : undefined}>
          <p className="mb-2 text-xs text-muted-foreground">
            Publish to user-visible surface
          </p>
          <button
            type="button"
            disabled={cardPending}
            aria-busy={pendingActions.has(`${candidateId}:publish`)}
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
          className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
          data-testid={`operator-error-${candidateId}`}
        >
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p
          className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary"
          role="status"
          data-testid={`operator-success-${candidateId}`}
        >
          {successMessage}
        </p>
      )}
    </div>
  );
}

function ModelUpdatePublishActionsSection({
  candidateId,
  publishAllowed,
  evidenceLinkCount,
  cardPending,
  pendingActions,
  errorMessage,
  successMessage,
  onPublish,
}: {
  candidateId: string;
  publishAllowed: boolean;
  evidenceLinkCount: number;
  cardPending: boolean;
  pendingActions: ReadonlySet<string>;
  errorMessage?: string;
  successMessage?: string;
  onPublish: (candidateId: string) => void;
}) {
  return (
    <div className="mt-4 border-t border-border/40 pt-4" data-testid={`operator-actions-${candidateId}`}>
      <p className="label-meta mb-3 text-xs font-semibold uppercase tracking-wide">
        Operator actions
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        Publish to What Changed (publish-only — no lifecycle actions)
      </p>

      {publishAllowed ? (
        <button
          type="button"
          disabled={cardPending}
          aria-busy={pendingActions.has(`${candidateId}:publish`)}
          onClick={() => onPublish(candidateId)}
          className={cn(
            "rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors",
            "hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {pendingActions.has(`${candidateId}:publish`) ? "Publishing…" : "Publish"}
        </button>
      ) : evidenceLinkCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          Needs linked evidence before publish.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Publish is not available for this candidate.
        </p>
      )}

      {errorMessage && (
        <p
          className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
          data-testid={`operator-error-${candidateId}`}
        >
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p
          className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary"
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
  modelUpdateCandidates,
  initialTab = "usermap",
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReviewTab>(initialTab);
  const [triageFilter, setTriageFilter] = useState<ReviewTriageFilter>("all");
  const [pendingActions, setPendingActions] = useState<PendingActionKeys>(new Set());
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [cardSuccess, setCardSuccess] = useState<Record<string, string>>({});

  const userMapPublishReadyCount = userMapCandidates.filter((item) =>
    canPublishInternalCandidate({
      candidateLifecycleStatus: item.candidateLifecycleStatus,
      visibility: item.visibility,
    })
  ).length;
  const investigationPublishReadyCount = investigationCandidates.filter((item) =>
    canPublishInternalInvestigationCandidate({
      candidateLifecycleStatus: item.candidateLifecycleStatus,
      visibility: item.visibility,
      status: item.status,
    })
  ).length;
  const fieldworkPublishReadyCount = fieldworkCandidates.filter((item) =>
    canPublishInternalFieldworkCandidate({
      candidateLifecycleStatus: item.candidateLifecycleStatus,
      visibility: item.visibility,
      status: item.status,
    })
  ).length;
  const modelUpdatePublishReadyCount = modelUpdateCandidates.filter((item) =>
    canPublishInternalModelUpdateCandidate({
      visibility: item.visibility,
      isMeaningful: item.isMeaningful,
      evidenceLinkCount: item.evidence.linkCount,
    })
  ).length;

  const userMapGroups = groupReviewCandidatesByTriage({
    items: userMapCandidates,
    getBucket: (item) =>
      getUserMapReviewTriageBucket({
        candidateLifecycleStatus: item.candidateLifecycleStatus,
        visibility: item.visibility,
      }),
    filter: triageFilter,
    bucketOrder: LIFECYCLE_TRIAGE_BUCKET_ORDER,
    getSortTimestamp: (item) => item.updatedAt,
  });
  const investigationGroups = groupReviewCandidatesByTriage({
    items: investigationCandidates,
    getBucket: (item) =>
      getInvestigationReviewTriageBucket({
        candidateLifecycleStatus: item.candidateLifecycleStatus,
        visibility: item.visibility,
        status: item.status,
      }),
    filter: triageFilter,
    bucketOrder: LIFECYCLE_TRIAGE_BUCKET_ORDER,
    getSortTimestamp: (item) => item.updatedAt,
  });
  const fieldworkGroups = groupReviewCandidatesByTriage({
    items: fieldworkCandidates,
    getBucket: (item) =>
      getFieldworkReviewTriageBucket({
        candidateLifecycleStatus: item.candidateLifecycleStatus,
        visibility: item.visibility,
        status: item.status,
      }),
    filter: triageFilter,
    bucketOrder: LIFECYCLE_TRIAGE_BUCKET_ORDER,
    getSortTimestamp: (item) => item.updatedAt,
  });
  const modelUpdateGroups = groupReviewCandidatesByTriage({
    items: modelUpdateCandidates,
    getBucket: (item) =>
      getModelUpdateReviewTriageBucket({
        visibility: item.visibility,
        isMeaningful: item.isMeaningful,
        evidenceLinkCount: item.evidence.linkCount,
      }),
    filter: triageFilter,
    bucketOrder: MODEL_UPDATE_TRIAGE_BUCKET_ORDER,
    getSortTimestamp: (item) => item.createdAt,
  });

  const userMapVisibleCount = userMapGroups.reduce(
    (count, group) => count + group.items.length,
    0
  );
  const investigationVisibleCount = investigationGroups.reduce(
    (count, group) => count + group.items.length,
    0
  );
  const fieldworkVisibleCount = fieldworkGroups.reduce(
    (count, group) => count + group.items.length,
    0
  );
  const modelUpdateVisibleCount = modelUpdateGroups.reduce(
    (count, group) => count + group.items.length,
    0
  );

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

  const handleModelUpdatePublish = useCallback(
    (candidateId: string) => {
      const actionKey = `${candidateId}:publish`;

      return runAction(candidateId, actionKey, async () => {
        const result = await postInternalModelUpdateCandidatePublish(candidateId);
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
            "Published to user-visible What Changed. The update is now meaningful.",
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
          {formatReviewTabLabel(
            "User Map",
            userMapCandidates.length,
            userMapPublishReadyCount
          )}
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
          {formatReviewTabLabel(
            "Investigation",
            investigationCandidates.length,
            investigationPublishReadyCount
          )}
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
          {formatReviewTabLabel(
            "Fieldwork",
            fieldworkCandidates.length,
            fieldworkPublishReadyCount
          )}
        </button>
        <button
          type="button"
          role="tab"
          id="review-tab-modelupdate"
          aria-controls="review-panel-modelupdate"
          aria-selected={activeTab === "modelupdate"}
          className={tabButtonClass("modelupdate")}
          onClick={() => setActiveTab("modelupdate")}
          data-testid="review-tab-modelupdate"
        >
          {formatReviewTabLabel(
            "ModelUpdate",
            modelUpdateCandidates.length,
            modelUpdatePublishReadyCount
          )}
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
            <ReviewEmptyState family="usermap" variant="none" />
          ) : (
            <>
              <ReviewTriageFilterBar
                family="usermap"
                filter={triageFilter}
                onChange={setTriageFilter}
                visibleCount={userMapVisibleCount}
                totalCount={userMapCandidates.length}
              />
              {userMapVisibleCount === 0 ? (
                <ReviewEmptyState family="usermap" variant="filtered" />
              ) : (
                <div className="space-y-6">
                  {userMapGroups.map((group) => (
                    <section key={group.bucket} className="space-y-4">
                      <TriageGroupHeader
                        label={LIFECYCLE_TRIAGE_BUCKET_LABELS[group.bucket]}
                        count={group.items.length}
                      />
                      {group.items.map((item) => {
                        const publishAllowed = canPublishInternalCandidate({
                          candidateLifecycleStatus: item.candidateLifecycleStatus,
                          visibility: item.visibility,
                        });
                        const triageBucket = getUserMapReviewTriageBucket({
                          candidateLifecycleStatus: item.candidateLifecycleStatus,
                          visibility: item.visibility,
                        });
                        const cardPending = candidateHasPendingAction(
                          pendingActions,
                          item.id
                        );
                        const hasError = Boolean(cardErrors[item.id]);

                        return (
                          <article
                            key={item.id}
                            className={reviewCardClass(cardPending, hasError)}
                            aria-busy={cardPending}
                          >
                            <header className="mb-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-semibold text-foreground">
                                  {item.title}
                                </h2>
                                <ReviewTriageBadge
                                  label={LIFECYCLE_TRIAGE_BUCKET_LABELS[triageBucket]}
                                />
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {item.summary}
                              </p>
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
                    </section>
                  ))}
                </div>
              )}
            </>
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
            <ReviewEmptyState family="investigation" variant="none" />
          ) : (
            <>
              <ReviewTriageFilterBar
                family="investigation"
                filter={triageFilter}
                onChange={setTriageFilter}
                visibleCount={investigationVisibleCount}
                totalCount={investigationCandidates.length}
              />
              {investigationVisibleCount === 0 ? (
                <ReviewEmptyState family="investigation" variant="filtered" />
              ) : (
                <div className="space-y-6">
                  {investigationGroups.map((group) => (
                    <section key={group.bucket} className="space-y-4">
                      <TriageGroupHeader
                        label={LIFECYCLE_TRIAGE_BUCKET_LABELS[group.bucket]}
                        count={group.items.length}
                      />
                      {group.items.map((item) => {
                        const publishAllowed = canPublishInternalInvestigationCandidate({
                          candidateLifecycleStatus: item.candidateLifecycleStatus,
                          visibility: item.visibility,
                          status: item.status,
                        });
                        const triageBucket = getInvestigationReviewTriageBucket({
                          candidateLifecycleStatus: item.candidateLifecycleStatus,
                          visibility: item.visibility,
                          status: item.status,
                        });
                        const cardPending = candidateHasPendingAction(
                          pendingActions,
                          item.id
                        );
                        const hasError = Boolean(cardErrors[item.id]);

                        return (
                          <article
                            key={item.id}
                            className={reviewCardClass(cardPending, hasError)}
                            aria-busy={cardPending}
                          >
                            <header className="mb-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-semibold text-foreground">
                                  {item.title}
                                </h2>
                                <ReviewTriageBadge
                                  label={LIFECYCLE_TRIAGE_BUCKET_LABELS[triageBucket]}
                                />
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {item.organizingQuestion}
                              </p>
                              {item.summary !== item.organizingQuestion && (
                                <p className="mt-2 text-sm text-muted-foreground">
                                  {item.summary}
                                </p>
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
                    </section>
                  ))}
                </div>
              )}
            </>
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
            <ReviewEmptyState family="fieldwork" variant="none" />
          ) : (
            <>
              <ReviewTriageFilterBar
                family="fieldwork"
                filter={triageFilter}
                onChange={setTriageFilter}
                visibleCount={fieldworkVisibleCount}
                totalCount={fieldworkCandidates.length}
              />
              {fieldworkVisibleCount === 0 ? (
                <ReviewEmptyState family="fieldwork" variant="filtered" />
              ) : (
                <div className="space-y-6">
                  {fieldworkGroups.map((group) => (
                    <section key={group.bucket} className="space-y-4">
                      <TriageGroupHeader
                        label={LIFECYCLE_TRIAGE_BUCKET_LABELS[group.bucket]}
                        count={group.items.length}
                      />
                      {group.items.map((item) => {
                        const publishAllowed = canPublishInternalFieldworkCandidate({
                          candidateLifecycleStatus: item.candidateLifecycleStatus,
                          visibility: item.visibility,
                          status: item.status,
                        });
                        const triageBucket = getFieldworkReviewTriageBucket({
                          candidateLifecycleStatus: item.candidateLifecycleStatus,
                          visibility: item.visibility,
                          status: item.status,
                        });
                        const cardPending = candidateHasPendingAction(
                          pendingActions,
                          item.id
                        );
                        const hasError = Boolean(cardErrors[item.id]);

                        return (
                          <article
                            key={item.id}
                            className={reviewCardClass(cardPending, hasError)}
                            aria-busy={cardPending}
                          >
                            <header className="mb-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-semibold text-foreground">
                                  {item.prompt}
                                </h2>
                                <ReviewTriageBadge
                                  label={LIFECYCLE_TRIAGE_BUCKET_LABELS[triageBucket]}
                                />
                              </div>
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
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "modelupdate" && (
        <div
          role="tabpanel"
          id="review-panel-modelupdate"
          aria-labelledby="review-tab-modelupdate"
          data-testid="review-panel-modelupdate"
        >
          {modelUpdateCandidates.length === 0 ? (
            <ReviewEmptyState family="modelupdate" variant="none" />
          ) : (
            <>
              <ReviewTriageFilterBar
                family="modelupdate"
                filter={triageFilter}
                onChange={setTriageFilter}
                visibleCount={modelUpdateVisibleCount}
                totalCount={modelUpdateCandidates.length}
              />
              {modelUpdateVisibleCount === 0 ? (
                <ReviewEmptyState family="modelupdate" variant="filtered" />
              ) : (
                <div className="space-y-6">
                  {modelUpdateGroups.map((group) => (
                    <section key={group.bucket} className="space-y-4">
                      <TriageGroupHeader
                        label={MODEL_UPDATE_TRIAGE_BUCKET_LABELS[group.bucket]}
                        count={group.items.length}
                      />
                      {group.items.map((item) => {
                        const publishAllowed = canPublishInternalModelUpdateCandidate({
                          visibility: item.visibility,
                          isMeaningful: item.isMeaningful,
                          evidenceLinkCount: item.evidence.linkCount,
                        });
                        const triageBucket = getModelUpdateReviewTriageBucket({
                          visibility: item.visibility,
                          isMeaningful: item.isMeaningful,
                          evidenceLinkCount: item.evidence.linkCount,
                        });
                        const cardPending = candidateHasPendingAction(
                          pendingActions,
                          item.id
                        );
                        const hasError = Boolean(cardErrors[item.id]);

                        return (
                          <article
                            key={item.id}
                            className={reviewCardClass(cardPending, hasError)}
                            aria-busy={cardPending}
                          >
                            <header className="mb-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-semibold text-foreground">
                                  {item.userFacingSummary}
                                </h2>
                                <ReviewTriageBadge
                                  label={MODEL_UPDATE_TRIAGE_BUCKET_LABELS[triageBucket]}
                                />
                              </div>
                            </header>

                            <dl className="grid grid-cols-1 gap-2 text-sm text-foreground md:grid-cols-2">
                              <div>
                                <dt className="label-meta text-xs">Update type</dt>
                                <dd>{item.updateType}</dd>
                              </div>
                              <div>
                                <dt className="label-meta text-xs">Affected object</dt>
                                <dd>
                                  {item.affectedObjectType}/{item.affectedObjectId}
                                </dd>
                              </div>
                              {item.beforeSummary && (
                                <div className="md:col-span-2">
                                  <dt className="label-meta text-xs">Before summary</dt>
                                  <dd>{item.beforeSummary}</dd>
                                </div>
                              )}
                              {item.afterSummary && (
                                <div className="md:col-span-2">
                                  <dt className="label-meta text-xs">After summary</dt>
                                  <dd>{item.afterSummary}</dd>
                                </div>
                              )}
                              {item.confidenceDelta !== null && (
                                <div>
                                  <dt className="label-meta text-xs">Confidence delta</dt>
                                  <dd>{item.confidenceDelta}</dd>
                                </div>
                              )}
                              <div>
                                <dt className="label-meta text-xs">Visibility</dt>
                                <dd>{item.visibility}</dd>
                              </div>
                              <div>
                                <dt className="label-meta text-xs">Meaningful</dt>
                                <dd>{item.isMeaningful ? "true" : "false"}</dd>
                              </div>
                              <div>
                                <dt className="label-meta text-xs">Created</dt>
                                <dd>{formatTimestamp(item.createdAt)}</dd>
                              </div>
                            </dl>

                            <ProvenanceSection
                              itemId={item.id}
                              evidence={item.evidence}
                              diagnostics={item.diagnostics}
                            />

                            <ModelUpdatePublishActionsSection
                              candidateId={item.id}
                              publishAllowed={publishAllowed}
                              evidenceLinkCount={item.evidence.linkCount}
                              cardPending={cardPending}
                              pendingActions={pendingActions}
                              errorMessage={cardErrors[item.id]}
                              successMessage={cardSuccess[item.id]}
                              onPublish={handleModelUpdatePublish}
                            />
                          </article>
                        );
                      })}
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
