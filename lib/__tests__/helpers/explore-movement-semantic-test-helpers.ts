/**
 * Shared test helpers for Explore movement semantic restoration (DEL-001B).
 * Deterministic fakes only — no live provider calls, no production DB.
 */

import {
  ExploreMovementProposalStatus,
  UnderstandingLinkTargetType,
  UserMapConclusionStatus,
  UserMapConclusionVisibility,
  type PrismaClient,
} from "@prisma/client";

import type { ExploreGroundingSource } from "../../explore-grounding-contract";
import type { ExploreGroundingCandidate } from "../../explore-grounding-retrieval";
import {
  createExploreMovementCallBudget,
  type ExploreMovementCallBudget,
} from "../../explore-movement-live-provider-adapters";
import {
  buildExploreMovementProposalProvenance,
  type ExploreMovementProposalProvenance,
} from "../../explore-movement-proposal-provenance";
import {
  EXPLORE_MOVEMENT_MIN_CONFIDENCE,
  type ExploreMovementProposeConclusionStrengthening,
  type ExploreMovementSemanticDecision,
} from "../../explore-movement-semantic-contract";
import type { StructuredModelRunner } from "../../orvek-intelligence-kernel/model-runner";
import {
  OBJECTIVITY_REFEREE_INTERFACE_VERSION,
  type ObjectivityReferee,
  type ObjectivityRefereeEvaluation,
  type ObjectivityRefereeResult,
} from "../../orvek-intelligence-kernel/objectivity-referee";

export const SEMANTIC_USER_ID = "user_explore_semantic_restoration";
export const FOREIGN_USER_ID = "user_explore_semantic_foreign";
export const UMC_ID = "umc_semantic_target_1";
export const SESSION_ID = "session_semantic_1";
export const USER_MSG_ID = "msg_user_semantic_1";
export const ASSISTANT_MSG_ID = "msg_assistant_semantic_1";

export function sampleOwnedSources(
  userId = SEMANTIC_USER_ID
): ExploreGroundingSource[] {
  return [
    {
      sourceId: "journal-verified-semantic",
      sourceType: "journal_entry",
      sourceFamily: "journal_entry",
      userId,
      title: "Recovery journal",
      extract:
        "After dense meetings I lose the evening stop point and keep working past fatigue.",
      retrievalReason: "Stored extract directly supports the conversational claim.",
      claimSupport: "verifies",
      epistemicStatus: "VERIFIED",
    },
    {
      sourceId: "pattern-inferred-semantic",
      sourceType: "pattern_claim_evidence",
      sourceFamily: "pattern_claim_evidence",
      userId,
      title: "Boundary pattern",
      extract: "Named boundary protects recovery energy after work pressure.",
      retrievalReason:
        "Owned evidence supports an inference but does not directly verify the claim.",
      claimSupport: "infers",
      epistemicStatus: "INFERRED",
    },
  ];
}

export function sampleCandidates(
  userId = SEMANTIC_USER_ID
): ExploreGroundingCandidate[] {
  return [
    {
      sourceId: "journal-verified-semantic",
      sourceType: "journal_entry",
      sourceFamily: "journal_entry",
      userId,
      title: "Recovery journal",
      extract:
        "After dense meetings I lose the evening stop point and keep working past fatigue.",
      tokens: [
        "after",
        "dense",
        "meetings",
        "lose",
        "evening",
        "stop",
        "point",
        "keep",
        "working",
        "past",
        "fatigue",
      ],
    },
    {
      sourceId: "pattern-inferred-semantic",
      sourceType: "pattern_claim_evidence",
      sourceFamily: "pattern_claim_evidence",
      userId,
      title: "Boundary pattern",
      extract: "Named boundary protects recovery energy after work pressure.",
      tokens: [
        "named",
        "boundary",
        "protects",
        "recovery",
        "energy",
        "after",
        "work",
        "pressure",
      ],
    },
    {
      sourceId: UMC_ID,
      sourceType: "usermap_conclusion",
      sourceFamily: "usermap_conclusion",
      userId,
      title: "Evening recovery boundary",
      extract:
        "Evening recovery boundary weakens when meetings stack without a hard stop.",
      tokens: [
        "evening",
        "recovery",
        "boundary",
        "weakens",
        "meetings",
        "stack",
        "without",
        "hard",
        "stop",
      ],
    },
  ];
}

