"use client";

import { useEffect, useState } from "react";

import { SectionLabel } from "@/components/orvek-v0/primitives";
import { useDurableActionsRefresh } from "@/lib/orvek-v0/durable-actions-context";
import {
  fetchInspectorInvestigationDetail,
  type InspectorInvestigationDetail,
} from "@/lib/inspector-object-api";
import type { InvestigationAvailableEvidenceItem } from "@/lib/investigation-production-detail";

import { InvestigationDetailActions } from "./InvestigationDetailActions";
import { InvestigationInspectorButton } from "./InvestigationInspectorButton";

type InvestigationWorkbenchDetail = InspectorInvestigationDetail & {
  availableEvidence?: InvestigationAvailableEvidenceItem[];
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_FORMATTER.format(date);
}

function formatResolvedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_FORMATTER.format(date);
}

function renderBulletList(items: string[], fallback: string) {
  if (items.length === 0) {
    return <div className="o-material rounded-[10px] p-3 text-[13px] text-muted-foreground">{fallback}</div>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="o-material rounded-[10px] p-3 text-[13px] text-foreground">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function ProductionInvestigationWorkbenchDetail({
  investigationId,
  fallbackTitle,
  showActions = true,
}: {
  investigationId: string;
  fallbackTitle?: string | null;
  showActions?: boolean;
}) {
  const { revision } = useDurableActionsRefresh();
  const [detail, setDetail] = useState<InvestigationWorkbenchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    void fetchInspectorInvestigationDetail(investigationId).then((next) => {
      if (cancelled) {
        return;
      }
      setDetail((next as InvestigationWorkbenchDetail | null) ?? null);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [investigationId, revision]);

  if (isLoading) {
    return (
      <div className="o-material rounded-[12px] p-4 text-[13px] text-muted-foreground">
        Loading investigation…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="o-material rounded-[12px] p-4 text-[13px] text-muted-foreground">
        Investigation {fallbackTitle ?? investigationId} is unavailable on this production surface.
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="production-investigation-detail">
      <section className="o-material rounded-[12px] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="label-meta text-cyan/70" data-testid="investigation-id">
              Investigation ID {detail.id}
            </div>
            <div className="label-meta mt-1" data-testid="investigation-status">
              Lifecycle {detail.status} · {detail.closureStateLabel}
            </div>
          </div>
          {!showActions ? (
            <InvestigationInspectorButton
              investigationId={detail.id}
              title={detail.title}
              className="rounded-[9px] border border-cyan/25 px-3 py-2 text-[12px] font-medium text-cyan transition hover:bg-cyan/10"
            />
          ) : null}
        </div>
        <h2 className="mt-3 text-lg font-semibold leading-snug text-foreground text-pretty">
          {detail.title}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {detail.organizingQuestion}
        </p>
        <div className="label-meta mt-3">
          Created {formatDateTime(detail.createdAt)} · Updated {formatDateTime(detail.updatedAt)}
          {typeof detail.priority === "number" ? ` · Priority ${detail.priority}` : ""}
        </div>
        {detail.isClosed ? (
          <div className="mt-3 space-y-2">
            <div className="rounded-[10px] bg-secondary/60 px-3 py-2 text-[12px] text-muted-foreground">
              This investigation remains reviewable after closure, but it no longer belongs in the
              active question list.
            </div>
            {!showActions ? (
              <div className="rounded-[10px] border border-white/10 bg-black/15 px-3 py-2 text-[12px] text-muted-foreground">
                Reopening is not exposed on this production surface.
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {showActions ? (
        <InvestigationDetailActions
          investigationId={detail.id}
          title={detail.title}
          status={detail.status}
          resolutionSummary={detail.resolutionSummary}
          availableEvidence={detail.availableEvidence ?? []}
          useRouterRefresh={false}
        />
      ) : null}

      <section>
        <SectionLabel>Competing theories</SectionLabel>
        <div className="mt-2">
          {renderBulletList(
            detail.competingTheories,
            "No competing theories have been recorded for this investigation yet."
          )}
        </div>
      </section>

      <section>
        <SectionLabel>Evidence still needed</SectionLabel>
        <div className="mt-2">
          {renderBulletList(
            detail.evidenceNeeded,
            "No specific evidence requests are recorded yet."
          )}
        </div>
      </section>

      <section className="o-material rounded-[12px] p-4">
        <SectionLabel>Outcome and closure</SectionLabel>
        <p className="mt-2 text-[13px] leading-relaxed text-foreground">
          {detail.resolutionSummary ?? "No durable outcome has been recorded for this investigation yet."}
        </p>
        <div className="label-meta mt-3">
          {formatResolvedAt(detail.resolvedAt)
            ? `Resolved ${formatResolvedAt(detail.resolvedAt)}`
            : "Still open — not resolved yet."}
        </div>
        {detail.reopenReason ? (
          <div className="label-meta mt-1">Reopen reason: {detail.reopenReason}</div>
        ) : null}
      </section>

      <section>
        <SectionLabel>Linked evidence</SectionLabel>
        {detail.linkedEvidence.length === 0 ? (
          <div
            className="o-material mt-2 rounded-[10px] p-3 text-[13px] text-muted-foreground"
            data-testid="investigation-linked-evidence-empty"
          >
            No evidence spans are linked to this investigation yet.
          </div>
        ) : (
          <div className="mt-2 space-y-3" data-testid="investigation-linked-evidence-list">
            {detail.linkedEvidence.map((evidence) => (
              <article
                key={evidence.linkId}
                className="o-material rounded-[10px] p-3"
                data-testid="investigation-linked-evidence-item"
              >
                <div className="label-meta text-cyan/70">Evidence ID {evidence.evidenceId}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-foreground">
                  {evidence.excerpt}
                </p>
                <div className="label-meta mt-2">
                  Role {evidence.role.replace(/_/g, " ")} · Linked {formatDateTime(evidence.createdAt)}
                </div>
                <div className="label-meta mt-1">
                  Message ID {evidence.messageId}
                  {evidence.sessionLabel ? ` · ${evidence.sessionLabel}` : ""}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionLabel>Linked fieldwork and check-ins</SectionLabel>
        {detail.linkedFieldwork.length === 0 ? (
          <div
            className="o-material mt-2 rounded-[10px] p-3 text-[13px] text-muted-foreground"
            data-testid="investigation-linked-fieldwork-empty"
          >
            No watch-for prompts or fieldwork check-ins are linked to this investigation yet.
          </div>
        ) : (
          <div className="mt-2 space-y-3" data-testid="investigation-linked-fieldwork-list">
            {detail.linkedFieldwork.map((fieldwork) => (
              <article
                key={fieldwork.id}
                className="o-material rounded-[10px] p-3"
                data-testid="investigation-linked-fieldwork-item"
              >
                <div className="label-meta text-cyan/70">Fieldwork ID {fieldwork.id}</div>
                <h3 className="mt-1 text-[14px] font-medium leading-snug text-foreground">
                  {fieldwork.prompt}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {fieldwork.reason}
                </p>
                <div className="label-meta mt-2">
                  {fieldwork.statusLabel} · Updated {formatDateTime(fieldwork.updatedAt)}
                </div>
                <div className="mt-2 text-[12px] text-muted-foreground">
                  Observation note: {fieldwork.observationNote ?? "Not recorded yet."}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  Observation outcome: {fieldwork.observationOutcome ?? "Not recorded yet."}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
