import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ModelUpdateVisibility } from "@prisma/client";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import prismadb from "@/lib/prismadb";
import { toWhatChangedListItem } from "@/lib/public-intelligence-safe-slice";

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

export default async function WhatChangedPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const rows = await prismadb.modelUpdate.findMany({
    where: {
      userId,
      visibility: ModelUpdateVisibility.user_visible,
      isMeaningful: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      updateType: true,
      affectedObjectType: true,
      affectedObjectId: true,
      userFacingSummary: true,
      createdAt: true,
    },
  });

  const items = rows
    .map((row) => toWhatChangedListItem(row))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="px-12 py-10 max-w-[1100px] mx-auto animate-fade-in">
      <PageHeader
        title="What Changed"
        meta="Read-only meaningful updates anchored to user-visible backend records."
      />

      <SectionLabel>Meaningful updates</SectionLabel>
      {items.length === 0 ? (
        <div className="card-standard p-4 text-[13px] text-meta">
          No meaningful changes yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="card-standard p-5">
              <div className="label-meta text-cyan/70 mb-2">
                {item.updateTypeLabel} · {item.affectedObjectTypeLabel}
              </div>
              <p className="text-[14px] text-[hsl(216_11%_70%)] leading-relaxed">
                {item.userFacingSummary}
              </p>

              <div className="mt-3 pt-3 border-t hairline">
                {item.affectedObjectId && item.affectedObjectHref ? (
                  <Link
                    href={item.affectedObjectHref}
                    className="label-meta text-cyan hover:underline"
                  >
                    Linked target: {item.affectedObjectId}
                  </Link>
                ) : item.affectedObjectId ? (
                  <div className="label-meta text-meta">
                    Linked target: {item.affectedObjectId}
                    <div className="mt-1">No linked detail available yet.</div>
                  </div>
                ) : (
                  <div className="label-meta text-meta">No linked detail available yet.</div>
                )}
                <div className="label-meta mt-2">
                  Recorded {formatDateTime(item.createdAt)}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
