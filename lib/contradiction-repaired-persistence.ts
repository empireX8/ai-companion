/**
 * CONTRADICTION-DUPLICATE-PREVENTION-001 (CEQR-007) — repaired contradiction
 * transactional writer with exact ordered dual-side duplicate prevention.
 *
 * Narrow injected transactional writer that consumes ONLY an authorised
 * persistence plan from `buildContradictionPersistencePlan`.
 *
 * Exact duplicate identity (database-enforced):
 *   userId + sideASourceSpanId + sideBSourceSpanId
 * (ordered Side A / Side B roles; no reverse-side equivalence).
 *
 * On success, `contradictionDeduplicationProven` is true (created or reused).
 *
 * Does NOT:
 * - route through the legacy contradiction materialiser / detection shape
 * - create ContradictionEvidence (legacy compatibility path left untouched)
 * - update or backfill existing ContradictionNode rows
 * - create ModelUpdate / Model Movement
 * - invoke providers, routes, or import flows
 * - default to the shared Prisma singleton (caller must inject a transaction interface)
 * - claim fuzzy / title / text similarity deduplication
 * - wire into live production routes
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
  | "existing_node_mismatch"
  | "unique_conflict_unresolved"
  | "span_unique_conflict_unresolved"
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

export type ContradictionRepairedExactNodeRow = {
  id: string;
  userId: string;
  sideASourceSpanId: string | null;
  sideBSourceSpanId: string | null;
};

type ExactNodeSelect = {
  id: true;
  userId: true;
  sideASourceSpanId: true;
  sideBSourceSpanId: true;
};

type ExactNodeFindArgs = {
  where: {
    userId: string;
    sideASourceSpanId: string;
    sideBSourceSpanId: string;
  };
  select: ExactNodeSelect;
};

type SpanFindUniqueArgs = {
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
    findUnique: (
      args: SpanFindUniqueArgs,
    ) => Promise<ContradictionRepairedSpanRow | null>;
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
    findFirst: (
      args: ExactNodeFindArgs,
    ) => Promise<ContradictionRepairedExactNodeRow | null>;
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

type ContradictionRepairedPersistenceSuccessBase = {
  ok: true;
  contradictionNodeId: string;
  sideASourceSpanId: string;
  sideBSourceSpanId: string;
  sideASpanOutcome: "created" | "reused";
  sideBSpanOutcome: "created" | "reused";
  status: "candidate";
  recommendedStorageConfidence: ContradictionPersistenceAuthorisedPlan["recommendedStorageConfidence"];
  contradictionDeduplicationProven: true;
};

export type ContradictionRepairedPersistenceSuccess =
  | (ContradictionRepairedPersistenceSuccessBase & {
      writeExecuted: true;
      contradictionNodeOutcome: "created";
    })
  | (ContradictionRepairedPersistenceSuccessBase & {
      writeExecuted: false;
      contradictionNodeOutcome: "reused";
    });

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

function isUniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; name?: string; meta?: unknown };
  if (e.code === "P2002") return true;
  if (error instanceof Error && /Unique constraint|P2002/i.test(error.message)) {
    return true;
  }
  return false;
}

function verifyNodeIntegrity(
  node: ContradictionRepairedExactNodeRow,
  expected: {
    userId: string;
    sideASourceSpanId: string;
    sideBSourceSpanId: string;
  },
): ContradictionRepairedPersistenceFailure | null {
  if (!node.id || typeof node.id !== "string" || node.id.trim().length === 0) {
    return fail(
      "existing_node_mismatch",
      "Existing exact ContradictionNode has a blank id.",
    );
  }
  if (node.userId !== expected.userId) {
    return fail(
      "existing_node_mismatch",
      "Existing exact ContradictionNode userId does not match the plan.",
    );
  }
  if (node.sideASourceSpanId !== expected.sideASourceSpanId) {
    return fail(
      "existing_node_mismatch",
      "Existing exact ContradictionNode Side A span id does not match.",
    );
  }
  if (node.sideBSourceSpanId !== expected.sideBSourceSpanId) {
    return fail(
      "existing_node_mismatch",
      "Existing exact ContradictionNode Side B span id does not match.",
    );
  }
  return null;
}

function reusedSuccess(args: {
  contradictionNodeId: string;
  sideASourceSpanId: string;
  sideBSourceSpanId: string;
  sideASpanOutcome: "created" | "reused";
  sideBSpanOutcome: "created" | "reused";
  recommendedStorageConfidence: ContradictionPersistenceAuthorisedPlan["recommendedStorageConfidence"];
}): ContradictionRepairedPersistenceSuccess {
  return {
    ok: true,
    writeExecuted: false,
    contradictionNodeOutcome: "reused",
    contradictionNodeId: args.contradictionNodeId,
    sideASourceSpanId: args.sideASourceSpanId,
    sideBSourceSpanId: args.sideBSourceSpanId,
    sideASpanOutcome: args.sideASpanOutcome,
    sideBSpanOutcome: args.sideBSpanOutcome,
    status: "candidate",
    recommendedStorageConfidence: args.recommendedStorageConfidence,
    contradictionDeduplicationProven: true,
  };
}

function createdSuccess(args: {
  contradictionNodeId: string;
  sideASourceSpanId: string;
  sideBSourceSpanId: string;
  sideASpanOutcome: "created" | "reused";
  sideBSpanOutcome: "created" | "reused";
  recommendedStorageConfidence: ContradictionPersistenceAuthorisedPlan["recommendedStorageConfidence"];
}): ContradictionRepairedPersistenceSuccess {
  return {
    ok: true,
    writeExecuted: true,
    contradictionNodeOutcome: "created",
    contradictionNodeId: args.contradictionNodeId,
    sideASourceSpanId: args.sideASourceSpanId,
    sideBSourceSpanId: args.sideBSourceSpanId,
    sideASpanOutcome: args.sideASpanOutcome,
    sideBSpanOutcome: args.sideBSpanOutcome,
    status: "candidate",
    recommendedStorageConfidence: args.recommendedStorageConfidence,
    contradictionDeduplicationProven: true,
  };
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

  // Unique conflict on create must propagate so the whole transaction aborts.
  // Do NOT catch P2002 here and continue inside an aborted transaction.
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

async function findExactNode(
  client: ContradictionRepairedPersistenceTx,
  args: {
    userId: string;
    sideASourceSpanId: string;
    sideBSourceSpanId: string;
  },
): Promise<ContradictionRepairedExactNodeRow | null> {
  return client.contradictionNode.findFirst({
    where: {
      userId: args.userId,
      sideASourceSpanId: args.sideASourceSpanId,
      sideBSourceSpanId: args.sideBSourceSpanId,
    },
    select: {
      id: true,
      userId: true,
      sideASourceSpanId: true,
      sideBSourceSpanId: true,
    },
  });
}

async function verifySpanMatchesDescriptor(
  db: ContradictionRepairedPersistenceDb,
  descriptor: ContradictionPersistenceSpanEnsureDescriptor,
  side: "A" | "B",
): Promise<
  | { ok: true; spanId: string }
  | ContradictionRepairedPersistenceFailure
> {
  const existing = await db.evidenceSpan.findUnique({
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

  if (!existing) {
    return fail(
      "unique_conflict_unresolved",
      `Side ${side} EvidenceSpan could not be resolved after unique conflict.`,
    );
  }

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
      `Side ${side} EvidenceSpan recovered after unique conflict does not match descriptor.`,
    );
  }

  return { ok: true, spanId: existing.id };
}

async function createNodeInTransaction(
  tx: ContradictionRepairedPersistenceTx,
  plan: ContradictionPersistenceAuthorisedPlan,
  spanIds: { sideASourceSpanId: string; sideBSourceSpanId: string },
  now: Date,
): Promise<{ id: string }> {
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
      sideASourceSpanId: spanIds.sideASourceSpanId,
      sideBSourceSpanId: spanIds.sideBSourceSpanId,
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

  return createdNode;
}

async function runPersistTransaction(
  db: ContradictionRepairedPersistenceDb,
  plan: ContradictionPersistenceAuthorisedPlan,
  now: Date,
): Promise<ContradictionRepairedPersistenceSuccess> {
  return db.$transaction(async (tx) => {
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

    const existingNode = await findExactNode(tx, {
      userId: plan.userId,
      sideASourceSpanId: sideASpan.spanId,
      sideBSourceSpanId: sideBSpan.spanId,
    });

    if (existingNode) {
      const mismatch = verifyNodeIntegrity(existingNode, {
        userId: plan.userId,
        sideASourceSpanId: sideASpan.spanId,
        sideBSourceSpanId: sideBSpan.spanId,
      });
      if (mismatch) {
        throw Object.assign(new Error(mismatch.message), {
          __persistenceFailure: mismatch,
        });
      }
      return reusedSuccess({
        contradictionNodeId: existingNode.id,
        sideASourceSpanId: sideASpan.spanId,
        sideBSourceSpanId: sideBSpan.spanId,
        sideASpanOutcome: sideASpan.outcome,
        sideBSpanOutcome: sideBSpan.outcome,
        recommendedStorageConfidence: plan.recommendedStorageConfidence,
      });
    }

    const createdNode = await createNodeInTransaction(
      tx,
      plan,
      {
        sideASourceSpanId: sideASpan.spanId,
        sideBSourceSpanId: sideBSpan.spanId,
      },
      now,
    );

    return createdSuccess({
      contradictionNodeId: createdNode.id,
      sideASourceSpanId: sideASpan.spanId,
      sideBSourceSpanId: sideBSpan.spanId,
      sideASpanOutcome: sideASpan.outcome,
      sideBSpanOutcome: sideBSpan.outcome,
      recommendedStorageConfidence: plan.recommendedStorageConfidence,
    });
  });
}

/**
 * Recovery path AFTER an aborted transaction. Uses top-level `db`, never the
 * aborted transaction client.
 */
