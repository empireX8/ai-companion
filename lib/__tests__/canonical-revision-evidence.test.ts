import { describe, expect, it, vi } from "vitest";
import {
  UnderstandingLinkRole,
  UnderstandingLinkSourceType,
  UnderstandingLinkTargetType,
  CanonicalConceptDomain,
  CanonicalRevisionStatus,
  UserMapConclusionArea,
  UserMapConclusionStatus,
} from "@prisma/client";

import {
  prepareCanonicalProposalEvidence,
  prepareCanonicalRegistrationEvidence,
} from "../canonical-revision-evidence";
import { CanonicalModelAuthorityError } from "../canonical-model-authority-errors";
import {
  mapUserMapAreaToCanonicalDomain,
  mapUserMapStatusToCanonicalRevisionStatus,
} from "../canonical-domain-mappings";
import type { ExploreGroundingSource } from "../explore-grounding-contract";
import { isSupportedEvidenceLinkPair } from "../orvek-intelligence-object-authority";

function makeSource(
  overrides: Partial<ExploreGroundingSource> &
    Pick<ExploreGroundingSource, "sourceId" | "sourceType">,
): ExploreGroundingSource {
  return {
    sourceFamily: overrides.sourceType,
    userId: "user_1",
    title: "t",
    extract: "extract text",
    retrievalReason: "reason",
    claimSupport: "verifies",
    epistemicStatus: "VERIFIED",
    ...overrides,
  };
}

type LineageMessage = {
  id: string;
  userId: string;
  sessionId: string;
  role: string;
} | null;

type LineageSession = {
  id: string;
  userId: string;
  surfaceType: string | null;
} | null;

function matchesMessage(
  row: LineageMessage,
  where: { id: string; userId?: string; sessionId?: string; role?: string },
): LineageMessage {
  if (!row || row.id !== where.id) return null;
  if (where.userId && row.userId !== where.userId) return null;
  if (where.sessionId && row.sessionId !== where.sessionId) return null;
  if (where.role && row.role !== where.role) return null;
  return row;
}

function validLineageDb(overrides?: {
  session?: LineageSession;
  userMessage?: LineageMessage;
  assistantMessage?: LineageMessage;
}) {
  const session: LineageSession =
    overrides && "session" in overrides
      ? overrides.session ?? null
      : { id: "sess_1", userId: "user_1", surfaceType: "explore_chat" };
  const userMessage: LineageMessage =
    overrides && "userMessage" in overrides
      ? overrides.userMessage ?? null
      : {
          id: "msg_user",
          userId: "user_1",
          sessionId: "sess_1",
          role: "user",
        };
  const assistantMessage: LineageMessage =
    overrides && "assistantMessage" in overrides
      ? overrides.assistantMessage ?? null
      : {
          id: "msg_asst",
          userId: "user_1",
          sessionId: "sess_1",
          role: "assistant",
        };

  return {
    session: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { id: string; userId?: string; surfaceType?: string | null };
        }) => {
          if (!session) return null;
          if (session.id !== where.id) return null;
          if (where.userId && session.userId !== where.userId) return null;
          return session;
        },
      ),
    },
    message: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            id: string;
            userId?: string;
            sessionId?: string;
            role?: string;
          };
        }) => {
          if (where.id === "msg_bad") {
            return matchesMessage(
              {
                id: "msg_bad",
                userId: "user_1",
                sessionId: "sess_1",
                role: "assistant",
              },
              where,
            );
          }
          return (
            matchesMessage(userMessage, where) ??
            matchesMessage(assistantMessage, where)
          );
        },
      ),
    },
    journalEntry: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
      })),
    },
  };
}

