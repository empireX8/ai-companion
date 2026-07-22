/**
 * CEQR-010 — controlled natural-entry contradiction proof (corrected).
 *
 * Public entry: persisted CurrentMessageSource + SameSessionReferenceRow[].
 * Deterministic injected StructuredModelRunner + ObjectivityReferee only.
 * In-memory injected transaction boundary (not an actual isolated DB engine).
 * No prismadb. No live provider. No real account user ID. No message/import wiring.
 * Authorised persistence plans never egress the orchestrator.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContradictionModelTransportResult } from "../contradiction-adjudicator";
import { KERNEL_FIRST_PROOF_OBJECT } from "../contradiction-adjudicator";
import {
  runControlledContradictionNaturalEntryProof,
  type ControlledNaturalEntryProofInput,
} from "../contradiction-controlled-natural-entry-proof";
import { assertAuthorisedContradictionPersistencePlan } from "../contradiction-persistence-plan";
import {
  persistRepairedContradictionCandidate,
  type ContradictionRepairedPersistenceDb,
  type ContradictionRepairedSpanRow,
} from "../contradiction-repaired-persistence";
import type {
  CurrentMessageSource,
  SameSessionReferenceRow,
} from "../contradiction-same-session-selection";
import {
  claimForSubstring,
  type KernelSourceUnit,
  type ObjectivityReferee,
  type StructuredModelRunner,
} from "../orvek-intelligence-kernel";

const PROOF_USER = "ceqr010-proof-user-isolated";
const KAY_ACCOUNT = "user_34TUYA53pI1QRLK73O22Kve1a1G";
const SESSION = "ceqr010-session-1";
const OTHER_SESSION = "ceqr010-session-other";
const MSG_A = "ceqr010-message-a";
const MSG_B = "ceqr010-message-b";
const QUOTE_A = "I never drink alcohol";
const QUOTE_B = "I drank last night";
const CONTENT_A = `${QUOTE_A} and other text`;
const CONTENT_B = `Preface. ${QUOTE_B}`;
const REF_A = "ceqr010-ref-a";

const FIXED_NOW = () => new Date("2026-07-21T18:00:00.000Z");

function sha(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function classAResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
  overrides: Partial<ContradictionModelTransportResult> = {},
): ContradictionModelTransportResult {
  const claimA =
    overrides.evidenceClaimA ??
    claimForSubstring(sideA, QUOTE_A) ??
    claimForSubstring(sideA, sideA.sourceText)!;
  const claimB =
    overrides.evidenceClaimB ??
    claimForSubstring(sideB, QUOTE_B) ??
    claimForSubstring(sideB, sideB.sourceText)!;

  return {
    propositionA: {
      normalizedProposition: "Speaker never drinks alcohol",
      actor: "speaker",
      subject: "alcohol",
      timeframe: "general",
      negation: true,
      modality: "assertive",
      qualifications: "none",
    },
    propositionB: {
      normalizedProposition: "Speaker drank alcohol last night",
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
    evidenceClaimA: claimA,
    evidenceClaimB: claimB,
    rationale: "Incompatible under matching scope.",
    alternativeInterpretation: "Temporal change.",
    whatWouldChangeClassification: "Explicit time-scoped belief change.",
    abstentionReason: null,
    proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
    ...overrides,
  };
}

function compatibleResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): ContradictionModelTransportResult {
  return classAResult(sideA, sideB, {
    classification: "compatible_states",
    bothCanSimultaneouslyBeTrue: true,
    confidence: 0.7,
    rationale: "Compatible under different scopes.",
  });
}

function contextShiftResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): ContradictionModelTransportResult {
  return classAResult(sideA, sideB, {
    classification: "compatible_states",
    bothCanSimultaneouslyBeTrue: true,
    contextAndScope: "work context vs home context",
    confidence: 0.65,
    rationale: "Context shift explains the contrast.",
  });
}

function temporalChangeResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): ContradictionModelTransportResult {
  return classAResult(sideA, sideB, {
    classification: "compatible_states",
    changedBeliefOverTime: true,
    bothCanSimultaneouslyBeTrue: true,
    confidence: 0.6,
    rationale: "Belief changed over time.",
  });
}

function aspirationResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): ContradictionModelTransportResult {
  return classAResult(sideA, sideB, {
    classification: "plausible_unresolved_tension",
    intentionVersusOutcome: true,
    goalVersusObstacle: true,
    bothCanSimultaneouslyBeTrue: true,
    confidence: 0.55,
    rationale: "Aspiration versus behaviour — not Class A.",
  });
}

type ModelFactory = (
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
) => ContradictionModelTransportResult;

/**
 * Runner that rebuilds claims from the actual KernelSourceUnit fields embedded
 * in the landed adjudication prompt (JSON-stringified sourceText).
 */
