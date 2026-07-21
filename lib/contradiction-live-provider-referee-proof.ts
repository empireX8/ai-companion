/**
 * CEQR-011 — controlled live provider + Objectivity Referee proof.
 *
 * Explicitly invoked only. Composes CEQR-010
 * `runControlledContradictionNaturalEntryProof` with real provider adapters
 * and an injected in-memory transaction harness.
 *
 * Does NOT wire POST /api/message, import, or the real Kay account DB.
 */

import {
  runControlledContradictionNaturalEntryProof,
  type ControlledNaturalEntryProofInput,
  type ControlledNaturalEntryProofResult,
} from "./contradiction-controlled-natural-entry-proof";
import type { DualSourcePresentationReader } from "./contradiction-dual-source-presentation";
import type {
  ContradictionRepairedPersistenceDb,
  ContradictionRepairedSpanRow,
} from "./contradiction-repaired-persistence";
import type {
  CurrentMessageSource,
  SameSessionReferenceRow,
} from "./contradiction-same-session-selection";
import {
  CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
  createOpenAiContradictionLiveAdapters,
  isLiveContradictionProviderProofOptedIn,
  redactSecretsForReceipt,
  resolveContradictionLiveProviderConfig,
  type ContradictionLiveIndependenceLevel,
  type ContradictionLiveAdapterBundle,
} from "./contradiction-live-provider-adapters";
import type { ObjectivityReferee } from "./orvek-intelligence-kernel/objectivity-referee";
import type { StructuredModelRunner } from "./orvek-intelligence-kernel/model-runner";

export const CONTRADICTION_LIVE_PROVIDER_REFEREE_PROOF_VERSION =
  "contradiction-live-provider-referee-proof-v1" as const;

export const LIVE_PROOF_USER_ID =
  "ceqr011-live-provider-proof-user-isolated" as const;

export type LiveSyntheticCaseId =
  | "clear_contradiction_candidate"
  | "compatible_contextual"
  | "ambiguous_insufficient";

export type LiveSyntheticCase = {
  id: LiveSyntheticCaseId;
  sideAText: string;
  sideBText: string;
  referenceStatement: string;
};

export const LIVE_SYNTHETIC_CASES: readonly LiveSyntheticCase[] = [
  {
    id: "clear_contradiction_candidate",
    sideAText: "I do not drink alcohol at all.",
    sideBText: "I drank several beers last night.",
    referenceStatement: "I do not drink alcohol at all.",
  },
  {
    id: "compatible_contextual",
    sideAText: "I avoid coffee in the evening.",
    sideBText: "I drink coffee in the morning.",
    referenceStatement: "I avoid coffee in the evening.",
  },
  {
    id: "ambiguous_insufficient",
    sideAText: "I might go running later if I feel up to it.",
    sideBText: "Sometimes I think about exercise.",
    referenceStatement: "I might go running later if I feel up to it.",
  },
] as const;

export type LiveCaseExecutionStatus =
  | "created"
  | "reused"
  | "no_write"
  | "failed_safely"
  | "skipped_budget"
  | "provider_failed";

export type LiveCaseReceipt = {
  caseId: LiveSyntheticCaseId;
  status: LiveCaseExecutionStatus;
  proofOutcome: ControlledNaturalEntryProofResult["outcome"] | null;
  writeExecuted: boolean;
  writerInvoked: boolean;
  adjudicatorCallCount: number;
  refereeCallCount: number;
  contradictionNodeId: string | null;
  sideAQuote: string | null;
  sideBQuote: string | null;
  presentationStatus: ControlledNaturalEntryProofResult["presentationStatus"] | null;
  failureCode: string | null;
  failureMessage: string | null;
  latencyMs: number | null;
  harnessNodeCountAfter: number;
  harnessSpanCountAfter: number;
};

export type LiveProofSkipped = {
  ran: false;
  reason:
    | "opt_in_missing"
    | "credentials_unavailable"
    | "invalid_config";
  message: string;
  optInEnv: typeof CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV;
};

