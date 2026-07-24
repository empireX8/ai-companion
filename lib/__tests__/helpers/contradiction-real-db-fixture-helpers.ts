/**
 * Shared fixture helpers for isolated contradiction real-DB proofs.
 * Test/harness only — not imported by production routes or UI.
 */

import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

import type { ContradictionModelTransportResult } from "../../contradiction-adjudicator";
import { KERNEL_FIRST_PROOF_OBJECT } from "../../contradiction-adjudicator";
import {
  CONTRADICTION_REAL_DB_TEST_DATABASE,
  assertDestructiveTargetIsIsolatedTestDb,
} from "../../contradiction-real-db-round-trip-safety";
import {
  type KernelSourceUnit,
  type ObjectivityReferee,
  type StructuredModelRunner,
} from "../../orvek-intelligence-kernel";
import { transportSelectionForSubstring } from "./ceqr020-transport-selection";

export const CONTRADICTION_RT_QUOTE_A = "I never drink alcohol";
export const CONTRADICTION_RT_QUOTE_B = "I drank last night";
export const CONTRADICTION_RT_CONTENT_A = `${CONTRADICTION_RT_QUOTE_A} and other text`;
export const CONTRADICTION_RT_CONTENT_B = `Preface. ${CONTRADICTION_RT_QUOTE_B}`;
export const CONTRADICTION_RT_PROP_A = "Speaker never drinks alcohol";
export const CONTRADICTION_RT_PROP_B = "Speaker drank alcohol last night";

export function shaExactQuote(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function classAClearContradictionResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): ContradictionModelTransportResult {
  return {
    propositionA: {
      normalizedProposition: CONTRADICTION_RT_PROP_A,
      actor: "speaker",
      subject: "alcohol",
      timeframe: "general",
      negation: true,
      modality: "assertive",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: CONTRADICTION_RT_PROP_B,
      actor: "speaker",
      subject: "alcohol",
      timeframe: "last night",
      negation: false,
      modality: "assertive",
      qualifications: "none",
    },
    contextAndScope: "same speaker, overlapping claim scope",
    bothCanSimultaneouslyBeTrue: false,
    changedBeliefOverTime: false,
    intentionVersusOutcome: false,
    goalVersusObstacle: false,
    emotionalOrPhysiologicalVersusReasoningStandard: false,
    classification: "clear_contradiction",
    confidence: 0.86,
    evidenceClaimA: transportSelectionForSubstring(
      sideA.sourceText,
      CONTRADICTION_RT_QUOTE_A,
    ),
    evidenceClaimB: transportSelectionForSubstring(
      sideB.sourceText,
      CONTRADICTION_RT_QUOTE_B,
    ),
    rationale: "Incompatible under matching scope.",
    alternativeInterpretation: "Temporal change.",
    whatWouldChangeClassification: "Explicit time-scoped belief change.",
    abstentionReason: null,
    proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
  } as ContradictionModelTransportResult;
}

export function createDeterministicAdjudicatorRunner(
  factories: Array<
    (
      sideA: KernelSourceUnit,
      sideB: KernelSourceUnit,
    ) => ContradictionModelTransportResult
  > = [classAClearContradictionResult],
): StructuredModelRunner & { callCount: () => number } {
  let calls = 0;
  return {
    callCount: () => calls,
    async runStructured(request) {
      const idx = calls;
      calls += 1;
      const factory = factories[Math.min(idx, factories.length - 1)]!;
      const prompt = request.prompt;

      const parseSide = (side: "A" | "B"): KernelSourceUnit => {
        const sourceId =
          prompt.match(new RegExp(`Side ${side} sourceId: (.+)`))?.[1]?.trim() ??
          `side-${side.toLowerCase()}`;
        const sessionId =
          prompt.match(new RegExp(`Side ${side} sessionId: (.+)`))?.[1]?.trim() ??
          "unknown-session";
        const messageIdRaw =
          prompt.match(new RegExp(`Side ${side} messageId: (.+)`))?.[1]?.trim() ??
          null;
        const label =
          prompt.match(new RegExp(`Side ${side} label: (.+)`))?.[1]?.trim() ??
          `side-${side.toLowerCase()}`;
        const roleType =
          prompt.match(new RegExp(`Side ${side} role/type: (.+)`))?.[1]?.trim() ??
          "user";
        const [sourceRole, sourceType] = roleType.split(" / ").map((s) => s.trim());
        const textMatch = prompt.match(
          new RegExp(`Side ${side} sourceText: ("(?:\\\\.|[^"\\\\])*")`),
        );
        const sourceText = textMatch ? (JSON.parse(textMatch[1]!) as string) : "";
        return {
          sourceId,
          sessionId,
          messageId:
            messageIdRaw && messageIdRaw !== "null" ? messageIdRaw : undefined,
          sourceText,
          sourceRole: sourceRole || "user",
          sourceType: sourceType || undefined,
          label,
        };
      };

      return {
        ok: true as const,
        object: factory(parseSide("A"), parseSide("B")),
        providerId: "crt-rt-fake-adjudicator",
        modelId: "crt-rt-deterministic-fixture",
        rawText: null,
      };
    },
  };
}

