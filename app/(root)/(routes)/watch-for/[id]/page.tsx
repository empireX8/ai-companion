import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { PublicLinkedObjectContinuity } from "../../../../../lib/public-continuity-display";
import { resolvePublicLinkedObjectHref } from "@/lib/public-linked-object-continuity";
import prismadb from "@/lib/prismadb";
import {
  formatFieldworkStatus,
  formatLinkedObjectType,
} from "@/lib/public-intelligence-safe-slice";
import { buildPublicWatchForWhere } from "@/lib/watch-for";

export const dynamic = "force-dynamic";

const LINKED_TARGET_INTRO =
  "Verified link to the related pattern, signal, question, or map item this prompt watches.";
const OBSERVATION_INTRO =
  "Notes you add for this prompt. Summary fields only — not raw evidence.";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

function formatDateTime(value: Date): string {
  return DATE_FORMATTER.format(value);
}

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

  return (
    <div className="px-12 py-10 max-w-[980px] mx-auto animate-fade-in">
      <Link
        href="/watch-for"
        className="label-meta text-meta hover:text-cyan transition-colors mb-6 inline-block"
      >
        ← Back to Watch For
      </Link>

      <PageHeader
        eyebrow={formatFieldworkStatus(item.status)}
        title={item.prompt}
        meta={`Linked to ${formatLinkedObjectType(item.linkedObjectType)}`}
      />

      <section className="card-standard p-5 mb-8">
        <SectionLabel>Why this prompt exists</SectionLabel>
        <p className="text-[14px] text-[hsl(216_11%_70%)] leading-relaxed">
          {item.reason}
        </p>
        <div className="label-meta mt-4">
          Created {formatDateTime(item.createdAt)} · Updated {formatDateTime(item.updatedAt)}
          {typeof item.priority === "number" ? ` · Priority ${item.priority}` : ""}
        </div>
      </section>

      <section className="mb-8">
        <SectionLabel>Connected object</SectionLabel>
        <p className="text-[13px] text-meta mb-3">{LINKED_TARGET_INTRO}</p>
        <div className="card-standard p-4 text-[13px] text-[hsl(216_11%_70%)]">
          <PublicLinkedObjectContinuity
            objectType={item.linkedObjectType}
            objectId={linkedObjectId}
            href={linkedObjectHref}
            context="linked_target"
            linkClassName="text-cyan hover:underline"
            containerClassName="text-[13px] text-[hsl(216_11%_70%)]"
          />
        </div>
      </section>

      <section className="mb-8">
        <SectionLabel>Observation record</SectionLabel>
        <p className="text-[13px] text-meta mb-3">{OBSERVATION_INTRO}</p>
        <div className="card-standard p-5 text-[13.5px] text-[hsl(216_11%_70%)] space-y-3">
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
        <SectionLabel>Timing</SectionLabel>
        <div className="card-standard p-5 text-[13.5px] text-[hsl(216_11%_70%)] space-y-2">
          <div>
            {item.expiresAt
              ? `Watch until ${formatDateTime(item.expiresAt)}`
              : "No end date set."}
          </div>
        </div>
      </section>
    </div>
  );
}
