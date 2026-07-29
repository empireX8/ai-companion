/**
 * Seed map understanding + owned evidence for live Explore proposal regression.
 * Never seeds ExploreMovementProposal rows.
 */

import {
  PrismaClient,
  SessionSurfaceType,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  UserMapConfidenceLevel,
} from "@prisma/client";
import { randomBytes } from "node:crypto";

export const LIVE_TEA_UMC_TITLE = "Tea preference";
export const LIVE_TEA_UMC_SUMMARY = "I don't like tea anymore";
export const LIVE_TEA_CORRECTION_MESSAGE =
  "Correction: I like tea again now. Please update your understanding of me.";
export const LIVE_TEA_JOURNAL_TITLE = "Tea preference note";
export const LIVE_TEA_JOURNAL_BODY =
  "I used to drink tea every morning. Lately I said I don't like tea anymore, but that preference can change.";

function id(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

/**
 * Existing map conclusion + journal evidence only. Asserts zero proposals exist
 * for the user after seed.
 */
export async function seedLiveTeaMapUnderstanding(args: {
  userId: string;
  db: PrismaClient;
}): Promise<{
  umcId: string;
  journalId: string;
  conversationId: string;
}> {
  const umc = await args.db.userMapConclusion.create({
    data: {
      userId: args.userId,
      area: UserMapConclusionArea.operating_logic,
      status: UserMapConclusionStatus.emerging,
      visibility: UserMapConclusionVisibility.user_visible,
      title: LIVE_TEA_UMC_TITLE,
      summary: LIVE_TEA_UMC_SUMMARY,
      confidenceScore: 0.6,
      confidenceLevel: UserMapConfidenceLevel.medium,
      evidenceCount: 1,
    },
  });

  const journalId = id("tea_journal");
  await args.db.journalEntry.create({
    data: {
      id: journalId,
      userId: args.userId,
      title: LIVE_TEA_JOURNAL_TITLE,
      body: LIVE_TEA_JOURNAL_BODY,
    },
  });

  const conversationId = id("tea_explore");
  await args.db.session.create({
    data: {
      id: conversationId,
      userId: args.userId,
      surfaceType: SessionSurfaceType.explore_chat,
    },
  });

  const proposalCount = await args.db.exploreMovementProposal.count({
    where: { userId: args.userId },
  });
  if (proposalCount !== 0) {
    throw new Error(
      `Live tea seed must not create proposals; found ${proposalCount}`,
    );
  }

  return { umcId: umc.id, journalId, conversationId };
}
