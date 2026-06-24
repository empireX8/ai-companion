import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { UnderstandingLinkTargetType } from "@prisma/client";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { WatchForInspectorAction } from "@/components/watch-for/WatchForInspectorAction";
import { PublicLinkedObjectContinuity } from "../../../../../lib/public-continuity-display";
import { resolvePublicLinkedObjectHref } from "@/lib/public-linked-object-continuity";
import { listPublicEvidenceContinuityForTarget } from "@/lib/public-evidence-continuity";
import prismadb from "@/lib/prismadb";
import {
  formatFieldworkStatus,
  formatLinkedObjectType,
} from "@/lib/public-intelligence-safe-slice";
import { buildPublicWatchForWhere } from "@/lib/watch-for";
import {
  formatWatchForListDateTime,
  toWatchForFieldActionHint,
  WATCH_FOR_DETAIL_BACK_LABEL,
  WATCH_FOR_DETAIL_EVIDENCE_EMPTY,
  WATCH_FOR_DETAIL_EVIDENCE_INTRO,
  WATCH_FOR_DETAIL_EVIDENCE_LABEL,
  WATCH_FOR_DETAIL_LINKED_CONTEXT_INTRO,
  WATCH_FOR_DETAIL_LINKED_CONTEXT_LABEL,
  WATCH_FOR_DETAIL_OBSERVATION_INTRO,
  WATCH_FOR_DETAIL_OBSERVATION_LABEL,
  WATCH_FOR_DETAIL_TESTING_LABEL,
  WATCH_FOR_DETAIL_TIMING_LABEL,
  WATCH_FOR_DETAIL_WHAT_TO_NOTICE_LABEL,
} from "../../../../../lib/watch-for-surface";

export const dynamic = "force-dynamic";

function toSafeId(value: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export default async function WatchForDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    notFound();
  }

  const { id } = await params;
  const item = await prismadb.fieldworkAssignment.findFirst({
    where: buildPublicWatchForWhere({ userId, id }),
    select: {
      id: true,
      prompt: true,
      reason: true,
      status: true,
      linkedObjectType: true,
      linkedObjectId: true,
      priority: true,
      observationNote: true,
      observationOutcome: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!item) {
    notFound();
  }

  const linkedObjectId = toSafeId(item.linkedObjectId);
  const linkedObjectHref = await resolvePublicLinkedObjectHref({
    userId,
    linkedObjectType: item.linkedObjectType,
    linkedObjectId,
  });

  const evidenceItems = await listPublicEvidenceContinuityForTarget({
    userId,
    targetType: UnderstandingLinkTargetType.fieldwork_assignment,
    targetId: item.id,
  });

  const actionHint = toWatchForFieldActionHint(item.status);

  return (
    <div className="animate-fade-in px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/watch-for"
          className="label-meta text-meta hover:text-cyan transition-colors mb-6 inline-block"
        >
          {WATCH_FOR_DETAIL_BACK_LABEL}
        </Link>

        <PageHeader
          eyebrow={formatFieldworkStatus(item.status)}
          title={item.prompt}
          meta={
            actionHint
              ? `${actionHint} · Linked to ${formatLinkedObjectType(item.linkedObjectType)}`
              : `Linked to ${formatLinkedObjectType(item.linkedObjectType)}`
          }
        />

        <section className="ml-material mb-5 rounded-2xl p-5">
          <SectionLabel>{WATCH_FOR_DETAIL_WHAT_TO_NOTICE_LABEL}</SectionLabel>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{item.prompt}</p>
        </section>

        <section className="ml-material mb-5 rounded-2xl p-5">
          <SectionLabel>{WATCH_FOR_DETAIL_TESTING_LABEL}</SectionLabel>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{item.reason}</p>
          <div className="label-meta mt-4">
            Created {formatWatchForListDateTime(item.createdAt.toISOString())} · Updated{" "}
            {formatWatchForListDateTime(item.updatedAt.toISOString())}
            {typeof item.priority === "number" ? ` · Priority ${item.priority}` : ""}
          </div>
        </section>

        <section className="mb-5">
          <SectionLabel>{WATCH_FOR_DETAIL_LINKED_CONTEXT_LABEL}</SectionLabel>
          <p className="mb-3 text-[13px] text-muted-foreground">
            {WATCH_FOR_DETAIL_LINKED_CONTEXT_INTRO}
          </p>
          <div className="ml-material rounded-2xl p-4 text-[13px] text-muted-foreground">
            <PublicLinkedObjectContinuity
              objectType={item.linkedObjectType}
              objectId={linkedObjectId}
              href={linkedObjectHref}
              context="linked_target"
              linkClassName="text-cyan hover:underline"
              containerClassName="text-[13px] text-muted-foreground"
            />
            <WatchForInspectorAction linkedObjectHref={linkedObjectHref} title={item.prompt} />
          </div>
        </section>

        <section className="mb-5">
          <SectionLabel>{WATCH_FOR_DETAIL_EVIDENCE_LABEL}</SectionLabel>
          <p className="mb-3 text-[13px] text-muted-foreground">{WATCH_FOR_DETAIL_EVIDENCE_INTRO}</p>
          {evidenceItems.length === 0 ? (
            <div className="ml-material rounded-2xl p-5 text-[13px] text-muted-foreground">
              {WATCH_FOR_DETAIL_EVIDENCE_EMPTY}
            </div>
          ) : (
            <div className="space-y-2">
              {evidenceItems.map((evidence) => (
                <article
                  key={`${evidence.href}-${evidence.createdAt}`}
                  className="ml-material rounded-xl p-4 text-[13px]"
                >
                  <div className="label-meta text-cyan/70">{evidence.evidenceSummaryLabel}</div>
                  {evidence.href ? (
                    <Link href={evidence.href} className="text-cyan hover:underline">
                      {evidence.sourceTypeLabel}
                    </Link>
                  ) : (
                    <span>{evidence.sourceTypeLabel}</span>
                  )}
                  <div className="label-meta mt-1 text-meta">
                    Linked {formatWatchForListDateTime(evidence.createdAt)}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mb-5">
          <SectionLabel>{WATCH_FOR_DETAIL_OBSERVATION_LABEL}</SectionLabel>
          <p className="mb-3 text-[13px] text-muted-foreground">{WATCH_FOR_DETAIL_OBSERVATION_INTRO}</p>
          <div className="ml-material space-y-3 rounded-2xl p-5 text-[13px] text-muted-foreground">
            <div>
              <div className="label-meta mb-1">Observation note</div>
              <div>{item.observationNote ?? "No observation note recorded yet."}</div>
            </div>
            <div>
              <div className="label-meta mb-1">Observation outcome</div>
              <div>{item.observationOutcome ?? "No observation outcome recorded yet."}</div>
            </div>
          </div>
        </section>

        <section>
          <SectionLabel>{WATCH_FOR_DETAIL_TIMING_LABEL}</SectionLabel>
          <div className="ml-material mt-3 rounded-2xl p-5 text-[13px] text-muted-foreground">
            {item.expiresAt
              ? `Watch until ${formatWatchForListDateTime(item.expiresAt.toISOString())}`
              : "No end date set."}
          </div>
        </section>
      </div>
    </div>
  );
}