export type LiveProofExecuted = {
  ran: true;
  proofVersion: typeof CONTRADICTION_LIVE_PROVIDER_REFEREE_PROOF_VERSION;
  providerId: string;
  adjudicatorModelId: string;
  refereeModelId: string;
  independenceLevel: ContradictionLiveIndependenceLevel;
  /** Always 0 — retries disabled so call counts are exact provider attempts. */
  maxRetries: 0;
  /** Native AI SDK timeout applied to both roles (milliseconds). */
  timeoutMs: number;
  /** True because maxRetries is 0. */
  providerAttemptCountExact: true;
  /** Exact provider-attempt counts (retries disabled). */
  adjudicatorCallCount: number;
  refereeCallCount: number;
  totalCallCount: number;
  maxTotalCalls: number;
  cases: LiveCaseReceipt[];
  clearContradictionWriteProven: boolean;
  compatibleCaseNoWrite: boolean;
  /** Optional ambiguity case — recorded honestly; not required for PASS. */
  ambiguousCaseNoWrite: boolean | null;
  unsafeMutationDetected: boolean;
  evidenceOutputMutated: false;
  realAccountMutated: false;
  productionIngestionWired: false;
  isolatedDatabasePersistenceProven: false;
  productionReady: false;
  classificationHint:
    | "PASS_LIVE_PROVIDER_REFEREE_EXECUTION_PROVEN"
    | "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED"
    | "FAIL_UNSAFE_TO_PROCEED";
};

export type LiveProofResult = LiveProofSkipped | LiveProofExecuted;

export type LiveInMemoryHarness = {
  userId: string;
  sessionId: string;
  nodes: Array<{
    id: string;
    userId: string;
    sideA: string;
    sideB: string;
    sideASourceSpanId: string;
    sideBSourceSpanId: string;
  }>;
  spans: ContradictionRepairedSpanRow[];
  db: ContradictionRepairedPersistenceDb;
  messageResolver: ControlledNaturalEntryProofInput["messageResolver"];
  presentationReader: DualSourcePresentationReader;
  seedCase: (synthetic: LiveSyntheticCase) => {
    currentMessage: CurrentMessageSource;
    references: SameSessionReferenceRow[];
  };
  snapshot: () => { nodes: number; spans: number; messages: number };
};

/**
 * Injected in-memory transactional persistence boundary (test/live-proof only).
 * Always uses the fixed synthetic `LIVE_PROOF_USER_ID`. Never accepts a
 * caller-controlled userId (no real-account identifier path).
 */
