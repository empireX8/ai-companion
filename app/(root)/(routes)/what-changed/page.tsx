import React from "react";
import { auth } from "@clerk/nextjs/server";
import { ModelUpdateVisibility } from "@prisma/client";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import prismadb from "@/lib/prismadb";
import {
  WHAT_CHANGED_EMPTY_PRIMARY,
  WHAT_CHANGED_EMPTY_SECONDARY,
  WHAT_CHANGED_LIST_SECTION_LABEL,
  WHAT_CHANGED_PAGE_INTRO,
} from "../../../../lib/what-changed-surface";
import { toWhatChangedListItem } from "@/lib/public-intelligence-safe-slice";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import { applyVerifiedAffectedObjectHrefs } from "@/lib/public-linked-object-continuity";

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
  const verifiedItems = await applyVerifiedAffectedObjectHrefs({
    userId,
    items,
  });

  return (
    <div className="px-12 py-10 max-w-[1100px] mx-auto animate-fade-in">
      <PageHeader
        title="What Changed"
        meta="Recent shifts in your understanding"
      />

      <p className="text-[13px] text-meta mb-6 max-w-2xl">{WHAT_CHANGED_PAGE_INTRO}</p>

      <SectionLabel>{WHAT_CHANGED_LIST_SECTION_LABEL}</SectionLabel>
      {verifiedItems.length === 0 ? (
        <div className="card-standard p-5 text-[13px] text-meta space-y-1">
          <p>{WHAT_CHANGED_EMPTY_PRIMARY}</p>
          <p className="text-meta/80">{WHAT_CHANGED_EMPTY_SECONDARY}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {verifiedItems.map((item) => (
            <article key={item.id} className="card-standard p-5">
              <div className="label-meta text-cyan/70 mb-2">
                {item.updateTypeLabel} · {item.affectedObjectTypeLabel}
              </div>
              <p className="text-[14px] text-[hsl(216_11%_70%)] leading-relaxed">
                {item.userFacingSummary}
              </p>

              <div className="mt-3 pt-3 border-t hairline">
                <PublicLinkedObjectContinuity
                  objectType={item.affectedObjectType}
                  objectId={item.affectedObjectId}
                  href={item.affectedObjectHref}
                  context="model_update"
                />
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
