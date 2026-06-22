import {
  CandidateLifecycleStatus,
  FieldworkStatus,
  InvestigationSeedType,
  InvestigationStatus,
  ModelUpdateType,
  ReferenceConfidence,
  ReferenceType,
  SessionOrigin,
  SessionSurfaceType,
  UnderstandingLinkTargetType,
  UserMapConfidenceLevel,
  UserMapConclusionArea,
  UserMapConclusionStatus,
  type PrismaClient,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  EXPLORE_CONVERSATION_REVIEW_FORBIDDEN_RESPONSE_FIELDS,
  getExploreConversationReviewItems,
  projectFieldworkCandidateToExploreReviewItem,
  projectInvestigationCandidateToExploreReviewItem,
  projectModelUpdateCandidateToExploreReviewItem,
  projectReferenceCandidateToExploreReviewItem,
  projectUserMapCandidateToExploreReviewItem,
} from "../explore-conversation-review";

function expectNoForbiddenFields(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const field of EXPLORE_CONVERSATION_REVIEW_FORBIDDEN_RESPONSE_FIELDS) {
    expect(serialized).not.toContain(field);
  }
}

describe("Explore conversation review projection", () => {
  it("projects internal UserMap candidates as draft context/profile updates only", () => {
    const item = projectUserMapCandidateToExploreReviewItem({
      id: "umc-internal-1",
      title: "Execution pattern may be forming",
      summary: "The conversation suggests a possible execution pattern, but it still needs user review.",
      area: UserMapConclusionArea.operating_logic,
      status: UserMapConclusionStatus.emerging,
      confidenceLevel: UserMapConfidenceLevel.low,
      candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
      updatedAt: new Date("2026-06-22T10:00:00.000Z"),
    });

    expect(item.kind).toBe("context_profile_update");
    expect(item.status).toBe("needs_review");
    expect(item.id).not.toContain("umc-internal-1");
    expect(item.selectableObject).toBeNull();
    expect(item.actions).toEqual({ canConfirm: false, canEdit: false, canReject: false });
    expect(item.sourceLabel).toContain("Draft map item");
    expectNoForbiddenFields(item);
  });

  it("projects Investigation candidates as draft active questions without operator state", () => {
    const item = projectInvestigationCandidateToExploreReviewItem({
      id: "inv-internal-1",
      title: "What is driving the avoidance loop?",
      organizingQuestion: "Is this mainly pressure, unclear priority, or identity friction?",
      status: InvestigationStatus.open,
      seedType: InvestigationSeedType.model_uncertainty,
      candidateLifecycleStatus: CandidateLifecycleStatus.held_for_more_evidence,
      updatedAt: new Date("2026-06-22T10:01:00.000Z"),
    });

    expect(item.kind).toBe("active_question_proposed");
    expect(item.status).toBe("deferred");
    expect(item.sourceLabel).toContain("Draft active question");
    expect(item.selectableObject).toBeNull();
    expectNoForbiddenFields(item);
  });

  it("projects Fieldwork candidates as review-only suggestions", () => {
    const item = projectFieldworkCandidateToExploreReviewItem({
      id: "fw-internal-1",
      prompt: "Watch for the first moment you start speeding up under pressure.",
      reason: "This would test whether urgency is narrowing the next action.",
      status: FieldworkStatus.assigned,
      linkedObjectType: UnderstandingLinkTargetType.pattern_claim,
      linkedObjectId: "pattern-1",
      candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
      updatedAt: new Date("2026-06-22T10:02:00.000Z"),
    });

    expect(item.kind).toBe("fieldwork_suggestion");
    expect(item.status).toBe("needs_review");
    expect(item.linkedObjectHref).toBe("/patterns/pattern-1");
    expect(item.actions.canConfirm).toBe(false);
    expectNoForbiddenFields(item);
  });

  it("projects internal ModelUpdate candidates as possible movement, not published movement", () => {
    const item = projectModelUpdateCandidateToExploreReviewItem({
      id: "mu-internal-1",
      updateType: ModelUpdateType.conclusion_strengthened,
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: "umc-1",
      userFacingSummary: "A possible update was detected, but it is not added to the Map yet.",
      createdAt: new Date("2026-06-22T10:03:00.000Z"),
    });

    expect(item.kind).toBe("model_update_candidate");
    expect(item.status).toBe("needs_review");
    expect(item.sourceLabel).toBe("Draft possible movement");
    expect(item.linkedObjectHref).toBeUndefined();
    expect(item.selectableObject).toBeNull();
    expectNoForbiddenFields(item);
  });

  it("projects reference memory candidates as draft context updates", () => {
    const item = projectReferenceCandidateToExploreReviewItem({
      id: "ref-candidate-1",
      type: ReferenceType.goal,
      statement: "User wants the product to surface model movement clearly.",
      confidence: ReferenceConfidence.medium,
      updatedAt: new Date("2026-06-22T10:04:00.000Z"),
    });

    expect(item.kind).toBe("context_profile_update");
    expect(item.status).toBe("needs_review");
    expect(item.sourceLabel).toBe("Draft context/profile update");
    expect(item.id).not.toContain("ref-candidate-1");
    expectNoForbiddenFields(item);
  });
});

describe("Explore conversation review item source lookup", () => {
  it("requires an owned APP explore_chat session before returning review items", async () => {
    const sessionFindFirst = vi.fn().mockResolvedValue(null);
    const db = {
      session: { findFirst: sessionFindFirst },
    } as unknown as PrismaClient;

    const result = await getExploreConversationReviewItems({
      userId: "user-1",
      sessionId: "session-1",
      db,
    });

    expect(result).toEqual({ sessionFound: false, sourceAvailable: true, items: [] });
    expect(sessionFindFirst).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        origin: SessionOrigin.APP,
        surfaceType: SessionSurfaceType.explore_chat,
      },
      select: { id: true },
    });
  });

  it("returns an honest empty state when no session-linked review source exists", async () => {
    const db = {
      session: { findFirst: vi.fn().mockResolvedValue({ id: "session-1" }) },
      message: { findMany: vi.fn().mockResolvedValue([]) },
      patternClaimEvidence: { findMany: vi.fn().mockResolvedValue([]) },
      contradictionEvidence: { findMany: vi.fn().mockResolvedValue([]) },
      referenceItem: { findMany: vi.fn().mockResolvedValue([]) },
      understandingEvidenceLink: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;

    const result = await getExploreConversationReviewItems({
      userId: "user-1",
      sessionId: "session-1",
      db,
    });

    expect(result).toEqual({ sessionFound: true, sourceAvailable: true, items: [] });
  });
});
