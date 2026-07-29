import "server-only";

import { ModelUpdateVisibility } from "@prisma/client";

import prismadb from "./prismadb";

/**
 * Published movement lineage summaries for What Changed briefing display.
 * Kept out of the list-page source so public list contracts stay free of
 * internal field names while the briefing can still show before → after.
 */
export async function readPublishedMovementLineageSummaries(args: {
  userId: string;
  modelUpdateId: string;
}): Promise<{ before: string | null; after: string | null } | null> {
  const row = await prismadb.modelUpdate.findFirst({
    where: {
      id: args.modelUpdateId,
      userId: args.userId,
      visibility: ModelUpdateVisibility.user_visible,
      isMeaningful: true,
    },
    select: {
      beforeSummary: true,
      afterSummary: true,
    },
  });

  if (!row) {
    return null;
  }

  return {
    before: row.beforeSummary,
    after: row.afterSummary,
  };
}
