/**
 * CONTRADICTION-PERSISTENCE-WIRING-001 — repaired contradiction transactional writer.
 *
 * Narrow injected transactional writer that consumes ONLY an authorised
 * persistence plan from `buildContradictionPersistencePlan`.
 *
 * Does NOT:
 * - route through the legacy contradiction materialiser / detection shape
 * - create ContradictionEvidence (legacy compatibility path left untouched)
 * - update or backfill existing ContradictionNode rows
 * - create ModelUpdate / Model Movement
 * - invoke providers, routes, or import flows
 * - default to the shared Prisma singleton (caller must inject a transaction interface)
 *
 * Repeated valid persistence invocations may still require CEQR-007
 * contradiction-level deduplication.
 */

import { createHash } from "node:crypto";

import {
  assertAuthorisedContradictionPersistencePlan,
  type ContradictionPersistenceAuthorisedPlan,
  type ContradictionPersistenceSpanEnsureDescriptor,
} from "./contradiction-persistence-plan";

export type ContradictionRepairedPersistenceFailureCode =
  | "plan_not_authorised"
  | "malformed_plan_object"
  | "unresolved_source_message"
  | "wrong_user_message"
  | "wrong_session_message"
  | "message_content_inconsistent"
  | "existing_span_mismatch"
  | "identical_span_ids"
  | "node_create_missing_id"
  | "transaction_failure";

export type ContradictionRepairedMessageRow = {
  id: string;
  userId: string;
  sessionId: string;
  content: string;
};

export type ContradictionRepairedSpanRow = {
  id: string;
  userId: string;
  messageId: string;
  charStart: number;
  charEnd: number;
  contentHash: string;
};

type ContradictionRepairedPersistenceTx = {
  message: {
    findUnique: (args: {
      where: { id: string };
      select: {
        id: true;
        userId: true;
        sessionId: true;
        content: true;
      };
    }) => Promise<ContradictionRepairedMessageRow | null>;
  };
  evidenceSpan: {
    findUnique: (args: {
      where: {
        messageId_charStart_charEnd_contentHash: {
          messageId: string;
          charStart: number;
          charEnd: number;
          contentHash: string;
        };
      };
      select: {
        id: true;
        userId: true;
        messageId: true;
        charStart: true;
        charEnd: true;
        contentHash: true;
      };
    }) => Promise<ContradictionRepairedSpanRow | null>;
    create: (args: {
      data: {
        userId: string;
        messageId: string;
        charStart: number;
        charEnd: number;
        contentHash: string;
      };
      select: { id: true };
    }) => Promise<{ id: string }>;
  };
  contradictionNode: {
    create: (args: {
      data: {
        userId: string;
        title: string;
        sideA: string;
        sideB: string;
        type: ContradictionPersistenceAuthorisedPlan["contradictionType"];
        confidence: ContradictionPersistenceAuthorisedPlan["recommendedStorageConfidence"];
        status: "candidate";
        sourceSessionId: string;
        sourceMessageId: null;
        sideASourceSpanId: string;
        sideBSourceSpanId: string;
        evidenceCount: number;
        lastTouchedAt: Date;
        recommendedRung: "rung1_gentle_mirror";
        escalationLevel: number;
      };
      select: { id: true };
    }) => Promise<{ id: string }>;
  };
};

export type ContradictionRepairedPersistenceDb =
  ContradictionRepairedPersistenceTx & {
    $transaction: <T>(
      fn: (tx: ContradictionRepairedPersistenceTx) => Promise<T>,
    ) => Promise<T>;
  };

export type ContradictionRepairedPersistenceSuccess = {
  ok: true;
  writeExecuted: true;
  contradictionNodeId: string;
  sideASourceSpanId: string;
  sideBSourceSpanId: string;
  sideASpanOutcome: "created" | "reused";
  sideBSpanOutcome: "created" | "reused";
  status: "candidate";
  recommendedStorageConfidence: ContradictionPersistenceAuthorisedPlan["recommendedStorageConfidence"];
  /** Explicit: contradiction-level deduplication is not claimed (CEQR-007). */
  contradictionDeduplicationProven: false;
};

export type ContradictionRepairedPersistenceFailure = {
  ok: false;
  writeExecuted: false;
  code: ContradictionRepairedPersistenceFailureCode;
  message: string;
};

export type ContradictionRepairedPersistenceResult =
  | ContradictionRepairedPersistenceSuccess
  | ContradictionRepairedPersistenceFailure;

