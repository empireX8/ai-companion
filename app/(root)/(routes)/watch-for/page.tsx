import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import {
  linkedObjectHrefMapKey,
  resolvePublicLinkedObjectHrefs,
} from "@/lib/public-linked-object-continuity";
import prismadb from "@/lib/prismadb";
import { toWatchForListItem } from "@/lib/public-intelligence-safe-slice";
import { buildPublicWatchForWhere } from "@/lib/watch-for";

export const dynamic = "force-dynamic";

const PAGE_INTRO =
  "Small things to notice in real life, drawn from your evidence. Each prompt links to a related item when available.";
const LIST_SECTION_LABEL = "Watch prompts";
const EMPTY_PRIMARY = "Nothing to watch for yet.";
const EMPTY_SECONDARY =
  "When there is enough evidence, MindLab may surface observation prompts here. Keep capturing signal in journal or check-ins.";

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

export default async function WatchForPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const rows = await prismadb.fieldworkAssignment.findMany({
    where: buildPublicWatchForWhere({ userId }),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      prompt: true,
      reason: true,
      status: true,
      linkedObjectType: true,
      linkedObjectId: true,
      priority: true,
      updatedAt: true,
    },
  });

  const items = rows
    .map((row) => toWatchForListItem(row))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const verifiedLinkedObjectHrefByKey = await resolvePublicLinkedObjectHrefs({
    userId,
    targets: items.map((item) => ({
      linkedObjectType: item.linkedObjectType,
      linkedObjectId: item.linkedObjectId,
    })),
  });

  return (
    <div className="px-12 py-10 max-w-[1100px] mx-auto animate-fade-in">
      <PageHeader title="Watch For" meta="Small things to notice" />

      <p className="text-[13px] text-meta mb-6 max-w-2xl">{PAGE_INTRO}</p>

      <SectionLabel>{LIST_SECTION_LABEL}</SectionLabel>
      {items.length === 0 ? (
        <div className="card-standard p-5 text-[13px] text-meta space-y-1">
          <p>{EMPTY_PRIMARY}</p>
          <p className="text-meta/80">{EMPTY_SECONDARY}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="card-standard p-5 hover:border-[hsl(187_100%_50%/0.18)] transition-colors"
            >
              <Link href={item.detailHref} className="block group">
                <div className="label-meta text-cyan/70 mb-2">
                  {item.statusLabel} · {item.linkedObjectTypeLabel}
                </div>
                <h2 className="text-[16px] font-medium leading-snug mb-1.5 group-hover:text-cyan transition-colors">
                  {item.prompt}
                </h2>
                <p className="text-[13.5px] text-[hsl(216_11%_70%)] leading-relaxed line-clamp-2">
                  {item.reason}
                </p>
              </Link>

              <div className="mt-3 pt-3 border-t hairline">
                {(() => {
                  const mapKey = linkedObjectHrefMapKey({
                    linkedObjectType: item.linkedObjectType,
                    linkedObjectId: item.linkedObjectId,
                  });
                  const verifiedHref = mapKey
                    ? verifiedLinkedObjectHrefByKey.get(mapKey) ?? null
                    : null;

                  return (
                    <PublicLinkedObjectContinuity
                      objectType={item.linkedObjectType}
                      objectId={item.linkedObjectId}
                      href={verifiedHref}
                      context="linked_target"
                    />
                  );
                })()}
                <div className="label-meta mt-2">
                  Updated {formatDateTime(item.updatedAt)}
                  {typeof item.priority === "number"
                    ? ` · Priority ${item.priority}`
                    : ""}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="label-meta text-meta mt-8">
        Explore related surfaces:{" "}
        <Link href="/your-map" className="hover:text-cyan transition-colors">
          Your Map
        </Link>{" "}
        ·{" "}
        <Link href="/active-questions" className="hover:text-cyan transition-colors">
          Active Questions
        </Link>
      </p>
    </div>
  );
}
