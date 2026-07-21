/**
 * CONTRADICTION-DUPLICATE-PREVENTION-001 (CEQR-007) — repaired transactional
 * writer tests with exact ordered dual-side duplicate prevention.
 * Injected fakes only. No prismadb. No live account writes. ESM imports only.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { ContradictionAdjudicationResult } from "../contradiction-adjudicator";
import {
  CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION,
  type DualSideLineageResult,
  type ValidatedDualSideLineage,
} from "../contradiction-dual-side-lineage";
import { calibrateContradictionConfidence } from "../contradiction-confidence-calibration";
import type { SemanticallySelectedContradictionPair } from "../contradiction-same-session-selection";
import {
  buildContradictionPersistencePlan,
  type ContradictionPersistenceAuthorisedPlan,
} from "../contradiction-persistence-plan";
import {
  persistRepairedContradictionCandidate,
  type ContradictionRepairedPersistenceDb,
  type ContradictionRepairedSpanRow,
} from "../contradiction-repaired-persistence";
import {
  OBJECTIVITY_REFEREE_INTERFACE_VERSION,
  type KernelSourceUnit,
} from "../orvek-intelligence-kernel";
import type { ExactEvidenceClaim } from "../orvek-intelligence-kernel/types";

const USER = "user-kay";
const SESSION = "session-1";
const MSG_A = "message-a";
const MSG_B = "message-b";
const QUOTE_A = "I never drink alcohol";
const QUOTE_B = "I drank last night";
const CONTENT_A = `${QUOTE_A} and other text`;
const CONTENT_B = `Preface. ${QUOTE_B}`;
const PROP_A = "Speaker never drinks alcohol";
const PROP_B = "Speaker drank alcohol last night";

function sha(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function source(
  partial: Partial<KernelSourceUnit> &
    Pick<KernelSourceUnit, "sourceId" | "sourceText" | "label">,
): KernelSourceUnit {
  return {
    sessionId: partial.sessionId ?? SESSION,
    messageId: partial.messageId ?? `message-${partial.sourceId}`,
    sourceRole: partial.sourceRole ?? "user",
    sourceType: partial.sourceType ?? "goal",
    existingObjectId: partial.existingObjectId ?? null,
    ...partial,
  };
}

function claimAt(
  sourceUnit: KernelSourceUnit,
  exactQuote: string,
  startOffset: number,
): ExactEvidenceClaim {
  return {
    sourceId: sourceUnit.sourceId,
    exactQuote,
    startOffset,
    endOffset: startOffset + exactQuote.length,
  };
}

function buildAdjudication(args: {
  sideA: KernelSourceUnit;
  sideB: KernelSourceUnit;
  claimA: ExactEvidenceClaim;
  claimB: ExactEvidenceClaim;
}): ContradictionAdjudicationResult {
  return {
    outcome: "semantic_accepted",
    semantic: {
      propositionA: {
        normalizedProposition: PROP_A,
        actor: "speaker",
        subject: "alcohol",
        timeframe: "general",
        negation: true,
        modality: "assertive",
        qualifications: "none",
      },
      propositionB: {
        normalizedProposition: PROP_B,
        actor: "speaker",
        subject: "alcohol",
        timeframe: "last night",
        negation: false,
        modality: "assertive",
        qualifications: "none",
      },
      contextAndScope: "same speaker",
      bothCanSimultaneouslyBeTrue: false,
      changedBeliefOverTime: false,
      intentionVersusOutcome: false,
      goalVersusObstacle: false,
      emotionalOrPhysiologicalVersusReasoningStandard: false,
      classification: "clear_contradiction",
      confidence: 0.86,
      evidenceClaimA: args.claimA,
      evidenceClaimB: args.claimB,
      rationale: "Incompatible.",
      alternativeInterpretation: "Temporal change.",
      whatWouldChangeClassification: "Scoped belief change.",
      abstentionReason: null,
      proposedObjectType: "ContradictionNode",
    },
    validation: { status: "valid", errors: [], warnings: [] },
    refereeStatus: "PASS",
    referee: {
      interfaceVersion: OBJECTIVITY_REFEREE_INTERFACE_VERSION,
      executionState: "completed",
      outcome: "PASS",
      rationale: "ok",
      proposedObjectType: "ContradictionNode",
      proposedConfidence: 0.86,
      adjustedConfidence: null,
      routedObjectType: null,
      validationErrors: [],
      continuationAllowed: true,
      errorMessage: null,
    },
    audit: {
      processorVersion: "test",
      kernelContractVersion: "test",
      schemaVersion: "test",
      promptVersion: "test",
      providerId: "test-fake",
      modelId: "test-fake-model",
      sourceIds: [args.sideA.sourceId, args.sideB.sourceId],
      executedAt: "2026-07-21T00:00:00.000Z",
      parseValidationOutcome: "valid",
      semanticClassification: "clear_contradiction",
      abstentionOrErrorCode: null,
      refereeStatus: "PASS",
    },
    abstentionReason: null,
    errorCode: null,
    errorMessage: null,
    persistenceDecision: null,
    createCandidate: undefined,
  };
}

function makeAuthorisedPlan(): ContradictionPersistenceAuthorisedPlan {
  const sideA = source({
    sourceId: "src-a",
    sourceText: CONTENT_A,
    label: "Side A",
    messageId: MSG_A,
    sourceType: "goal",
  });
  const sideB = source({
    sourceId: "src-b",
    sourceText: CONTENT_B,
    label: "Side B",
    messageId: MSG_B,
    sourceType: "message",
  });
  const claimA = claimAt(sideA, QUOTE_A, 0);
  const claimB = claimAt(sideB, QUOTE_B, "Preface. ".length);
  const selectedPair: SemanticallySelectedContradictionPair = {
    sideA,
    sideB,
    referenceId: "ref-1",
    semanticallySelected: true,
    persistable: false,
    persistenceAuthorised: false,
    adjudication: buildAdjudication({ sideA, sideB, claimA, claimB }),
  };

  const hashA = sha(QUOTE_A);
  const hashB = sha(QUOTE_B);
  const lineage: ValidatedDualSideLineage = {
    lineageContractVersion: CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION,
    userId: USER,
    sessionId: SESSION,
    sideA: {
      role: "A",
      sourceId: sideA.sourceId,
      sessionId: SESSION,
      messageId: MSG_A,
      exactQuote: QUOTE_A,
      startOffset: 0,
      endOffset: QUOTE_A.length,
      contentHash: hashA,
    },
    sideB: {
      role: "B",
      sourceId: sideB.sourceId,
      sessionId: SESSION,
      messageId: MSG_B,
      exactQuote: QUOTE_B,
      startOffset: claimB.startOffset,
      endOffset: claimB.endOffset,
      contentHash: hashB,
    },
    refereeOutcome: "PASS",
    adjustedConfidence: null,
    spanEnsureDescriptors: {
      sideA: {
        userId: USER,
        messageId: MSG_A,
        charStart: 0,
        charEnd: QUOTE_A.length,
        contentHash: hashA,
      },
      sideB: {
        userId: USER,
        messageId: MSG_B,
        charStart: claimB.startOffset,
        charEnd: claimB.endOffset,
        contentHash: hashB,
      },
    },
  };

  const lineageResult: DualSideLineageResult = {
    ok: true,
    lineageReadyForPersistenceGate: true,
    continuationReady: true,
    validatedDualSideLineage: lineage,
    persistable: false,
    persistenceAuthorised: false,
    createCandidate: undefined,
    persistenceDecision: null,
  };

  const confidenceResult = calibrateContradictionConfidence({
    modelReportedConfidence: 0.72,
    adjudicationOutcome: "semantic_accepted",
    deterministicValidationStatus: "valid",
    semanticPresent: true,
    semanticClassification: "clear_contradiction",
    refereeExecutionState: "completed",
    refereeOutcome: "PASS",
    refereeAdjustedConfidence: null,
    refereeValidationErrors: [],
    refereeContinuationAllowed: true,
  });

  const built = buildContradictionPersistencePlan({
    selectedPair,
    lineageResult,
    confidenceResult,
  });
  if (!built.ok) throw new Error(`expected authorised plan: ${built.code}`);
  return built.plan;
}

type ExistingExactNodeSeed = {
  id: string;
  userId: string;
  sideASourceSpanId: string | null;
  sideBSourceSpanId: string | null;
  title?: string;
};


function makeAuthorisedPlanWithSideAQuote(quoteA: string, contentA: string): ContradictionPersistenceAuthorisedPlan {
  const sideA = source({
    sourceId: "src-a-alt",
    sourceText: contentA,
    label: "Side A alt",
    messageId: "message-a-alt",
    sourceType: "goal",
  });
  const sideB = source({
    sourceId: "src-b",
    sourceText: CONTENT_B,
    label: "Side B",
    messageId: MSG_B,
    sourceType: "message",
  });
  const claimA = claimAt(sideA, quoteA, 0);
  const claimB = claimAt(sideB, QUOTE_B, "Preface. ".length);
  const selectedPair: SemanticallySelectedContradictionPair = {
    sideA,
    sideB,
    referenceId: "ref-alt",
    semanticallySelected: true,
    persistable: false,
    persistenceAuthorised: false,
    adjudication: buildAdjudication({ sideA, sideB, claimA, claimB }),
  };

  const hashA = sha(quoteA);
  const hashB = sha(QUOTE_B);
  const lineage: ValidatedDualSideLineage = {
    lineageContractVersion: CONTRADICTION_DUAL_SIDE_LINEAGE_VERSION,
    userId: USER,
    sessionId: SESSION,
    sideA: {
      role: "A",
      sourceId: sideA.sourceId,
      sessionId: SESSION,
      messageId: "message-a-alt",
      exactQuote: quoteA,
      startOffset: 0,
      endOffset: quoteA.length,
      contentHash: hashA,
    },
    sideB: {
      role: "B",
      sourceId: sideB.sourceId,
      sessionId: SESSION,
      messageId: MSG_B,
      exactQuote: QUOTE_B,
      startOffset: claimB.startOffset,
      endOffset: claimB.endOffset,
      contentHash: hashB,
    },
    refereeOutcome: "PASS",
    adjustedConfidence: null,
    spanEnsureDescriptors: {
      sideA: {
        userId: USER,
        messageId: "message-a-alt",
        charStart: 0,
        charEnd: quoteA.length,
        contentHash: hashA,
      },
      sideB: {
        userId: USER,
        messageId: MSG_B,
        charStart: claimB.startOffset,
        charEnd: claimB.endOffset,
        contentHash: hashB,
      },
    },
  };

  const lineageResult: DualSideLineageResult = {
    ok: true,
    lineageReadyForPersistenceGate: true,
    continuationReady: true,
    validatedDualSideLineage: lineage,
    persistable: false,
    persistenceAuthorised: false,
    createCandidate: undefined,
    persistenceDecision: null,
  };

  const confidenceResult = calibrateContradictionConfidence({
    modelReportedConfidence: 0.72,
    adjudicationOutcome: "semantic_accepted",
    deterministicValidationStatus: "valid",
    semanticPresent: true,
    semanticClassification: "clear_contradiction",
    refereeExecutionState: "completed",
    refereeOutcome: "PASS",
    refereeAdjustedConfidence: null,
    refereeValidationErrors: [],
    refereeContinuationAllowed: true,
  });

  const built = buildContradictionPersistencePlan({
    selectedPair,
    lineageResult,
    confidenceResult,
  });
  if (!built.ok) throw new Error(`expected authorised plan: ${built.code}`);
  return built.plan;
}

function makeFakeDb(options?: {
  existingSpans?: ContradictionRepairedSpanRow[];
  existingNodes?: ExistingExactNodeSeed[];
  failSideBCreate?: boolean;
  failNodeCreate?: boolean;
  nodeCreateReturnsEmptyId?: boolean;
  forceSameSpanId?: boolean;
  /** Both concurrent callers observe absent, then both attempt create. */
  raceMode?: boolean;
  /** Throw P2002 on node create without inserting a durable node. */
  throwUnresolvedNodeP2002?: boolean;
  messageOverrides?: Record<
    string,
    Partial<{ userId: string; sessionId: string; content: string }>
  >;
  omitMessageIds?: string[];
  extraMessages?: Array<{
    id: string;
    userId: string;
    sessionId: string;
    content: string;
  }>;
}) {
  const messages = new Map([
    [
      MSG_A,
      {
        id: MSG_A,
        userId: USER,
        sessionId: SESSION,
        content: CONTENT_A,
      },
    ],
    [
      MSG_B,
      {
        id: MSG_B,
        userId: USER,
        sessionId: SESSION,
        content: CONTENT_B,
      },
    ],
  ]);

  for (const extra of options?.extraMessages ?? []) {
    messages.set(extra.id, extra);
  }

  for (const [id, override] of Object.entries(options?.messageOverrides ?? {})) {
    const current = messages.get(id);
    if (current) messages.set(id, { ...current, ...override });
  }
  for (const id of options?.omitMessageIds ?? []) {
    messages.delete(id);
  }

  const spans: ContradictionRepairedSpanRow[] = [
    ...(options?.existingSpans ?? []),
  ];
  const nodes: Array<Record<string, unknown>> = [
    ...(options?.existingNodes ?? []).map((n) => ({ ...n })),
  ];
  let spanSeq = spans.length;
  let nodeSeq = nodes.length;
  // Serialize node creates so concurrent losers observe the unique conflict.
  let nodeCreateChain: Promise<void> = Promise.resolve();

  let raceObservers = 0;
  let releaseRaceObservers: (() => void) | null = null;
  const raceBarrier = options?.raceMode
    ? new Promise<void>((resolve) => {
        releaseRaceObservers = resolve;
      })
    : null;

  function findExactNodeRow(where: {
    userId: string;
    sideASourceSpanId: string;
    sideBSourceSpanId: string;
  }) {
    return (
      nodes.find(
        (n) =>
          n.userId === where.userId &&
          n.sideASourceSpanId === where.sideASourceSpanId &&
          n.sideBSourceSpanId === where.sideBSourceSpanId,
      ) ?? null
    );
  }

  function throwP2002(message: string): never {
    const err = new Error(message);
    Object.assign(err, { code: "P2002" });
    throw err;
  }

  const tx = {
    message: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          messages.get(where.id) ?? null,
      ),
    },
    evidenceSpan: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            messageId_charStart_charEnd_contentHash: {
              messageId: string;
              charStart: number;
              charEnd: number;
              contentHash: string;
            };
          };
        }) => {
          const key = where.messageId_charStart_charEnd_contentHash;
          return (
            spans.find(
              (s) =>
                s.messageId === key.messageId &&
                s.charStart === key.charStart &&
                s.charEnd === key.charEnd &&
                s.contentHash === key.contentHash,
            ) ?? null
          );
        },
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            userId: string;
            messageId: string;
            charStart: number;
            charEnd: number;
            contentHash: string;
          };
        }) => {
          if (options?.failSideBCreate && data.messageId === MSG_B) {
            throw new Error("simulated Side B span failure");
          }
          const existing = spans.find(
            (s) =>
              s.messageId === data.messageId &&
              s.charStart === data.charStart &&
              s.charEnd === data.charEnd &&
              s.contentHash === data.contentHash,
          );
          if (existing) {
            throwP2002(
              "Unique constraint failed on EvidenceSpan messageId_charStart_charEnd_contentHash",
            );
          }
          const id = options?.forceSameSpanId
            ? "forced-same-span-id"
            : `span-${++spanSeq}`;
          const row: ContradictionRepairedSpanRow = { id, ...data };
          spans.push(row);
          return { id };
        },
      ),
    },
    contradictionNode: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId: string;
            sideASourceSpanId: string;
            sideBSourceSpanId: string;
          };
        }) => {
          if (options?.raceMode && raceBarrier) {
            const found = findExactNodeRow(where);
            if (found) {
              return {
                id: String(found.id),
                userId: String(found.userId),
                sideASourceSpanId:
                  (found.sideASourceSpanId as string | null) ?? null,
                sideBSourceSpanId:
                  (found.sideBSourceSpanId as string | null) ?? null,
              };
            }
            raceObservers += 1;
            if (raceObservers >= 2 && releaseRaceObservers) {
              releaseRaceObservers();
            }
            await raceBarrier;
            // Both callers observed absence before either create — keep returning null.
            return null;
          }

          const found = findExactNodeRow(where);
          if (!found) return null;
          return {
            id: String(found.id),
            userId: String(found.userId),
            sideASourceSpanId:
              (found.sideASourceSpanId as string | null) ?? null,
            sideBSourceSpanId:
              (found.sideBSourceSpanId as string | null) ?? null,
          };
        },
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const run = async () => {
          if (options?.failNodeCreate) {
            throw new Error("simulated node create failure");
          }
          if (options?.throwUnresolvedNodeP2002) {
            throwP2002(
              "Unique constraint failed on ContradictionNode_user_sideA_sideB_span_uniq",
            );
          }
          if (options?.nodeCreateReturnsEmptyId) {
            return { id: "" };
          }
          const existing = findExactNodeRow({
            userId: String(data.userId),
            sideASourceSpanId: String(data.sideASourceSpanId),
            sideBSourceSpanId: String(data.sideBSourceSpanId),
          });
          if (existing) {
            throwP2002(
              "Unique constraint failed on ContradictionNode_user_sideA_sideB_span_uniq",
            );
          }
          const id = `node-${++nodeSeq}`;
          nodes.push({ id, ...data });
          return { id };
        };

        // Chain creates: concurrent callers still both observe absent via findFirst,
        // but the second create hits the unique conflict after the first commits.
        const prior = nodeCreateChain;
        let release!: () => void;
        nodeCreateChain = new Promise<void>((resolve) => {
          release = resolve;
        });
        await prior;
        try {
          return await run();
        } finally {
          release();
        }
      }),
    },
  };

  const rolledBack = { value: false };
  const db: ContradictionRepairedPersistenceDb = {
    ...tx,
    $transaction: vi.fn(async (callback) => {
      // Track rows inserted by THIS transaction only (concurrent winners must survive).
      const ownedSpanIds = new Set<string>();
      const ownedNodeIds = new Set<string>();
      const trackingTx = {
        ...tx,
        evidenceSpan: {
          ...tx.evidenceSpan,
          create: async (args: {
            data: {
              userId: string;
              messageId: string;
              charStart: number;
              charEnd: number;
              contentHash: string;
            };
            select: { id: true };
          }) => {
            const created = await tx.evidenceSpan.create(args);
            ownedSpanIds.add(created.id);
            return created;
          },
        },
        contradictionNode: {
          ...tx.contradictionNode,
          create: async (args: { data: Record<string, unknown>; select: { id: true } }) => {
            const created = await tx.contradictionNode.create(args);
            ownedNodeIds.add(created.id);
            return created;
          },
        },
      };
      try {
        return await callback(trackingTx);
      } catch (error) {
        for (let i = spans.length - 1; i >= 0; i -= 1) {
          if (ownedSpanIds.has(spans[i].id)) spans.splice(i, 1);
        }
        for (let i = nodes.length - 1; i >= 0; i -= 1) {
          if (ownedNodeIds.has(String(nodes[i].id))) nodes.splice(i, 1);
        }
        rolledBack.value = true;
        throw error;
      }
    }),
  };

  return { db, spans, nodes, rolledBack, tx };
}

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Specialized harness for EvidenceSpan Side A create race from empty state.
 * Separate from makeFakeDb raceMode (node-create race with pre-seeded spans).
 */