function fail(
  code: ContradictionRepairedPersistenceFailureCode,
  message: string,
): ContradictionRepairedPersistenceFailure {
  return {
    ok: false,
    writeExecuted: false,
    code,
    message,
  };
}

function hashExactQuoteSlice(exactQuote: string): string {
  return createHash("sha256").update(exactQuote, "utf8").digest("hex");
}

async function resolveAndVerifyMessage(
  tx: ContradictionRepairedPersistenceTx,
  plan: ContradictionPersistenceAuthorisedPlan,
  descriptor: ContradictionPersistenceSpanEnsureDescriptor,
  side: "A" | "B",
): Promise<ContradictionRepairedPersistenceFailure | null> {
  const message = await tx.message.findUnique({
    where: { id: descriptor.messageId },
    select: {
      id: true,
      userId: true,
      sessionId: true,
      content: true,
    },
  });

  if (!message) {
    return fail(
      "unresolved_source_message",
      `Side ${side} source message ${descriptor.messageId} could not be resolved.`,
    );
  }

  if (message.userId !== plan.userId || message.userId !== descriptor.userId) {
    return fail(
      "wrong_user_message",
      `Side ${side} message is owned by a different user.`,
    );
  }

  if (message.sessionId !== plan.sharedSessionId) {
    return fail(
      "wrong_session_message",
      `Side ${side} message session does not match the shared plan session.`,
    );
  }

  if (
    descriptor.charStart < 0 ||
    descriptor.charEnd > message.content.length ||
    descriptor.charStart >= descriptor.charEnd
  ) {
    return fail(
      "message_content_inconsistent",
      `Side ${side} offsets are outside message content bounds.`,
    );
  }

  const slice = message.content.slice(descriptor.charStart, descriptor.charEnd);
  if (slice !== descriptor.exactQuote) {
    return fail(
      "message_content_inconsistent",
      `Side ${side} message slice does not match the plan exactQuote.`,
    );
  }

  const recomputedHash = hashExactQuoteSlice(slice);
  if (recomputedHash !== descriptor.contentHash) {
    return fail(
      "message_content_inconsistent",
      `Side ${side} contentHash does not match the exact message slice.`,
    );
  }

  return null;
}

async function ensureSpanInTransaction(
  tx: ContradictionRepairedPersistenceTx,
  descriptor: ContradictionPersistenceSpanEnsureDescriptor,
  side: "A" | "B",
): Promise<
  | { ok: true; spanId: string; outcome: "created" | "reused" }
  | ContradictionRepairedPersistenceFailure
> {
  const existing = await tx.evidenceSpan.findUnique({
    where: {
      messageId_charStart_charEnd_contentHash: {
        messageId: descriptor.messageId,
        charStart: descriptor.charStart,
        charEnd: descriptor.charEnd,
        contentHash: descriptor.contentHash,
      },
    },
    select: {
      id: true,
      userId: true,
      messageId: true,
      charStart: true,
      charEnd: true,
      contentHash: true,
    },
  });

  if (existing) {
    if (
      existing.userId !== descriptor.userId ||
      existing.messageId !== descriptor.messageId ||
      existing.charStart !== descriptor.charStart ||
      existing.charEnd !== descriptor.charEnd ||
      existing.contentHash !== descriptor.contentHash ||
      !existing.id
    ) {
      return fail(
        "existing_span_mismatch",
        `Existing Side ${side} EvidenceSpan does not match the complete descriptor/ownership.`,
      );
    }
    return { ok: true, spanId: existing.id, outcome: "reused" };
  }

  const created = await tx.evidenceSpan.create({
    data: {
      userId: descriptor.userId,
      messageId: descriptor.messageId,
      charStart: descriptor.charStart,
      charEnd: descriptor.charEnd,
      contentHash: descriptor.contentHash,
    },
    select: { id: true },
  });

  if (!created?.id) {
    return fail(
      "transaction_failure",
      `Side ${side} EvidenceSpan create did not return an id.`,
    );
  }

  return { ok: true, spanId: created.id, outcome: "created" };
}

/**
 * Persist one repaired contradiction candidate from an authorised plan.
 * All writes occur in a single injected transaction.
 */
