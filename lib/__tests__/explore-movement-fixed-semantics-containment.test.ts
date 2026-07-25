import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExploreMovementProposalStatus,
  UnderstandingLinkTargetType,
  type PrismaClient,
} from "@prisma/client";

import {
  EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS,
  matchesUnsafeFixedExploreMovementSignature,
  UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE,
  UNSAFE_FIXED_EXPLORE_MOVEMENT_USER_FACING_SUMMARY,
} from "../explore-movement-fixed-semantics-containment";
import type { ExploreGroundingCandidate } from "../explore-grounding-retrieval";
import type { ExploreGroundingSource } from "../explore-grounding-contract";

const USER_ID = "user_fixed_semantics_containment";
const FOREIGN_USER_ID = "user_fixed_semantics_foreign";
const PROPOSAL_ID = "proposal_unsafe_fixed_1";
const SAFE_PROPOSAL_ID = "proposal_safe_legitimate_1";

vi.mock("../explore-grounding-retrieval", async () => {
  const actual = await vi.importActual<
    typeof import("../explore-grounding-retrieval")
  >("../explore-grounding-retrieval");
  return {
    ...actual,
    collectOwnedExploreGroundingCandidates: vi.fn(),
  };
});

vi.mock("../model-update-candidate-publish-helper", () => {
  class PublishModelUpdateCandidateError extends Error {
    code: string;
    constructor(code: string, message?: string) {
      super(message ?? code);
      this.code = code;
    }
  }
  return {
    PublishModelUpdateCandidateError,
    publishModelUpdateCandidate: vi.fn(
      async (userId: string, id: string) => ({
        id,
        userId,
        previousVisibility: "internal_only",
        newVisibility: "user_visible",
        previousIsMeaningful: false,
        newIsMeaningful: true,
      })
    ),
  };
});

import { collectOwnedExploreGroundingCandidates } from "../explore-grounding-retrieval";
import { orchestrateExploreReplyGrounding } from "../explore-grounding-orchestrator";
import {
  publishExploreMovementProposal,
  rejectExploreMovementProposal,
} from "../explore-movement-proposal";
import { publishModelUpdateCandidate } from "../model-update-candidate-publish-helper";

const collectOwnedMock = vi.mocked(collectOwnedExploreGroundingCandidates);
const publishCandidateMock = vi.mocked(publishModelUpdateCandidate);

function ownedCandidates(): ExploreGroundingCandidate[] {
  return [
    {
      sourceId: "journal-verified",
      sourceType: "journal_entry",
      sourceFamily: "journal_entry",
      userId: USER_ID,
      title: "Verified journal",
      extract: "I ignore stop point evenings repeatedly when tired.",
      tokens: ["ignore", "stop", "point", "evenings", "repeatedly", "tired"],
    },
    {
      sourceId: "pattern-inferred",
      sourceType: "pattern_claim_evidence",
      sourceFamily: "pattern_claim_evidence",
      userId: USER_ID,
      title: "Inferred pattern",
      extract: "Named boundary matters for recovery energy after work.",
      tokens: ["named", "boundary", "matters", "recovery", "energy", "work"],
    },
  ];
}

function unsafeSignatureFields(title = "Evening recovery pattern") {
  return {
    afterSummary: `Explore evidence suggests refining: ${title} with stop-point sensitivity after meetings.`,
    rationale: UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE,
    userFacingSummary: UNSAFE_FIXED_EXPLORE_MOVEMENT_USER_FACING_SUMMARY,
  };
}

function sampleSources(): ExploreGroundingSource[] {
  return [
    {
      sourceId: "journal-verified",
      sourceType: "journal_entry",
      sourceFamily: "journal_entry",
      userId: USER_ID,
      title: "Verified journal",
      extract: "stop point after meetings",
      retrievalReason: "overlap",
      claimSupport: "verifies",
      epistemicStatus: "VERIFIED",
    },
    {
      sourceId: "pattern-inferred",
      sourceType: "pattern_claim_evidence",
      sourceFamily: "pattern_claim_evidence",
      userId: USER_ID,
      title: "Inferred pattern",
      extract: "named boundary",
      retrievalReason: "overlap",
      claimSupport: "infers",
      epistemicStatus: "INFERRED",
    },
  ];
}

