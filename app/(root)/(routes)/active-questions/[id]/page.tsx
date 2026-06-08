import React from "react";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import { resolvePublicLinkedObjectHref } from "@/lib/public-linked-object-continuity";
import prismadb from "@/lib/prismadb";
import { buildPublicActiveInvestigationWhere } from "@/lib/active-questions";
import { toActiveQuestionDetailItem } from "@/lib/public-intelligence-safe-slice";

export const dynamic = "force-dynamic";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not set";
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
  const row = await prismadb.investigation.findFirst({
    where: buildPublicActiveInvestigationWhere({ userId, id }),
    select: {
      id: true,
      title: true,
      organizingQuestion: true,
      status: true,
      seedType: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      resolutionSummary: true,
      resolvedAt: true,
      resolvedIntoUserMapConclusionId: true,
      reopenReason: true,
      competingTheories: true,
      evidenceNeeded: true,
    },
  });

  if (!row) {
    notFound();
  }

  const item = toActiveQuestionDetailItem(row);
  if (!item) {
    notFound();
  }

  const resolvedConclusionHref =
    item.resolvedConclusionId === null
      ? null
      : await resolvePublicLinkedObjectHref({
          userId,
          linkedObjectType: "usermap_conclusion",
          linkedObjectId: item.resolvedConclusionId,
        });

  return (
    <div className="px-12 py-10 max-w-[980px] mx-auto animate-fade-in">
      <PageHeader
        eyebrow={item.statusLabel}
        title={item.title}
        meta={`Seed: ${item.seedTypeLabel}`}
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
      </section>

      <section className="mb-8">
        <SectionLabel>Competing theories</SectionLabel>
        {renderBulletList(item.competingTheories, "No competing theories recorded yet.")}
      </section>

      <section className="mb-8">
        <SectionLabel>Evidence still needed</SectionLabel>
        {renderBulletList(item.evidenceNeeded, "No evidence requests recorded yet.")}
      </section>

      <section className="mb-8">
        <SectionLabel>Resolution status</SectionLabel>
        <div className="card-standard p-5">
          <div className="text-[13.5px] text-[hsl(216_11%_70%)] leading-relaxed">
            {item.resolutionSummary ?? "No resolution summary yet."}
          </div>
          <div className="label-meta mt-3">
            Resolved at {formatDateTime(item.resolvedAt)}
          </div>
          {item.reopenReason ? (
            <div className="label-meta mt-2">Reopen reason: {item.reopenReason}</div>
          ) : null}
        </div>
      </section>

      <section>
        <SectionLabel>Linked target</SectionLabel>
        <div className="card-standard p-4 text-[13px] text-[hsl(216_11%_70%)]">
          <PublicLinkedObjectContinuity
            objectType="usermap_conclusion"
            objectId={item.resolvedConclusionId}
            href={resolvedConclusionHref}
            context="linked_target"
            linkClassName="text-cyan hover:underline"
            containerClassName="text-[13px] text-[hsl(216_11%_70%)]"
          />
        </div>
      </section>
    </div>
  );
}