function sequenceRunner(
  factories: ModelFactory[],
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
          SESSION;
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

      const sideA = parseSide("A");
      const sideB = parseSide("B");
      return {
        ok: true as const,
        object: factory(sideA, sideB),
        providerId: "ceqr010-fake-adjudicator",
        modelId: "ceqr010-deterministic-fixture",
        rawText: null,
      };
    },
  };
}

function bindReferee(
  evaluation: {
    outcome:
      | "PASS"
      | "PASS_WITH_LOWER_CONFIDENCE"
      | "ROUTE_TO_DIFFERENT_OBJECT_TYPE"
      | "REQUEST_MORE_EVIDENCE"
      | "ABSTAIN";
    rationale: string;
    adjustedConfidence?: number;
    routedObjectType?: string;
  },
): ObjectivityReferee & { callCount: () => number } {
  let calls = 0;
  return {
    callCount: () => calls,
    async evaluate() {
      calls += 1;
      return evaluation;
    },
  };
}

type HarnessMessage = {
  id: string;
  userId: string;
  sessionId: string;
  content: string;
  createdAt: Date;
};

type HarnessSession = {
  id: string;
  userId: string;
  origin: "APP" | "IMPORTED_ARCHIVE";
  label: string | null;
};

type HarnessNode = {
  id: string;
  userId: string;
  title: string;
  sideA: string;
  sideB: string;
  type: string;
  confidence: string;
  status: string;
  sourceSessionId: string;
  sourceMessageId: null;
  sideASourceSpanId: string;
  sideBSourceSpanId: string;
};

type IsolatedHarness = {
  userId: string;
  sessionId: string;
  sessions: Map<string, HarnessSession>;
  messages: Map<string, HarnessMessage>;
  /** Content the writer transaction observes (may diverge from lineage resolver). */
  writerMessageContent: Map<string, string>;
  spans: ContradictionRepairedSpanRow[];
  nodes: HarnessNode[];
  db: ContradictionRepairedPersistenceDb;
  writerInvokeCount: () => number;
  messageResolver: ControlledNaturalEntryProofInput["messageResolver"];
  presentationReader: NonNullable<
    ControlledNaturalEntryProofInput["presentationReader"]
  >;
  seedDefaultPersistedPair: () => {
    currentMessage: CurrentMessageSource;
    references: SameSessionReferenceRow[];
  };
  makeReference: (args: {
    id: string;
    type?: "goal" | "constraint";
    sourceSessionId: string | null;
    sourceMessageId: string | null;
    sourceMessage?: SameSessionReferenceRow["sourceMessage"];
    statement?: string;
  }) => SameSessionReferenceRow;
  mutateWriterMessageContent: (messageId: string, content: string) => void;
  cleanup: () => void;
  snapshotCounts: () => {
    sessions: number;
    messages: number;
    spans: number;
    nodes: number;
  };
};