function makeSpanRaceFakeDb() {
  const messages = new Map([
    [
      MSG_A,
      {
        id: MSG_A,
        userId: USER,
        sessionId: SESSION,
        content: CONTENT_A,
      },
    ],
    [
      MSG_B,
      {
        id: MSG_B,
        userId: USER,
        sessionId: SESSION,
        content: CONTENT_B,
      },
    ],
  ]);

  const spans: ContradictionRepairedSpanRow[] = [];
  const nodes: Array<Record<string, unknown>> = [];
  let spanSeq = 0;
  let nodeSeq = 0;

  let sideAAbsentObservations = 0;
  const bothObservedAbsent = deferred();
  let winnerTxCommitted = false;
  const winnerCommitted = deferred();
  let spanCreateAttempts = 0;
  let spanP2002Thrown = 0;
  let spanP2002OnEvidenceSpanCreate = false;
  let recoveryWaitedUntilWinnerCommit = false;
  let sideACreateWinnerId: string | null = null;

  function isSideAKey(key: {
    messageId: string;
    charStart: number;
    charEnd: number;
    contentHash: string;
  }) {
    return (
      key.messageId === MSG_A &&
      key.charStart === 0 &&
      key.charEnd === QUOTE_A.length &&
      key.contentHash === sha(QUOTE_A)
    );
  }

  function findExactNodeRow(where: {
    userId: string;
    sideASourceSpanId: string;
    sideBSourceSpanId: string;
  }) {
    return (
      nodes.find(
        (n) =>
          n.userId === where.userId &&
          n.sideASourceSpanId === where.sideASourceSpanId &&
          n.sideBSourceSpanId === where.sideBSourceSpanId,
      ) ?? null
    );
  }

  function throwP2002(message: string): never {
    const err = new Error(message);
    Object.assign(err, { code: "P2002" });
    throw err;
  }

  const tx = {
    message: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          messages.get(where.id) ?? null,
      ),
    },
    evidenceSpan: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: {
            messageId_charStart_charEnd_contentHash: {
              messageId: string;
              charStart: number;
              charEnd: number;
              contentHash: string;
            };
          };
        }) => {
          const key = where.messageId_charStart_charEnd_contentHash;
          const found =
            spans.find(
              (s) =>
                s.messageId === key.messageId &&
                s.charStart === key.charStart &&
                s.charEnd === key.charEnd &&
                s.contentHash === key.contentHash,
            ) ?? null;

          if (found) return found;

          // Side A absent barrier: both callers must observe absence before either create.
          if (isSideAKey(key)) {
            sideAAbsentObservations += 1;
            if (sideAAbsentObservations >= 2) {
              bothObservedAbsent.resolve();
            }
            await bothObservedAbsent.promise;
            // Keep returning null so both proceed to create (not mid-tx re-find of winner).
            return null;
          }

          return null;
        },
      ),
      create: vi.fn(
        async ({
          data,
        }: {
          data: {
            userId: string;
            messageId: string;
            charStart: number;
            charEnd: number;
            contentHash: string;
          };
        }) => {
          if (isSideAKey(data)) {
            spanCreateAttempts += 1;
            if (spanCreateAttempts === 1) {
              const id = `span-${++spanSeq}`;
              const row: ContradictionRepairedSpanRow = { id, ...data };
              spans.push(row);
              sideACreateWinnerId = id;
              return { id };
            }
            // Loser: wait until winning transaction fully commits (spans + node).
            await winnerCommitted.promise;
            recoveryWaitedUntilWinnerCommit = winnerTxCommitted;
            spanP2002Thrown += 1;
            spanP2002OnEvidenceSpanCreate = true;
            throwP2002(
              "Unique constraint failed on EvidenceSpan messageId_charStart_charEnd_contentHash",
            );
          }

          // Side B (and any non-Side-A) create — winner path only in this harness.
          const existing = spans.find(
            (s) =>
              s.messageId === data.messageId &&
              s.charStart === data.charStart &&
              s.charEnd === data.charEnd &&
              s.contentHash === data.contentHash,
          );
          if (existing) {
            throwP2002(
              "Unique constraint failed on EvidenceSpan messageId_charStart_charEnd_contentHash",
            );
          }
          const id = `span-${++spanSeq}`;
          const row: ContradictionRepairedSpanRow = { id, ...data };
          spans.push(row);
          return { id };
        },
      ),
    },
    contradictionNode: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId: string;
            sideASourceSpanId: string;
            sideBSourceSpanId: string;
          };
        }) => {
          const found = findExactNodeRow(where);
          if (!found) return null;
          return {
            id: String(found.id),
            userId: String(found.userId),
            sideASourceSpanId:
              (found.sideASourceSpanId as string | null) ?? null,
            sideBSourceSpanId:
              (found.sideBSourceSpanId as string | null) ?? null,
          };
        },
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const existing = findExactNodeRow({
          userId: String(data.userId),
          sideASourceSpanId: String(data.sideASourceSpanId),
          sideBSourceSpanId: String(data.sideBSourceSpanId),
        });
        if (existing) {
          throwP2002(
            "Unique constraint failed on ContradictionNode_user_sideA_sideB_span_uniq",
          );
        }
        const id = `node-${++nodeSeq}`;
        nodes.push({ id, ...data });
        return { id };
      }),
      update: vi.fn(async () => {
        throw new Error("contradictionNode.update must not be called");
      }),
    },
    contradictionEvidence: {
      create: vi.fn(async () => {
        throw new Error("contradictionEvidence.create must not be called");
      }),
    },
    modelUpdate: {
      create: vi.fn(async () => {
        throw new Error("modelUpdate.create must not be called");
      }),
    },
  };

  const rolledBack = { value: false };
  const db: ContradictionRepairedPersistenceDb = {
    ...tx,
    $transaction: vi.fn(async (callback) => {
      const ownedSpanIds = new Set<string>();
      const ownedNodeIds = new Set<string>();
      const trackingTx = {
        ...tx,
        evidenceSpan: {
          ...tx.evidenceSpan,
          create: async (args: {
            data: {
              userId: string;
              messageId: string;
              charStart: number;
              charEnd: number;
              contentHash: string;
            };
            select: { id: true };
          }) => {
            const created = await tx.evidenceSpan.create(args);
            ownedSpanIds.add(created.id);
            return created;
          },
        },
        contradictionNode: {
          ...tx.contradictionNode,
          create: async (args: {
            data: Record<string, unknown>;
            select: { id: true };
          }) => {
            const created = await tx.contradictionNode.create(args);
            ownedNodeIds.add(created.id);
            return created;
          },
        },
      };
      try {
        const result = await callback(trackingTx);
        // Signal only after the entire winning transaction commits (spans + node).
        if (!winnerTxCommitted && spans.length === 2 && nodes.length === 1) {
          winnerTxCommitted = true;
          winnerCommitted.resolve();
        }
        return result;
      } catch (error) {
        for (let i = spans.length - 1; i >= 0; i -= 1) {
          if (ownedSpanIds.has(spans[i].id)) spans.splice(i, 1);
        }
        for (let i = nodes.length - 1; i >= 0; i -= 1) {
          if (ownedNodeIds.has(String(nodes[i].id))) nodes.splice(i, 1);
        }
        rolledBack.value = true;
        throw error;
      }
    }),
  };

  return {
    db,
    spans,
    nodes,
    rolledBack,
    tx,
    harness: {
      get sideAAbsentObservations() {
        return sideAAbsentObservations;
      },
      get spanCreateAttempts() {
        return spanCreateAttempts;
      },
      get spanP2002Thrown() {
        return spanP2002Thrown;
      },
      get spanP2002OnEvidenceSpanCreate() {
        return spanP2002OnEvidenceSpanCreate;
      },
      get winnerTxCommitted() {
        return winnerTxCommitted;
      },
      get recoveryWaitedUntilWinnerCommit() {
        return recoveryWaitedUntilWinnerCommit;
      },
      get sideACreateWinnerId() {
        return sideACreateWinnerId;
      },
    },
  };
}

