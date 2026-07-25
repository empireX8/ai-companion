import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExploreMovementProposalStatus,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import {
  EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS,
  UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE,
  UNSAFE_FIXED_EXPLORE_MOVEMENT_USER_FACING_SUMMARY,
} from "../explore-movement-fixed-semantics-containment";
import { EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE } from "../explore-movement-proposal-provenance";
import {
  EXPLORE_MOVEMENT_MAX_RETRIES,
  EXPLORE_MOVEMENT_MAX_TOTAL_PROVIDER_ATTEMPTS,
  isExploreMovementSemanticEnabled,
  resolveExploreMovementProviderConfig,
  createExploreMovementCallBudget,
  wrapExploreRunnerWithCallBudget,
} from "../explore-movement-live-provider-adapters";
import {
  EXPLORE_MOVEMENT_MIN_CONFIDENCE,
  parseExploreMovementSemanticDecision,
} from "../explore-movement-semantic-contract";
import { orchestrateExploreReplyGrounding } from "../explore-grounding-orchestrator";
import {
  createExploreMovementProposal,
  publishExploreMovementProposal,
  rejectExploreMovementProposal,
} from "../explore-movement-proposal";
import type { StructuredModelRunner } from "../orvek-intelligence-kernel/model-runner";

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
import { publishModelUpdateCandidate } from "../model-update-candidate-publish-helper";
import {
  ASSISTANT_MSG_ID,
  FOREIGN_USER_ID,
  SEMANTIC_USER_ID,
  SESSION_ID,
  UMC_ID,
  USER_MSG_ID,
  fakeAdjudicatorRunner,
  fakeReferee,
  makeSemanticTestDb,
  sampleCandidates,
  sampleOwnedSources,
  validProposeDecision,
  validProvenance,
  completedPassReferee,
} from "./helpers/explore-movement-semantic-test-helpers";

const collectOwnedMock = vi.mocked(collectOwnedExploreGroundingCandidates);
const publishCandidateMock = vi.mocked(publishModelUpdateCandidate);

const USER_MESSAGE =
  "After dense meetings I lose my evening stop point and keep working past fatigue.";
const ASSISTANT_REPLY =
  "That evening recovery boundary seems to weaken when meetings stack.";

describe("explore movement semantic contract", () => {
  it("parses propose / route / request / abstain and rejects contradictory fields", () => {
    expect(parseExploreMovementSemanticDecision(validProposeDecision()).ok).toBe(
      true
    );

    expect(
      parseExploreMovementSemanticDecision({
        outcome: "ABSTAIN",
        rationale: "Not enough owned evidence.",
      }).ok
    ).toBe(true);

    expect(
      parseExploreMovementSemanticDecision({
        outcome: "REQUEST_MORE_EVIDENCE",
        rationale: "Need another owned source.",
      }).ok
    ).toBe(true);

    expect(
      parseExploreMovementSemanticDecision({
        outcome: "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
        routedObjectType: "PatternClaim",
        rationale: "This is a pattern correction, not a conclusion strengthen.",
      }).ok
    ).toBe(true);

    expect(
      parseExploreMovementSemanticDecision({
        outcome: "ABSTAIN",
        rationale: "x",
        targetObjectId: "should-not-be-here",
      }).ok
    ).toBe(false);

    expect(
      parseExploreMovementSemanticDecision({
        outcome: "PROPOSE_CONCLUSION_STRENGTHENING",
        proposedObjectType: "PatternClaim",
        targetObjectId: UMC_ID,
        afterSummary: "x",
        rationale: "y",
        userFacingSummary: "z",
        confidence: 0.8,
        alternativeInterpretation: "a",
        qualificationContext: "b",
        evidenceSourceIds: ["journal-verified-semantic"],
      }).ok
    ).toBe(false);
  });

  it("normalises OpenAI-strict nullable envelopes into the domain union", () => {
    const parsed = parseExploreMovementSemanticDecision({
      decision: {
        outcome: "PROPOSE_CONCLUSION_STRENGTHENING",
        proposedObjectType: "UserMapConclusion",
        targetObjectId: UMC_ID,
        afterSummary: validProposeDecision().afterSummary,
        rationale: validProposeDecision().rationale,
        userFacingSummary: validProposeDecision().userFacingSummary,
        confidence: 0.7,
        alternativeInterpretation: "alt",
        qualificationContext: "qual",
        evidenceSourceIds: ["journal-verified-semantic"],
        routedObjectType: null,
      },
    });
    expect(parsed.ok).toBe(true);
  });
});

