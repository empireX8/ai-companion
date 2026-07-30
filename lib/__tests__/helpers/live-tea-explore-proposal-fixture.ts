/**
 * Seed map understanding + owned evidence for live Explore proposal regression.
 * Never seeds ExploreMovementProposal rows.
 */

import {
  PrismaClient,
  ReferenceConfidence,
  ReferenceStatus,
  ReferenceType,
  SessionSurfaceType,
} from "@prisma/client";
import { randomBytes } from "node:crypto";

export const LIVE_TEA_UMC_SUMMARY = "I don't like tea anymore";
export const LIVE_TEA_UMC_TITLE = LIVE_TEA_UMC_SUMMARY;
export const LIVE_TEA_CORRECTION_MESSAGE =
  "Correction: I like tea again now. Please update your understanding of me.";
export const LIVE_TEA_JOURNAL_TITLE = "Tea preference note";
export const LIVE_TEA_JOURNAL_BODY =
  "I used to drink tea every morning. Lately I said I don't like tea anymore, but that preference can change.";

function id(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

/**
 * Existing Map-visible legacy memory + journal evidence only. Asserts zero
 * UMC/canonical/proposal rows exist for the user after seed.
 */
export async function seedLiveTeaMapUnderstanding(args: {
  userId: string;
  db: PrismaClient;
}): Promise<{
  referenceItemId: string;
  journalId: string;
  conversationId: string;
}> {
  const reference = await args.db.referenceItem.create({
    data: {
      userId: args.userId,
      type: ReferenceType.preference,
      confidence: ReferenceConfidence.medium,
      status: ReferenceStatus.active,
      statement: LIVE_TEA_UMC_SUMMARY,
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

  const umcCount = await args.db.userMapConclusion.count({
    where: { userId: args.userId },
  });
  if (umcCount !== 0) {
    throw new Error(`Live tea seed must not create UMC rows; found ${umcCount}`);
  }

  const canonicalConceptCount = await args.db.canonicalConcept.count({
    where: { userId: args.userId },
  });
  if (canonicalConceptCount !== 0) {
    throw new Error(
      `Live tea seed must not create canonical concepts; found ${canonicalConceptCount}`,
    );
  }

  return { referenceItemId: reference.id, journalId, conversationId };
}
