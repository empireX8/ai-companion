import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { PUBLIC_LINKED_DETAIL_FALLBACK_COPY } from "../../../../../lib/public-continuity-registry";
import { resolvePublicLinkedObjectHref } from "@/lib/public-linked-object-continuity";
import prismadb from "@/lib/prismadb";
import {
  formatFieldworkStatus,
  formatLinkedObjectType,
} from "@/lib/public-intelligence-safe-slice";
import { buildPublicWatchForWhere } from "@/lib/watch-for";

export const dynamic = "force-dynamic";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

function formatDateTime(value: Date | null): string {
  if (!value) {
    return "Not set";
  }
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
        <SectionLabel>Linked target</SectionLabel>
        <div className="card-standard p-4 text-[13px] text-[hsl(216_11%_70%)]">
          {linkedObjectId && linkedObjectHref ? (
            <Link href={linkedObjectHref} className="text-cyan hover:underline">
              {linkedObjectId}
            </Link>
          ) : linkedObjectId ? (
            <div>
              <div>{linkedObjectId}</div>
              <div className="label-meta text-meta mt-1">
                {PUBLIC_LINKED_DETAIL_FALLBACK_COPY}
              </div>
            </div>
          ) : (
            <div>{PUBLIC_LINKED_DETAIL_FALLBACK_COPY}</div>
          )}
        </div>
      </section>

      <section className="mb-8">
        <SectionLabel>Observation record</SectionLabel>
        <div className="card-standard p-5 text-[13.5px] text-[hsl(216_11%_70%)] space-y-3">
          <div>
            <div className="label-meta mb-1">Observation note</div>
            <div>{item.observationNote ?? "No observation note yet."}</div>
          </div>
          <div>
            <div className="label-meta mb-1">Observation outcome</div>
            <div>{item.observationOutcome ?? "No observation outcome yet."}</div>
          </div>
        </div>
      </section>

      <section>
        <SectionLabel>Timing</SectionLabel>
        <div className="card-standard p-5 text-[13.5px] text-[hsl(216_11%_70%)] space-y-2">
          <div>Expires at {formatDateTime(item.expiresAt)}</div>
        </div>
      </section>
    </div>
  );
}