function createIsolatedHarness(
  options: { failTransactionAfterSpans?: boolean } = {},
): IsolatedHarness {
  const userId = PROOF_USER;
  const sessionId = SESSION;
  const sessions = new Map<string, HarnessSession>();
  const messages = new Map<string, HarnessMessage>();
  const writerMessageContent = new Map<string, string>();
  const spans: ContradictionRepairedSpanRow[] = [];
  const nodes: HarnessNode[] = [];
  let spanSeq = 0;
  let nodeSeq = 0;
  let writerInvokes = 0;
  let nodeCreateChain: Promise<void> = Promise.resolve();

  sessions.set(sessionId, {
    id: sessionId,
    userId,
    origin: "APP",
    label: "CEQR-010 isolated proof session",
  });

  function throwP2002(message: string): never {
    const err = new Error(message);
    Object.assign(err, { code: "P2002" });
    throw err;
  }

  function findExactNode(where: {
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

  const tx = {
    message: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const m = messages.get(where.id);
        if (!m) return null;
        const content = writerMessageContent.get(where.id) ?? m.content;
        return {
          id: m.id,
          userId: m.userId,
          sessionId: m.sessionId,
          content,
        };
      }),
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
          select: { id: true };
        }) => {
          const dup = spans.find(
            (s) =>
              s.messageId === data.messageId &&
              s.charStart === data.charStart &&
              s.charEnd === data.charEnd &&
              s.contentHash === data.contentHash,
          );
          if (dup) {
            throwP2002(
              "Unique constraint failed on EvidenceSpan messageId_charStart_charEnd_contentHash",
            );
          }
          const row: ContradictionRepairedSpanRow = {
            id: `span-${++spanSeq}`,
            userId: data.userId,
            messageId: data.messageId,
            charStart: data.charStart,
            charEnd: data.charEnd,
            contentHash: data.contentHash,
          };
          spans.push(row);
          return { id: row.id };
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
          const found = findExactNode(where);
          if (!found) return null;
          return {
            id: found.id,
            userId: found.userId,
            sideASourceSpanId: found.sideASourceSpanId,
            sideBSourceSpanId: found.sideBSourceSpanId,
          };
        },
      ),
      create: vi.fn(
        async ({ data }: { data: Record<string, unknown>; select: { id: true } }) => {
          const run = async () => {
            const existing = findExactNode({
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
            nodes.push({
              id,
              userId: String(data.userId),
              title: String(data.title),
              sideA: String(data.sideA),
              sideB: String(data.sideB),
              type: String(data.type),
              confidence: String(data.confidence),
              status: String(data.status),
              sourceSessionId: String(data.sourceSessionId),
              sourceMessageId: null,
              sideASourceSpanId: String(data.sideASourceSpanId),
              sideBSourceSpanId: String(data.sideBSourceSpanId),
            });
            return { id };
          };

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
        },
      ),
    },
  };

  const db: ContradictionRepairedPersistenceDb = {
    ...tx,
    $transaction: vi.fn(async (callback) => {
      writerInvokes += 1;
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
            if (options.failTransactionAfterSpans && ownedSpanIds.size >= 2) {
              throw new Error("forced_transaction_failure");
            }
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
        return await callback(trackingTx);
      } catch (error) {
        for (let i = spans.length - 1; i >= 0; i -= 1) {
          if (ownedSpanIds.has(spans[i]!.id)) spans.splice(i, 1);
        }
        for (let i = nodes.length - 1; i >= 0; i -= 1) {
          if (ownedNodeIds.has(nodes[i]!.id)) nodes.splice(i, 1);
        }
        throw error;
      }
    }),
  };

  const harness: IsolatedHarness = {
    userId,
    sessionId,
    sessions,
    messages,
    writerMessageContent,
    spans,
    nodes,
    db,
    writerInvokeCount: () => writerInvokes,
    messageResolver: {
      async resolveMessages({ sideAMessageId, sideBMessageId }) {
        const sideA = messages.get(sideAMessageId);
        const sideB = messages.get(sideBMessageId);
        return {
          sideA: sideA
            ? {
                id: sideA.id,
                sessionId: sideA.sessionId,
                userId: sideA.userId,
                content: sideA.content,
              }
            : null,
          sideB: sideB
            ? {
                id: sideB.id,
                sessionId: sideB.sessionId,
                userId: sideB.userId,
                content: sideB.content,
              }
            : null,
        };
      },
    },
    presentationReader: {
      async findSpansByIds(uid, ids) {
        return spans
          .filter((s) => s.userId === uid && ids.includes(s.id))
          .map((s) => ({
            id: s.id,
            userId: s.userId,
            messageId: s.messageId,
            charStart: s.charStart,
            charEnd: s.charEnd,
            contentHash: s.contentHash,
            createdAt: new Date("2026-07-21T18:00:00.000Z"),
          }));
      },
      async findMessagesByIds(uid, ids) {
        return [...messages.values()]
          .filter((m) => m.userId === uid && ids.includes(m.id))
          .map((m) => ({
            id: m.id,
            userId: m.userId,
            sessionId: m.sessionId,
            content: m.content,
            createdAt: m.createdAt,
          }));
      },
      async findSessionsByIds(uid, ids) {
        return [...sessions.values()]
          .filter((s) => s.userId === uid && ids.includes(s.id))
          .map((s) => ({
            id: s.id,
            userId: s.userId,
            origin: s.origin,
            label: s.label,
          }));
      },
    },
    makeReference({
      id,
      type = "goal",
      sourceSessionId,
      sourceMessageId,
      sourceMessage,
      statement = "I never drink alcohol",
    }) {
      return {
        id,
        type,
        statement,
        status: "active",
        confidence: "high",
        sourceSessionId,
        sourceMessageId,
        sourceMessage: sourceMessage ?? null,
      };
    },
    seedDefaultPersistedPair() {
      messages.set(MSG_A, {
        id: MSG_A,
        userId,
        sessionId,
        content: CONTENT_A,
        createdAt: new Date("2026-07-21T17:00:00.000Z"),
      });
      messages.set(MSG_B, {
        id: MSG_B,
        userId,
        sessionId,
        content: CONTENT_B,
        createdAt: new Date("2026-07-21T17:05:00.000Z"),
      });
      writerMessageContent.set(MSG_A, CONTENT_A);
      writerMessageContent.set(MSG_B, CONTENT_B);

      const currentMessage: CurrentMessageSource = {
        sourceId: `message:${MSG_B}`,
        sessionId,
        messageId: MSG_B,
        role: "user",
        sourceText: CONTENT_B,
        label: "side_b_current_message",
      };

      const references: SameSessionReferenceRow[] = [
        harness.makeReference({
          id: REF_A,
          type: "goal",
          sourceSessionId: sessionId,
          sourceMessageId: MSG_A,
          sourceMessage: {
            id: MSG_A,
            sessionId,
            userId,
            content: CONTENT_A,
          },
        }),
      ];

      return { currentMessage, references };
    },
    mutateWriterMessageContent(messageId, content) {
      writerMessageContent.set(messageId, content);
    },
    cleanup() {
      messages.clear();
      writerMessageContent.clear();
      spans.splice(0, spans.length);
      nodes.splice(0, nodes.length);
      sessions.clear();
      writerInvokes = 0;
    },
    snapshotCounts() {
      return {
        sessions: sessions.size,
        messages: messages.size,
        spans: spans.length,
        nodes: nodes.length,
      };
    },
  };

  return harness;
}