export function validProposeDecision(
  overrides: Partial<ExploreMovementProposeConclusionStrengthening> = {}
): ExploreMovementProposeConclusionStrengthening {
  return {
    outcome: "PROPOSE_CONCLUSION_STRENGTHENING",
    proposedObjectType: "UserMapConclusion",
    targetObjectId: UMC_ID,
    afterSummary:
      "Evening recovery boundary weakens more specifically when dense meetings stack and the hard stop is skipped.",
    rationale:
      "Owned journal and pattern evidence show the same recovery boundary weakening under meeting load.",
    userFacingSummary:
      "Possible model movement: strengthen evening recovery boundary after dense meetings.",
    confidence: Math.max(EXPLORE_MOVEMENT_MIN_CONFIDENCE, 0.72),
    alternativeInterpretation:
      "The slip could be a one-off fatigue episode rather than a durable boundary pattern.",
    qualificationContext:
      "Applies when meetings are dense and the evening stop is skipped, not to every workday.",
    evidenceSourceIds: [
      "journal-verified-semantic",
      "pattern-inferred-semantic",
    ],
    ...overrides,
  };
}

export function completedPassReferee(
  overrides: Partial<ObjectivityRefereeResult> = {}
): ObjectivityRefereeResult {
  return {
    interfaceVersion: OBJECTIVITY_REFEREE_INTERFACE_VERSION,
    executionState: "completed",
    outcome: "PASS",
    rationale: "Proposal remains within owned evidence and same-subject strengthening.",
    proposedObjectType: "UserMapConclusion",
    proposedConfidence: 0.72,
    adjustedConfidence: null,
    routedObjectType: null,
    validationErrors: [],
    continuationAllowed: true,
    errorMessage: null,
    ...overrides,
  };
}

export function validProvenance(
  overrides: Partial<ExploreMovementProposalProvenance> = {}
): ExploreMovementProposalProvenance {
  const decision = validProposeDecision();
  const base = buildExploreMovementProposalProvenance({
    sources: sampleOwnedSources(),
    semanticDecision: decision,
    refereeResult: completedPassReferee({
      proposedConfidence: decision.confidence,
    }),
    providerMetadata: {
      providerId: "injected",
      adjudicatorModelId: "fake-adjudicator",
      refereeModelId: "fake-referee",
      adjudicatorCalls: 1,
      refereeCalls: 1,
      totalCalls: 2,
    },
  });
  return { ...base, ...overrides };
}

export function fakeAdjudicatorRunner(
  decision: ExploreMovementSemanticDecision | (() => ExploreMovementSemanticDecision),
  options?: { fail?: boolean; malformed?: unknown }
): StructuredModelRunner & { calls: number } {
  const runner = {
    calls: 0,
    async runStructured() {
      runner.calls += 1;
      if (options?.fail) {
        return {
          ok: false as const,
          errorCode: "model_execution_failed" as const,
          message: "injected adjudicator failure",
          providerId: "injected",
          modelId: "fake-adjudicator",
        };
      }
      if (options?.malformed !== undefined) {
        return {
          ok: true as const,
          object: options.malformed,
          providerId: "injected",
          modelId: "fake-adjudicator",
        };
      }
      const object = typeof decision === "function" ? decision() : decision;
      return {
        ok: true as const,
        object,
        providerId: "injected",
        modelId: "fake-adjudicator",
      };
    },
  };
  return runner;
}

