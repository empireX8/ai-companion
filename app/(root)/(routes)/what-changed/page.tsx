import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ModelUpdateVisibility, UnderstandingLinkTargetType } from "@prisma/client";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { WhatChangedHeroMovement } from "@/components/what-changed/WhatChangedHeroMovement";
import { WhatChangedMovementCard } from "@/components/what-changed/WhatChangedMovementCard";
import prismadb from "@/lib/prismadb";
import { listPublicEvidenceContinuityForTarget } from "@/lib/public-evidence-continuity";
import { toWhatChangedListItem } from "@/lib/public-intelligence-safe-slice";
import { applyVerifiedAffectedObjectHrefs } from "@/lib/public-linked-object-continuity";
import {
  splitWhatChangedMovements,
  WHAT_CHANGED_EARLIER_SECTION_INTRO,
  WHAT_CHANGED_EARLIER_SECTION_LABEL,
  WHAT_CHANGED_EMPTY_PRIMARY,
  WHAT_CHANGED_EMPTY_SECONDARY,
  WHAT_CHANGED_PAGE_INTRO,
  WHAT_CHANGED_PAGE_META,
  WHAT_CHANGED_PAGE_TITLE,
  WHAT_CHANGED_PRIMARY_SECTION_INTRO,
  WHAT_CHANGED_PRIMARY_SECTION_LABEL,
  WHAT_CHANGED_REENTRY_LINKS,
} from "../../../../lib/what-changed-surface";

export const dynamic = "force-dynamic";

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

  const { primary, earlier } = splitWhatChangedMovements(verifiedItems);
  const primaryEvidence = primary
    ? await listPublicEvidenceContinuityForTarget({
        userId,
        targetType: UnderstandingLinkTargetType.model_update,
        targetId: primary.id,
      })
    : [];

  return (
    <div className="animate-fade-in px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title={WHAT_CHANGED_PAGE_TITLE}
          meta={WHAT_CHANGED_PAGE_META}
        />

        <p className="mb-6 max-w-2xl text-[13px] text-muted-foreground">{WHAT_CHANGED_PAGE_INTRO}</p>

        {verifiedItems.length === 0 ? (
          <div className="ml-material space-y-1 rounded-2xl p-5 text-[13px] text-muted-foreground">
            <p>{WHAT_CHANGED_EMPTY_PRIMARY}</p>
            <p className="text-muted-foreground/80">{WHAT_CHANGED_EMPTY_SECONDARY}</p>
          </div>
        ) : (
          <div className="space-y-6" data-testid="what-changed-list">
            {primary ? (
              <section>
                <SectionLabel>{WHAT_CHANGED_PRIMARY_SECTION_LABEL}</SectionLabel>
                <p className="mt-1 mb-3 text-[12px] text-muted-foreground">
                  {WHAT_CHANGED_PRIMARY_SECTION_INTRO}
                </p>
                <WhatChangedHeroMovement item={primary} evidenceItems={primaryEvidence} />
              </section>
            ) : null}

            {earlier.length > 0 ? (
              <section>
                <SectionLabel>{WHAT_CHANGED_EARLIER_SECTION_LABEL}</SectionLabel>
                <p className="mt-1 mb-3 text-[12px] text-muted-foreground">
                  {WHAT_CHANGED_EARLIER_SECTION_INTRO}
                </p>
                <div className="space-y-3">
                  {earlier.map((item) => (
                    <WhatChangedMovementCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}

        <p className="label-meta mt-8 text-meta">
          Re-enter from:{" "}
          {WHAT_CHANGED_REENTRY_LINKS.map((link, index) => (
            <React.Fragment key={link.href}>
              {index > 0 ? " · " : null}
              <Link href={link.href} className="hover:text-cyan transition-colors">
                {link.label}
              </Link>
            </React.Fragment>
          ))}
        </p>
      </div>
    </div>
  );
}