async function runProof(
  harness: IsolatedHarness,
  args: {
    currentMessage: CurrentMessageSource;
    references: SameSessionReferenceRow[];
    modelRunner: StructuredModelRunner;
    objectivityReferee: ObjectivityReferee;
    presentationReader?: ControlledNaturalEntryProofInput["presentationReader"];
    messageResolver?: ControlledNaturalEntryProofInput["messageResolver"];
    userId?: string;
    sessionId?: string;
  },
) {
  expect(args.userId ?? harness.userId).not.toBe(KAY_ACCOUNT);
  return runControlledContradictionNaturalEntryProof({
    userId: args.userId ?? harness.userId,
    sessionId: args.sessionId ?? harness.sessionId,
    currentMessage: args.currentMessage,
    references: args.references,
    modelRunner: args.modelRunner,
    objectivityReferee: args.objectivityReferee,
    messageResolver: args.messageResolver ?? harness.messageResolver,
    persistenceDb: harness.db,
    presentationReader:
      args.presentationReader === undefined
        ? harness.presentationReader
        : args.presentationReader,
    now: FIXED_NOW,
  });
}

describe("CEQR-010 controlled natural-entry proof (corrected)", () => {
  const harnesses: IsolatedHarness[] = [];

  afterEach(() => {
    for (const h of harnesses) h.cleanup();
    harnesses.length = 0;
  });

  function freshHarness(
    options?: { failTransactionAfterSpans?: boolean },
  ): IsolatedHarness {
    const h = createIsolatedHarness(options);
    harnesses.push(h);
    return h;
  }

  it("N1. persisted message IDs/content/session become Side A/B source units", async () => {
    const harness = freshHarness();
    const { currentMessage, references } = harness.seedDefaultPersistedPair();
    const runner = sequenceRunner([classAResult]);
    const result = await runProof(harness, {
      currentMessage,
      references,
      modelRunner: runner,
      objectivityReferee: bindReferee({
        outcome: "PASS",
        rationale: "Deterministic fixture PASS — not a live AI judgment.",
      }),
    });
    expect(result.outcome).toBe("created");
    const pair = result.selection.selectedPair!;
    expect(pair.sideA.messageId).toBe(MSG_A);
    expect(pair.sideA.sessionId).toBe(SESSION);
    expect(pair.sideA.sourceText).toBe(CONTENT_A);
    expect(pair.sideB.messageId).toBe(MSG_B);
    expect(pair.sideB.sessionId).toBe(SESSION);
    expect(pair.sideB.sourceText).toBe(CONTENT_B);
    expect(pair.sideA.sourceId).toContain(REF_A);
    expect(pair.sideA.sourceId).toContain(MSG_A);
  });

  it("N2. wrong-user reference source is rejected before the model call", async () => {
    const harness = freshHarness();
    const { currentMessage } = harness.seedDefaultPersistedPair();
    const runner = sequenceRunner([classAResult]);
    const references = [
      harness.makeReference({
        id: "ref-wrong-user",
        sourceSessionId: SESSION,
        sourceMessageId: MSG_A,
        sourceMessage: {
          id: MSG_A,
          sessionId: SESSION,
          userId: "other-user",
          content: CONTENT_A,
        },
      }),
    ];
    const result = await runProof(harness, {
      currentMessage,
      references,
      modelRunner: runner,
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "n/a" }),
    });
    expect(runner.callCount()).toBe(0);
    expect(result.writerInvoked).toBe(false);
    expect(result.selection.rejectionSummaries.some(
      (s) => s.reason === "source_message_user_mismatch",
    )).toBe(true);
  });

  it("N3. cross-session reference is rejected before the model call", async () => {
    const harness = freshHarness();
    const { currentMessage } = harness.seedDefaultPersistedPair();
    const runner = sequenceRunner([classAResult]);
    const references = [
      harness.makeReference({
        id: "ref-cross",
        sourceSessionId: OTHER_SESSION,
        sourceMessageId: MSG_A,
        sourceMessage: {
          id: MSG_A,
          sessionId: OTHER_SESSION,
          userId: PROOF_USER,
          content: CONTENT_A,
        },
      }),
    ];
    const result = await runProof(harness, {
      currentMessage,
      references,
      modelRunner: runner,
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "n/a" }),
    });
    expect(runner.callCount()).toBe(0);
    expect(result.failureCode).toBe("cross_session");
    expect(result.writerInvoked).toBe(false);
  });

  it("N4. unresolved source message is rejected before the model call", async () => {
    const harness = freshHarness();
    const { currentMessage } = harness.seedDefaultPersistedPair();
    const runner = sequenceRunner([classAResult]);
    const references = [
      harness.makeReference({
        id: "ref-unresolved",
        sourceSessionId: SESSION,
        sourceMessageId: MSG_A,
        sourceMessage: null,
      }),
    ];
    const result = await runProof(harness, {
      currentMessage,
      references,
      modelRunner: runner,
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "n/a" }),
    });
    expect(runner.callCount()).toBe(0);
    expect(result.writerInvoked).toBe(false);
    expect(result.selection.rejectionSummaries.some(
      (s) => s.reason === "source_message_unresolved",
    )).toBe(true);
  });

  it("N5. selected pair contains units assembled from persisted inputs", async () => {
    const harness = freshHarness();
    const { currentMessage, references } = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      currentMessage,
      references,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    });
    expect(result.selection.selectedPair?.sideA.existingObjectId).toBe(REF_A);
    expect(result.selection.selectedPair?.sideB.sourceId).toBe(
      `message:${MSG_B}`,
    );
    expect(result.selection.selectedPair?.referenceId).toBe(REF_A);
  });

  it("1. valid Class A contradiction creates exactly one candidate", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({
        outcome: "PASS",
        rationale: "Deterministic fixture PASS — not a live AI judgment.",
      }),
    });
    expect(result.outcome).toBe("created");
    expect(result.writeExecuted).toBe(true);
    expect(result.writerInvoked).toBe(true);
    expect(result.gateStoppedAt).toBeNull();
    expect(result.presentationStatus).toBe("resolved");
    expect(harness.nodes).toHaveLength(1);
    expect(harness.spans).toHaveLength(2);
  });

  it("2. exact Side A/B quotes and hashes persist correctly", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    });
    const spanA = harness.spans.find((s) => s.id === result.sideASourceSpanId)!;
    const spanB = harness.spans.find((s) => s.id === result.sideBSourceSpanId)!;
    expect(spanA.contentHash).toBe(sha(QUOTE_A));
    expect(spanB.contentHash).toBe(sha(QUOTE_B));
    expect(CONTENT_A.slice(spanA.charStart, spanA.charEnd)).toBe(QUOTE_A);
    expect(CONTENT_B.slice(spanB.charStart, spanB.charEnd)).toBe(QUOTE_B);
  });

  it("3. dual-source presentation resolves exact excerpts after success", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    });
    expect(result.dualSourcePresentation?.lineageState).toBe("complete_verified");
    expect(result.dualSourcePresentation?.sideA).toMatchObject({
      availability: "available",
      exactQuote: QUOTE_A,
      integrityVerified: true,
    });
    expect(result.dualSourcePresentation?.sideB).toMatchObject({
      availability: "available",
      exactQuote: QUOTE_B,
      integrityVerified: true,
    });
  });

  it("4. compatible state produces no write", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([compatibleResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "n/a" }),
    });
    expect(result.outcome).toBe("no_candidate");
    expect(result.writerInvoked).toBe(false);
    expect(harness.nodes).toHaveLength(0);
  });

  it("5. context shift produces no write", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([contextShiftResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "n/a" }),
    });
    expect(result.writerInvoked).toBe(false);
    expect(harness.nodes).toHaveLength(0);
  });

  it("6. temporal change produces no write", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([temporalChangeResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "n/a" }),
    });
    expect(result.writerInvoked).toBe(false);
  });

  it("7. aspiration-versus-behaviour produces no contradiction write", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([aspirationResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "n/a" }),
    });
    expect(result.writerInvoked).toBe(false);
  });

  it("8. ambiguous evidence produces no write", async () => {
    const harness = freshHarness();
    const { currentMessage } = harness.seedDefaultPersistedPair();
    const references = [
      harness.makeReference({
        id: "ref-1",
        type: "goal",
        sourceSessionId: SESSION,
        sourceMessageId: MSG_A,
        sourceMessage: {
          id: MSG_A,
          sessionId: SESSION,
          userId: PROOF_USER,
          content: CONTENT_A,
        },
      }),
      harness.makeReference({
        id: "ref-2",
        type: "constraint",
        sourceSessionId: SESSION,
        sourceMessageId: MSG_A,
        sourceMessage: {
          id: MSG_A,
          sessionId: SESSION,
          userId: PROOF_USER,
          content: CONTENT_A,
        },
      }),
    ];
    const result = await runProof(harness, {
      currentMessage,
      references,
      modelRunner: sequenceRunner([classAResult, classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    });
    expect(result.failureCode).toBe("ambiguous_multiple_matches");
    expect(result.writerInvoked).toBe(false);
  });

  it("9. referee PASS allows continuation", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "Deterministic fixture PASS.",
    });
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: referee,
    });
    expect(referee.callCount()).toBeGreaterThanOrEqual(1);
    expect(result.outcome).toBe("created");
  });

  it("10. PASS_WITH_LOWER_CONFIDENCE applies the lowered confidence", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([
        (a, b) => classAResult(a, b, { confidence: 0.9 }),
      ]),
      objectivityReferee: bindReferee({
        outcome: "PASS_WITH_LOWER_CONFIDENCE",
        rationale: "Lowered by fixture referee.",
        adjustedConfidence: 0.7,
      }),
    });
    expect(result.outcome).toBe("created");
    expect(result.effectiveConfidence).toBe(0.7);
    expect(result.recommendedStorageConfidence).toBe("medium");
  });

  it("11. lowered confidence below candidate floor produces no write", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([
        (a, b) => classAResult(a, b, { confidence: 0.7 }),
      ]),
      objectivityReferee: bindReferee({
        outcome: "PASS_WITH_LOWER_CONFIDENCE",
        rationale: "Below floor.",
        adjustedConfidence: 0.4,
      }),
    });
    expect(result.outcome).toBe("no_candidate");
    expect(result.failureCode).toBe("below_candidate_floor");
    expect(result.writerInvoked).toBe(false);
  });

  it("12. ROUTE_TO_DIFFERENT_OBJECT_TYPE produces no contradiction write", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({
        outcome: "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
        rationale: "Route away.",
        routedObjectType: "TensionNode",
      }),
    });
    expect(result.outcome).toBe("routed_elsewhere");
    expect(result.writerInvoked).toBe(false);
  });

  it("13. REQUEST_MORE_EVIDENCE produces no write", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({
        outcome: "REQUEST_MORE_EVIDENCE",
        rationale: "Need more.",
      }),
    });
    expect(result.outcome).toBe("more_evidence_required");
    expect(result.writerInvoked).toBe(false);
  });

  it("14. ABSTAIN produces no write", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({
        outcome: "ABSTAIN",
        rationale: "Abstain fixture.",
      }),
    });
    expect(result.outcome).toBe("abstained");
    expect(result.writerInvoked).toBe(false);
  });

  it("15. invalid evidence offsets fail closed (CEQR-016)", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([
        (a, b) =>
          classAResult(a, b, {
            evidenceClaimA: {
              startOffset: 0,
              endOffset: a.sourceText.length + 40,
            },
          }),
      ]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "n/a" }),
    });
    expect(result.writerInvoked).toBe(false);
    expect(harness.nodes).toHaveLength(0);
  });

  it("16. resolver-versus-writer content divergence fails closed without plan egress", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    harness.mutateWriterMessageContent(
      MSG_A,
      "corrupted content without original quote",
    );
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    });
    expect(result.outcome).toBe("failed_safely");
    expect(result.failureCode).toBe("message_content_inconsistent");
    expect(result.writerInvoked).toBe(true);
    expect(harness.nodes).toHaveLength(0);
    expect(result).not.toHaveProperty("authorisedPlanForHarness");
    expect(result).not.toHaveProperty("executePersistence");
  });

  it("17. pure cross-session pool fails closed as cross_session", async () => {
    const harness = freshHarness();
    const { currentMessage } = harness.seedDefaultPersistedPair();
    const references = [
      harness.makeReference({
        id: "ref-cross-only",
        sourceSessionId: OTHER_SESSION,
        sourceMessageId: MSG_A,
        sourceMessage: {
          id: MSG_A,
          sessionId: OTHER_SESSION,
          userId: PROOF_USER,
          content: CONTENT_A,
        },
      }),
    ];
    const result = await runProof(harness, {
      currentMessage,
      references,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "n/a" }),
    });
    expect(result.failureCode).toBe("cross_session");
    expect(result.selection.sameSessionCount).toBe(0);
  });

  it("17b. mixed pool with cross-session + same-session non-match returns no_candidate", async () => {
    const harness = freshHarness();
    const { currentMessage } = harness.seedDefaultPersistedPair();
    const references = [
      harness.makeReference({
        id: "ref-cross",
        sourceSessionId: OTHER_SESSION,
        sourceMessageId: MSG_A,
        sourceMessage: {
          id: MSG_A,
          sessionId: OTHER_SESSION,
          userId: PROOF_USER,
          content: CONTENT_A,
        },
      }),
      harness.makeReference({
        id: "ref-same",
        type: "goal",
        sourceSessionId: SESSION,
        sourceMessageId: MSG_A,
        sourceMessage: {
          id: MSG_A,
          sessionId: SESSION,
          userId: PROOF_USER,
          content: CONTENT_A,
        },
      }),
    ];
    const result = await runProof(harness, {
      currentMessage,
      references,
      modelRunner: sequenceRunner([compatibleResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "n/a" }),
    });
    expect(result.outcome).toBe("no_candidate");
    expect(result.failureCode).not.toBe("cross_session");
    expect(result.selection.sameSessionCount).toBeGreaterThan(0);
  });

  it("18. more than one eligible pair fails closed", async () => {
    const harness = freshHarness();
    const { currentMessage } = harness.seedDefaultPersistedPair();
    const references = [
      harness.makeReference({
        id: "r1",
        type: "goal",
        sourceSessionId: SESSION,
        sourceMessageId: MSG_A,
        sourceMessage: {
          id: MSG_A,
          sessionId: SESSION,
          userId: PROOF_USER,
          content: CONTENT_A,
        },
      }),
      harness.makeReference({
        id: "r2",
        type: "constraint",
        sourceSessionId: SESSION,
        sourceMessageId: MSG_A,
        sourceMessage: {
          id: MSG_A,
          sessionId: SESSION,
          userId: PROOF_USER,
          content: CONTENT_A,
        },
      }),
    ];
    const result = await runProof(harness, {
      currentMessage,
      references,
      modelRunner: sequenceRunner([classAResult, classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    });
    expect(result.failureCode).toBe("ambiguous_multiple_matches");
  });

  it("19. same ordered duplicate reuses the existing node", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const deps = {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    };
    const first = await runProof(harness, deps);
    const second = await runProof(harness, deps);
    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("reused");
    expect(second.gateStoppedAt).toBeNull();
    expect(second.writeExecuted).toBe(false);
    expect(harness.nodes).toHaveLength(1);
  });

  it("20. reversed ordered pair remains a different ordered identity", async () => {
    const harness = freshHarness();
    // Seed both messages; first run uses A=goal(CONTENT_A), B=current(CONTENT_B)
    const firstSeed = harness.seedDefaultPersistedPair();
    const first = await runProof(harness, {
      ...firstSeed,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    });
    expect(first.outcome).toBe("created");

    // Reverse: current message is MSG_A / CONTENT_A; reference points at MSG_B.
    const reversedCurrent: CurrentMessageSource = {
      sourceId: `message:${MSG_A}`,
      sessionId: SESSION,
      messageId: MSG_A,
      role: "user",
      sourceText: CONTENT_A,
      label: "side_b_current_message",
    };
    const reversedRefs = [
      harness.makeReference({
        id: "ref-rev",
        type: "goal",
        sourceSessionId: SESSION,
        sourceMessageId: MSG_B,
        sourceMessage: {
          id: MSG_B,
          sessionId: SESSION,
          userId: PROOF_USER,
          content: CONTENT_B,
        },
        statement: QUOTE_B,
      }),
    ];
    const second = await runProof(harness, {
      currentMessage: reversedCurrent,
      references: reversedRefs,
      modelRunner: sequenceRunner([
        (a, b) =>
          classAResult(a, b, {
            evidenceClaimA: claimForSubstring(a, QUOTE_B)!,
            evidenceClaimB: claimForSubstring(b, QUOTE_A)!,
          }),
      ]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    });
    expect(second.outcome).toBe("created");
    expect(second.contradictionNodeId).not.toBe(first.contradictionNodeId);
    expect(harness.nodes).toHaveLength(2);
  });

  it("21. transaction failure rolls back every write", async () => {
    const harness = freshHarness({ failTransactionAfterSpans: true });
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    });
    expect(result.outcome).toBe("failed_safely");
    expect(result.writeExecuted).toBe(false);
    expect(harness.nodes).toHaveLength(0);
    expect(harness.spans).toHaveLength(0);
  });

  it("22. concurrent duplicate race resolves to one existing candidate", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const deps = {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    };
    const [a, b] = await Promise.all([
      runProof(harness, deps),
      runProof(harness, deps),
    ]);
    expect([a.outcome, b.outcome].sort()).toEqual(["created", "reused"].sort());
    expect(new Set([a.contradictionNodeId, b.contradictionNodeId]).size).toBe(1);
    expect(harness.nodes).toHaveLength(1);
  });

  it("23. orchestration result has no plan capability; forged lookalikes fail writer", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    });
    expect(result.outcome).toBe("created");
    expect(Object.keys(result)).not.toContain("authorisedPlanForHarness");
    expect(Object.keys(result)).not.toContain("executePersistence");
    expect(Object.keys(result)).not.toContain("plan");

    const forged = {
      persistenceContractVersion: "contradiction-persistence-plan-v1",
      persistenceAuthorised: true,
      writeExecuted: false,
      userId: PROOF_USER,
      sharedSessionId: SESSION,
    };
    expect(assertAuthorisedContradictionPersistencePlan(forged).ok).toBe(false);
    expect(assertAuthorisedContradictionPersistencePlan(
      JSON.parse(JSON.stringify(forged)),
    ).ok).toBe(false);
    const persistForged = await persistRepairedContradictionCandidate({
      plan: forged,
      db: harness.db,
    });
    expect(persistForged.ok).toBe(false);

    const src = readFileSync(
      join(process.cwd(), "lib/contradiction-controlled-natural-entry-proof.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/executePersistence/);
    expect(src).not.toMatch(/authorisedPlanForHarness/);
  });

  it("24. no writer invocation occurs before all gates pass", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([compatibleResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "n/a" }),
    });
    expect(result.writerInvoked).toBe(false);
    expect(harness.writerInvokeCount()).toBe(0);
    expect(harness.db.$transaction).not.toHaveBeenCalled();
  });

  it("25. adjudicator and referee are invoked as separate dependencies", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const runner = sequenceRunner([classAResult]);
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "Separate fixture referee — not live AI.",
    });
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: runner,
      objectivityReferee: referee,
    });
    expect(result.adjudicatorCallCount).toBeGreaterThanOrEqual(1);
    expect(result.refereeCallCount).toBeGreaterThanOrEqual(1);
    expect(runner.callCount()).toBe(result.adjudicatorCallCount);
    expect(referee.callCount()).toBe(result.refereeCallCount);
  });

  it("26. test-created records do not survive cleanup", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
    });
    expect(harness.snapshotCounts().nodes).toBe(1);
    harness.cleanup();
    expect(harness.snapshotCounts()).toEqual({
      sessions: 0,
      messages: 0,
      spans: 0,
      nodes: 0,
    });
  });

  it("27. presentation failure after create keeps created outcome", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const throwingReader = {
      findSpansByIds: async () => {
        throw new Error("presentation boom");
      },
      findMessagesByIds: async () => [],
      findSessionsByIds: async () => [],
    };
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
      presentationReader: throwingReader,
    });
    expect(result.outcome).toBe("created");
    expect(result.gateStoppedAt).toBeNull();
    expect(result.failureCode).toBeNull();
    expect(result.writeExecuted).toBe(true);
    expect(result.contradictionNodeOutcome).toBe("created");
    expect(result.dualSourcePresentation).toBeNull();
    expect(result.presentationStatus).toBe("failed");
    expect(result.presentationFailureCode).toBe("presentation_resolution_failed");
    expect(harness.nodes).toHaveLength(1);
  });

  it("28. message-resolver exception before persistence fails safely", async () => {
    const harness = freshHarness();
    const seeded = harness.seedDefaultPersistedPair();
    const result = await runProof(harness, {
      ...seeded,
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({ outcome: "PASS", rationale: "fixture" }),
      messageResolver: {
        async resolveMessages() {
          throw new Error("resolver exploded");
        },
      },
    });
    expect(result.outcome).toBe("failed_safely");
    expect(result.failureCode).toBe("message_resolver_failed");
    expect(result.writerInvoked).toBe(false);
    expect(harness.nodes).toHaveLength(0);
  });

  it("boundary: no KernelSourceUnit public input; no plan egress; no live deps", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/contradiction-controlled-natural-entry-proof.ts"),
      "utf8",
    );
    expect(src).toContain("currentMessage: CurrentMessageSource");
    expect(src).toContain("references: SameSessionReferenceRow[]");
    expect(src).not.toMatch(/sideB:\s*KernelSourceUnit/);
    expect(src).not.toMatch(/sideACandidates:\s*SideACandidate/);
    expect(src).not.toMatch(/executePersistence/);
    expect(src).not.toMatch(/authorisedPlanForHarness/);
    expect(src).not.toMatch(/prismadb/);
    expect(src).not.toMatch(/createAiSdkStructuredModelRunner/);
    expect(src).not.toContain(KAY_ACCOUNT);
  });
});
