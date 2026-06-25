import React from "react";
import { auth } from "@clerk/nextjs/server";
import { ModelUpdateVisibility, UnderstandingLinkTargetType } from "@prisma/client";

import { OrvekWhatChangedView } from "@/components/orvek-workbench/OrvekWhatChangedPage";
import prismadb from "@/lib/prismadb";
import { listPublicEvidenceContinuityForTarget } from "@/lib/public-evidence-continuity";
import { toWhatChangedListItem } from "@/lib/public-intelligence-safe-slice";
import { applyVerifiedAffectedObjectHrefs } from "@/lib/public-linked-object-continuity";
import { splitWhatChangedMovements } from "../../../../lib/what-changed-surface";

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
    <OrvekWhatChangedView
      primary={primary}
      earlier={earlier}
      evidenceItems={primaryEvidence}
    />
  );
}