async function recoverExactAfterUniqueConflict(
  db: ContradictionRepairedPersistenceDb,
  plan: ContradictionPersistenceAuthorisedPlan,
  now: Date,
): Promise<ContradictionRepairedPersistenceResult> {
  const sideA = await verifySpanMatchesDescriptor(
    db,
    plan.sideASpanEnsureDescriptor,
    "A",
  );
  if (!sideA.ok) return sideA;

  const sideB = await verifySpanMatchesDescriptor(
    db,
    plan.sideBSpanEnsureDescriptor,
    "B",
  );
  if (!sideB.ok) return sideB;

  if (sideA.spanId === sideB.spanId) {
    return fail(
      "identical_span_ids",
      "Side A and Side B EvidenceSpan IDs must be distinct.",
    );
  }

  const existingNode = await findExactNode(db, {
    userId: plan.userId,
    sideASourceSpanId: sideA.spanId,
    sideBSourceSpanId: sideB.spanId,
  });

  if (existingNode) {
    const mismatch = verifyNodeIntegrity(existingNode, {
      userId: plan.userId,
      sideASourceSpanId: sideA.spanId,
      sideBSourceSpanId: sideB.spanId,
    });
    if (mismatch) return mismatch;

    return reusedSuccess({
      contradictionNodeId: existingNode.id,
      sideASourceSpanId: sideA.spanId,
      sideBSourceSpanId: sideB.spanId,
      sideASpanOutcome: "reused",
      sideBSpanOutcome: "reused",
      recommendedStorageConfidence: plan.recommendedStorageConfidence,
    });
  }

  // Spans exist but node does not — attempt one create in a fresh transaction.
  try {
    return await db.$transaction(async (tx) => {
      const createdNode = await createNodeInTransaction(
        tx,
        plan,
        {
          sideASourceSpanId: sideA.spanId,
          sideBSourceSpanId: sideB.spanId,
        },
        now,
      );
      return createdSuccess({
        contradictionNodeId: createdNode.id,
        sideASourceSpanId: sideA.spanId,
        sideBSourceSpanId: sideB.spanId,
        sideASpanOutcome: "reused",
        sideBSpanOutcome: "reused",
        recommendedStorageConfidence: plan.recommendedStorageConfidence,
      });
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "__persistenceFailure" in error &&
      (error as { __persistenceFailure: ContradictionRepairedPersistenceFailure })
        .__persistenceFailure
    ) {
      return (
        error as { __persistenceFailure: ContradictionRepairedPersistenceFailure }
      ).__persistenceFailure;
    }

    if (!isUniqueConflict(error)) {
      return fail(
        "unique_conflict_unresolved",
        error instanceof Error
          ? `Could not resolve unique conflict: ${error.message}`
          : "Could not resolve unique conflict.",
      );
    }

    const recoveredNode = await findExactNode(db, {
      userId: plan.userId,
      sideASourceSpanId: sideA.spanId,
      sideBSourceSpanId: sideB.spanId,
    });

    if (!recoveredNode) {
      return fail(
        "unique_conflict_unresolved",
        "Unique conflict occurred but no complete exact ContradictionNode could be resolved.",
      );
    }

    const mismatch = verifyNodeIntegrity(recoveredNode, {
      userId: plan.userId,
      sideASourceSpanId: sideA.spanId,
      sideBSourceSpanId: sideB.spanId,
    });
    if (mismatch) return mismatch;

    return reusedSuccess({
      contradictionNodeId: recoveredNode.id,
      sideASourceSpanId: sideA.spanId,
      sideBSourceSpanId: sideB.spanId,
      sideASpanOutcome: "reused",
      sideBSpanOutcome: "reused",
      recommendedStorageConfidence: plan.recommendedStorageConfidence,
    });
  }
}

/**
 * Persist one repaired contradiction candidate from an authorised plan.
 *
 * Exact ordered dual-side identity is enforced: create when absent, reuse when
 * present, recover after unique-conflict races outside the aborted transaction.
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
    return await runPersistTransaction(args.db, plan, now);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "__persistenceFailure" in error &&
      (error as { __persistenceFailure: ContradictionRepairedPersistenceFailure })
        .__persistenceFailure
    ) {
      return (
        error as { __persistenceFailure: ContradictionRepairedPersistenceFailure }
      ).__persistenceFailure;
    }

    if (isUniqueConflict(error)) {
      // OUTSIDE aborted transaction — do not query the aborted tx.
      return recoverExactAfterUniqueConflict(args.db, plan, now);
    }

    return fail(
      "transaction_failure",
      error instanceof Error
        ? `Transaction failed: ${error.message}`
        : "Transaction failed.",
    );
  }
}