export function createLiveProofInMemoryHarness(args?: {
  sessionId?: string;
}): LiveInMemoryHarness {
  const userId = LIVE_PROOF_USER_ID;
  const sessionId = args?.sessionId ?? "ceqr011-live-session";
  const messages = new Map<
    string,
    { id: string; userId: string; sessionId: string; content: string; createdAt: Date }
  >();
  const sessions = new Map<
    string,
    { id: string; userId: string; origin: "APP"; label: string | null }
  >();
  const spans: ContradictionRepairedSpanRow[] = [];
  const nodes: LiveInMemoryHarness["nodes"] = [];
  let spanSeq = 0;
  let nodeSeq = 0;
  let nodeCreateChain: Promise<void> = Promise.resolve();

  sessions.set(sessionId, {
    id: sessionId,
    userId,
    origin: "APP",
    label: "CEQR-011 live proof session",
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
      findUnique: async ({ where }: { where: { id: string } }) => {
        const m = messages.get(where.id);
        if (!m) return null;
        return {
          id: m.id,
          userId: m.userId,
          sessionId: m.sessionId,
          content: m.content,
        };
      },
    },
    evidenceSpan: {
      findUnique: async ({
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
      create: async ({
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
          throwP2002("Unique constraint failed on EvidenceSpan");
        }
        const row: ContradictionRepairedSpanRow = {
          id: `live-span-${++spanSeq}`,
          userId: data.userId,
          messageId: data.messageId,
          charStart: data.charStart,
          charEnd: data.charEnd,
          contentHash: data.contentHash,
        };
        spans.push(row);
        return { id: row.id };
      },
    },
    contradictionNode: {
      findFirst: async ({
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
      create: async ({
        data,
      }: {
        data: Record<string, unknown>;
        select: { id: true };
      }) => {
        const run = async () => {
          const existing = findExactNode({
            userId: String(data.userId),
            sideASourceSpanId: String(data.sideASourceSpanId),
            sideBSourceSpanId: String(data.sideBSourceSpanId),
          });
          if (existing) {
            throwP2002("Unique constraint failed on ContradictionNode");
          }
          const id = `live-node-${++nodeSeq}`;
          nodes.push({
            id,
            userId: String(data.userId),
            sideA: String(data.sideA),
            sideB: String(data.sideB),
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
    },
  };

  const db: ContradictionRepairedPersistenceDb = {
    ...tx,
    $transaction: async (callback) => {
      const ownedSpanIds = new Set<string>();
      const ownedNodeIds = new Set<string>();
      const trackingTx = {
        ...tx,
        evidenceSpan: {
          ...tx.evidenceSpan,
          create: async (createArgs: {
            data: {
              userId: string;
              messageId: string;
              charStart: number;
              charEnd: number;
              contentHash: string;
            };
            select: { id: true };
          }) => {
            const created = await tx.evidenceSpan.create(createArgs);
            ownedSpanIds.add(created.id);
            return created;
          },
        },
        contradictionNode: {
          ...tx.contradictionNode,
          create: async (createArgs: {
            data: Record<string, unknown>;
            select: { id: true };
          }) => {
            const created = await tx.contradictionNode.create(createArgs);
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
    },
  };

  const harness: LiveInMemoryHarness = {
    userId,
    sessionId,
    nodes,
    spans,
    db,
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
            createdAt: new Date("2026-07-21T20:00:00.000Z"),
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
    seedCase(synthetic) {
      const msgA = `live-msg-a-${synthetic.id}`;
      const msgB = `live-msg-b-${synthetic.id}`;
      const refId = `live-ref-${synthetic.id}`;

      messages.set(msgA, {
        id: msgA,
        userId,
        sessionId,
        content: synthetic.sideAText,
        createdAt: new Date("2026-07-21T19:00:00.000Z"),
      });
      messages.set(msgB, {
        id: msgB,
        userId,
        sessionId,
        content: synthetic.sideBText,
        createdAt: new Date("2026-07-21T19:05:00.000Z"),
      });

      const currentMessage: CurrentMessageSource = {
        sourceId: `message:${msgB}`,
        sessionId,
        messageId: msgB,
        role: "user",
        sourceText: synthetic.sideBText,
        label: "side_b_current_message",
      };

      const references: SameSessionReferenceRow[] = [
        {
          id: refId,
          type: "goal",
          statement: synthetic.referenceStatement,
          status: "active",
          confidence: "high",
          sourceSessionId: sessionId,
          sourceMessageId: msgA,
          sourceMessage: {
            id: msgA,
            sessionId,
            userId,
            content: synthetic.sideAText,
          },
        },
      ];

      return { currentMessage, references };
    },
    snapshot() {
      return {
        nodes: nodes.length,
        spans: spans.length,
        messages: messages.size,
      };
    },
  };

  return harness;
}

function mapCaseStatus(
  result: ControlledNaturalEntryProofResult,
): LiveCaseExecutionStatus {
  if (result.outcome === "created" || result.outcome === "reused") {
    return result.outcome;
  }
  if (
    result.failureCode === "model_failed" ||
    result.selection.outcome === "model_failed"
  ) {
    return "provider_failed";
  }
  if (result.writeExecuted) {
    return "created";
  }
  if (result.outcome === "failed_safely") {
    return "failed_safely";
  }
  return "no_write";
}

const EXPECTED_COMPATIBLE_FAILURE_CODES = new Set([
  "no_semantic_match",
  "no_candidate",
  "no_same_session_sources",
]);

/**
 * Strict compatible-case success predicate for live PASS eligibility.
 */
export function isCompatibleCaseSafeNoWrite(
  compatibleCase: LiveCaseReceipt | undefined,
  harnessNodesBeforeCompatible: number,
): boolean {
  if (!compatibleCase) return false;
  if (compatibleCase.status !== "no_write") return false;
  if (compatibleCase.proofOutcome !== "no_candidate") return false;
  if (compatibleCase.writeExecuted !== false) return false;
  if (compatibleCase.writerInvoked !== false) return false;
  if (compatibleCase.adjudicatorCallCount !== 1) return false;
  if (compatibleCase.refereeCallCount !== 0) return false;
  if (
    compatibleCase.failureCode == null ||
    !EXPECTED_COMPATIBLE_FAILURE_CODES.has(compatibleCase.failureCode)
  ) {
    return false;
  }
  if (
    compatibleCase.failureCode === "model_failed" ||
    compatibleCase.failureCode === "model_timeout" ||
    compatibleCase.failureCode === "unhandled_exception" ||
    compatibleCase.failureCode === "adjudication_failed"
  ) {
    return false;
  }
  if (compatibleCase.harnessNodeCountAfter !== harnessNodesBeforeCompatible) {
    return false;
  }
  return true;
}

export function isCompatibleCaseUnexpectedWrite(
  compatibleCase: LiveCaseReceipt | undefined,
): boolean {
  if (!compatibleCase) return false;
  return (
    compatibleCase.writeExecuted === true ||
    compatibleCase.writerInvoked === true ||
    compatibleCase.status === "created" ||
    compatibleCase.status === "reused" ||
    compatibleCase.contradictionNodeId != null
  );
}

export function isCompatibleCaseProviderFailure(
  compatibleCase: LiveCaseReceipt | undefined,
): boolean {
  if (!compatibleCase) return false;
  return (
    compatibleCase.status === "provider_failed" ||
    compatibleCase.failureCode === "model_failed" ||
    compatibleCase.failureCode === "model_timeout" ||
    compatibleCase.failureCode === "unhandled_exception" ||
    compatibleCase.failureCode === "adjudication_failed" ||
    compatibleCase.failureCode === "call_budget_exhausted"
  );
}

export function evaluateLiveProofClassification(args: {
  clearContradictionWriteProven: boolean;
  compatibleCaseNoWrite: boolean;
  compatibleUnexpectedWrite: boolean;
  compatibleMissing: boolean;
  totalCallCount: number;
  maxTotalCalls: number;
  unsafeMutationDetected: boolean;
}): LiveProofExecuted["classificationHint"] {
  if (args.unsafeMutationDetected || args.compatibleUnexpectedWrite) {
    return "FAIL_UNSAFE_TO_PROCEED";
  }
  if (
    args.clearContradictionWriteProven &&
    args.compatibleCaseNoWrite &&
    args.totalCallCount <= args.maxTotalCalls &&
    !args.compatibleMissing
  ) {
    return "PASS_LIVE_PROVIDER_REFEREE_EXECUTION_PROVEN";
  }
  return "HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED";
}

export type RunLiveProofArgs = {
  env?: Record<string, string | undefined>;
  cases?: readonly LiveSyntheticCase[];
  /**
   * Injected adapters for deterministic tests.
   * Live script omits this and constructs real OpenAI adapters.
   */
  adapters?: ContradictionLiveAdapterBundle;
  abortSignal?: AbortSignal;
};

/**
 * Controlled live proof entry. Missing opt-in exits without provider calls.
 */
export async function runContradictionLiveProviderRefereeProof(
  args: RunLiveProofArgs = {},
): Promise<LiveProofResult> {
  const env = args.env ?? process.env;

  if (!isLiveContradictionProviderProofOptedIn(env)) {
    return {
      ran: false,
      reason: "opt_in_missing",
      message: `${CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV} must be set to 1 or true to run the live proof.`,
      optInEnv: CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
    };
  }

  const configResult = resolveContradictionLiveProviderConfig(env);
  if (!configResult.ok) {
    if (configResult.errorCode === "missing_credential") {
      return {
        ran: false,
        reason: "credentials_unavailable",
        message: configResult.message,
        optInEnv: CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
      };
    }
    return {
      ran: false,
      reason: "invalid_config",
      message: configResult.message,
      optInEnv: CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV,
    };
  }

  const config = configResult.config;
  const adapters =
    args.adapters ??
    (await createOpenAiContradictionLiveAdapters({
      adjudicatorModelId: config.adjudicatorModelId,
      refereeModelId: config.refereeModelId,
      timeoutMs: config.timeoutMs,
      maxTotalCalls: config.maxTotalCalls,
    }));

  const harness = createLiveProofInMemoryHarness();
  const cases = args.cases ?? LIVE_SYNTHETIC_CASES;
  const caseReceipts: LiveCaseReceipt[] = [];
  let unsafeMutationDetected = false;
  let nodesBeforeCompatible = harness.snapshot().nodes;

  for (const synthetic of cases) {
    if (unsafeMutationDetected) {
      break;
    }

    if (adapters.callBudget.remaining() <= 0) {
      caseReceipts.push({
        caseId: synthetic.id,
        status: "skipped_budget",
        proofOutcome: null,
        writeExecuted: false,
        writerInvoked: false,
        adjudicatorCallCount: 0,
        refereeCallCount: 0,
        contradictionNodeId: null,
        sideAQuote: null,
        sideBQuote: null,
        presentationStatus: null,
        failureCode: "call_budget_exhausted",
        failureMessage: "Skipped because the live call budget was exhausted.",
        latencyMs: null,
        harnessNodeCountAfter: harness.snapshot().nodes,
        harnessSpanCountAfter: harness.snapshot().spans,
      });
      continue;
    }

    if (synthetic.id === "compatible_contextual") {
      nodesBeforeCompatible = harness.snapshot().nodes;
    }

    const seeded = harness.seedCase(synthetic);
    const started = Date.now();
    const beforeAdj = adapters.callBudget.adjudicatorCalls();
    const beforeRef = adapters.callBudget.refereeCalls();
    const beforeNodes = harness.snapshot().nodes;
    const beforeSpans = harness.snapshot().spans;

    let result: ControlledNaturalEntryProofResult;
    try {
      result = await runControlledContradictionNaturalEntryProof({
        userId: harness.userId,
        sessionId: harness.sessionId,
        currentMessage: seeded.currentMessage,
        references: seeded.references,
        modelRunner: adapters.adjudicatorRunner,
        objectivityReferee: adapters.objectivityReferee,
        messageResolver: harness.messageResolver,
        persistenceDb: harness.db,
        presentationReader: harness.presentationReader,
        abortSignal: args.abortSignal,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unhandled live proof error";
      const afterAdj = adapters.callBudget.adjudicatorCalls();
      const afterRef = adapters.callBudget.refereeCalls();
      const afterNodes = harness.snapshot().nodes;
      const afterSpans = harness.snapshot().spans;
      const mutated =
        afterNodes > beforeNodes || afterSpans > beforeSpans;
      if (mutated) {
        unsafeMutationDetected = true;
      }
      caseReceipts.push({
        caseId: synthetic.id,
        status: "provider_failed",
        proofOutcome: null,
        writeExecuted: false,
        writerInvoked: false,
        adjudicatorCallCount: afterAdj - beforeAdj,
        refereeCallCount: afterRef - beforeRef,
        contradictionNodeId: null,
        sideAQuote: null,
        sideBQuote: null,
        presentationStatus: null,
        failureCode: mutated
          ? "unsafe_mutation_after_exception"
          : "unhandled_exception",
        failureMessage: message,
        latencyMs: Date.now() - started,
        harnessNodeCountAfter: afterNodes,
        harnessSpanCountAfter: afterSpans,
      });
      if (mutated) {
        break;
      }
      continue;
    }

    const presentation = result.dualSourcePresentation;
    const sideAQuote =
      presentation?.sideA.availability === "available"
        ? presentation.sideA.exactQuote
        : null;
    const sideBQuote =
      presentation?.sideB.availability === "available"
        ? presentation.sideB.exactQuote
        : null;
    caseReceipts.push({
      caseId: synthetic.id,
      status: mapCaseStatus(result),
      proofOutcome: result.outcome,
      writeExecuted: result.writeExecuted,
      writerInvoked: result.writerInvoked,
      adjudicatorCallCount: result.adjudicatorCallCount,
      refereeCallCount: result.refereeCallCount,
      contradictionNodeId: result.contradictionNodeId,
      sideAQuote,
      sideBQuote,
      presentationStatus: result.presentationStatus,
      failureCode: result.failureCode,
      failureMessage: result.failureMessage,
      latencyMs: Date.now() - started,
      harnessNodeCountAfter: harness.snapshot().nodes,
      harnessSpanCountAfter: harness.snapshot().spans,
    });
  }

  const clearCase = caseReceipts.find(
    (c) => c.caseId === "clear_contradiction_candidate",
  );
  const compatibleCase = caseReceipts.find(
    (c) => c.caseId === "compatible_contextual",
  );
  const ambiguousCase = caseReceipts.find(
    (c) => c.caseId === "ambiguous_insufficient",
  );

  const clearContradictionWriteProven = Boolean(
    clearCase &&
      clearCase.contradictionNodeId != null &&
      ((clearCase.status === "created" && clearCase.writeExecuted) ||
        clearCase.status === "reused") &&
      clearCase.sideAQuote != null &&
      clearCase.sideBQuote != null &&
      clearCase.presentationStatus === "resolved" &&
      clearCase.adjudicatorCallCount >= 1 &&
      clearCase.refereeCallCount >= 1,
  );

  const compatibleMissing = compatibleCase == null;
  const compatibleUnexpectedWrite =
    isCompatibleCaseUnexpectedWrite(compatibleCase);
  const compatibleCaseNoWrite = isCompatibleCaseSafeNoWrite(
    compatibleCase,
    nodesBeforeCompatible,
  );

  const ambiguousCaseNoWrite =
    ambiguousCase == null
      ? null
      : Boolean(
          !ambiguousCase.writeExecuted &&
            !ambiguousCase.writerInvoked &&
            ambiguousCase.status !== "provider_failed" &&
            ambiguousCase.status !== "created" &&
            ambiguousCase.status !== "reused",
        );

  const classificationHint = evaluateLiveProofClassification({
    clearContradictionWriteProven,
    compatibleCaseNoWrite,
    compatibleUnexpectedWrite,
    compatibleMissing,
    totalCallCount: adapters.callBudget.totalCalls(),
    maxTotalCalls: adapters.callBudget.maxTotalCalls,
    unsafeMutationDetected,
  });

  const executed: LiveProofExecuted = {
    ran: true,
    proofVersion: CONTRADICTION_LIVE_PROVIDER_REFEREE_PROOF_VERSION,
    providerId: adapters.providerId,
    adjudicatorModelId: adapters.adjudicatorModelId,
    refereeModelId: adapters.refereeModelId,
    independenceLevel: adapters.independenceLevel,
    maxRetries: 0,
    timeoutMs: adapters.timeoutMs,
    providerAttemptCountExact: true,
    adjudicatorCallCount: adapters.callBudget.adjudicatorCalls(),
    refereeCallCount: adapters.callBudget.refereeCalls(),
    totalCallCount: adapters.callBudget.totalCalls(),
    maxTotalCalls: adapters.callBudget.maxTotalCalls,
    cases: caseReceipts,
    clearContradictionWriteProven,
    compatibleCaseNoWrite,
    ambiguousCaseNoWrite,
    unsafeMutationDetected,
    evidenceOutputMutated: false,
    realAccountMutated: false,
    productionIngestionWired: false,
    isolatedDatabasePersistenceProven: false,
    productionReady: false,
    classificationHint,
  };

  return redactSecretsForReceipt(executed, env) as LiveProofExecuted;
}

/** Deterministic unit-test entry that bypasses live opt-in with injected adapters. */
export async function runContradictionLiveProviderRefereeProofForTests(args: {
  adapters: ContradictionLiveAdapterBundle;
  cases?: readonly LiveSyntheticCase[];
  env?: Record<string, string | undefined>;
  abortSignal?: AbortSignal;
}): Promise<LiveProofResult> {
  return runContradictionLiveProviderRefereeProof({
    env: {
      ...(args.env ?? {}),
      [CONTRADICTION_LIVE_PROVIDER_PROOF_OPT_IN_ENV]: "1",
      OPENAI_API_KEY:
        args.env?.OPENAI_API_KEY ??
        "test-key-not-used-with-injected-adapters",
    },
    adapters: args.adapters,
    cases: args.cases,
    abortSignal: args.abortSignal,
  });
}

/**
 * Pure process exit-code mapping for the live proof executable.
 *
 * - PASS → 0
 * - skipped / config unavailable → 3
 * - HOLD_LIVE_SEMANTIC_PROOF_NOT_OBTAINED → 4
 * - FAIL_UNSAFE_TO_PROCEED → 5
 */
export function liveProofResultToExitCode(result: LiveProofResult): number {
  if (!result.ran) {
    return 3;
  }
  if (result.classificationHint === "PASS_LIVE_PROVIDER_REFEREE_EXECUTION_PROVEN") {
    return 0;
  }
  if (result.classificationHint === "FAIL_UNSAFE_TO_PROCEED") {
    return 5;
  }
  return 4;
}

export type { StructuredModelRunner, ObjectivityReferee };