type ProposalRow = {
  id: string;
  userId: string;
  conversationId: string;
  assistantMessageId: string;
  userMessageId: string;
  status: ExploreMovementProposalStatus;
  affectedObjectType: UnderstandingLinkTargetType;
  affectedObjectId: string;
  beforeSummary: string;
  afterSummary: string;
  rationale: string;
  userFacingSummary: string;
  sourcesJson: ExploreGroundingSource[];
  modelUpdateId: string | null;
};

function makeProposalDb(seed: ProposalRow[]) {
  const rows = seed.map((row) => ({ ...row }));
  const modelUpdates: Array<{ id: string }> = [];
  const evidenceLinks: Array<Record<string, unknown>> = [];

  const db = {
    exploreMovementProposal: {
      findFirst: vi.fn(
        async ({ where }: { where: { id?: string; userId?: string } }) => {
          return (
            rows.find(
              (row) =>
                (!where.id || row.id === where.id) &&
                (!where.userId || row.userId === where.userId)
            ) ?? null
          );
        }
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<ProposalRow>;
        }) => {
          const row = rows.find((candidate) => candidate.id === where.id);
          if (!row) throw new Error("missing proposal");
          Object.assign(row, data);
          return row;
        }
      ),
    },
    modelUpdate: {
      create: vi.fn(async () => {
        const id = `mu_${modelUpdates.length + 1}`;
        modelUpdates.push({ id });
        return { id };
      }),
    },
    understandingEvidenceLink: {
      upsert: vi.fn(async (args: { create: Record<string, unknown> }) => {
        evidenceLinks.push(args.create);
        return args.create;
      }),
    },
  };

  return {
    db: db as unknown as PrismaClient,
    rows,
    modelUpdates,
    evidenceLinks,
    raw: db,
  };
}

