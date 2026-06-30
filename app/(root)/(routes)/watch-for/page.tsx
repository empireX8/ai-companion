import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { WatchForItemCard } from "@/components/watch-for/WatchForItemCard";
import {
  linkedObjectHrefMapKey,
  resolvePublicLinkedObjectHrefs,
} from "@/lib/public-linked-object-continuity";
import prismadb from "@/lib/prismadb";
import { toWatchForListItem } from "@/lib/public-intelligence-safe-slice";
import { buildPublicWatchForWhere } from "@/lib/watch-for";
import {
  groupWatchForListItems,
  WATCH_FOR_EMPTY_PRIMARY,
  WATCH_FOR_EMPTY_SECONDARY,
  WATCH_FOR_PAGE_EYEBROW,
  WATCH_FOR_PAGE_INTRO,
  WATCH_FOR_PAGE_META,
  WATCH_FOR_PAGE_TITLE,
} from "../../../../lib/watch-for-surface";

export const dynamic = "force-dynamic";

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

  const statusById = new Map(rows.map((row) => [row.id, row.status] as const));
  const groups = groupWatchForListItems(items, statusById);

  const verifiedLinkedObjectHrefByKey = await resolvePublicLinkedObjectHrefs({
    userId,
    targets: items.map((item) => ({
      linkedObjectType: item.linkedObjectType,
      linkedObjectId: item.linkedObjectId,
    })),
  });

  return (
    <div className="animate-fade-in px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow={WATCH_FOR_PAGE_EYEBROW}
          title={WATCH_FOR_PAGE_TITLE}
          meta={WATCH_FOR_PAGE_META}
        />

        <p className="mb-6 max-w-2xl text-[13px] text-muted-foreground">{WATCH_FOR_PAGE_INTRO}</p>

        {items.length === 0 ? (
          <div className="ml-material space-y-1 rounded-2xl p-5 text-[13px] text-muted-foreground">
            <p>{WATCH_FOR_EMPTY_PRIMARY}</p>
            <p className="text-muted-foreground/80">{WATCH_FOR_EMPTY_SECONDARY}</p>
          </div>
        ) : (
          <div className="space-y-6" data-testid="watch-for-list">
            {groups.map((group) => (
              <section key={group.key}>
                <SectionLabel>{group.label}</SectionLabel>
                <p className="mt-1 mb-3 text-[12px] text-muted-foreground">{group.intro}</p>
                <div className="space-y-3">
                  {group.items.map((item) => {
                    const mapKey = linkedObjectHrefMapKey({
                      linkedObjectType: item.linkedObjectType,
                      linkedObjectId: item.linkedObjectId,
                    });
                    const verifiedHref = mapKey
                      ? verifiedLinkedObjectHrefByKey.get(mapKey) ?? null
                      : null;

                    return (
                      <WatchForItemCard
                        key={item.id}
                        item={item}
                        verifiedHref={verifiedHref}
                        status={statusById.get(item.id) ?? "assigned"}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="label-meta text-meta mt-8">
          Explore related surfaces:{" "}
          <Link href="/your-map" className="hover:text-cyan transition-colors">
            Your Map
          </Link>{" "}
          ·{" "}
          <span className="text-muted-foreground/60" title="Unavailable in v0">
            Active Questions
          </span>{" "}
          ·{" "}
          <Link href="/" className="hover:text-cyan transition-colors">
            Today
          </Link>
        </p>
      </div>
    </div>
  );
}