export function createDeterministicPassReferee(): ObjectivityReferee & {
  callCount: () => number;
} {
  let calls = 0;
  return {
    callCount: () => calls,
    async evaluate() {
      calls += 1;
      return {
        outcome: "PASS" as const,
        rationale: "Clear contradiction.",
      };
    },
  };
}

export type ContradictionRtFixtureIds = {
  prefix: string;
  userId: string;
  sessionId: string;
  messageAId: string;
  messageBId: string;
  referenceId: string;
};

export function makeContradictionRtFixtureIds(
  label: string,
): ContradictionRtFixtureIds {
  const runId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const prefix = `crt-rt-${label}-${runId}`;
  return {
    prefix,
    userId: `${prefix}-user`,
    sessionId: `${prefix}-session`,
    messageAId: `${prefix}-message-a`,
    messageBId: `${prefix}-message-b`,
    referenceId: `${prefix}-ref-a`,
  };
}

export async function seedContradictionRtAuthoritativeFixture(
  db: PrismaClient,
  ids: ContradictionRtFixtureIds,
  options: { includeSideBMessage?: boolean } = {},
): Promise<ContradictionRtFixtureIds> {
  const includeSideBMessage = options.includeSideBMessage !== false;

  await db.session.create({
    data: {
      id: ids.sessionId,
      userId: ids.userId,
      label: `${ids.prefix}-session-label`,
      origin: "APP",
    },
  });

  await db.message.create({
    data: {
      id: ids.messageAId,
      sessionId: ids.sessionId,
      userId: ids.userId,
      role: "user",
      content: CONTRADICTION_RT_CONTENT_A,
    },
  });

  if (includeSideBMessage) {
    await db.message.create({
      data: {
        id: ids.messageBId,
        sessionId: ids.sessionId,
        userId: ids.userId,
        role: "user",
        content: CONTRADICTION_RT_CONTENT_B,
      },
    });
  }

  await db.referenceItem.create({
    data: {
      id: ids.referenceId,
      userId: ids.userId,
      type: "goal",
      confidence: "high",
      status: "active",
      statement: CONTRADICTION_RT_QUOTE_A,
      sourceSessionId: ids.sessionId,
      sourceMessageId: ids.messageAId,
    },
  });

  return ids;
}

export async function cleanupContradictionRtFixtureUser(
  db: PrismaClient,
  userId: string,
): Promise<{
  contradictionNodes: number;
  evidenceSpans: number;
  referenceItems: number;
  messages: number;
  sessions: number;
}> {
  assertDestructiveTargetIsIsolatedTestDb({
    databaseName: CONTRADICTION_REAL_DB_TEST_DATABASE,
    operation: `cleanupContradictionRtFixtureUser(${userId})`,
  });

  const nodes = await db.contradictionNode.deleteMany({ where: { userId } });
  const spans = await db.evidenceSpan.deleteMany({ where: { userId } });
  const refs = await db.referenceItem.deleteMany({ where: { userId } });
  const messages = await db.message.deleteMany({ where: { userId } });
  const sessions = await db.session.deleteMany({ where: { userId } });

  return {
    contradictionNodes: nodes.count,
    evidenceSpans: spans.count,
    referenceItems: refs.count,
    messages: messages.count,
    sessions: sessions.count,
  };
}

export async function contradictionRtFixtureCounts(
  db: PrismaClient,
  userId: string,
) {
  const [
    contradictionNodes,
    evidenceSpans,
    referenceItems,
    messages,
    sessions,
    contradictionEvidence,
    modelUpdates,
  ] = await Promise.all([
    db.contradictionNode.count({ where: { userId } }),
    db.evidenceSpan.count({ where: { userId } }),
    db.referenceItem.count({ where: { userId } }),
    db.message.count({ where: { userId } }),
    db.session.count({ where: { userId } }),
    db.contradictionEvidence.count({
      where: { node: { userId } },
    }),
    db.modelUpdate.count({ where: { userId } }),
  ]);
  return {
    contradictionNodes,
    evidenceSpans,
    referenceItems,
    messages,
    sessions,
    contradictionEvidence,
    modelUpdates,
  };
}