describe("explore movement fixed-semantics containment", () => {
  beforeEach(() => {
    collectOwnedMock.mockReset();
    publishCandidateMock.mockClear();
    publishCandidateMock.mockImplementation(async (userId: string, id: string) => ({
      id,
      userId,
      previousVisibility: "internal_only" as const,
      newVisibility: "user_visible" as const,
      previousIsMeaningful: false,
      newIsMeaningful: true,
    }));
  });

  it("detects the exact unsafe fixed signature and rejects partial matches", () => {
    const exact = unsafeSignatureFields();
    expect(matchesUnsafeFixedExploreMovementSignature(exact)).toBe(true);

    expect(
      matchesUnsafeFixedExploreMovementSignature(
        unsafeSignatureFields("Evening\nrecovery\r\npattern")
      )
    ).toBe(true);

    expect(
      matchesUnsafeFixedExploreMovementSignature(unsafeSignatureFields(""))
    ).toBe(true);

    expect(
      matchesUnsafeFixedExploreMovementSignature({
        ...exact,
        rationale: "Different rationale",
      })
    ).toBe(false);

    expect(
      matchesUnsafeFixedExploreMovementSignature({
        ...exact,
        userFacingSummary: "Different summary",
      })
    ).toBe(false);

    expect(
      matchesUnsafeFixedExploreMovementSignature({
        ...exact,
        afterSummary: "Unrelated after summary about meetings",
      })
    ).toBe(false);
  });

  it("grounds owned evidence without creating a movement proposal when lexical gate would pass", async () => {
    collectOwnedMock.mockResolvedValue(ownedCandidates());

    const userMapConclusion = {
      findFirst: vi.fn(async () => ({
        id: "umc-1",
        title: "Evening recovery pattern",
        summary: "Prior summary",
      })),
    };
    const exploreMovementProposal = {
      create: vi.fn(),
    };
    const modelUpdate = {
      create: vi.fn(),
    };

    const db = {
      userMapConclusion,
      exploreMovementProposal,
      modelUpdate,
    } as unknown as PrismaClient;

    const result = await orchestrateExploreReplyGrounding({
      userId: USER_ID,
      db,
      conversationId: "session-1",
      assistantMessageId: "assistant-1",
      userMessageId: "user-1",
      userMessageContent: "stop point evenings named boundary",
      assistantReplyContent: "stop point evenings",
      createProposalWhenSufficient: true,
    });

    expect(result.proposalCreated).toBe(false);
    expect(result.payload.status).toBe("grounded");
    expect(result.payload.sources.length).toBeGreaterThanOrEqual(2);
    expect(
      result.payload.sources.some((source) => source.epistemicStatus === "VERIFIED")
    ).toBe(true);
    expect(
      result.payload.sources.some((source) => source.epistemicStatus === "INFERRED")
    ).toBe(true);
    expect(result.payload.movementProposal).toEqual({
      status: "insufficient_evidence",
      proposalId: null,
      modelUpdateId: null,
      beforeSummary: null,
      afterSummary: null,
      rationale: null,
    });

    const serialized = JSON.stringify(result.payload);
    expect(serialized).not.toContain("stop-point sensitivity after meetings");
    expect(serialized).not.toContain("evening stop-point signal after meetings");
    expect(serialized).not.toContain(UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE);
    expect(serialized).not.toContain(
      UNSAFE_FIXED_EXPLORE_MOVEMENT_USER_FACING_SUMMARY
    );

    expect(exploreMovementProposal.create).not.toHaveBeenCalled();
    expect(modelUpdate.create).not.toHaveBeenCalled();
    expect(userMapConclusion.findFirst).not.toHaveBeenCalled();
  });

  it("returns honest empty grounding without proposals when no owned evidence overlaps", async () => {
    collectOwnedMock.mockResolvedValue([]);

    const exploreMovementProposal = { create: vi.fn() };
    const modelUpdate = { create: vi.fn() };
    const db = {
      exploreMovementProposal,
      modelUpdate,
    } as unknown as PrismaClient;

    const result = await orchestrateExploreReplyGrounding({
      userId: USER_ID,
      db,
      conversationId: "session-empty",
      assistantMessageId: "assistant-empty",
      userMessageId: "user-empty",
      userMessageContent: "hello",
      assistantReplyContent: "hello back",
    });

    expect(result.proposalCreated).toBe(false);
    expect(result.payload.status).toBe("ungrounded");
    expect(result.payload.sources).toEqual([]);
    expect(result.payload.movementProposal.status).toBe("none");
    expect(exploreMovementProposal.create).not.toHaveBeenCalled();
    expect(modelUpdate.create).not.toHaveBeenCalled();
  });

  it("blocks publish of an existing unsafe fixed proposal before ModelUpdate creation", async () => {
    const unsafe = unsafeSignatureFields();
    const { db, rows, modelUpdates, evidenceLinks, raw } = makeProposalDb([
      {
        id: PROPOSAL_ID,
        userId: USER_ID,
        conversationId: "session-1",
        assistantMessageId: "assistant-1",
        userMessageId: "user-1",
        status: ExploreMovementProposalStatus.proposed,
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
        affectedObjectId: "umc-1",
        beforeSummary: "Prior summary",
        afterSummary: unsafe.afterSummary,
        rationale: unsafe.rationale,
        userFacingSummary: unsafe.userFacingSummary,
        sourcesJson: sampleSources(),
        modelUpdateId: null,
      },
    ]);

    const result = await publishExploreMovementProposal({
      userId: USER_ID,
      proposalId: PROPOSAL_ID,
      db,
    });

    expect(result).toBe(EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS);
    expect(raw.modelUpdate.create).not.toHaveBeenCalled();
    expect(raw.understandingEvidenceLink.upsert).not.toHaveBeenCalled();
    expect(raw.exploreMovementProposal.update).not.toHaveBeenCalled();
    expect(publishCandidateMock).not.toHaveBeenCalled();
    expect(modelUpdates).toHaveLength(0);
    expect(evidenceLinks).toHaveLength(0);
    expect(rows[0]?.status).toBe(ExploreMovementProposalStatus.proposed);
    expect(rows[0]?.modelUpdateId).toBeNull();
  });

  it("keeps foreign-user proposal access blocked", async () => {
    const unsafe = unsafeSignatureFields();
    const { db, raw } = makeProposalDb([
      {
        id: PROPOSAL_ID,
        userId: USER_ID,
        conversationId: "session-1",
        assistantMessageId: "assistant-1",
        userMessageId: "user-1",
        status: ExploreMovementProposalStatus.proposed,
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
        affectedObjectId: "umc-1",
        beforeSummary: "Prior summary",
        afterSummary: unsafe.afterSummary,
        rationale: unsafe.rationale,
        userFacingSummary: unsafe.userFacingSummary,
        sourcesJson: sampleSources(),
        modelUpdateId: null,
      },
    ]);

    const result = await publishExploreMovementProposal({
      userId: FOREIGN_USER_ID,
      proposalId: PROPOSAL_ID,
      db,
    });

    expect(result).toBe("not_found");
    expect(raw.modelUpdate.create).not.toHaveBeenCalled();
  });

  it("preserves reject behaviour for unsafe proposed rows", async () => {
    const unsafe = unsafeSignatureFields();
    const { db, rows, raw } = makeProposalDb([
      {
        id: PROPOSAL_ID,
        userId: USER_ID,
        conversationId: "session-1",
        assistantMessageId: "assistant-1",
        userMessageId: "user-1",
        status: ExploreMovementProposalStatus.proposed,
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
        affectedObjectId: "umc-1",
        beforeSummary: "Prior summary",
        afterSummary: unsafe.afterSummary,
        rationale: unsafe.rationale,
        userFacingSummary: unsafe.userFacingSummary,
        sourcesJson: sampleSources(),
        modelUpdateId: null,
      },
    ]);

    const result = await rejectExploreMovementProposal({
      userId: USER_ID,
      proposalId: PROPOSAL_ID,
      db,
    });

    expect(result).toEqual({ proposalId: PROPOSAL_ID, status: "rejected" });
    expect(rows[0]?.status).toBe(ExploreMovementProposalStatus.rejected);
    expect(rows[0]?.modelUpdateId).toBeNull();
    expect(raw.modelUpdate.create).not.toHaveBeenCalled();
  });

  it("preserves already-published idempotency even for the legacy unsafe signature", async () => {
    const unsafe = unsafeSignatureFields();
    const { db, raw } = makeProposalDb([
      {
        id: PROPOSAL_ID,
        userId: USER_ID,
        conversationId: "session-1",
        assistantMessageId: "assistant-1",
        userMessageId: "user-1",
        status: ExploreMovementProposalStatus.published,
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
        affectedObjectId: "umc-1",
        beforeSummary: "Prior summary",
        afterSummary: unsafe.afterSummary,
        rationale: unsafe.rationale,
        userFacingSummary: unsafe.userFacingSummary,
        sourcesJson: sampleSources(),
        modelUpdateId: "mu_already_published",
      },
    ]);

    const result = await publishExploreMovementProposal({
      userId: USER_ID,
      proposalId: PROPOSAL_ID,
      db,
    });

    expect(result).toEqual({
      modelUpdateId: "mu_already_published",
      status: "published",
      idempotent: true,
    });
    expect(raw.modelUpdate.create).not.toHaveBeenCalled();
    expect(raw.understandingEvidenceLink.upsert).not.toHaveBeenCalled();
    expect(raw.exploreMovementProposal.update).not.toHaveBeenCalled();
  });

  it("still publishes a non-unsafe proposed row", async () => {
    const { db, rows, modelUpdates, evidenceLinks, raw } = makeProposalDb([
      {
        id: SAFE_PROPOSAL_ID,
        userId: USER_ID,
        conversationId: "session-safe",
        assistantMessageId: "assistant-safe",
        userMessageId: "user-safe",
        status: ExploreMovementProposalStatus.proposed,
        affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
        affectedObjectId: "umc-safe",
        beforeSummary: "Prior summary",
        afterSummary: "Conversation-specific after summary from adjudicated movement.",
        rationale: "Conversation-specific rationale grounded in owned evidence.",
        userFacingSummary: "Possible model movement from Explore unit-safe path",
        sourcesJson: sampleSources(),
        modelUpdateId: null,
      },
    ]);

    const result = await publishExploreMovementProposal({
      userId: USER_ID,
      proposalId: SAFE_PROPOSAL_ID,
      db,
    });

    expect(result).toEqual({
      modelUpdateId: "mu_1",
      status: "published",
      idempotent: false,
    });
    expect(raw.modelUpdate.create).toHaveBeenCalledTimes(1);
    expect(raw.understandingEvidenceLink.upsert).toHaveBeenCalled();
    expect(evidenceLinks.length).toBeGreaterThan(0);
    expect(publishCandidateMock).toHaveBeenCalledTimes(1);
    expect(modelUpdates).toHaveLength(1);
    expect(rows[0]?.status).toBe(ExploreMovementProposalStatus.published);
    expect(rows[0]?.modelUpdateId).toBe("mu_1");
  });
});