describe("explore movement provider gate and budget", () => {
  it("defaults the production feature gate to off", () => {
    expect(
      isExploreMovementSemanticEnabled({
        ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED: undefined,
      })
    ).toBe(false);
    expect(
      resolveExploreMovementProviderConfig({
        ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED: undefined,
        OPENAI_API_KEY: "sk-test",
      }).ok
    ).toBe(false);
  });

  it("bounds total provider attempts to two with zero retries", () => {
    expect(EXPLORE_MOVEMENT_MAX_TOTAL_PROVIDER_ATTEMPTS).toBe(2);
    expect(EXPLORE_MOVEMENT_MAX_RETRIES).toBe(0);

    const budget = createExploreMovementCallBudget(2);
    let calls = 0;
    const inner: StructuredModelRunner = {
      async runStructured() {
        calls += 1;
        return {
          ok: true,
          object: { outcome: "ABSTAIN", rationale: "x" },
          providerId: "injected",
          modelId: "m",
        };
      },
    };
    const wrapped = wrapExploreRunnerWithCallBudget({
      runner: inner,
      budget,
      role: "adjudicator",
    });
    const wrappedRef = wrapExploreRunnerWithCallBudget({
      runner: inner,
      budget,
      role: "referee",
    });

    void wrapped.runStructured({
      schema: {} as never,
      prompt: "a",
    });
    void wrappedRef.runStructured({
      schema: {} as never,
      prompt: "b",
    });
    return Promise.all([
      wrapped.runStructured({ schema: {} as never, prompt: "c" }),
    ]).then(async ([third]) => {
      expect(calls).toBe(2);
      expect(third.ok).toBe(false);
      expect(budget.totalCalls()).toBe(2);
    });
  });
});

