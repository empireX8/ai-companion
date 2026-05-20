import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { PUBLIC_LINKED_DETAIL_FALLBACK_COPY } from "../../../../lib/public-continuity-registry";
import {
  linkedObjectHrefMapKey,
  resolvePublicLinkedObjectHrefs,
} from "@/lib/public-linked-object-continuity";
import prismadb from "@/lib/prismadb";
import {
  WATCH_FOR_VISIBLE_STATUSES,
  toWatchForListItem,
} from "@/lib/public-intelligence-safe-slice";

export const dynamic = "force-dynamic";

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
    where: {
      userId,
      status: { in: WATCH_FOR_VISIBLE_STATUSES },
    },
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
      <PageHeader
        title="Watch For"
        meta="Read-only observation prompts tied to persisted fieldwork records."
      />

      <SectionLabel>Active prompts</SectionLabel>
      {items.length === 0 ? (
        <div className="card-standard p-4 text-[13px] text-meta">
          No watch-for prompts right now.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="card-standard p-5 hover:border-[hsl(187_100%_50%/0.18)] transition-colors"
            >
              <Link href={item.detailHref} className="block">
                <div className="label-meta text-cyan/70 mb-2">
                  {item.statusLabel} · {item.linkedObjectTypeLabel}
                </div>
                <h2 className="text-[16px] font-medium leading-snug mb-1.5">
                  {item.prompt}
                </h2>
                <p className="text-[13.5px] text-[hsl(216_11%_70%)] leading-relaxed">
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

                  if (item.linkedObjectId && verifiedHref) {
                    return (
                      <Link href={verifiedHref} className="label-meta text-cyan hover:underline">
                        Linked target: {item.linkedObjectId}
                      </Link>
                    );
                  }

                  if (item.linkedObjectId) {
                    return (
                      <div className="label-meta text-meta">
                        Linked target: {item.linkedObjectId}
                        <div className="mt-1">{PUBLIC_LINKED_DETAIL_FALLBACK_COPY}</div>
                      </div>
                    );
                  }

                  return <div className="label-meta text-meta">{PUBLIC_LINKED_DETAIL_FALLBACK_COPY}</div>;
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
    </div>
  );
}
