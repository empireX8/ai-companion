import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { InvestigationDetailActions } from "@/components/investigations/InvestigationDetailActions";
import { InvestigationDetailInspectorSync } from "@/components/investigations/InvestigationDetailInspectorSync";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import {
  listAvailableEvidenceSpansForUser,
  loadProductionInvestigationDetail,
} from "@/lib/investigation-production-detail";
import { ACTIVE_QUESTIONS_COMPETING_THEORIES_EMPTY } from "../../../../../lib/active-questions-surface";

export const dynamic = "force-dynamic";

const LINKED_TARGET_INTRO =
  "When this question resolves into a map conclusion, a verified link appears here.";

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
    return <div className="card-standard p-4 text-[13px] text-meta">{fallback}</div>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="card-standard p-4 text-[13.5px] text-[hsl(216_11%_70%)]">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function ActiveQuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    notFound();
  }

  const { id } = await params;
  const [item, availableEvidence] = await Promise.all([
    loadProductionInvestigationDetail({ userId, id }),
    listAvailableEvidenceSpansForUser({ userId, investigationId: id }),
  ]);

  if (!item) {
    notFound();
  }

  return (
    <div className="px-12 py-10 max-w-[980px] mx-auto animate-fade-in">
      <InvestigationDetailInspectorSync
        investigationId={item.id}
        title={item.title}
      />

      <Link
        href="/active-questions"
        className="label-meta text-meta hover:text-cyan transition-colors mb-6 inline-block"
      >
        ← Back to Active Questions
      </Link>

      <PageHeader
        eyebrow={`${item.statusLabel} · ${item.seedTypeLabel}`}
        title={item.title}
      />

      <section className="card-standard p-5 mb-8">
        <SectionLabel>Organizing question</SectionLabel>
        <p className="text-[14px] text-[hsl(216_11%_70%)] leading-relaxed">
          {item.organizingQuestion}
        </p>
        <div className="label-meta mt-4">
          Created {formatDateTime(item.createdAt)} · Updated {formatDateTime(item.updatedAt)}
          {typeof item.priority === "number" ? ` · Priority ${item.priority}` : ""}
        </div>
        <div
          className="label-meta mt-2 text-cyan/70"
          data-testid="investigation-id"
        >
          Investigation ID {item.id}
        </div>
        <div className="label-meta mt-1" data-testid="investigation-status">
          Lifecycle {item.status} · {item.closureStateLabel}
        </div>
        {item.isClosed ? (
          <div className="mt-3 rounded-[10px] bg-black/20 px-3 py-2 text-[12px] text-[hsl(216_11%_70%)]">
            This investigation remains reviewable at the same URL, but it no longer appears in the
            active list.
          </div>
        ) : null}
      </section>

      <InvestigationDetailActions
        investigationId={item.id}
        title={item.title}
        status={item.status}
        resolutionSummary={item.resolutionSummary}
        availableEvidence={availableEvidence}
      />

      <section className="mb-8">
        <SectionLabel>Competing theories</SectionLabel>
        {renderBulletList(
          item.competingTheories,
          ACTIVE_QUESTIONS_COMPETING_THEORIES_EMPTY
        )}
      </section>

      <section className="mb-8">
        <SectionLabel>Evidence still needed</SectionLabel>
        {renderBulletList(
          item.evidenceNeeded,
          "No specific evidence requests recorded yet."
        )}
      </section>

      <section className="mb-8">
        <SectionLabel>Resolution status</SectionLabel>
        <div className="card-standard p-5">
          <div className="text-[13.5px] text-[hsl(216_11%_70%)] leading-relaxed">
            {item.resolutionSummary ?? "This question has not reached a resolution summary yet."}
          </div>
          <div className="label-meta mt-3">
            {formatResolvedAt(item.resolvedAt)
              ? `Resolved ${formatResolvedAt(item.resolvedAt)}`
              : "Still open — not resolved yet."}
          </div>
          {item.reopenReason ? (
            <div className="label-meta mt-2">Reopen reason: {item.reopenReason}</div>
          ) : null}
        </div>
      </section>

      <section className="mb-8">
        <SectionLabel>Linked evidence</SectionLabel>
        {item.linkedEvidence.length === 0 ? (
          <div className="card-standard p-4 text-[13px] text-meta">
            No evidence spans are linked to this investigation yet.
          </div>
        ) : (
          <div className="space-y-3" data-testid="investigation-linked-evidence-list">
            {item.linkedEvidence.map((evidence) => (
              <article
                key={evidence.linkId}
                className="card-standard p-4"
                data-testid="investigation-linked-evidence-item"
              >
                <div className="label-meta text-cyan/70">
                  Evidence ID {evidence.evidenceId}
                </div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[hsl(216_11%_70%)]">
                  {evidence.excerpt}
                </p>
                <div className="label-meta mt-3">
                  Role {evidence.role.replace(/_/g, " ")} · Linked{" "}
                  {formatDateTime(evidence.createdAt)}
                </div>
                <div className="label-meta mt-1">
                  Message ID {evidence.messageId}
                  {evidence.sessionLabel ? ` · ${evidence.sessionLabel}` : ""}
                </div>
                <div className="mt-2">
                  <Link href={evidence.evidenceHref} className="text-cyan hover:underline">
                    Inspect evidence span
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionLabel>Linked fieldwork and check-ins</SectionLabel>
        {item.linkedFieldwork.length === 0 ? (
          <div className="card-standard p-4 text-[13px] text-meta">
            No watch-for prompts or fieldwork check-ins are linked to this investigation yet.
          </div>
        ) : (
          <div className="space-y-3" data-testid="investigation-linked-fieldwork-list">
            {item.linkedFieldwork.map((fieldwork) => (
              <article
                key={fieldwork.id}
                className="card-standard p-4"
                data-testid="investigation-linked-fieldwork-item"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="label-meta text-cyan/70">
                      Fieldwork ID {fieldwork.id}
                    </div>
                    <h2 className="mt-1 text-[15px] font-medium leading-snug text-foreground">
                      {fieldwork.prompt}
                    </h2>
                    <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_70%)]">
                      {fieldwork.reason}
                    </p>
                    <div className="label-meta mt-3">
                      {fieldwork.statusLabel} · Updated {formatDateTime(fieldwork.updatedAt)}
                    </div>
                    <div className="mt-2 text-[12px] text-[hsl(216_11%_70%)]">
                      Observation note: {fieldwork.observationNote ?? "Not recorded yet."}
                    </div>
                    <div className="mt-1 text-[12px] text-[hsl(216_11%_70%)]">
                      Observation outcome: {fieldwork.observationOutcome ?? "Not recorded yet."}
                    </div>
                  </div>
                  {fieldwork.detailHref ? (
                    <Link href={fieldwork.detailHref} className="text-cyan hover:underline">
                      Open watch-for
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionLabel>Connected map item</SectionLabel>
        <p className="text-[13px] text-meta mb-3">{LINKED_TARGET_INTRO}</p>
        <div className="card-standard p-4 text-[13px] text-[hsl(216_11%_70%)]">
          <PublicLinkedObjectContinuity
            objectType="usermap_conclusion"
            objectId={item.resolvedConclusionId}
            href={item.resolvedConclusionHref}
            context="linked_target"
            linkClassName="text-cyan hover:underline"
            containerClassName="text-[13px] text-[hsl(216_11%_70%)]"
          />
        </div>
      </section>
    </div>
  );
}