describe("explore movement semantic restoration orchestration", () => {
  beforeEach(() => {
    collectOwnedMock.mockReset();
    collectOwnedMock.mockResolvedValue(sampleCandidates());
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

  it("feature gate off: zero provider calls, safe grounding, no proposal", async () => {
    const { db, proposals, callBudget } = makeSemanticTestDb();
    const adjudicator = fakeAdjudicatorRunner(validProposeDecision());
    const referee = fakeReferee({
      outcome: "PASS",
      rationale: "ok",
    });

    const result = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      createProposalWhenSufficient: true,
      semantic: {
        semanticEnabled: false,
        adjudicatorRunner: adjudicator,
        objectivityReferee: referee,
        callBudget,
        useInjectedProvidersOnly: true,
      },
    });

    expect(result.proposalCreated).toBe(false);
    expect(result.payload.status).toBe("grounded");
    expect(result.payload.movementProposal.status).toBe("insufficient_evidence");
    expect(adjudicator.calls).toBe(0);
    expect(referee.calls).toBe(0);
    expect(proposals).toHaveLength(0);
  });

  it("missing credential / no injected providers: zero calls, chat grounding succeeds", async () => {
    const { db, proposals, callBudget } = makeSemanticTestDb();
    const result = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      createProposalWhenSufficient: true,
      semantic: {
        semanticEnabled: true,
        callBudget,
        useInjectedProvidersOnly: true,
      },
    });

    expect(result.payload.status).toBe("grounded");
    expect(result.proposalCreated).toBe(false);
    expect(result.payload.movementProposal.status).toBe("insufficient_evidence");
    expect(proposals).toHaveLength(0);
  });

  it("no qualifying UMC target: zero provider calls, no proposal", async () => {
    const { db, proposals, callBudget } = makeSemanticTestDb();
    // Force empty qualifying set by returning no UMC rows.
    (db as unknown as { userMapConclusion: { findMany: () => Promise<unknown[]> } })
      .userMapConclusion.findMany = async () => [];

    const adjudicator = fakeAdjudicatorRunner(validProposeDecision());
    const referee = fakeReferee({ outcome: "PASS", rationale: "ok" });

    const result = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: adjudicator,
        objectivityReferee: referee,
        callBudget,
        useInjectedProvidersOnly: true,
      },
    });

    expect(adjudicator.calls).toBe(0);
    expect(referee.calls).toBe(0);
    expect(result.proposalCreated).toBe(false);
    expect(proposals).toHaveLength(0);
  });

  it("ABSTAIN / REQUEST_MORE_EVIDENCE / ROUTE create no proposal and no referee call", async () => {
    for (const decision of [
      { outcome: "ABSTAIN" as const, rationale: "Unclear." },
      {
        outcome: "REQUEST_MORE_EVIDENCE" as const,
        rationale: "Need another receipt.",
      },
      {
        outcome: "ROUTE_TO_DIFFERENT_OBJECT_TYPE" as const,
        routedObjectType: "PatternClaim" as const,
        rationale: "Belongs to PatternClaim.",
      },
    ]) {
      const { db, proposals, callBudget } = makeSemanticTestDb();
      const adjudicator = fakeAdjudicatorRunner(decision);
      const referee = fakeReferee({ outcome: "PASS", rationale: "ok" });

      const result = await orchestrateExploreReplyGrounding({
        userId: SEMANTIC_USER_ID,
        db,
        conversationId: SESSION_ID,
        assistantMessageId: ASSISTANT_MSG_ID,
        userMessageId: USER_MSG_ID,
        userMessageContent: USER_MESSAGE,
        assistantReplyContent: ASSISTANT_REPLY,
        semantic: {
          semanticEnabled: true,
          adjudicatorRunner: adjudicator,
          objectivityReferee: referee,
          callBudget,
          useInjectedProvidersOnly: true,
        },
      });

      expect(adjudicator.calls).toBe(1);
      expect(referee.calls).toBe(0);
      expect(result.proposalCreated).toBe(false);
      expect(proposals).toHaveLength(0);
      if (decision.outcome === "REQUEST_MORE_EVIDENCE") {
        expect(result.payload.movementProposal.rationale).toContain(
          "More evidence is needed"
        );
      }
    }
  });

  it("malformed adjudicator / fabricated target / fabricated evidence fail closed", async () => {
    const cases = [
      fakeAdjudicatorRunner(validProposeDecision(), { malformed: { nope: true } }),
      fakeAdjudicatorRunner(
        validProposeDecision({ targetObjectId: "fabricated-umc" })
      ),
      fakeAdjudicatorRunner(
        validProposeDecision({ evidenceSourceIds: ["fabricated-source"] })
      ),
      fakeAdjudicatorRunner(
        validProposeDecision({
          evidenceSourceIds: [ASSISTANT_MSG_ID],
        })
      ),
      fakeAdjudicatorRunner(
        validProposeDecision({
          afterSummary:
            "Evening recovery boundary weakens when meetings stack without a hard stop.",
        })
      ),
    ];

    for (const adjudicator of cases) {
      const { db, proposals, callBudget } = makeSemanticTestDb();
      const referee = fakeReferee({ outcome: "PASS", rationale: "ok" });
      const result = await orchestrateExploreReplyGrounding({
        userId: SEMANTIC_USER_ID,
        db,
        conversationId: SESSION_ID,
        assistantMessageId: ASSISTANT_MSG_ID,
        userMessageId: USER_MSG_ID,
        userMessageContent: USER_MESSAGE,
        assistantReplyContent: ASSISTANT_REPLY,
        semantic: {
          semanticEnabled: true,
          adjudicatorRunner: adjudicator,
          objectivityReferee: referee,
          callBudget,
          useInjectedProvidersOnly: true,
        },
      });
      expect(result.proposalCreated).toBe(false);
      expect(proposals).toHaveLength(0);
      expect(referee.calls).toBe(0);
    }
  });

  it("foreign-user target fails closed", async () => {
    const { db, proposals, callBudget } = makeSemanticTestDb({ foreignUmc: true });
    (db as unknown as { userMapConclusion: { findFirst: () => Promise<null> } })
      .userMapConclusion.findFirst = async () => null;

    const adjudicator = fakeAdjudicatorRunner(validProposeDecision());
    const referee = fakeReferee({ outcome: "PASS", rationale: "ok" });
    const result = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: adjudicator,
        objectivityReferee: referee,
        callBudget,
        useInjectedProvidersOnly: true,
      },
    });
    expect(result.proposalCreated).toBe(false);
    expect(proposals).toHaveLength(0);
    expect(referee.calls).toBe(0);
  });

  it("valid propose reaches referee; PASS creates exactly one proposal with provenance", async () => {
    const { db, proposals, modelUpdates, umc, callBudget } = makeSemanticTestDb();
    const adjudicator = fakeAdjudicatorRunner(validProposeDecision());
    const referee = fakeReferee({
      outcome: "PASS",
      rationale: "Within evidence.",
    });

    const result = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: adjudicator,
        objectivityReferee: referee,
        callBudget,
        providerId: "injected",
        adjudicatorModelId: "fake-adjudicator",
        refereeModelId: "fake-referee",
        useInjectedProvidersOnly: true,
      },
    });

    expect(adjudicator.calls).toBe(1);
    expect(referee.calls).toBe(1);
    expect(callBudget.totalCalls()).toBeLessThanOrEqual(2);
    expect(result.proposalCreated).toBe(true);
    expect(result.payload.movementProposal.status).toBe("proposed");
    expect(result.payload.movementProposal.proposalId).toBeTruthy();
    expect(result.payload.movementProposal.beforeSummary).toBe(umc.summary);
    expect(result.payload.movementProposal.afterSummary).toBe(
      validProposeDecision().afterSummary
    );
    expect(proposals).toHaveLength(1);
    expect(modelUpdates).toHaveLength(0);
    expect(proposals[0]?.sourcesJson).toMatchObject({
      version: "explore-movement-semantic-v1",
      semanticDecision: { outcome: "PROPOSE_CONCLUSION_STRENGTHENING" },
      refereeResult: { outcome: "PASS", continuationAllowed: true },
    });

    // Equivalent retry does not duplicate.
    const retry = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: adjudicator,
        objectivityReferee: referee,
        callBudget: createExploreMovementCallBudget(2),
        useInjectedProvidersOnly: true,
      },
    });
    expect(retry.proposalCreated).toBe(false);
    expect(retry.payload.movementProposal.proposalId).toBe(
      result.payload.movementProposal.proposalId
    );
    expect(proposals).toHaveLength(1);
  });

  it("PASS_WITH_LOWER_CONFIDENCE continues only above the final threshold", async () => {
    const above = makeSemanticTestDb();
    const adjudicator = fakeAdjudicatorRunner(validProposeDecision({ confidence: 0.8 }));
    const refereeAbove = fakeReferee({
      outcome: "PASS_WITH_LOWER_CONFIDENCE",
      rationale: "Lower slightly.",
      adjustedConfidence: EXPLORE_MOVEMENT_MIN_CONFIDENCE,
    });
    const ok = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db: above.db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: adjudicator,
        objectivityReferee: refereeAbove,
        callBudget: above.callBudget,
        useInjectedProvidersOnly: true,
      },
    });
    expect(ok.proposalCreated).toBe(true);

    const below = makeSemanticTestDb();
    const refereeBelow = fakeReferee({
      outcome: "PASS_WITH_LOWER_CONFIDENCE",
      rationale: "Too low.",
      adjustedConfidence: EXPLORE_MOVEMENT_MIN_CONFIDENCE - 0.05,
    });
    const blocked = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db: below.db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: fakeAdjudicatorRunner(
          validProposeDecision({ confidence: 0.8 })
        ),
        objectivityReferee: refereeBelow,
        callBudget: below.callBudget,
        useInjectedProvidersOnly: true,
      },
    });
    expect(blocked.proposalCreated).toBe(false);
    expect(below.proposals).toHaveLength(0);
  });

  it("referee route / request / abstain / failure / malformed / not-run create no proposal", async () => {
    const cases = [
      fakeReferee({
        outcome: "ROUTE_TO_DIFFERENT_OBJECT_TYPE",
        rationale: "Route.",
        routedObjectType: "PatternClaim",
      }),
      fakeReferee({
        outcome: "REQUEST_MORE_EVIDENCE",
        rationale: "Need more.",
      }),
      fakeReferee({ outcome: "ABSTAIN", rationale: "Abstain." }),
      fakeReferee({ outcome: "PASS", rationale: "x" }, { throwError: true }),
      fakeReferee({
        outcome: "PASS",
        rationale: "",
      }),
    ];

    for (const referee of cases) {
      const { db, proposals, callBudget } = makeSemanticTestDb();
      const result = await orchestrateExploreReplyGrounding({
        userId: SEMANTIC_USER_ID,
        db,
        conversationId: SESSION_ID,
        assistantMessageId: ASSISTANT_MSG_ID,
        userMessageId: USER_MSG_ID,
        userMessageContent: USER_MESSAGE,
        assistantReplyContent: ASSISTANT_REPLY,
        semantic: {
          semanticEnabled: true,
          adjudicatorRunner: fakeAdjudicatorRunner(validProposeDecision()),
          objectivityReferee: referee,
          callBudget,
          useInjectedProvidersOnly: true,
        },
      });
      expect(result.proposalCreated).toBe(false);
      expect(proposals).toHaveLength(0);
    }
  });

  it("never inserts fixed meetings/stop-point prose from code", async () => {
    const { db, proposals, callBudget } = makeSemanticTestDb();
    await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: fakeAdjudicatorRunner(validProposeDecision()),
        objectivityReferee: fakeReferee({
          outcome: "PASS",
          rationale: "ok",
        }),
        callBudget,
        useInjectedProvidersOnly: true,
      },
    });
    const serialized = JSON.stringify(proposals);
    expect(serialized).not.toContain(UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE);
    expect(serialized).not.toContain(
      UNSAFE_FIXED_EXPLORE_MOVEMENT_USER_FACING_SUMMARY
    );
  });
});

