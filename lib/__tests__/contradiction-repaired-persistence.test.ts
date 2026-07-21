/**
 * CONTRADICTION-PERSISTENCE-WIRING-001 — repaired transactional writer tests.
 * Injected fakes only. No prismadb. No live account writes.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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

function makeFakeDb(options?: {
  existingSpans?: ContradictionRepairedSpanRow[];
  failSideBCreate?: boolean;
  failNodeCreate?: boolean;
  nodeCreateReturnsEmptyId?: boolean;
  forceSameSpanId?: boolean;
  messageOverrides?: Record<
    string,
    Partial<{ userId: string; sessionId: string; content: string }>
  >;
  omitMessageIds?: string[];
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
  const nodes: Array<Record<string, unknown>> = [];
  let spanSeq = spans.length;
  let nodeSeq = 0;

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
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (options?.failNodeCreate) {
          throw new Error("simulated node create failure");
        }
        if (options?.nodeCreateReturnsEmptyId) {
          return { id: "" };
        }
        const id = `node-${++nodeSeq}`;
        nodes.push({ id, ...data });
        return { id };
      }),
    },
  };

  const rolledBack = { value: false };
  const db: ContradictionRepairedPersistenceDb = {
    ...tx,
    $transaction: vi.fn(async (callback) => {
      const snapshotSpans = spans.map((s) => ({ ...s }));
      const snapshotNodes = nodes.map((n) => ({ ...n }));
      try {
        return await callback(tx);
      } catch (error) {
        spans.splice(0, spans.length, ...snapshotSpans);
        nodes.splice(0, nodes.length, ...snapshotNodes);
        rolledBack.value = true;
        throw error;
      }
    }),
  };

  return { db, spans, nodes, rolledBack, tx };
}

describe("CONTRADICTION-PERSISTENCE-WIRING-001 repaired persistence writer", () => {
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
      expect(result.contradictionDeduplicationProven).toBe(false);
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
      const { readdirSync, readFileSync: readFs, statSync } =
        require("node:fs") as typeof import("node:fs");
      const { join: pathJoin } = require("node:path") as typeof import("node:path");
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
          const full = pathJoin(dir, entry);
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
            const text = readFs(full, "utf8");
            if (needle.test(text)) hits.push(full);
          }
        }
      }

      for (const root of roots) walk(pathJoin(process.cwd(), root));
      expect(hits).toEqual([]);
    });
  });
});
