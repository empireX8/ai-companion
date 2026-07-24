/**
 * CONTRADICTION-PRODUCTION-INGESTION-WIRING-001
 *
 * Fake providers + in-memory DB only. No live OpenAI. No real DB writes.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContradictionModelTransportResult } from "../contradiction-adjudicator";
import { KERNEL_FIRST_PROOF_OBJECT } from "../contradiction-adjudicator";
import type { ContradictionProductionDb } from "../contradiction-production-db-adapter";
import {
  PRODUCTION_MAX_ADJUDICATOR_CANDIDATES,
  PRODUCTION_MAX_TOTAL_PROVIDER_CALLS,
  RUN_PRODUCTION_CONTRADICTION_INGESTION_ENV,
  compactProductionIngestionLog,
  isProductionContradictionIngestionEnabled,
  runProductionContradictionIngestion,
} from "../contradiction-production-ingestion";
import type { ContradictionRepairedPersistenceDb } from "../contradiction-repaired-persistence";
import type {
  CurrentMessageSource,
  SameSessionReferenceRow,
} from "../contradiction-same-session-selection";
import {
  type KernelSourceUnit,
  type ObjectivityReferee,
  type StructuredModelRunner,
} from "../orvek-intelligence-kernel";
import {
  transportSelectionForSubstring,
} from "./helpers/ceqr020-transport-selection";

const USER = "prod-ingest-test-user";
const SESSION = "prod-ingest-session-1";
const MSG_A = "prod-ingest-message-a";
const MSG_B = "prod-ingest-message-b";
const QUOTE_A = "I never drink alcohol";
const QUOTE_B = "I drank last night";
const CONTENT_A = `${QUOTE_A} and other text`;
const CONTENT_B = `Preface. ${QUOTE_B}`;
const REF_A = "prod-ingest-ref-a";

const FIXED_NOW = () => new Date("2026-07-24T10:00:00.000Z");

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
    transportSelectionForSubstring(sideA.sourceText, QUOTE_A);
  const claimB =
    overrides.evidenceClaimB ??
    transportSelectionForSubstring(sideB.sourceText, QUOTE_B);

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
  } as ContradictionModelTransportResult;
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

function insufficientResult(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): ContradictionModelTransportResult {
  return classAResult(sideA, sideB, {
    classification: "insufficient_or_misaligned_context",
    confidence: 0.4,
    rationale: "Misaligned context; not a contradiction pair.",
    bothCanSimultaneouslyBeTrue: true,
  });
}

type ModelFactory = (
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
) => ContradictionModelTransportResult;

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

      return {
        ok: true as const,
        object: factory(parseSide("A"), parseSide("B")),
        providerId: "prod-ingest-fake-adjudicator",
        modelId: "prod-ingest-deterministic-fixture",
        rawText: null,
      };
    },
  };
}

function failingRunner(): StructuredModelRunner & { callCount: () => number } {
  let calls = 0;
  return {
    callCount: () => calls,
    async runStructured() {
      calls += 1;
      return {
        ok: false as const,
        errorCode: "model_execution_failed",
        message: "sk-test-should-never-appear-in-logs-abcdefg",
        providerId: "prod-ingest-fake-adjudicator",
        modelId: null,
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
};

type HarnessSpan = {
  id: string;
  userId: string;
  messageId: string;
  charStart: number;
  charEnd: number;
  contentHash: string;
};

type HarnessNode = {
  id: string;
  userId: string;
  sideASourceSpanId: string;
  sideBSourceSpanId: string;
  status: string;
};

function createInMemoryDb(args: {
  userId: string;
  sessionId: string;
  references: SameSessionReferenceRow[];
  messages: Map<string, HarnessMessage>;
}): {
  db: ContradictionProductionDb;
  writerInvokeCount: () => number;
  nodes: HarnessNode[];
  spans: HarnessSpan[];
} {
  const spans: HarnessSpan[] = [];
  const nodes: HarnessNode[] = [];
  let writerInvokes = 0;
  let spanSeq = 0;
  let nodeSeq = 0;

  const tx: ContradictionRepairedPersistenceDb = {
    message: {
      async findUnique({ where }) {
        const row = args.messages.get(where.id);
        if (!row) return null;
        return {
          id: row.id,
          userId: row.userId,
          sessionId: row.sessionId,
          content: row.content,
        };
      },
    },
    evidenceSpan: {
      async findUnique({ where }) {
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
      async create({ data, select: _select }) {
        void _select;
        const id = `span-${++spanSeq}`;
        const row: HarnessSpan = {
          id,
          userId: data.userId,
          messageId: data.messageId,
          charStart: data.charStart,
          charEnd: data.charEnd,
          contentHash: data.contentHash,
        };
        spans.push(row);
        return { id };
      },
    },
    contradictionNode: {
      async findFirst({ where }) {
        return (
          nodes.find(
            (n) =>
              n.userId === where.userId &&
              n.sideASourceSpanId === where.sideASourceSpanId &&
              n.sideBSourceSpanId === where.sideBSourceSpanId,
          ) ?? null
        );
      },
      async create({ data, select: _select }) {
        void _select;
        const id = `node-${++nodeSeq}`;
        const row: HarnessNode = {
          id,
          userId: String(data.userId),
          sideASourceSpanId: String(data.sideASourceSpanId),
          sideBSourceSpanId: String(data.sideBSourceSpanId),
          status: String(data.status),
        };
        nodes.push(row);
        return { id };
      },
    },
    async $transaction(fn) {
      writerInvokes += 1;
      return fn(tx);
    },
  };

  const db: ContradictionProductionDb = {
    async loadSameSessionReferences() {
      return args.references;
    },
    messageResolver: {
      async resolveMessages({ sideAMessageId, sideBMessageId }) {
        const sideA = args.messages.get(sideAMessageId);
        const sideB = args.messages.get(sideBMessageId);
        return {
          sideA: sideA
            ? {
                id: sideA.id,
                userId: sideA.userId,
                sessionId: sideA.sessionId,
                content: sideA.content,
              }
            : null,
          sideB: sideB
            ? {
                id: sideB.id,
                userId: sideB.userId,
                sessionId: sideB.sessionId,
                content: sideB.content,
              }
            : null,
        };
      },
    },
    persistenceDb: tx,
  };

  return {
    db,
    writerInvokeCount: () => writerInvokes,
    nodes,
    spans,
  };
}

function seedClearPair(): {
  currentMessage: CurrentMessageSource;
  references: SameSessionReferenceRow[];
  messages: Map<string, HarnessMessage>;
} {
  const messages = new Map<string, HarnessMessage>([
    [
      MSG_A,
      { id: MSG_A, userId: USER, sessionId: SESSION, content: CONTENT_A },
    ],
    [
      MSG_B,
      { id: MSG_B, userId: USER, sessionId: SESSION, content: CONTENT_B },
    ],
  ]);
  const currentMessage: CurrentMessageSource = {
    sourceId: `message:${MSG_B}`,
    sessionId: SESSION,
    messageId: MSG_B,
    role: "user",
    sourceText: CONTENT_B,
    label: "side_b_current_message",
  };
  const references: SameSessionReferenceRow[] = [
    {
      id: REF_A,
      type: "goal",
      statement: QUOTE_A,
      status: "active",
      confidence: "high",
      sourceSessionId: SESSION,
      sourceMessageId: MSG_A,
      sourceMessage: {
        id: MSG_A,
        sessionId: SESSION,
        userId: USER,
        content: CONTENT_A,
      },
    },
  ];
  return { currentMessage, references, messages };
}

const GATE_ON = { [RUN_PRODUCTION_CONTRADICTION_INGESTION_ENV]: "1" };
const GATE_OFF = {} as Record<string, string | undefined>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("production contradiction ingestion gate", () => {
  it("is off when env is missing", () => {
    expect(isProductionContradictionIngestionEnabled({})).toBe(false);
  });

  it("A. Gate missing: zero provider construction, calls, and writes", async () => {
    const seeded = seedClearPair();
    const { db, writerInvokeCount, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references: seeded.references,
      messages: seeded.messages,
    });
    const createProviders = vi.fn(async () => {
      throw new Error("must not construct providers when gated off");
    });
    const runner = sequenceRunner([classAResult]);
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "Clear contradiction.",
    });

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
        role: "user",
      },
      db,
      env: GATE_OFF,
      createProviders,
      providers: {
        modelRunner: runner,
        objectivityReferee: referee,
      },
      now: FIXED_NOW,
    });

    // Even if providers are supplied, gate-off must short-circuit before use.
    expect(result.gatedOff).toBe(true);
    expect(result.outcome).toBe("gated_off");
    expect(result.providerConstructionCount).toBe(0);
    expect(createProviders).not.toHaveBeenCalled();
    expect(runner.callCount()).toBe(0);
    expect(referee.callCount()).toBe(0);
    expect(result.adjudicatorCallCount).toBe(0);
    expect(result.refereeCallCount).toBe(0);
    expect(result.writerInvoked).toBe(false);
    expect(result.writeExecuted).toBe(false);
    expect(writerInvokeCount()).toBe(0);
    expect(nodes).toHaveLength(0);
  });

  it("A2. Gate missing with createProviders only: construction stays 0", async () => {
    const seeded = seedClearPair();
    const { db, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references: seeded.references,
      messages: seeded.messages,
    });
    const createProviders = vi.fn(async () => ({
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({
        outcome: "PASS",
        rationale: "unused",
      }),
    }));

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_OFF,
      createProviders,
      now: FIXED_NOW,
    });

    expect(result.providerConstructionCount).toBe(0);
    expect(createProviders).not.toHaveBeenCalled();
    expect(nodes).toHaveLength(0);
  });
});

describe("production contradiction ingestion pipeline", () => {
  it("B. Clear contradiction: one candidate, referee, writer, lineage, candidate", async () => {
    const seeded = seedClearPair();
    const { db, writerInvokeCount, nodes, spans } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references: seeded.references,
      messages: seeded.messages,
    });
    const runner = sequenceRunner([classAResult]);
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "Clear contradiction.",
    });

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_ON,
      providers: { modelRunner: runner, objectivityReferee: referee },
      now: FIXED_NOW,
    });

    expect(result.gatedOff).toBe(false);
    expect(result.outcome).toBe("created");
    expect(result.adjudicatorCallCount).toBe(1);
    expect(result.refereeCallCount).toBe(1);
    expect(result.totalProviderCalls).toBe(2);
    expect(result.writerInvoked).toBe(true);
    expect(result.writeExecuted).toBe(true);
    expect(writerInvokeCount()).toBe(1);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.status).toBe("candidate");
    expect(result.sideASourceSpanId).toBeTruthy();
    expect(result.sideBSourceSpanId).toBeTruthy();
    expect(spans).toHaveLength(2);
    expect(result.naturalEntry?.persistenceResult).toBeTruthy();
    // Authorised plan must never egress.
    expect(JSON.stringify(result)).not.toMatch(/persistenceAuthorisedPlan|WeakSet/);
  });

  it("C. Exact duplicate: second identical invocation reuses same node", async () => {
    const seeded = seedClearPair();
    const { db, writerInvokeCount, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references: seeded.references,
      messages: seeded.messages,
    });
    const makeProviders = () => ({
      modelRunner: sequenceRunner([classAResult]),
      objectivityReferee: bindReferee({
        outcome: "PASS",
        rationale: "Clear contradiction.",
      }),
    });

    const first = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_ON,
      providers: makeProviders(),
      now: FIXED_NOW,
    });
    const second = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_ON,
      providers: makeProviders(),
      now: FIXED_NOW,
    });

    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("reused");
    expect(second.contradictionNodeId).toBe(first.contradictionNodeId);
    expect(second.writeExecuted).toBe(false);
    expect(nodes).toHaveLength(1);
    expect(writerInvokeCount()).toBe(2);
  });

  it("D. Compatible state: no referee, no writer, no node", async () => {
    const seeded = seedClearPair();
    const { db, writerInvokeCount, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references: seeded.references,
      messages: seeded.messages,
    });
    const runner = sequenceRunner([compatibleResult]);
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "should not run",
    });

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_ON,
      providers: { modelRunner: runner, objectivityReferee: referee },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("no_candidate");
    expect(result.refereeCallCount).toBe(0);
    expect(referee.callCount()).toBe(0);
    expect(result.writerInvoked).toBe(false);
    expect(writerInvokeCount()).toBe(0);
    expect(nodes).toHaveLength(0);
  });

  it("E. insufficient_or_misaligned_context: no referee, no writer, no node", async () => {
    const seeded = seedClearPair();
    const { db, writerInvokeCount, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references: seeded.references,
      messages: seeded.messages,
    });
    const runner = sequenceRunner([insufficientResult]);
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "should not run",
    });

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_ON,
      providers: { modelRunner: runner, objectivityReferee: referee },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("no_candidate");
    expect(result.refereeCallCount).toBe(0);
    expect(result.writerInvoked).toBe(false);
    expect(writerInvokeCount()).toBe(0);
    expect(nodes).toHaveLength(0);
  });

  it("F. model/provider failure: sanitised failure, no writer, no node", async () => {
    const seeded = seedClearPair();
    const { db, writerInvokeCount, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references: seeded.references,
      messages: seeded.messages,
    });
    const runner = failingRunner();
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "should not run",
    });

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_ON,
      providers: { modelRunner: runner, objectivityReferee: referee },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("failed_safely");
    expect(result.failureCode).toBe("model_failed");
    expect(result.failureMessage).not.toMatch(/sk-/);
    expect(result.writerInvoked).toBe(false);
    expect(writerInvokeCount()).toBe(0);
    expect(nodes).toHaveLength(0);
    expect(JSON.stringify(compactProductionIngestionLog(result))).not.toMatch(
      /sk-/,
    );
  });

  it("G. multiple clear matches: ambiguity abstention, no writer, no node", async () => {
    const seeded = seedClearPair();
    const MSG_A2 = "prod-ingest-message-a2";
    const CONTENT_A2 = CONTENT_A;
    seeded.messages.set(MSG_A2, {
      id: MSG_A2,
      userId: USER,
      sessionId: SESSION,
      content: CONTENT_A2,
    });
    seeded.references.push({
      id: "prod-ingest-ref-a2",
      type: "constraint",
      statement: QUOTE_A,
      status: "active",
      confidence: "high",
      sourceSessionId: SESSION,
      sourceMessageId: MSG_A2,
      sourceMessage: {
        id: MSG_A2,
        sessionId: SESSION,
        userId: USER,
        content: CONTENT_A2,
      },
    });

    const { db, writerInvokeCount, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references: seeded.references,
      messages: seeded.messages,
    });
    const runner = sequenceRunner([classAResult, classAResult]);
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "should not run on ambiguity",
    });

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_ON,
      providers: { modelRunner: runner, objectivityReferee: referee },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("no_candidate");
    expect(result.failureCode).toBe("ambiguous_multiple_matches");
    expect(result.refereeCallCount).toBe(0);
    expect(referee.callCount()).toBe(0);
    expect(result.writerInvoked).toBe(false);
    expect(writerInvokeCount()).toBe(0);
    expect(nodes).toHaveLength(0);
  });

  it("mixed: one Class A + model_failed → model_failed, no referee, no writer", async () => {
    const seeded = seedClearPair();
    const MSG_A2 = "prod-mixed-model-fail-a2";
    seeded.messages.set(MSG_A2, {
      id: MSG_A2,
      userId: USER,
      sessionId: SESSION,
      content: CONTENT_A,
    });
    seeded.references.push({
      id: "prod-mixed-model-fail-ref-a2",
      type: "constraint",
      statement: QUOTE_A,
      status: "active",
      confidence: "medium",
      sourceSessionId: SESSION,
      sourceMessageId: MSG_A2,
      sourceMessage: {
        id: MSG_A2,
        sessionId: SESSION,
        userId: USER,
        content: CONTENT_A,
      },
    });

    const { db, writerInvokeCount, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references: seeded.references,
      messages: seeded.messages,
    });

    let calls = 0;
    const runner: StructuredModelRunner & { callCount: () => number } = {
      callCount: () => calls,
      async runStructured(request) {
        const idx = calls;
        calls += 1;
        if (idx === 0) {
          // First candidate: Class A via sequenceRunner-compatible path
          const seq = sequenceRunner([classAResult]);
          return seq.runStructured(request);
        }
        return {
          ok: false as const,
          errorCode: "model_execution_failed",
          message: "provider unavailable",
          providerId: "prod-ingest-fake-adjudicator",
          modelId: null,
        };
      },
    };
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "must not run when pool unresolved",
    });

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_ON,
      providers: { modelRunner: runner, objectivityReferee: referee },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("failed_safely");
    expect(result.failureCode).toBe("model_failed");
    expect(result.refereeCallCount).toBe(0);
    expect(referee.callCount()).toBe(0);
    expect(result.writerInvoked).toBe(false);
    expect(writerInvokeCount()).toBe(0);
    expect(nodes).toHaveLength(0);
  });

  it("mixed: one Class A + validation_failed → adjudication_failed, no referee, no writer", async () => {
    const seeded = seedClearPair();
    const MSG_A2 = "prod-mixed-validation-fail-a2";
    seeded.messages.set(MSG_A2, {
      id: MSG_A2,
      userId: USER,
      sessionId: SESSION,
      content: CONTENT_A,
    });
    seeded.references.push({
      id: "prod-mixed-validation-fail-ref-a2",
      type: "constraint",
      statement: QUOTE_A,
      status: "active",
      confidence: "medium",
      sourceSessionId: SESSION,
      sourceMessageId: MSG_A2,
      sourceMessage: {
        id: MSG_A2,
        sessionId: SESSION,
        userId: USER,
        content: CONTENT_A,
      },
    });

    const { db, writerInvokeCount, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references: seeded.references,
      messages: seeded.messages,
    });

    // Second result: clear_contradiction flags that fail deterministic validation
    // (compatibility flags true with clear_contradiction).
    const invalidClassA = (
      sideA: KernelSourceUnit,
      sideB: KernelSourceUnit,
    ): ContradictionModelTransportResult =>
      classAResult(sideA, sideB, {
        bothCanSimultaneouslyBeTrue: true,
      });

    const runner = sequenceRunner([classAResult, invalidClassA]);
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "must not run when pool unresolved",
    });

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_ON,
      providers: { modelRunner: runner, objectivityReferee: referee },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("failed_safely");
    expect(result.failureCode).toBe("adjudication_failed");
    expect(result.refereeCallCount).toBe(0);
    expect(referee.callCount()).toBe(0);
    expect(result.writerInvoked).toBe(false);
    expect(writerInvokeCount()).toBe(0);
    expect(nodes).toHaveLength(0);
  });

  it("mixed: one Class A + definitive non-Class-A only → sole referee may run", async () => {
    const seeded = seedClearPair();
    const MSG_A2 = "prod-mixed-compatible-a2";
    seeded.messages.set(MSG_A2, {
      id: MSG_A2,
      userId: USER,
      sessionId: SESSION,
      content: CONTENT_A,
    });
    seeded.references.push({
      id: "prod-mixed-compatible-ref-a2",
      type: "constraint",
      statement: QUOTE_A,
      status: "active",
      confidence: "medium",
      sourceSessionId: SESSION,
      sourceMessageId: MSG_A2,
      sourceMessage: {
        id: MSG_A2,
        sessionId: SESSION,
        userId: USER,
        content: CONTENT_A,
      },
    });

    const { db, writerInvokeCount, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references: seeded.references,
      messages: seeded.messages,
    });
    const runner = sequenceRunner([classAResult, compatibleResult]);
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "sole winner among definitive pool",
    });

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_ON,
      providers: { modelRunner: runner, objectivityReferee: referee },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("created");
    expect(result.refereeCallCount).toBe(1);
    expect(referee.callCount()).toBe(1);
    expect(result.writerInvoked).toBe(true);
    expect(writerInvokeCount()).toBe(1);
    expect(nodes).toHaveLength(1);
  });

  it("mixed: Class A + beyond-cap candidates are not treated as adjudication failures", async () => {
    const seeded = seedClearPair();
    const references: SameSessionReferenceRow[] = [...seeded.references];
    for (let i = 0; i < 4; i += 1) {
      const msgId = `prod-mixed-cap-msg-${i}`;
      seeded.messages.set(msgId, {
        id: msgId,
        userId: USER,
        sessionId: SESSION,
        content: CONTENT_A,
      });
      references.push({
        id: `prod-mixed-cap-ref-${i}`,
        type: "constraint",
        statement: QUOTE_A,
        status: "active",
        confidence: "low",
        sourceSessionId: SESSION,
        sourceMessageId: msgId,
        sourceMessage: {
          id: msgId,
          sessionId: SESSION,
          userId: USER,
          content: CONTENT_A,
        },
      });
    }

    const { db, writerInvokeCount, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references,
      messages: seeded.messages,
    });

    // Cap is 3: Class A then two compatible. Beyond-cap refs never adjudicated.
    const runner = sequenceRunner([
      classAResult,
      compatibleResult,
      compatibleResult,
    ]);
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "cap exclusions are not failures",
    });

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_ON,
      providers: { modelRunner: runner, objectivityReferee: referee },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("created");
    expect(result.adjudicatorCallCount).toBe(3);
    expect(result.refereeCallCount).toBe(1);
    expect(result.writerInvoked).toBe(true);
    expect(writerInvokeCount()).toBe(1);
    expect(nodes).toHaveLength(1);
    expect(
      result.naturalEntry?.selection.rejectionSummaries.some(
        (s) => s.reason === "beyond_adjudicator_candidate_cap",
      ),
    ).toBe(true);
  });

  it("H. candidate cap: ≤3 adjudicator calls and ≤4 total provider calls", async () => {
    const seeded = seedClearPair();
    const references: SameSessionReferenceRow[] = [];
    for (let i = 0; i < 8; i += 1) {
      const msgId = `prod-cap-msg-a-${i}`;
      const content = `${QUOTE_A} variant ${i}`;
      seeded.messages.set(msgId, {
        id: msgId,
        userId: USER,
        sessionId: SESSION,
        content,
      });
      references.push({
        id: `prod-cap-ref-${i}`,
        type: i % 2 === 0 ? "goal" : "constraint",
        statement: content,
        status: "active",
        confidence: "high",
        sourceSessionId: SESSION,
        sourceMessageId: msgId,
        sourceMessage: {
          id: msgId,
          sessionId: SESSION,
          userId: USER,
          content,
        },
      });
    }

    const { db, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references,
      messages: seeded.messages,
    });

    // All non-Class-A so we exercise the full capped pool without early ambiguity.
    const runner = sequenceRunner([
      compatibleResult,
      compatibleResult,
      compatibleResult,
      compatibleResult,
      compatibleResult,
    ]);
    const referee = bindReferee({
      outcome: "PASS",
      rationale: "unused",
    });

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: GATE_ON,
      providers: { modelRunner: runner, objectivityReferee: referee },
      now: FIXED_NOW,
    });

    expect(result.adjudicatorCallCount).toBeLessThanOrEqual(
      PRODUCTION_MAX_ADJUDICATOR_CANDIDATES,
    );
    expect(result.adjudicatorCallCount).toBe(3);
    expect(result.totalProviderCalls).toBeLessThanOrEqual(
      PRODUCTION_MAX_TOTAL_PROVIDER_CALLS,
    );
    expect(result.refereeCallCount).toBe(0);
    expect(nodes).toHaveLength(0);
    expect(
      result.naturalEntry?.selection.rejectionSummaries.some(
        (s) => s.reason === "beyond_adjudicator_candidate_cap",
      ),
    ).toBe(true);
  });

  it("missing credential with gate on: fail closed, zero writes", async () => {
    const seeded = seedClearPair();
    const { db, nodes } = createInMemoryDb({
      userId: USER,
      sessionId: SESSION,
      references: seeded.references,
      messages: seeded.messages,
    });

    const result = await runProductionContradictionIngestion({
      userId: USER,
      session: { id: SESSION },
      currentMessage: {
        id: seeded.currentMessage.messageId,
        content: seeded.currentMessage.sourceText,
      },
      db,
      env: {
        ...GATE_ON,
        OPENAI_API_KEY: "",
      },
      now: FIXED_NOW,
    });

    expect(result.outcome).toBe("failed_safely");
    expect(result.failureCode).toBe("missing_credential");
    expect(result.writerInvoked).toBe(false);
    expect(nodes).toHaveLength(0);
    expect(result.providerConstructionCount).toBe(1);
  });
});

describe("production contradiction ingestion route contract", () => {
  it("I. legacy detect/materialize path removed; production ingestion wired", () => {
    const route = readFileSync(
      join(process.cwd(), "app/api/message/route.ts"),
      "utf8",
    );
    expect(route).not.toMatch(/detectContradictions/);
    expect(route).not.toMatch(/materializeContradictions/);
    expect(route).not.toMatch(/contradiction-detection/);
    expect(route).not.toMatch(/contradiction-materialization/);
    expect(route).toMatch(/runProductionContradictionIngestion/);
    expect(route).toMatch(/createPrismaContradictionProductionAdapter/);
    expect(route).toMatch(/MESSAGE_CONTRADICTION_INGESTION/);
    // Separate after() registration from memory/audit/profile/pattern work.
    expect(route).toMatch(/Contradiction production ingestion \(separate after/);
    expect(route).not.toMatch(/runControlledContradictionNaturalEntryProof/);
    expect(route).not.toMatch(/contradiction-controlled-natural-entry-proof/);
    // Must not import adjudicator/kernel directly.
    expect(route).not.toMatch(/contradiction-adjudicator/);
    expect(route).not.toMatch(/orvek-intelligence-kernel/);
    expect(route).not.toMatch(/adjudicateContradiction/);
  });

  it("controlled proof remains a thin wrapper over natural entry", () => {
    const proof = readFileSync(
      join(process.cwd(), "lib/contradiction-controlled-natural-entry-proof.ts"),
      "utf8",
    );
    expect(proof).toMatch(/runContradictionNaturalEntry/);
    expect(proof).toMatch(/runControlledContradictionNaturalEntryProof/);
  });

  it("compact log never includes raw secrets or plan capability", () => {
    const log = compactProductionIngestionLog({
      version: "contradiction-production-ingestion-v1",
      gatedOff: false,
      outcome: "failed_safely",
      failureCode: "model_failed",
      failureMessage: "sanitised",
      providerConstructionCount: 0,
      adjudicatorCallCount: 1,
      refereeCallCount: 0,
      totalProviderCalls: 1,
      writerInvoked: false,
      writeExecuted: false,
      contradictionNodeId: null,
      sideASourceSpanId: null,
      sideBSourceSpanId: null,
      contradictionNodeOutcome: null,
      selectedCandidateCount: 0,
      naturalEntry: null,
    });
    expect(log).not.toHaveProperty("failureMessage");
    expect(JSON.stringify(log)).not.toMatch(/WeakSet|authorisedPlan|sk-/);
    void sha; // keep helper available for future hash assertions
  });
});