describe("explore movement semantic publication and round-trip", () => {
  beforeEach(() => {
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

  it("isolated round-trip: propose → publish ledger only → foreign isolation", async () => {
    const harness = makeSemanticTestDb();
    const adjudicator = fakeAdjudicatorRunner(validProposeDecision());
    const referee = fakeReferee({ outcome: "PASS", rationale: "ok" });

    collectOwnedMock.mockResolvedValue(sampleCandidates());

    const grounded = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db: harness.db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: adjudicator,
        objectivityReferee: referee,
        callBudget: harness.callBudget,
        useInjectedProvidersOnly: true,
      },
    });

    expect(grounded.proposalCreated).toBe(true);
    const proposalId = grounded.payload.movementProposal.proposalId!;
    expect(harness.modelUpdates).toHaveLength(0);

    const published = await publishExploreMovementProposal({
      userId: SEMANTIC_USER_ID,
      proposalId,
      db: harness.db,
    });
    expect(published).toMatchObject({
      status: "published",
      idempotent: false,
    });
    if (typeof published === "string") throw new Error(published);
    expect(harness.modelUpdates).toHaveLength(1);
    expect(harness.modelUpdates[0]?.data.updateType).toBe(
      "conclusion_strengthened"
    );
    expect(harness.modelUpdates[0]?.data.affectedObjectType).toBe(
      UnderstandingLinkTargetType.usermap_conclusion
    );
    expect(harness.evidenceLinks.length).toBeGreaterThan(0);
    expect(harness.proposals[0]?.status).toBe(
      ExploreMovementProposalStatus.published
    );
    // Target object mutation deferred — UMC update must not be called.
    await expect(
      (
        harness.db as unknown as {
          userMapConclusion: { update: () => Promise<unknown> };
        }
      ).userMapConclusion.update()
    ).rejects.toThrow(/must not occur/);

    const foreign = await publishExploreMovementProposal({
      userId: FOREIGN_USER_ID,
      proposalId,
      db: harness.db,
    });
    expect(foreign).toBe("not_found");
  });

  it("blocks unversioned / mismatched / non-continuing / unsafe before any write", async () => {
    const decision = validProposeDecision();
    const good = validProvenance();

    const cases: Array<{ sourcesJson: unknown; expected: string }> = [
      { sourcesJson: sampleOwnedSources(), expected: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE },
      {
        sourcesJson: {
          ...good,
          semanticDecision: {
            ...decision,
            afterSummary: "Different after summary that still mentions evening recovery boundary meetings stop.",
          },
        },
        expected: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
      },
      {
        sourcesJson: {
          ...good,
          refereeResult: completedPassReferee({
            outcome: "ABSTAIN",
            continuationAllowed: false,
          }),
        },
        expected: EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
      },
      {
        sourcesJson: sampleOwnedSources(),
        expected: EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS,
      },
    ];

    // First three normal mismatch/unversioned, then unsafe signature row.
    const { db, modelUpdates, evidenceLinks, raw } = makeSemanticTestDb({
      proposals: [
        {
          id: "p_unversioned",
          userId: SEMANTIC_USER_ID,
          conversationId: SESSION_ID,
          assistantMessageId: ASSISTANT_MSG_ID,
          userMessageId: USER_MSG_ID,
          status: ExploreMovementProposalStatus.proposed,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: UMC_ID,
          beforeSummary: "Evening recovery boundary weakens when meetings stack without a hard stop.",
          afterSummary: decision.afterSummary,
          rationale: decision.rationale,
          userFacingSummary: decision.userFacingSummary,
          sourcesJson: sampleOwnedSources(),
          modelUpdateId: null,
        },
        {
          id: "p_mismatch",
          userId: SEMANTIC_USER_ID,
          conversationId: SESSION_ID,
          assistantMessageId: ASSISTANT_MSG_ID,
          userMessageId: USER_MSG_ID,
          status: ExploreMovementProposalStatus.proposed,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: UMC_ID,
          beforeSummary: "Evening recovery boundary weakens when meetings stack without a hard stop.",
          afterSummary: decision.afterSummary,
          rationale: decision.rationale,
          userFacingSummary: decision.userFacingSummary,
          sourcesJson: {
            ...good,
            semanticDecision: {
              ...decision,
              afterSummary: "Different after summary evening recovery boundary.",
            },
          },
          modelUpdateId: null,
        },
        {
          id: "p_referee_block",
          userId: SEMANTIC_USER_ID,
          conversationId: SESSION_ID,
          assistantMessageId: ASSISTANT_MSG_ID,
          userMessageId: USER_MSG_ID,
          status: ExploreMovementProposalStatus.proposed,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: UMC_ID,
          beforeSummary: "Evening recovery boundary weakens when meetings stack without a hard stop.",
          afterSummary: decision.afterSummary,
          rationale: decision.rationale,
          userFacingSummary: decision.userFacingSummary,
          sourcesJson: {
            ...good,
            refereeResult: completedPassReferee({
              outcome: "ABSTAIN",
              continuationAllowed: false,
              rationale: "Blocked.",
            }),
          },
          modelUpdateId: null,
        },
        {
          id: "p_unsafe",
          userId: SEMANTIC_USER_ID,
          conversationId: SESSION_ID,
          assistantMessageId: ASSISTANT_MSG_ID,
          userMessageId: USER_MSG_ID,
          status: ExploreMovementProposalStatus.proposed,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: UMC_ID,
          beforeSummary: "Evening recovery boundary weakens when meetings stack without a hard stop.",
          afterSummary:
            "Explore evidence suggests refining: Evening recovery with stop-point sensitivity after meetings.",
          rationale: UNSAFE_FIXED_EXPLORE_MOVEMENT_RATIONALE,
          userFacingSummary: UNSAFE_FIXED_EXPLORE_MOVEMENT_USER_FACING_SUMMARY,
          sourcesJson: sampleOwnedSources(),
          modelUpdateId: null,
        },
      ],
    });

    expect(
      await publishExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId: "p_unversioned",
        db,
      })
    ).toBe(EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE);

    expect(
      await publishExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId: "p_mismatch",
        db,
      })
    ).toBe(EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE);

    expect(
      await publishExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId: "p_referee_block",
        db,
      })
    ).toBe(EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE);

    expect(
      await publishExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId: "p_unsafe",
        db,
      })
    ).toBe(EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS);

    expect(modelUpdates).toHaveLength(0);
    expect(evidenceLinks).toHaveLength(0);
    void cases;
    void raw;
  });

  it("preserves reject and already-published idempotency", async () => {
    const decision = validProposeDecision();
    const provenance = validProvenance();
    const { db, proposals, modelUpdates } = makeSemanticTestDb({
      proposals: [
        {
          id: "p_reject",
          userId: SEMANTIC_USER_ID,
          conversationId: SESSION_ID,
          assistantMessageId: ASSISTANT_MSG_ID,
          userMessageId: USER_MSG_ID,
          status: ExploreMovementProposalStatus.proposed,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: UMC_ID,
          beforeSummary: "Evening recovery boundary weakens when meetings stack without a hard stop.",
          afterSummary: decision.afterSummary,
          rationale: decision.rationale,
          userFacingSummary: decision.userFacingSummary,
          sourcesJson: provenance,
          modelUpdateId: null,
        },
        {
          id: "p_published",
          userId: SEMANTIC_USER_ID,
          conversationId: SESSION_ID,
          assistantMessageId: ASSISTANT_MSG_ID,
          userMessageId: USER_MSG_ID,
          status: ExploreMovementProposalStatus.published,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: UMC_ID,
          beforeSummary: "Evening recovery boundary weakens when meetings stack without a hard stop.",
          afterSummary: decision.afterSummary,
          rationale: decision.rationale,
          userFacingSummary: decision.userFacingSummary,
          sourcesJson: provenance,
          modelUpdateId: "mu_existing",
        },
      ],
    });

    expect(
      await rejectExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId: "p_reject",
        db,
      })
    ).toEqual({ proposalId: "p_reject", status: "rejected" });
    expect(proposals[0]?.status).toBe(ExploreMovementProposalStatus.rejected);

    expect(
      await publishExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId: "p_published",
        db,
      })
    ).toEqual({
      modelUpdateId: "mu_existing",
      status: "published",
      idempotent: true,
    });
    expect(modelUpdates).toHaveLength(0);
  });

  it("create with provenance remains readable and publishable", async () => {
    const { db, proposals } = makeSemanticTestDb();
    const decision = validProposeDecision();
    const created = await createExploreMovementProposal({
      userId: SEMANTIC_USER_ID,
      db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: UMC_ID,
      beforeSummary:
        "Evening recovery boundary weakens when meetings stack without a hard stop.",
      afterSummary: decision.afterSummary,
      rationale: decision.rationale,
      userFacingSummary: decision.userFacingSummary,
      provenance: validProvenance(),
    });
    expect(created.status).toBe("proposed");
    expect(proposals[0]?.sourcesJson).toMatchObject({
      version: "explore-movement-semantic-v1",
    });

    const published = await publishExploreMovementProposal({
      userId: SEMANTIC_USER_ID,
      proposalId: created.proposalId,
      db,
    });
    expect(published).toMatchObject({ status: "published", idempotent: false });
  });
});