export function fakeReferee(
  evaluation:
    | ObjectivityRefereeEvaluation
    | (() => ObjectivityRefereeEvaluation)
    | (() => Promise<ObjectivityRefereeEvaluation>),
  options?: { throwError?: boolean }
): ObjectivityReferee & { calls: number } {
  const referee = {
    calls: 0,
    async evaluate() {
      referee.calls += 1;
      if (options?.throwError) {
        throw new Error("injected referee failure");
      }
      const value =
        typeof evaluation === "function" ? await evaluation() : evaluation;
      return value;
    },
  };
  return referee;
}

type ProposalRow = {
  id: string;
  userId: string;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  status: ExploreMovementProposalStatus;
  authorityMode?: "legacy" | "canonical_v1" | null;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  beforeSummary: string;
  afterSummary: string;
  rationale: string;
  userFacingSummary: string;
  sourcesJson: unknown;
  modelUpdateId: string | null;
  expectedCurrentRevisionId?: string | null;
  expectedLegacySnapshotHash?: string | null;
  canonicalConceptId?: string | null;
  revisionOperation?: string | null;
};

type ModelUpdateRow = {
  id: string;
  userId: string;
  visibility: string;
  isMeaningful: boolean;
  data: Record<string, unknown>;
};

export type SemanticTestDbHooks = {
  /** Awaited inside proposal create before inserting (barrier concurrency). */
  beforeProposalCreate?: () => Promise<void>;
  /** Called after a successful proposal insert. */
  afterProposalCreate?: () => void;
  /** When true / returns true, UEL upsert throws (transaction rollback tests). */
  failUelUpsert?: boolean | (() => boolean);
  /** When true / returns true, ModelUpdate visibility flip throws. */
  failPublishFlip?: boolean | (() => boolean);
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function makeSemanticTestDb(args?: {
  proposals?: ProposalRow[];
  umc?: {
    id: string;
    userId: string;
    title: string;
    summary: string;
    status?: UserMapConclusionStatus;
    visibility?: UserMapConclusionVisibility;
    supersededById?: string | null;
    candidateLifecycleStatus?: null;
    evidenceCount?: number;
  };
  foreignUmc?: boolean;
  /** Actual DB owners for source IDs (JSON userId is ignored for ownership proof). */
  ownedSourceRows?: Array<{
    id: string;
    userId: string;
    kind:
      | "journal_entry"
      | "pattern_claim_evidence"
      | "usermap_conclusion"
      | "message"
      | "session";
    /** Message role when kind is message (defaults by id heuristics). */
    role?: "user" | "assistant";
  }>;
  /** Optional alternate session/message bindings for lineage mismatch tests. */
  sessionId?: string;
  userMessage?: { id: string; sessionId: string; userId: string };
  assistantMessage?: { id: string; sessionId: string; userId: string };
  hooks?: SemanticTestDbHooks;
}) {
  const proposals = (args?.proposals ?? []).map((row) => ({ ...row }));
  const modelUpdates: ModelUpdateRow[] = [];
  const evidenceLinks: Array<Record<string, unknown>> = [];
  const hooks = args?.hooks ?? {};
  const sessionId = args?.sessionId ?? SESSION_ID;
  const userMessage = args?.userMessage ?? {
    id: USER_MSG_ID,
    sessionId,
    userId: SEMANTIC_USER_ID,
  };
  const assistantMessage = args?.assistantMessage ?? {
    id: ASSISTANT_MSG_ID,
    sessionId,
    userId: SEMANTIC_USER_ID,
  };
  const umc = args?.umc ?? {
    id: UMC_ID,
    userId: SEMANTIC_USER_ID,
    title: "Evening recovery boundary",
    summary:
      "Evening recovery boundary weakens when meetings stack without a hard stop.",
    status: UserMapConclusionStatus.supported,
    visibility: UserMapConclusionVisibility.user_visible,
    supersededById: null,
    candidateLifecycleStatus: null,
    evidenceCount: 3,
  };

  const ownedSourceRows = args?.ownedSourceRows ?? [
    {
      id: "journal-verified-semantic",
      userId: SEMANTIC_USER_ID,
      kind: "journal_entry" as const,
    },
    {
      id: "pattern-inferred-semantic",
      userId: SEMANTIC_USER_ID,
      kind: "pattern_claim_evidence" as const,
    },
    {
      id: UMC_ID,
      userId: SEMANTIC_USER_ID,
      kind: "usermap_conclusion" as const,
    },
    {
      id: sessionId,
      userId: SEMANTIC_USER_ID,
      kind: "session" as const,
    },
    {
      id: USER_MSG_ID,
      userId: SEMANTIC_USER_ID,
      kind: "message" as const,
      role: "user" as const,
    },
    {
      id: ASSISTANT_MSG_ID,
      userId: SEMANTIC_USER_ID,
      kind: "message" as const,
      role: "assistant" as const,
    },
  ];

  function findOwned(
    kind: string,
    id: string,
    userId: string
  ): { id: string } | null {
    const row = ownedSourceRows.find(
      (candidate) =>
        candidate.kind === kind &&
        candidate.id === id &&
        candidate.userId === userId
    );
    return row ? { id: row.id } : null;
  }

  function messageRoleForId(id: string): "user" | "assistant" | null {
    if (id === userMessage.id) return "user";
    if (id === assistantMessage.id) return "assistant";
    const owned = ownedSourceRows.find(
      (candidate) => candidate.kind === "message" && candidate.id === id
    );
    if (!owned) return null;
    if (owned.role) return owned.role;
    return "user";
  }

  function snapshotState() {
    return {
      proposals: cloneJson(proposals),
      modelUpdates: cloneJson(modelUpdates),
      evidenceLinks: cloneJson(evidenceLinks),
    };
  }

  function restoreState(snapshot: ReturnType<typeof snapshotState>) {
    proposals.splice(0, proposals.length, ...snapshot.proposals);
    modelUpdates.splice(0, modelUpdates.length, ...snapshot.modelUpdates);
    evidenceLinks.splice(0, evidenceLinks.length, ...snapshot.evidenceLinks);
  }

  function matchesProposalWhere(
    row: ProposalRow,
    where: Record<string, unknown>
  ): boolean {
    if (where.id && row.id !== where.id) return false;
    if (where.userId && row.userId !== where.userId) return false;
    if (where.conversationId && row.conversationId !== where.conversationId) {
      return false;
    }
    if (
      where.assistantMessageId &&
      row.assistantMessageId !== where.assistantMessageId
    ) {
      return false;
    }
    if (
      where.affectedObjectId &&
      row.affectedObjectId !== where.affectedObjectId
    ) {
      return false;
    }
    if (where.afterSummary && row.afterSummary !== where.afterSummary) {
      return false;
    }
    if (where.status && row.status !== where.status) return false;
    if ("modelUpdateId" in where) {
      if (where.modelUpdateId === null && row.modelUpdateId !== null) return false;
      if (
        where.modelUpdateId !== null &&
        where.modelUpdateId !== undefined &&
        row.modelUpdateId !== where.modelUpdateId
      ) {
        return false;
      }
    }
    return true;
  }

  type UndoFn = () => void;

  function buildTransactionalClient(undoStack: UndoFn[]) {
    return {
      $queryRaw: async () => [],
      session: db.session,
      message: db.message,
      userMapConclusion: db.userMapConclusion,
      journalEntry: db.journalEntry,
      patternClaimEvidence: db.patternClaimEvidence,
      referenceItem: db.referenceItem,
      patternClaim: db.patternClaim,
      contradictionNode: db.contradictionNode,
      contradictionEvidence: db.contradictionEvidence,
      profileArtifact: db.profileArtifact,
      evidenceSpan: db.evidenceSpan,
      surfacedAction: db.surfacedAction,
      quickCheckIn: db.quickCheckIn,
      importUploadSession: db.importUploadSession,
      importUploadChunk: db.importUploadChunk,
      investigation: db.investigation,
      fieldworkAssignment: db.fieldworkAssignment,
      evidencePointerSurfacingRationale: db.evidencePointerSurfacingRationale,
      exploreMovementProposal: {
        findFirst: db.exploreMovementProposal.findFirst,
        create: db.exploreMovementProposal.create,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<ProposalRow>;
        }) => {
          const row = proposals.find((candidate) => candidate.id === where.id);
          if (!row) throw new Error("missing proposal");
          const before = { ...row };
          Object.assign(row, data);
          undoStack.push(() => {
            Object.keys(row).forEach((key) => {
              delete (row as Record<string, unknown>)[key];
            });
            Object.assign(row, before);
          });
          return row;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Partial<ProposalRow>;
        }) => {
          let count = 0;
          for (const row of proposals) {
            if (!matchesProposalWhere(row, where)) continue;
            const before = { ...row };
            Object.assign(row, data);
            undoStack.push(() => {
              Object.keys(row).forEach((key) => {
                delete (row as Record<string, unknown>)[key];
              });
              Object.assign(row, before);
            });
            count += 1;
          }
          return { count };
        },
      },
      modelUpdate: {
        create: db.modelUpdate.create,
        findFirst: db.modelUpdate.findFirst,
        createMany: async ({
          data,
          skipDuplicates,
        }: {
          data: Array<Record<string, unknown>>;
          skipDuplicates?: boolean;
        }) => {
          let count = 0;
          for (const item of data) {
            const id =
              typeof item.id === "string" && item.id.length > 0
                ? item.id
                : `mu_${modelUpdates.length + 1}`;
            if (modelUpdates.some((row) => row.id === id)) {
              if (skipDuplicates) continue;
              const err = new Error("Unique constraint failed") as Error & {
                code: string;
              };
              err.code = "P2002";
              throw err;
            }
            const row: ModelUpdateRow = {
              id,
              userId: String(item.userId ?? ""),
              visibility: String(item.visibility ?? "internal_only"),
              isMeaningful: Boolean(item.isMeaningful ?? false),
              data: { ...item, id },
            };
            modelUpdates.push(row);
            undoStack.push(() => {
              // Do not roll back a row adopted by a committed concurrent publisher.
              const adopted = proposals.some(
                (proposal) =>
                  proposal.modelUpdateId === id &&
                  proposal.status === ExploreMovementProposalStatus.published
              );
              if (adopted) return;
              const idx = modelUpdates.findIndex((candidate) => candidate.id === id);
              if (idx >= 0) modelUpdates.splice(idx, 1);
            });
            count += 1;
          }
          return { count };
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: {
            id?: string;
            userId?: string;
            visibility?: string;
            isMeaningful?: boolean;
          };
          data: { visibility?: string; isMeaningful?: boolean };
        }) => {
          const shouldFail =
            typeof hooks.failPublishFlip === "function"
              ? hooks.failPublishFlip()
              : Boolean(hooks.failPublishFlip);
          if (shouldFail) {
            throw new Error("injected_publish_flip_failure");
          }
          let count = 0;
          for (const row of modelUpdates) {
            if (where.id && row.id !== where.id) continue;
            if (where.userId && row.userId !== where.userId) continue;
            if (where.visibility && row.visibility !== where.visibility) continue;
            if (
              where.isMeaningful !== undefined &&
              row.isMeaningful !== where.isMeaningful
            ) {
              continue;
            }
            const beforeVisibility = row.visibility;
            const beforeMeaningful = row.isMeaningful;
            const beforeDataVisibility = row.data.visibility;
            const beforeDataMeaningful = row.data.isMeaningful;
            if (data.visibility !== undefined) row.visibility = data.visibility;
            if (data.isMeaningful !== undefined) {
              row.isMeaningful = data.isMeaningful;
            }
            Object.assign(row.data, data);
            undoStack.push(() => {
              const adopted = proposals.some(
                (proposal) =>
                  proposal.modelUpdateId === row.id &&
                  proposal.status === ExploreMovementProposalStatus.published
              );
              if (adopted) return;
              row.visibility = beforeVisibility;
              row.isMeaningful = beforeMeaningful;
              row.data.visibility = beforeDataVisibility;
              row.data.isMeaningful = beforeDataMeaningful;
            });
            count += 1;
          }
          return { count };
        },
      },
      understandingEvidenceLink: {
        findFirst: db.understandingEvidenceLink.findFirst,
        upsert: async (argsInner: { create: Record<string, unknown> }) => {
          const shouldFail =
            typeof hooks.failUelUpsert === "function"
              ? hooks.failUelUpsert()
              : Boolean(hooks.failUelUpsert);
          if (shouldFail) {
            throw new Error("injected_uel_upsert_failure");
          }
          const created = argsInner.create;
          evidenceLinks.push(created);
          undoStack.push(() => {
            const idx = evidenceLinks.indexOf(created);
            if (idx >= 0) evidenceLinks.splice(idx, 1);
          });
          return created;
        },
      },
    };
  }

  // Explicit annotation breaks the circular $transaction → db inference.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    $queryRaw: async () => [],
    $transaction: async <T>(
      fn: (tx: ReturnType<typeof buildTransactionalClient>) => Promise<T>
    ): Promise<T> => {
      // Concurrent-safe: undo only this transaction's writes (no global queue).
      const undoStack: UndoFn[] = [];
      const tx = buildTransactionalClient(undoStack);
      try {
        return await fn(tx);
      } catch (error) {
        for (const undo of undoStack.reverse()) undo();
        throw error;
      }
    },
    session: {
      findFirst: async ({
        where,
      }: {
        where: { id?: string; userId?: string; surfaceType?: string };
      }) => {
        if (where.userId && where.userId !== SEMANTIC_USER_ID) return null;
        if (where.id && where.id !== sessionId) return null;
        if (where.surfaceType && where.surfaceType !== "explore_chat") return null;
        return { id: sessionId };
      },
    },
    message: {
      findFirst: async ({
        where,
      }: {
        where: {
          id?: string;
          userId?: string;
          sessionId?: string;
          role?: string;
        };
      }) => {
        if (where.role === "user") {
          if (where.id && where.id !== userMessage.id) return null;
          if (where.userId && where.userId !== userMessage.userId) return null;
          if (where.sessionId && where.sessionId !== userMessage.sessionId) {
            return null;
          }
          return { id: userMessage.id, role: "user" as const };
        }
        if (where.role === "assistant") {
          if (where.id && where.id !== assistantMessage.id) return null;
          if (where.userId && where.userId !== assistantMessage.userId) return null;
          if (
            where.sessionId &&
            where.sessionId !== assistantMessage.sessionId
          ) {
            return null;
          }
          return { id: assistantMessage.id, role: "assistant" as const };
        }
        if (where.id && where.userId) {
          const owned = findOwned("message", where.id, where.userId);
          if (!owned) return null;
          const role = messageRoleForId(where.id);
          if (!role) return null;
          return { id: owned.id, role };
        }
        return null;
      },
      updateMany: async () => ({ count: 1 }),
    },
    userMapConclusion: {
      findMany: async ({ where }: { where: { userId?: string } }) => {
        if (where.userId && where.userId !== umc.userId) return [];
        return [umc];
      },
      findFirst: async ({
        where,
      }: {
        where: { id?: string; userId?: string };
      }) => {
        if (where.userId && where.userId !== umc.userId) return null;
        if (where.id && where.id !== umc.id) return null;
        if (args?.foreignUmc && where.userId === FOREIGN_USER_ID) return null;
        return umc;
      },
      update: async () => {
        throw new Error("UMC mutation must not occur in DEL-001B");
      },
    },
    exploreMovementProposal: {
      findFirst: async ({
        where,
      }: {
        where: Record<string, unknown>;
      }) => {
        return (
          proposals.find((row) => matchesProposalWhere(row, where)) ?? null
        );
      },
      create: async ({ data }: { data: ProposalRow & { id?: string } }) => {
        if (hooks.beforeProposalCreate) {
          await hooks.beforeProposalCreate();
        }
        const id = data.id ?? `proposal_${proposals.length + 1}`;
        if (proposals.some((row) => row.id === id)) {
          const err = new Error("Unique constraint failed") as Error & {
            code: string;
          };
          err.code = "P2002";
          throw err;
        }
        const row = {
          ...data,
          id,
          status: data.status ?? ExploreMovementProposalStatus.proposed,
          modelUpdateId: data.modelUpdateId ?? null,
        };
        proposals.push(row);
        hooks.afterProposalCreate?.();
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<ProposalRow>;
      }) => {
        const row = proposals.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error("missing proposal");
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<ProposalRow>;
      }) => {
        let count = 0;
        for (const row of proposals) {
          if (!matchesProposalWhere(row, where)) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
    },
    modelUpdate: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id =
          typeof data.id === "string" && data.id.length > 0
            ? data.id
            : `mu_${modelUpdates.length + 1}`;
        if (modelUpdates.some((row) => row.id === id)) {
          const err = new Error("Unique constraint failed") as Error & {
            code: string;
          };
          err.code = "P2002";
          throw err;
        }
        const row: ModelUpdateRow = {
          id,
          userId: String(data.userId ?? ""),
          visibility: String(data.visibility ?? "internal_only"),
          isMeaningful: Boolean(data.isMeaningful ?? false),
          data: { ...data, id },
        };
        modelUpdates.push(row);
        return { id };
      },
      createMany: async ({
        data,
        skipDuplicates,
      }: {
        data: Array<Record<string, unknown>>;
        skipDuplicates?: boolean;
      }) => {
        let count = 0;
        for (const item of data) {
          const id =
            typeof item.id === "string" && item.id.length > 0
              ? item.id
              : `mu_${modelUpdates.length + 1}`;
          if (modelUpdates.some((row) => row.id === id)) {
            if (skipDuplicates) continue;
            const err = new Error("Unique constraint failed") as Error & {
              code: string;
            };
            err.code = "P2002";
            throw err;
          }
          const row: ModelUpdateRow = {
            id,
            userId: String(item.userId ?? ""),
            visibility: String(item.visibility ?? "internal_only"),
            isMeaningful: Boolean(item.isMeaningful ?? false),
            data: { ...item, id },
          };
          modelUpdates.push(row);
          count += 1;
        }
        return { count };
      },
      findFirst: async ({
        where,
      }: {
        where: {
          id?: string;
          userId?: string;
          visibility?: string;
          isMeaningful?: boolean;
        };
        select?: Record<string, boolean>;
      }) => {
        const found = modelUpdates.find((row) => {
          if (where.id && row.id !== where.id) return false;
          if (where.userId && row.userId !== where.userId) return false;
          if (where.visibility && row.visibility !== where.visibility) {
            return false;
          }
          if (
            where.isMeaningful !== undefined &&
            row.isMeaningful !== where.isMeaningful
          ) {
            return false;
          }
          return true;
        });
        if (!found) return null;
        return {
          id: found.id,
          userId: found.userId,
          visibility: found.visibility,
          isMeaningful: found.isMeaningful,
          updateType: found.data.updateType,
          affectedObjectType: found.data.affectedObjectType,
          affectedObjectId: found.data.affectedObjectId,
          beforeSummary: found.data.beforeSummary,
          afterSummary: found.data.afterSummary,
          userFacingSummary: found.data.userFacingSummary,
          internalNotes: found.data.internalNotes,
          ...found.data,
        };
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id?: string;
          userId?: string;
          visibility?: string;
          isMeaningful?: boolean;
        };
        data: { visibility?: string; isMeaningful?: boolean };
      }) => {
        const shouldFail =
          typeof hooks.failPublishFlip === "function"
            ? hooks.failPublishFlip()
            : Boolean(hooks.failPublishFlip);
        if (shouldFail) {
          throw new Error("injected_publish_flip_failure");
        }
        let count = 0;
        for (const row of modelUpdates) {
          if (where.id && row.id !== where.id) continue;
          if (where.userId && row.userId !== where.userId) continue;
          if (where.visibility && row.visibility !== where.visibility) continue;
          if (
            where.isMeaningful !== undefined &&
            row.isMeaningful !== where.isMeaningful
          ) {
            continue;
          }
          if (data.visibility !== undefined) row.visibility = data.visibility;
          if (data.isMeaningful !== undefined) {
            row.isMeaningful = data.isMeaningful;
          }
          Object.assign(row.data, data);
          count += 1;
        }
        return { count };
      },
    },
    understandingEvidenceLink: {
      findFirst: async ({
        where,
      }: {
        where: {
          userId?: string;
          targetType?: string;
          targetId?: string;
        };
      }) => {
        const found = evidenceLinks.find((row) => {
          if (where.userId && row.userId !== where.userId) return false;
          if (where.targetType && row.targetType !== where.targetType) {
            return false;
          }
          if (where.targetId && row.targetId !== where.targetId) return false;
          return true;
        });
        return found ? { id: "uel_found" } : null;
      },
      upsert: async (argsInner: { create: Record<string, unknown> }) => {
        const shouldFail =
          typeof hooks.failUelUpsert === "function"
            ? hooks.failUelUpsert()
            : Boolean(hooks.failUelUpsert);
        if (shouldFail) {
          throw new Error("injected_uel_upsert_failure");
        }
        evidenceLinks.push(argsInner.create);
        return argsInner.create;
      },
    },
    evidencePointerSurfacingRationale: {
      findFirst: async () => null,
    },
    journalEntry: {
      findMany: async () => [],
      findFirst: async ({
        where,
      }: {
        where: { id?: string; userId?: string };
      }) => {
        if (!where.id || !where.userId) return null;
        return findOwned("journal_entry", where.id, where.userId);
      },
    },
    patternClaimEvidence: {
      findMany: async () => [],
      findFirst: async ({
        where,
      }: {
        where: { id?: string; claim?: { userId?: string } };
      }) => {
        if (!where.id || !where.claim?.userId) return null;
        return findOwned(
          "pattern_claim_evidence",
          where.id,
          where.claim.userId
        );
      },
    },
    referenceItem: {
      findMany: async () => [],
      findFirst: async () => null,
    },
    patternClaim: { findFirst: async () => null },
    contradictionNode: { findFirst: async () => null },
    contradictionEvidence: { findFirst: async () => null },
    profileArtifact: { findFirst: async () => null },
    evidenceSpan: { findFirst: async () => null },
    surfacedAction: { findFirst: async () => null },
    quickCheckIn: { findFirst: async () => null },
    importUploadSession: { findFirst: async () => null },
    importUploadChunk: { findFirst: async () => null },
    investigation: { findFirst: async () => null },
    fieldworkAssignment: { findFirst: async () => null },
  };

  // Silence unused helpers retained for optional harness introspection.
  void snapshotState;
  void restoreState;

  return {
    db: db as unknown as PrismaClient,
    proposals,
    modelUpdates,
    evidenceLinks,
    umc,
    sessionId,
    raw: db,
    hooks,
    callBudget: createExploreMovementCallBudget(2) as ExploreMovementCallBudget,
  };
}
