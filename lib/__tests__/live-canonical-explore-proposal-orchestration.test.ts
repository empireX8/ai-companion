import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { orchestrateExploreReplyGrounding } from "../explore-grounding-orchestrator";
import {
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV,
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV,
} from "../canonical-model-authority-flag";

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
      }),
    ),
  };
});

vi.mock("../explore-movement-proposal", () => ({
  createOrReuseSemanticExploreMovementProposal: vi.fn(),
}));

import { collectOwnedExploreGroundingCandidates } from "../explore-grounding-retrieval";
import { createOrReuseSemanticExploreMovementProposal } from "../explore-movement-proposal";
import {
  ASSISTANT_MSG_ID,
  SEMANTIC_USER_ID,
  SESSION_ID,
  USER_MSG_ID,
  fakeAdjudicatorRunner,
  fakeReferee,
  makeSemanticTestDb,
  sampleCandidates,
  validProposeDecision,
} from "./helpers/explore-movement-semantic-test-helpers";

const collectOwnedMock = vi.mocked(collectOwnedExploreGroundingCandidates);
const createOrReuseProposalMock = vi.mocked(createOrReuseSemanticExploreMovementProposal);

const USER_MESSAGE =
  "After dense meetings I lose my evening stop point and keep working past fatigue.";
const ASSISTANT_REPLY =
  "That evening recovery boundary seems to weaken when meetings stack.";

describe("live canonical Explore proposal — allowlist-gated orchestration", () => {
  const prior = {
    flag: process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV],
    users: process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV],
    semantic: process.env.ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED,
  };

  beforeEach(() => {
    collectOwnedMock.mockResolvedValue(sampleCandidates());
    delete process.env.ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED;
    createOrReuseProposalMock.mockClear();
    createOrReuseProposalMock.mockResolvedValue({
      record: {
        proposalId: "proposal_canonical_live",
        modelUpdateId: null,
        status: "proposed",
        beforeSummary:
          "Evening recovery boundary weakens when meetings stack without a hard stop.",
        afterSummary: validProposeDecision().afterSummary,
        rationale: validProposeDecision().rationale,
        userFacingSummary: validProposeDecision().userFacingSummary,
      },
      created: true,
      reusedStatus: null,
    });
  });

  afterEach(() => {
    if (prior.flag === undefined) {
      delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV];
    } else {
      process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV] = prior.flag;
    }
    if (prior.users === undefined) {
      delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV];
    } else {
      process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV] = prior.users;
    }
    if (prior.semantic === undefined) {
      delete process.env.ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED;
    } else {
      process.env.ORVEK_EXPLORE_MOVEMENT_SEMANTIC_ENABLED = prior.semantic;
    }
  });

  it("creates a proposal for an allowlisted user without the global semantic flag", async () => {
    process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV] = "1";
    process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV] = SEMANTIC_USER_ID;

    const harness = makeSemanticTestDb();
    const result = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db: harness.db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      createProposalWhenSufficient: true,
      semantic: {
        // Intentionally omit semanticEnabled — production path uses user-aware gate.
        adjudicatorRunner: fakeAdjudicatorRunner(validProposeDecision()),
        objectivityReferee: fakeReferee({
          outcome: "PASS",
          rationale: "ok",
        }),
        callBudget: harness.callBudget,
        useInjectedProvidersOnly: true,
      },
    });

    expect(result.proposalCreated).toBe(true);
    expect(result.payload.movementProposal.status).toBe("proposed");
    expect(result.payload.movementProposal.proposalId).toBe("proposal_canonical_live");
    expect(createOrReuseProposalMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the canonical gate is off and the global semantic flag is off", async () => {
    delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV];
    delete process.env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV];

    const harness = makeSemanticTestDb();
    const result = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db: harness.db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      createProposalWhenSufficient: true,
      semantic: {
        adjudicatorRunner: fakeAdjudicatorRunner(validProposeDecision()),
        objectivityReferee: fakeReferee({
          outcome: "PASS",
          rationale: "ok",
        }),
        callBudget: harness.callBudget,
        useInjectedProvidersOnly: true,
      },
    });

    expect(result.proposalCreated).toBe(false);
    expect(result.payload.movementProposal.status).toBe("insufficient_evidence");
    expect(createOrReuseProposalMock).not.toHaveBeenCalled();
  });
});