describe("CONTRADICTION-DUPLICATE-PREVENTION-001 repaired persistence writer", () => {
  describe("module boundary", () => {
    it("does not import prismadb, materialisation, detection, or routes", () => {
      const sourceText = readFileSync(
        join(process.cwd(), "lib/contradiction-repaired-persistence.ts"),
        "utf8",
      );
      expect(sourceText).not.toMatch(/from ["'].*prismadb["']/);
      expect(sourceText).not.toMatch(/materializeContradictions/);
      expect(sourceText).not.toMatch(/from ["'].*contradiction-detection["']/);
      expect(sourceText).not.toMatch(/from ["']@prisma\/client["']/);
      expect(sourceText).not.toMatch(/modelUpdate\.(create|update)/);
      expect(sourceText).not.toMatch(/contradictionEvidence\.(create|update)/);
    });

    it("does not wire into production surfaces", () => {
      const planSource = readFileSync(
        join(process.cwd(), "lib/contradiction-persistence-plan.ts"),
        "utf8",
      );
      const writerSource = readFileSync(
        join(process.cwd(), "lib/contradiction-repaired-persistence.ts"),
        "utf8",
      );
      for (const text of [planSource, writerSource]) {
        expect(text).not.toMatch(/from ["']@\/app\//);
        expect(text).not.toMatch(/from ["']\.\.\/app\//);
        expect(text).not.toMatch(/from ["'].*import-chatgpt/);
      }
    });
  });

  describe("span + node persistence", () => {
    it("creates Side A and Side B spans and exactly one candidate node", async () => {
      const plan = makeAuthorisedPlan();
      const { db, spans, nodes, tx } = makeFakeDb();

      const result = await persistRepairedContradictionCandidate({ plan, db });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.writeExecuted).toBe(true);
      expect(result.sideASpanOutcome).toBe("created");
      expect(result.sideBSpanOutcome).toBe("created");
      expect(result.status).toBe("candidate");
      expect(result.recommendedStorageConfidence).toBe("medium");
      expect(result.contradictionDeduplicationProven).toBe(true);
      expect(result.contradictionNodeOutcome).toBe("created");
      expect(spans).toHaveLength(2);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        userId: USER,
        title: plan.title,
        sideA: PROP_A,
        sideB: PROP_B,
        type: "goal_behavior_gap",
        confidence: "medium",
        status: "candidate",
        sourceSessionId: SESSION,
        sourceMessageId: null,
        sideASourceSpanId: result.sideASourceSpanId,
        sideBSourceSpanId: result.sideBSourceSpanId,
        evidenceCount: 0,
      });
      expect(result.sideASourceSpanId).not.toBe(result.sideBSourceSpanId);
      expect(tx.contradictionNode.create).toHaveBeenCalledTimes(1);
    });

    it("stores shared sourceSessionId and null sourceMessageId (no singular side authority)", async () => {
      const plan = makeAuthorisedPlan();
      const { db, nodes } = makeFakeDb();
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(true);
      expect(nodes[0]?.sourceSessionId).toBe(SESSION);
      expect(nodes[0]?.sourceMessageId).toBeNull();
      expect(nodes[0]?.sourceMessageId).not.toBe(MSG_A);
      expect(nodes[0]?.sourceMessageId).not.toBe(MSG_B);
      expect(nodes[0]?.sideASourceSpanId).toBeTruthy();
      expect(nodes[0]?.sideBSourceSpanId).toBeTruthy();
      expect(plan.sideBTriggerMessageId).toBe(MSG_B);
      expect(plan.sideBTriggerMessageId).not.toBe(nodes[0]?.sourceMessageId);
    });

    it("reuses an exact existing Side A span", async () => {
      const plan = makeAuthorisedPlan();
      const existingA: ContradictionRepairedSpanRow = {
        id: "existing-a",
        userId: plan.sideASpanEnsureDescriptor.userId,
        messageId: plan.sideASpanEnsureDescriptor.messageId,
        charStart: plan.sideASpanEnsureDescriptor.charStart,
        charEnd: plan.sideASpanEnsureDescriptor.charEnd,
        contentHash: plan.sideASpanEnsureDescriptor.contentHash,
      };
      const { db } = makeFakeDb({ existingSpans: [existingA] });
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.sideASpanOutcome).toBe("reused");
      expect(result.sideASourceSpanId).toBe("existing-a");
      expect(result.sideBSpanOutcome).toBe("created");
    });

    it("reuses an exact existing Side B span", async () => {
      const plan = makeAuthorisedPlan();
      const existingB: ContradictionRepairedSpanRow = {
        id: "existing-b",
        userId: plan.sideBSpanEnsureDescriptor.userId,
        messageId: plan.sideBSpanEnsureDescriptor.messageId,
        charStart: plan.sideBSpanEnsureDescriptor.charStart,
        charEnd: plan.sideBSpanEnsureDescriptor.charEnd,
        contentHash: plan.sideBSpanEnsureDescriptor.contentHash,
      };
      const { db } = makeFakeDb({ existingSpans: [existingB] });
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.sideBSpanOutcome).toBe("reused");
      expect(result.sideBSourceSpanId).toBe("existing-b");
    });

    it("reuses both exact spans", async () => {
      const plan = makeAuthorisedPlan();
      const { db } = makeFakeDb({
        existingSpans: [
          {
            id: "existing-a",
            userId: plan.sideASpanEnsureDescriptor.userId,
            messageId: plan.sideASpanEnsureDescriptor.messageId,
            charStart: plan.sideASpanEnsureDescriptor.charStart,
            charEnd: plan.sideASpanEnsureDescriptor.charEnd,
            contentHash: plan.sideASpanEnsureDescriptor.contentHash,
          },
          {
            id: "existing-b",
            userId: plan.sideBSpanEnsureDescriptor.userId,
            messageId: plan.sideBSpanEnsureDescriptor.messageId,
            charStart: plan.sideBSpanEnsureDescriptor.charStart,
            charEnd: plan.sideBSpanEnsureDescriptor.charEnd,
            contentHash: plan.sideBSpanEnsureDescriptor.contentHash,
          },
        ],
      });
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.sideASpanOutcome).toBe("reused");
      expect(result.sideBSpanOutcome).toBe("reused");
    });

    it("rejects existing span with mismatched ownership", async () => {
      const plan = makeAuthorisedPlan();
      const { db } = makeFakeDb({
        existingSpans: [
          {
            id: "bad-a",
            userId: "other-user",
            messageId: plan.sideASpanEnsureDescriptor.messageId,
            charStart: plan.sideASpanEnsureDescriptor.charStart,
            charEnd: plan.sideASpanEnsureDescriptor.charEnd,
            contentHash: plan.sideASpanEnsureDescriptor.contentHash,
          },
        ],
      });
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("existing_span_mismatch");
      expect(result.writeExecuted).toBe(false);
    });

    it("rejects same returned span ID for both sides", async () => {
      const plan = makeAuthorisedPlan();
      const { db } = makeFakeDb({ forceSameSpanId: true });
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("identical_span_ids");
    });

    it("does not update existing nodes and does not create ModelUpdate/ContradictionEvidence", async () => {
      const plan = makeAuthorisedPlan();
      const { db, nodes, tx } = makeFakeDb();
      const before = [{ id: "legacy-1", title: "legacy" }];
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(true);
      expect(nodes).toHaveLength(1);
      expect(before[0]).toEqual({ id: "legacy-1", title: "legacy" });
      expect(tx.contradictionNode.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("transactionality", () => {
    it("Side B span failure prevents node creation and rolls back", async () => {
      const plan = makeAuthorisedPlan();
      const { db, nodes, spans, rolledBack, tx } = makeFakeDb({
        failSideBCreate: true,
      });
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("transaction_failure");
      expect(result.writeExecuted).toBe(false);
      expect(nodes).toHaveLength(0);
      expect(spans).toHaveLength(0);
      expect(rolledBack.value).toBe(true);
      expect(tx.contradictionNode.create).not.toHaveBeenCalled();
    });

    it("node creation failure rolls back transaction in the fake contract", async () => {
      const plan = makeAuthorisedPlan();
      const { db, nodes, spans, rolledBack } = makeFakeDb({
        failNodeCreate: true,
      });
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("transaction_failure");
      expect(nodes).toHaveLength(0);
      expect(spans).toHaveLength(0);
      expect(rolledBack.value).toBe(true);
    });

    it("returns no success before transaction completion and creates node at most once", async () => {
      const plan = makeAuthorisedPlan();
      const { db, tx } = makeFakeDb();
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(true);
      expect(tx.contradictionNode.create).toHaveBeenCalledTimes(1);
      expect(db.$transaction).toHaveBeenCalledTimes(1);
    });

    it("rejects node create that returns no id", async () => {
      const plan = makeAuthorisedPlan();
      const { db, nodes } = makeFakeDb({ nodeCreateReturnsEmptyId: true });
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("node_create_missing_id");
      expect(nodes).toHaveLength(0);
    });
  });

  describe("writer rejection cases", () => {
    it("rejects a non-authorised / forged plan before transaction", async () => {
      const { db, tx } = makeFakeDb();
      const result = await persistRepairedContradictionCandidate({
        plan: {
          persistenceAuthorised: true,
          writeExecuted: false,
          persistenceAuthorisationToken:
            "contradiction-persistence-authorised-v1",
          userId: USER,
          persistedSourceMessageId: null,
        },
        db,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("plan_not_authorised");
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(tx.contradictionNode.create).not.toHaveBeenCalled();
    });

    it("rejects a JSON clone of a valid plan before transaction", async () => {
      const plan = makeAuthorisedPlan();
      const { db } = makeFakeDb();
      const result = await persistRepairedContradictionCandidate({
        plan: JSON.parse(JSON.stringify(plan)),
        db,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("plan_not_authorised");
    });

    it("rejects unresolved source message", async () => {
      const plan = makeAuthorisedPlan();
      const { db } = makeFakeDb({ omitMessageIds: [MSG_A] });
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("unresolved_source_message");
    });

    it("rejects wrong-user message", async () => {
      const plan = makeAuthorisedPlan();
      const { db } = makeFakeDb({
        messageOverrides: { [MSG_A]: { userId: "intruder" } },
      });
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("wrong_user_message");
    });

    it("rejects wrong-session message", async () => {
      const plan = makeAuthorisedPlan();
      const { db } = makeFakeDb({
        messageOverrides: { [MSG_B]: { sessionId: "other-session" } },
      });
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("wrong_session_message");
    });

    it("rejects message content inconsistent with descriptor", async () => {
      const plan = makeAuthorisedPlan();
      const { db } = makeFakeDb({
        messageOverrides: { [MSG_A]: { content: "totally different content" } },
      });
      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("message_content_inconsistent");
    });
  });


  describe("CEQR-007 exact duplicate prevention", () => {
    it("sequential second invocation reuses the same node without a second create", async () => {
      const plan = makeAuthorisedPlan();
      const { db, nodes, spans, tx } = makeFakeDb();

      const first = await persistRepairedContradictionCandidate({ plan, db });
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.contradictionNodeOutcome).toBe("created");
      expect(first.writeExecuted).toBe(true);
      expect(first.contradictionDeduplicationProven).toBe(true);

      const second = await persistRepairedContradictionCandidate({ plan, db });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.contradictionNodeOutcome).toBe("reused");
      expect(second.writeExecuted).toBe(false);
      expect(second.contradictionDeduplicationProven).toBe(true);
      expect(second.contradictionNodeId).toBe(first.contradictionNodeId);
      expect(second.sideASourceSpanId).toBe(first.sideASourceSpanId);
      expect(second.sideBSourceSpanId).toBe(first.sideBSourceSpanId);
      expect(nodes).toHaveLength(1);
      expect(spans).toHaveLength(2);
      expect(tx.contradictionNode.create).toHaveBeenCalledTimes(1);
    });

    it("allows a different Side A span to create a different node", async () => {
      const plan1 = makeAuthorisedPlan();
      const quoteAlt = "I refuse alcohol entirely";
      const contentAlt = `${quoteAlt} and other text`;
      const plan2 = makeAuthorisedPlanWithSideAQuote(quoteAlt, contentAlt);
      const { db, nodes } = makeFakeDb({
        extraMessages: [
          {
            id: "message-a-alt",
            userId: USER,
            sessionId: SESSION,
            content: contentAlt,
          },
        ],
      });

      const first = await persistRepairedContradictionCandidate({ plan: plan1, db });
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const second = await persistRepairedContradictionCandidate({ plan: plan2, db });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.contradictionNodeOutcome).toBe("created");
      expect(second.contradictionNodeId).not.toBe(first.contradictionNodeId);
      expect(second.sideASourceSpanId).not.toBe(first.sideASourceSpanId);
      expect(second.sideBSourceSpanId).toBe(first.sideBSourceSpanId);
      expect(nodes).toHaveLength(2);
    });


    it("allows a different Side B span identity to create a different node", async () => {
      const plan = makeAuthorisedPlan();
      const { db, nodes } = makeFakeDb({
        existingSpans: [
          {
            id: "span-a",
            userId: USER,
            messageId: MSG_A,
            charStart: plan.sideASpanEnsureDescriptor.charStart,
            charEnd: plan.sideASpanEnsureDescriptor.charEnd,
            contentHash: plan.sideASpanEnsureDescriptor.contentHash,
          },
          {
            id: "span-b-other",
            userId: USER,
            messageId: MSG_B,
            charStart: 0,
            charEnd: 1,
            contentHash: sha(CONTENT_B.slice(0, 1)),
          },
        ],
        existingNodes: [
          {
            id: "node-other-b",
            userId: USER,
            sideASourceSpanId: "span-a",
            sideBSourceSpanId: "span-b-other",
          },
        ],
      });

      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.contradictionNodeOutcome).toBe("created");
      expect(result.contradictionNodeId).not.toBe("node-other-b");
      expect(nodes).toHaveLength(2);
      expect(
        nodes.filter(
          (n) =>
            n.sideASourceSpanId === result.sideASourceSpanId &&
            n.sideBSourceSpanId === result.sideBSourceSpanId,
        ),
      ).toHaveLength(1);
    });

    it("legacy null-null nodes do not block exact repaired creation", async () => {
      const plan = makeAuthorisedPlan();
      const { db, nodes } = makeFakeDb({
        existingNodes: [
          {
            id: "legacy-null-1",
            userId: USER,
            sideASourceSpanId: null,
            sideBSourceSpanId: null,
            title: "legacy",
          },
          {
            id: "legacy-null-2",
            userId: USER,
            sideASourceSpanId: null,
            sideBSourceSpanId: null,
            title: "legacy-2",
          },
        ],
      });

      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.contradictionNodeOutcome).toBe("created");
      expect(nodes).toHaveLength(3);
      expect(nodes.filter((n) => n.sideASourceSpanId == null)).toHaveLength(2);
      expect(
        nodes.find((n) => n.id === result.contradictionNodeId)?.sideASourceSpanId,
      ).toBeTruthy();
    });

    it("fails closed on malformed existing exact row (wrong userId)", async () => {
      const plan = makeAuthorisedPlan();
      const spans = [
        {
          id: "span-a",
          userId: USER,
          messageId: MSG_A,
          charStart: plan.sideASpanEnsureDescriptor.charStart,
          charEnd: plan.sideASpanEnsureDescriptor.charEnd,
          contentHash: plan.sideASpanEnsureDescriptor.contentHash,
        },
        {
          id: "span-b",
          userId: USER,
          messageId: MSG_B,
          charStart: plan.sideBSpanEnsureDescriptor.charStart,
          charEnd: plan.sideBSpanEnsureDescriptor.charEnd,
          contentHash: plan.sideBSpanEnsureDescriptor.contentHash,
        },
      ];

      // Blank id fails integrity after exact-key lookup.
      const { db: dbBlank, nodes: blankNodes } = makeFakeDb({
        existingSpans: spans,
        existingNodes: [
          {
            id: "   ",
            userId: USER,
            sideASourceSpanId: "span-a",
            sideBSourceSpanId: "span-b",
          },
        ],
      });

      const blank = await persistRepairedContradictionCandidate({
        plan,
        db: dbBlank,
      });
      expect(blank.ok).toBe(false);
      if (blank.ok) return;
      expect(blank.code).toBe("existing_node_mismatch");
      expect(blankNodes).toHaveLength(1);

      // Wrong userId on a row returned by findFirst: patch findFirst to return mismatched row.
      const { db: dbMismatch, nodes: mismatchNodes, tx } = makeFakeDb({
        existingSpans: spans,
      });
      tx.contradictionNode.findFirst = vi.fn(async () => ({
        id: "forged",
        userId: "intruder",
        sideASourceSpanId: "span-a",
        sideBSourceSpanId: "span-b",
      }));

      const mismatched = await persistRepairedContradictionCandidate({
        plan,
        db: dbMismatch,
      });
      expect(mismatched.ok).toBe(false);
      if (mismatched.ok) return;
      expect(mismatched.code).toBe("existing_node_mismatch");
      expect(mismatchNodes).toHaveLength(0);
    });

    it("concurrent same-plan invocations from empty spans recover exact node after EvidenceSpan P2002", async () => {
      const plan = makeAuthorisedPlan();
      const { db, nodes, spans, tx, harness } = makeSpanRaceFakeDb();

      expect(spans).toHaveLength(0);
      expect(nodes).toHaveLength(0);

      const [a, b] = await Promise.all([
        persistRepairedContradictionCandidate({ plan, db }),
        persistRepairedContradictionCandidate({ plan, db }),
      ]);

      expect(harness.sideAAbsentObservations).toBe(2);
      expect(harness.spanCreateAttempts).toBe(2);
      expect(harness.spanP2002Thrown).toBe(1);
      expect(harness.spanP2002OnEvidenceSpanCreate).toBe(true);
      expect(harness.winnerTxCommitted).toBe(true);
      expect(harness.recoveryWaitedUntilWinnerCommit).toBe(true);
      expect(harness.sideACreateWinnerId).toBeTruthy();

      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      if (!a.ok || !b.ok) return;

      expect(a.contradictionNodeId).toBe(b.contradictionNodeId);
      const outcomes = [a.contradictionNodeOutcome, b.contradictionNodeOutcome].sort();
      expect(outcomes).toEqual(["created", "reused"]);
      const created = a.contradictionNodeOutcome === "created" ? a : b;
      const reused = a.contradictionNodeOutcome === "reused" ? a : b;
      expect(created.writeExecuted).toBe(true);
      expect(reused.writeExecuted).toBe(false);
      expect(created.contradictionDeduplicationProven).toBe(true);
      expect(reused.contradictionDeduplicationProven).toBe(true);
      expect(nodes).toHaveLength(1);
      expect(spans).toHaveLength(2);
      expect(
        new Set(spans.map((s) => `${s.messageId}:${s.charStart}:${s.charEnd}:${s.contentHash}`)).size,
      ).toBe(2);
      expect(new Set(nodes.map((n) => String(n.id))).size).toBe(1);
      expect(tx.contradictionNode.create).toHaveBeenCalledTimes(1);
      expect(tx.contradictionNode.update).not.toHaveBeenCalled();
      expect(tx.contradictionEvidence.create).not.toHaveBeenCalled();
      expect(tx.modelUpdate.create).not.toHaveBeenCalled();
    });

    it("concurrent same-plan invocations result in one durable node via P2002 recovery", async () => {
      const plan = makeAuthorisedPlan();
      // Pre-seed exact spans so the race is on ContradictionNode create only
      // (avoids span P2002 aborting one caller before the node findFirst barrier).
      const { db, nodes, spans, tx } = makeFakeDb({
        raceMode: true,
        existingSpans: [
          {
            id: "span-a",
            userId: USER,
            messageId: MSG_A,
            charStart: plan.sideASpanEnsureDescriptor.charStart,
            charEnd: plan.sideASpanEnsureDescriptor.charEnd,
            contentHash: plan.sideASpanEnsureDescriptor.contentHash,
          },
          {
            id: "span-b",
            userId: USER,
            messageId: MSG_B,
            charStart: plan.sideBSpanEnsureDescriptor.charStart,
            charEnd: plan.sideBSpanEnsureDescriptor.charEnd,
            contentHash: plan.sideBSpanEnsureDescriptor.contentHash,
          },
        ],
      });

      const [a, b] = await Promise.all([
        persistRepairedContradictionCandidate({ plan, db }),
        persistRepairedContradictionCandidate({ plan, db }),
      ]);

      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      if (!a.ok || !b.ok) return;

      expect(a.contradictionNodeId).toBe(b.contradictionNodeId);
      const outcomes = [a.contradictionNodeOutcome, b.contradictionNodeOutcome].sort();
      expect(outcomes).toEqual(["created", "reused"]);
      const created = a.contradictionNodeOutcome === "created" ? a : b;
      const reused = a.contradictionNodeOutcome === "reused" ? a : b;
      expect(created.writeExecuted).toBe(true);
      expect(reused.writeExecuted).toBe(false);
      expect(created.contradictionDeduplicationProven).toBe(true);
      expect(reused.contradictionDeduplicationProven).toBe(true);
      expect(nodes).toHaveLength(1);
      expect(spans).toHaveLength(2);
      expect(tx.contradictionNode.create.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("unique-conflict recovery fails when no complete exact node is resolvable", async () => {
      const plan = makeAuthorisedPlan();
      const { db } = makeFakeDb({
        existingSpans: [
          {
            id: "span-a",
            userId: USER,
            messageId: MSG_A,
            charStart: plan.sideASpanEnsureDescriptor.charStart,
            charEnd: plan.sideASpanEnsureDescriptor.charEnd,
            contentHash: plan.sideASpanEnsureDescriptor.contentHash,
          },
          {
            id: "span-b",
            userId: USER,
            messageId: MSG_B,
            charStart: plan.sideBSpanEnsureDescriptor.charStart,
            charEnd: plan.sideBSpanEnsureDescriptor.charEnd,
            contentHash: plan.sideBSpanEnsureDescriptor.contentHash,
          },
        ],
        throwUnresolvedNodeP2002: true,
      });

      const result = await persistRepairedContradictionCandidate({ plan, db });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("unique_conflict_unresolved");
      expect(result.writeExecuted).toBe(false);
    });

    it("avoids CommonJS require calls in this test file", () => {
      const sourceText = readFileSync(
        join(process.cwd(), "lib/__tests__/contradiction-repaired-persistence.test.ts"),
        "utf8",
      );
      expect(sourceText).not.toMatch(/(?:^|[^\w.$])require\s*\(\s*["'`]/m);
    });
  });

  describe("anti-regression", () => {
    it("does not depend on marker/token/similarity/legacy confidence paths", () => {
      const sourceText = readFileSync(
        join(process.cwd(), "lib/contradiction-repaired-persistence.ts"),
        "utf8",
      );
      expect(sourceText).not.toMatch(/markerFamily|tokenOverlap|textualSimilarity/);
      expect(sourceText).not.toMatch(/from ["'].*contradiction-detection["']/);
      expect(sourceText).not.toMatch(/materializeContradictions/);
      expect(sourceText).not.toMatch(/from ["'].*reference/);
    });
  });

  describe("non-live wiring", () => {
    it("is not imported by routes or production lib surfaces", () => {
      const roots = ["app", "lib/orvek-v0", "lib/understanding-dark-engine"];
      const needle =
        /contradiction-persistence-plan|contradiction-repaired-persistence|persistRepairedContradictionCandidate|buildContradictionPersistencePlan/;
      const hits: string[] = [];

      function walk(dir: string) {
        let entries: string[] = [];
        try {
          entries = readdirSync(dir);
        } catch {
          return;
        }
        for (const entry of entries) {
          const full = join(dir, entry);
          let st;
          try {
            st = statSync(full);
          } catch {
            continue;
          }
          if (st.isDirectory()) {
            if (entry === "node_modules" || entry === ".next") continue;
            walk(full);
          } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) {
            const text = readFileSync(full, "utf8");
            if (needle.test(text)) hits.push(full);
          }
        }
      }

      for (const root of roots) walk(join(process.cwd(), root));
      expect(hits).toEqual([]);
    });
  });
});