describe("canonical domain mappings", () => {
  it("maps every UserMapConclusionArea explicitly and unknown otherwise", () => {
    expect(
      mapUserMapAreaToCanonicalDomain(UserMapConclusionArea.operating_logic),
    ).toBe(CanonicalConceptDomain.operating_logic);
    expect(mapUserMapAreaToCanonicalDomain("not_a_real_area")).toBe(
      CanonicalConceptDomain.unknown,
    );
  });

  it("maps qualifying statuses and fails closed on superseded", () => {
    expect(
      mapUserMapStatusToCanonicalRevisionStatus(
        UserMapConclusionStatus.emerging,
      ),
    ).toBe(CanonicalRevisionStatus.emerging);
    expect(() =>
      mapUserMapStatusToCanonicalRevisionStatus(
        UserMapConclusionStatus.superseded,
      ),
    ).toThrow(CanonicalModelAuthorityError);
  });
});

describe("canonical revision evidence preparation", () => {
  it("extends allowlist so ownership-verifiable sources may target canonical_concept_revision", () => {
    expect(
      isSupportedEvidenceLinkPair({
        sourceType: "journal_entry",
        targetType: "canonical_concept_revision",
      }),
    ).toBe(true);
    expect(
      isSupportedEvidenceLinkPair({
        sourceType: "timeline_aggregation",
        targetType: "canonical_concept_revision",
      }),
    ).toBe(false);
  });

  it("registration evidence omits unowned sources and counts only supports", async () => {
    const db = {
      understandingEvidenceLink: {
        findMany: vi.fn(async () => [
          {
            sourceType: UnderstandingLinkSourceType.journal_entry,
            sourceId: "owned_src",
            role: UnderstandingLinkRole.supports,
            summary: "s",
            snippet: "sn",
            quote: "q",
          },
          {
            sourceType: UnderstandingLinkSourceType.journal_entry,
            sourceId: "missing_src",
            role: UnderstandingLinkRole.supports,
            summary: "s2",
            snippet: "sn2",
            quote: "q2",
          },
          {
            sourceType: UnderstandingLinkSourceType.session,
            sourceId: "ctx_src",
            role: UnderstandingLinkRole.context,
            summary: "c",
            snippet: "c",
            quote: "c",
          },
          {
            sourceType: UnderstandingLinkSourceType.journal_entry,
            sourceId: "owned_src",
            role: UnderstandingLinkRole.supports,
            summary: "dup",
            snippet: "dup",
            quote: "dup",
          },
        ]),
      },
      journalEntry: {
        findFirst: vi.fn(
          async ({ where }: { where: { id: string } }) =>
            where.id === "owned_src" ? { id: where.id } : null,
        ),
      },
      session: {
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ({
          id: where.id,
        })),
      },
    };

    const result = await prepareCanonicalRegistrationEvidence({
      userId: "user_1",
      userMapConclusionId: "umc_1",
      db: db as never,
    });

    expect(result.links.map((l) => l.sourceId).sort()).toEqual([
      "ctx_src",
      "owned_src",
    ]);
    expect(result.supportingLinkCount).toBe(1);
    expect(db.understandingEvidenceLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetType: UnderstandingLinkTargetType.usermap_conclusion,
          targetId: "umc_1",
          userId: "user_1",
        }),
      }),
    );
  });

  it("registration evidence yields zero when no supports resolve", async () => {
    const db = {
      understandingEvidenceLink: {
        findMany: vi.fn(async () => []),
      },
    };
    const result = await prepareCanonicalRegistrationEvidence({
      userId: "user_1",
      userMapConclusionId: "umc_1",
      db: db as never,
    });
    expect(result.links).toEqual([]);
    expect(result.supportingLinkCount).toBe(0);
  });

  it("proposal evidence forces assistant to context and allows user supports", async () => {
    const db = validLineageDb();

    const result = await prepareCanonicalProposalEvidence({
      userId: "user_1",
      conversationId: "sess_1",
      assistantMessageId: "msg_asst",
      userMessageId: "msg_user",
      sources: [
        makeSource({
          sourceId: "journal_1",
          sourceType: "journal_entry",
          claimSupport: "verifies",
        }),
      ],
      db: db as never,
    });

    const asst = result.links.find((l) => l.sourceId === "msg_asst");
    const user = result.links.find((l) => l.sourceId === "msg_user");
    const journal = result.links.find((l) => l.sourceId === "journal_1");
    expect(asst?.role).toBe(UnderstandingLinkRole.context);
    expect(user?.role).toBe(UnderstandingLinkRole.supports);
    expect(journal?.role).toBe(UnderstandingLinkRole.supports);
    expect(result.supportingLinkCount).toBe(2);
  });

  it("rejects when userMessageId identifies an assistant message", async () => {
    const db = validLineageDb({
      userMessage: {
        id: "msg_user",
        userId: "user_1",
        sessionId: "sess_1",
        role: "assistant",
      },
    });

    await expect(
      prepareCanonicalProposalEvidence({
        userId: "user_1",
        conversationId: "sess_1",
        assistantMessageId: "msg_asst",
        userMessageId: "msg_user",
        sources: [],
        db: db as never,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EVIDENCE_OWNERSHIP",
    } satisfies Partial<CanonicalModelAuthorityError>);
  });

  it("rejects when assistantMessageId identifies a user message", async () => {
    const db = validLineageDb({
      assistantMessage: {
        id: "msg_asst",
        userId: "user_1",
        sessionId: "sess_1",
        role: "user",
      },
    });

    await expect(
      prepareCanonicalProposalEvidence({
        userId: "user_1",
        conversationId: "sess_1",
        assistantMessageId: "msg_asst",
        userMessageId: "msg_user",
        sources: [],
        db: db as never,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EVIDENCE_OWNERSHIP",
    } satisfies Partial<CanonicalModelAuthorityError>);
  });

  it("rejects when either message belongs to another session", async () => {
    const db = validLineageDb({
      userMessage: {
        id: "msg_user",
        userId: "user_1",
        sessionId: "other_sess",
        role: "user",
      },
    });

    await expect(
      prepareCanonicalProposalEvidence({
        userId: "user_1",
        conversationId: "sess_1",
        assistantMessageId: "msg_asst",
        userMessageId: "msg_user",
        sources: [],
        db: db as never,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EVIDENCE_OWNERSHIP",
    } satisfies Partial<CanonicalModelAuthorityError>);
  });

  it("rejects when the session is not explore_chat", async () => {
    const db = validLineageDb({
      session: {
        id: "sess_1",
        userId: "user_1",
        surfaceType: "journal_chat",
      },
    });

    await expect(
      prepareCanonicalProposalEvidence({
        userId: "user_1",
        conversationId: "sess_1",
        assistantMessageId: "msg_asst",
        userMessageId: "msg_user",
        sources: [],
        db: db as never,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EVIDENCE_OWNERSHIP",
    } satisfies Partial<CanonicalModelAuthorityError>);
  });

  it("rejects when either lineage row is unowned or missing", async () => {
    const db = validLineageDb({ session: null });

    await expect(
      prepareCanonicalProposalEvidence({
        userId: "user_1",
        conversationId: "sess_1",
        assistantMessageId: "msg_asst",
        userMessageId: "msg_user",
        sources: [],
        db: db as never,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EVIDENCE_OWNERSHIP",
    } satisfies Partial<CanonicalModelAuthorityError>);
  });

  it("proposal evidence fails closed when a cited message is assistant-role", async () => {
    const db = validLineageDb();

    await expect(
      prepareCanonicalProposalEvidence({
        userId: "user_1",
        conversationId: "sess_1",
        assistantMessageId: "msg_asst",
        userMessageId: "msg_user",
        sources: [
          makeSource({
            sourceId: "msg_bad",
            sourceType: "message",
            claimSupport: "verifies",
          }),
        ],
        db: db as never,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_EVIDENCE_OWNERSHIP",
    } satisfies Partial<CanonicalModelAuthorityError>);
  });
});