export async function persistRepairedContradictionCandidate(args: {
  plan: unknown;
  db: ContradictionRepairedPersistenceDb;
  now?: Date;
}): Promise<ContradictionRepairedPersistenceResult> {
  const authorised = assertAuthorisedContradictionPersistencePlan(args.plan);
  if (!authorised.ok) {
    return fail(authorised.code, authorised.message);
  }

  const plan = authorised.plan;

  // Reassert derived semantic / source metadata before opening a transaction.
  if (
    plan.persistedSourceMessageId !== null ||
    plan.persistedSourceSessionId !== plan.sharedSessionId ||
    (plan.contradictionType !== "goal_behavior_gap" &&
      plan.contradictionType !== "constraint_conflict") ||
    !plan.sideAProposition.trim() ||
    !plan.sideBProposition.trim() ||
    !plan.title.trim() ||
    plan.sourceMetadata.titleIsDeterministicDisplayLabel !== true
  ) {
    return fail(
      "malformed_plan_object",
      "Authorised plan failed pre-transaction semantic/source reassertion.",
    );
  }

  const now = args.now ?? new Date();

  try {
    return await args.db.$transaction(async (tx) => {
      const sideAMessageError = await resolveAndVerifyMessage(
        tx,
        plan,
        plan.sideASpanEnsureDescriptor,
        "A",
      );
      if (sideAMessageError) {
        throw Object.assign(new Error(sideAMessageError.message), {
          __persistenceFailure: sideAMessageError,
        });
      }

      const sideBMessageError = await resolveAndVerifyMessage(
        tx,
        plan,
        plan.sideBSpanEnsureDescriptor,
        "B",
      );
      if (sideBMessageError) {
        throw Object.assign(new Error(sideBMessageError.message), {
          __persistenceFailure: sideBMessageError,
        });
      }

      const sideASpan = await ensureSpanInTransaction(
        tx,
        plan.sideASpanEnsureDescriptor,
        "A",
      );
      if (!sideASpan.ok) {
        throw Object.assign(new Error(sideASpan.message), {
          __persistenceFailure: sideASpan,
        });
      }

      const sideBSpan = await ensureSpanInTransaction(
        tx,
        plan.sideBSpanEnsureDescriptor,
        "B",
      );
      if (!sideBSpan.ok) {
        throw Object.assign(new Error(sideBSpan.message), {
          __persistenceFailure: sideBSpan,
        });
      }

      if (sideASpan.spanId === sideBSpan.spanId) {
        const identical = fail(
          "identical_span_ids",
          "Side A and Side B EvidenceSpan IDs must be distinct.",
        );
        throw Object.assign(new Error(identical.message), {
          __persistenceFailure: identical,
        });
      }

      const createdNode = await tx.contradictionNode.create({
        data: {
          userId: plan.userId,
          title: plan.title,
          sideA: plan.sideAProposition,
          sideB: plan.sideBProposition,
          type: plan.contradictionType,
          confidence: plan.recommendedStorageConfidence,
          status: "candidate",
          sourceSessionId: plan.persistedSourceSessionId,
          sourceMessageId: null,
          sideASourceSpanId: sideASpan.spanId,
          sideBSourceSpanId: sideBSpan.spanId,
          evidenceCount: 0,
          lastTouchedAt: now,
          recommendedRung: "rung1_gentle_mirror",
          escalationLevel: 0,
        },
        select: { id: true },
      });

      if (!createdNode?.id) {
        const missing = fail(
          "node_create_missing_id",
          "ContradictionNode create did not return an id.",
        );
        throw Object.assign(new Error(missing.message), {
          __persistenceFailure: missing,
        });
      }

      const success: ContradictionRepairedPersistenceSuccess = {
        ok: true,
        writeExecuted: true,
        contradictionNodeId: createdNode.id,
        sideASourceSpanId: sideASpan.spanId,
        sideBSourceSpanId: sideBSpan.spanId,
        sideASpanOutcome: sideASpan.outcome,
        sideBSpanOutcome: sideBSpan.outcome,
        status: "candidate",
        recommendedStorageConfidence: plan.recommendedStorageConfidence,
        contradictionDeduplicationProven: false,
      };
      return success;
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "__persistenceFailure" in error &&
      (error as { __persistenceFailure: ContradictionRepairedPersistenceFailure })
        .__persistenceFailure
    ) {
      return (error as { __persistenceFailure: ContradictionRepairedPersistenceFailure })
        .__persistenceFailure;
    }

    return fail(
      "transaction_failure",
      error instanceof Error
        ? `Transaction failed: ${error.message}`
        : "Transaction failed.",
    );
  }
}
