import type { PrismaClient } from "@prisma/client";

import prismadb from "./prismadb";

/**
 * On-read reconciliation: any snoozed node whose snoozedUntil has passed is
 * automatically returned to "open". lastTouchedAt is intentionally NOT updated
 * because this is system housekeeping, not a user action.
 */
export async function expireSnoozedContradictionsForUser({
  userId,
  db = prismadb,
  now = new Date(),
}: {
  userId: string;
  db?: PrismaClient;
  now?: Date;
}): Promise<{ expired: number }> {
  const result = await db.contradictionNode.updateMany({
    where: {
      userId,
      status: "snoozed",
      snoozedUntil: {
        not: null,
        lte: now,
      },
    },
    data: {
      status: "open",
      snoozedUntil: null,
      // lastTouchedAt intentionally omitted — system reconciliation, not user action
    },
  });

  return { expired: result.count };
}
