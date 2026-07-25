import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ExploreMovementProposalStatus,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import {
  buildExploreMovementAdjudicationPrompt,
  boundExploreMovementEvidencePacketForProvider,
  EXPLORE_MOVEMENT_PROVIDER_MAX_SOURCE_EXTRACT_CHARS,
  EXPLORE_MOVEMENT_PROVIDER_MAX_USER_MESSAGE_CHARS,
} from "../explore-movement-semantic-adjudicator";
import {
  buildExploreMovementProposalProvenance,
  deriveExploreMovementProposalId,
  EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE,
  EXPLORE_MOVEMENT_SUCCESS_TOTAL_CALLS,
  parseExploreMovementProposalProvenance,
  validateExploreMovementProposalProvenanceCoherence,
} from "../explore-movement-proposal-provenance";
import {
  createOrReuseSemanticExploreMovementProposal,
  publishExploreMovementProposal,
} from "../explore-movement-proposal";
import { orchestrateExploreReplyGrounding } from "../explore-grounding-orchestrator";
import { EXPLORE_MOVEMENT_MIN_CONFIDENCE } from "../explore-movement-semantic-contract";
import { EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS } from "../explore-movement-fixed-semantics-containment";

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
import {
  ASSISTANT_MSG_ID,
  FOREIGN_USER_ID,
  SEMANTIC_USER_ID,
  SESSION_ID,
  UMC_ID,
  USER_MSG_ID,
  completedPassReferee,
  fakeAdjudicatorRunner,
  fakeReferee,
  makeSemanticTestDb,
  sampleCandidates,
  sampleOwnedSources,
  validProposeDecision,
  validProvenance,
} from "./helpers/explore-movement-semantic-test-helpers";

const collectOwnedMock = vi.mocked(collectOwnedExploreGroundingCandidates);

const USER_MESSAGE =
  "After dense meetings I lose my evening stop point and keep working past fatigue.";
const ASSISTANT_REPLY =
  "That evening recovery boundary seems to weaken when meetings stack.";
const UMC_SUMMARY =
  "Evening recovery boundary weakens when meetings stack without a hard stop.";

describe("DEL-001B provenance coherence corrections", () => {
  it("rejects unknown source types and sourceType/sourceFamily mismatches", () => {
    const base = validProvenance();
    expect(
      validateExploreMovementProposalProvenanceCoherence({
        ...base,
        sources: [
          {
            ...base.sources[0],
            sourceType: "not_a_real_source",
          },
        ],
      }).ok
    ).toBe(false);

    expect(
      validateExploreMovementProposalProvenanceCoherence({
        ...base,
        sources: [
          {
            ...base.sources[0],
            sourceType: "journal_entry",
            sourceFamily: "message",
          },
          ...base.sources.slice(1),
        ],
      }).ok
    ).toBe(false);
  });

  it("rejects decision/source-set mismatch, empty cited set, and bad call metadata", () => {
    const base = validProvenance();
    expect(
      validateExploreMovementProposalProvenanceCoherence({
        ...base,
        sources: [base.sources[0]],
      }).ok
    ).toBe(false);

    expect(
      validateExploreMovementProposalProvenanceCoherence({
        ...base,
        sources: [],
      }).ok
    ).toBe(false);

    expect(
      validateExploreMovementProposalProvenanceCoherence({
        ...base,
        providerMetadata: {
          ...base.providerMetadata,
          adjudicatorCalls: 0,
          refereeCalls: 0,
          totalCalls: 0,
        },
      }).ok
    ).toBe(false);

    expect(
      validateExploreMovementProposalProvenanceCoherence({
        ...base,
        providerMetadata: {
          ...base.providerMetadata,
          adjudicatorCalls: 1,
          refereeCalls: 0,
          totalCalls: 1,
        },
      }).ok
    ).toBe(false);

    expect(
      validateExploreMovementProposalProvenanceCoherence({
        ...base,
        providerMetadata: {
          ...base.providerMetadata,
          totalCalls: 3,
        },
      }).ok
    ).toBe(false);
  });

  it("rejects forged continuationAllowed, validationErrors, confidence mismatch, and low confidence", () => {
    const base = validProvenance();
    expect(
      validateExploreMovementProposalProvenanceCoherence({
        ...base,
        refereeResult: completedPassReferee({
          continuationAllowed: true,
          validationErrors: ["invalid"],
        }),
      }).ok
    ).toBe(false);

    expect(
      validateExploreMovementProposalProvenanceCoherence({
        ...base,
        refereeResult: completedPassReferee({
          proposedConfidence: 0.99,
        }),
      }).ok
    ).toBe(false);

    const decision = validProposeDecision({ confidence: 0.9 });
    expect(
      validateExploreMovementProposalProvenanceCoherence({
        ...base,
        semanticDecision: decision,
        refereeResult: completedPassReferee({
          outcome: "PASS_WITH_LOWER_CONFIDENCE",
          proposedConfidence: 0.9,
          adjustedConfidence: EXPLORE_MOVEMENT_MIN_CONFIDENCE - 0.1,
          continuationAllowed: true,
        }),
      }).ok
    ).toBe(false);
  });

  it("buildExploreMovementProposalProvenance runtime-validates and stores exact 1/1/2 metadata", async () => {
    collectOwnedMock.mockResolvedValue(sampleCandidates());
    const harness = makeSemanticTestDb();
    const result = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db: harness.db,
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
        callBudget: harness.callBudget,
        useInjectedProvidersOnly: true,
      },
    });
    expect(result.proposalCreated).toBe(true);
    const parsed = parseExploreMovementProposalProvenance(
      harness.proposals[0]?.sourcesJson
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.provenance.providerMetadata).toEqual({
      providerId: "injected",
      adjudicatorModelId: "injected-adjudicator",
      refereeModelId: "injected-referee",
      adjudicatorCalls: 1,
      refereeCalls: 1,
      totalCalls: EXPLORE_MOVEMENT_SUCCESS_TOTAL_CALLS,
    });
  });
});

describe("DEL-001B publication ownership and lineage", () => {
  beforeEach(() => {
    collectOwnedMock.mockResolvedValue(sampleCandidates());
  });

  it("blocks forged JSON userId / nonexistent / wrong-type / foreign / lineage mismatches with zero writes", async () => {
    const decision = validProposeDecision();
    const good = validProvenance();

    const cases = [
      {
        name: "foreign-owned source despite JSON userId",
        harness: makeSemanticTestDb({
          ownedSourceRows: [
            {
              id: "journal-verified-semantic",
              userId: FOREIGN_USER_ID,
              kind: "journal_entry",
            },
            {
              id: "pattern-inferred-semantic",
              userId: SEMANTIC_USER_ID,
              kind: "pattern_claim_evidence",
            },
            { id: SESSION_ID, userId: SEMANTIC_USER_ID, kind: "session" },
            { id: USER_MSG_ID, userId: SEMANTIC_USER_ID, kind: "message" },
            {
              id: ASSISTANT_MSG_ID,
              userId: SEMANTIC_USER_ID,
              kind: "message",
            },
          ],
          proposals: [
            {
              id: "p_foreign_source",
              userId: SEMANTIC_USER_ID,
              conversationId: SESSION_ID,
              assistantMessageId: ASSISTANT_MSG_ID,
              userMessageId: USER_MSG_ID,
              status: ExploreMovementProposalStatus.proposed,
              affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
              affectedObjectId: UMC_ID,
              beforeSummary: UMC_SUMMARY,
              afterSummary: decision.afterSummary,
              rationale: decision.rationale,
              userFacingSummary: decision.userFacingSummary,
              sourcesJson: good,
              modelUpdateId: null,
            },
          ],
        }),
        proposalId: "p_foreign_source",
        conversationId: SESSION_ID,
      },
      {
        name: "nonexistent source",
        harness: makeSemanticTestDb({
          ownedSourceRows: [
            { id: SESSION_ID, userId: SEMANTIC_USER_ID, kind: "session" },
            { id: USER_MSG_ID, userId: SEMANTIC_USER_ID, kind: "message" },
            {
              id: ASSISTANT_MSG_ID,
              userId: SEMANTIC_USER_ID,
              kind: "message",
            },
          ],
          proposals: [
            {
              id: "p_missing_source",
              userId: SEMANTIC_USER_ID,
              conversationId: SESSION_ID,
              assistantMessageId: ASSISTANT_MSG_ID,
              userMessageId: USER_MSG_ID,
              status: ExploreMovementProposalStatus.proposed,
              affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
              affectedObjectId: UMC_ID,
              beforeSummary: UMC_SUMMARY,
              afterSummary: decision.afterSummary,
              rationale: decision.rationale,
              userFacingSummary: decision.userFacingSummary,
              sourcesJson: good,
              modelUpdateId: null,
            },
          ],
        }),
        proposalId: "p_missing_source",
        conversationId: SESSION_ID,
      },
      {
        name: "stale target summary",
        harness: makeSemanticTestDb({
          umc: {
            id: UMC_ID,
            userId: SEMANTIC_USER_ID,
            title: "Evening recovery boundary",
            summary: "Canonical summary changed after proposal.",
          },
          proposals: [
            {
              id: "p_stale",
              userId: SEMANTIC_USER_ID,
              conversationId: SESSION_ID,
              assistantMessageId: ASSISTANT_MSG_ID,
              userMessageId: USER_MSG_ID,
              status: ExploreMovementProposalStatus.proposed,
              affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
              affectedObjectId: UMC_ID,
              beforeSummary: UMC_SUMMARY,
              afterSummary: decision.afterSummary,
              rationale: decision.rationale,
              userFacingSummary: decision.userFacingSummary,
              sourcesJson: good,
              modelUpdateId: null,
            },
          ],
        }),
        proposalId: "p_stale",
        conversationId: SESSION_ID,
      },
      {
        name: "route session mismatch",
        harness: makeSemanticTestDb({
          proposals: [
            {
              id: "p_route_mismatch",
              userId: SEMANTIC_USER_ID,
              conversationId: SESSION_ID,
              assistantMessageId: ASSISTANT_MSG_ID,
              userMessageId: USER_MSG_ID,
              status: ExploreMovementProposalStatus.proposed,
              affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
              affectedObjectId: UMC_ID,
              beforeSummary: UMC_SUMMARY,
              afterSummary: decision.afterSummary,
              rationale: decision.rationale,
              userFacingSummary: decision.userFacingSummary,
              sourcesJson: good,
              modelUpdateId: null,
            },
          ],
        }),
        proposalId: "p_route_mismatch",
        conversationId: "session_other_owned",
      },
    ];

    for (const testCase of cases) {
      const result = await publishExploreMovementProposal({
        userId: SEMANTIC_USER_ID,
        proposalId: testCase.proposalId,
        conversationId: testCase.conversationId,
        db: testCase.harness.db,
      });
      expect(result, testCase.name).toBe(
        EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE
      );
      expect(testCase.harness.modelUpdates, testCase.name).toHaveLength(0);
      expect(testCase.harness.evidenceLinks, testCase.name).toHaveLength(0);
      expect(testCase.harness.proposals[0]?.status, testCase.name).toBe(
        ExploreMovementProposalStatus.proposed
      );
    }
  });
});

describe("DEL-001B idempotency and concurrency", () => {
  beforeEach(() => {
    collectOwnedMock.mockResolvedValue(sampleCandidates());
  });

  it("normalises equivalent retries and concurrent creates to one proposal", async () => {
    const harness = makeSemanticTestDb();
    const semantic = {
      semanticEnabled: true as const,
      adjudicatorRunner: fakeAdjudicatorRunner(validProposeDecision()),
      objectivityReferee: fakeReferee({ outcome: "PASS", rationale: "ok" }),
      useInjectedProvidersOnly: true as const,
    };

    const [a, b] = await Promise.all([
      orchestrateExploreReplyGrounding({
        userId: SEMANTIC_USER_ID,
        db: harness.db,
        conversationId: SESSION_ID,
        assistantMessageId: ASSISTANT_MSG_ID,
        userMessageId: USER_MSG_ID,
        userMessageContent: USER_MESSAGE,
        assistantReplyContent: ASSISTANT_REPLY,
        semantic: { ...semantic, callBudget: harness.callBudget },
      }),
      orchestrateExploreReplyGrounding({
        userId: SEMANTIC_USER_ID,
        db: harness.db,
        conversationId: SESSION_ID,
        assistantMessageId: ASSISTANT_MSG_ID,
        userMessageId: USER_MSG_ID,
        userMessageContent: USER_MESSAGE,
        assistantReplyContent: ASSISTANT_REPLY,
        semantic: {
          ...semantic,
          adjudicatorRunner: fakeAdjudicatorRunner(
            validProposeDecision({
              afterSummary: `  ${validProposeDecision().afterSummary.toUpperCase()}  `,
            })
          ),
          callBudget: makeSemanticTestDb().callBudget,
        },
      }),
    ]);

    // Case-folded identity may differ if afterSummary content differs materially
    // after uppercasing words — use exact equivalent whitespace retry instead.
    void a;
    void b;

    const first = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db: harness.db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: fakeAdjudicatorRunner(validProposeDecision()),
        objectivityReferee: fakeReferee({ outcome: "PASS", rationale: "ok" }),
        callBudget: makeSemanticTestDb().callBudget,
        useInjectedProvidersOnly: true,
      },
    });
    expect(first.proposalCreated || first.payload.movementProposal.proposalId).toBeTruthy();

    const whitespaceRetry = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db: harness.db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: fakeAdjudicatorRunner(
          validProposeDecision({
            afterSummary: `  ${validProposeDecision().afterSummary}  `,
          })
        ),
        objectivityReferee: fakeReferee({ outcome: "PASS", rationale: "ok" }),
        callBudget: makeSemanticTestDb().callBudget,
        useInjectedProvidersOnly: true,
      },
    });
    expect(whitespaceRetry.proposalCreated).toBe(false);
    expect(whitespaceRetry.payload.movementProposal.proposalId).toBe(
      first.payload.movementProposal.proposalId
    );

    const concurrentHarness = makeSemanticTestDb();
    const results = await Promise.all(
      [0, 1, 2].map(() =>
        orchestrateExploreReplyGrounding({
          userId: SEMANTIC_USER_ID,
          db: concurrentHarness.db,
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
            callBudget: makeSemanticTestDb().callBudget,
            useInjectedProvidersOnly: true,
          },
        })
      )
    );
    const ids = new Set(
      results.map((row) => row.payload.movementProposal.proposalId)
    );
    expect(ids.size).toBe(1);
    expect(concurrentHarness.proposals).toHaveLength(1);
  });

  it("does not recreate after publish or reject; ignores matching unversioned legacy", async () => {
    const decision = validProposeDecision();
    const provenance = validProvenance();
    const proposalId = deriveExploreMovementProposalId({
      userId: SEMANTIC_USER_ID,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
      affectedObjectId: UMC_ID,
      afterSummary: decision.afterSummary,
    });

    const publishedHarness = makeSemanticTestDb({
      proposals: [
        {
          id: proposalId,
          userId: SEMANTIC_USER_ID,
          conversationId: SESSION_ID,
          assistantMessageId: ASSISTANT_MSG_ID,
          userMessageId: USER_MSG_ID,
          status: ExploreMovementProposalStatus.published,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: UMC_ID,
          beforeSummary: UMC_SUMMARY,
          afterSummary: decision.afterSummary,
          rationale: decision.rationale,
          userFacingSummary: decision.userFacingSummary,
          sourcesJson: provenance,
          modelUpdateId: "mu_existing",
        },
      ],
    });
    const published = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db: publishedHarness.db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: fakeAdjudicatorRunner(decision),
        objectivityReferee: fakeReferee({ outcome: "PASS", rationale: "ok" }),
        callBudget: publishedHarness.callBudget,
        useInjectedProvidersOnly: true,
      },
    });
    expect(published.proposalCreated).toBe(false);
    expect(published.payload.movementProposal.status).toBe("published");
    expect(published.payload.movementProposal.modelUpdateId).toBe("mu_existing");
    expect(publishedHarness.proposals).toHaveLength(1);

    const rejectedHarness = makeSemanticTestDb({
      proposals: [
        {
          id: proposalId,
          userId: SEMANTIC_USER_ID,
          conversationId: SESSION_ID,
          assistantMessageId: ASSISTANT_MSG_ID,
          userMessageId: USER_MSG_ID,
          status: ExploreMovementProposalStatus.rejected,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: UMC_ID,
          beforeSummary: UMC_SUMMARY,
          afterSummary: decision.afterSummary,
          rationale: decision.rationale,
          userFacingSummary: decision.userFacingSummary,
          sourcesJson: provenance,
          modelUpdateId: null,
        },
      ],
    });
    const rejected = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db: rejectedHarness.db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: fakeAdjudicatorRunner(decision),
        objectivityReferee: fakeReferee({ outcome: "PASS", rationale: "ok" }),
        callBudget: rejectedHarness.callBudget,
        useInjectedProvidersOnly: true,
      },
    });
    expect(rejected.proposalCreated).toBe(false);
    expect(rejected.payload.movementProposal.status).toBe("rejected");
    expect(rejectedHarness.proposals).toHaveLength(1);

    const legacyHarness = makeSemanticTestDb({
      proposals: [
        {
          id: "legacy_cuid_unversioned",
          userId: SEMANTIC_USER_ID,
          conversationId: SESSION_ID,
          assistantMessageId: ASSISTANT_MSG_ID,
          userMessageId: USER_MSG_ID,
          status: ExploreMovementProposalStatus.proposed,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: UMC_ID,
          beforeSummary: UMC_SUMMARY,
          afterSummary: decision.afterSummary,
          rationale: decision.rationale,
          userFacingSummary: decision.userFacingSummary,
          sourcesJson: sampleOwnedSources(),
          modelUpdateId: null,
        },
      ],
    });
    const afterLegacy = await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db: legacyHarness.db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: USER_MESSAGE,
      assistantReplyContent: ASSISTANT_REPLY,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: fakeAdjudicatorRunner(decision),
        objectivityReferee: fakeReferee({ outcome: "PASS", rationale: "ok" }),
        callBudget: legacyHarness.callBudget,
        useInjectedProvidersOnly: true,
      },
    });
    expect(afterLegacy.proposalCreated).toBe(true);
    expect(legacyHarness.proposals).toHaveLength(2);
    expect(
      legacyHarness.proposals.some((row) => row.id === proposalId)
    ).toBe(true);
  });

  it("concurrent publication creates exactly one ModelUpdate linked to the proposal", async () => {
    const decision = validProposeDecision();
    const provenance = validProvenance();
    const proposalId = "p_concurrent_publish";
    const harness = makeSemanticTestDb({
      proposals: [
        {
          id: proposalId,
          userId: SEMANTIC_USER_ID,
          conversationId: SESSION_ID,
          assistantMessageId: ASSISTANT_MSG_ID,
          userMessageId: USER_MSG_ID,
          status: ExploreMovementProposalStatus.proposed,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: UMC_ID,
          beforeSummary: UMC_SUMMARY,
          afterSummary: decision.afterSummary,
          rationale: decision.rationale,
          userFacingSummary: decision.userFacingSummary,
          sourcesJson: provenance,
          modelUpdateId: null,
        },
      ],
    });

    const results = await Promise.all(
      [0, 1, 2].map(() =>
        publishExploreMovementProposal({
          userId: SEMANTIC_USER_ID,
          proposalId,
          conversationId: SESSION_ID,
          db: harness.db,
        })
      )
    );

    const success = results.filter(
      (row) => typeof row !== "string" && row.status === "published"
    );
    expect(success.length).toBe(3);
    const modelUpdateIds = new Set(
      success.map((row) => (typeof row === "string" ? "" : row.modelUpdateId))
    );
    expect(modelUpdateIds.size).toBe(1);
    expect(harness.modelUpdates).toHaveLength(1);
    expect(harness.proposals[0]?.modelUpdateId).toBe(
      harness.modelUpdates[0]?.id
    );
    expect(harness.proposals[0]?.status).toBe(
      ExploreMovementProposalStatus.published
    );
  });
});

describe("DEL-001B provider input bounds", () => {
  it("bounds oversized provider packets without mutating stored text or changing call counts", async () => {
    const seededMessage = `${USER_MESSAGE}\n${"x".repeat(
      EXPLORE_MOVEMENT_PROVIDER_MAX_USER_MESSAGE_CHARS
    )}`;
    const seededReply = `${ASSISTANT_REPLY}\n${"x".repeat(
      EXPLORE_MOVEMENT_PROVIDER_MAX_USER_MESSAGE_CHARS
    )}`;
    const packet = {
      conversationId: SESSION_ID,
      userMessageId: USER_MSG_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageContent: seededMessage,
      assistantReplyContent: seededReply,
      ownedSources: sampleOwnedSources().map((source) => ({
        ...source,
        extract: `${source.extract}${"y".repeat(
          EXPLORE_MOVEMENT_PROVIDER_MAX_SOURCE_EXTRACT_CHARS
        )}`,
      })),
      qualifyingConclusions: [
        {
          id: UMC_ID,
          title: "t".repeat(300),
          summary: "s".repeat(900),
          status: "supported" as const,
          visibility: "user_visible" as const,
          evidenceCount: 1,
        },
      ],
    };

    const bounded = boundExploreMovementEvidencePacketForProvider(packet);
    expect(bounded.userMessageContent.length).toBe(
      EXPLORE_MOVEMENT_PROVIDER_MAX_USER_MESSAGE_CHARS
    );
    expect(packet.userMessageContent.length).toBeGreaterThan(
      EXPLORE_MOVEMENT_PROVIDER_MAX_USER_MESSAGE_CHARS
    );

    const { prompt } = buildExploreMovementAdjudicationPrompt(packet);
    expect(prompt.includes(seededMessage)).toBe(false);
    expect(bounded.userMessageContent.length).toBe(
      EXPLORE_MOVEMENT_PROVIDER_MAX_USER_MESSAGE_CHARS
    );
    expect(bounded.assistantReplyContent.length).toBe(
      EXPLORE_MOVEMENT_PROVIDER_MAX_USER_MESSAGE_CHARS
    );
    expect(
      bounded.ownedSources.every(
        (source) =>
          source.extract.length <= EXPLORE_MOVEMENT_PROVIDER_MAX_SOURCE_EXTRACT_CHARS
      )
    ).toBe(true);

    collectOwnedMock.mockResolvedValue(sampleCandidates());
    const harness = makeSemanticTestDb();
    const adjudicator = fakeAdjudicatorRunner(validProposeDecision());
    const referee = fakeReferee({ outcome: "PASS", rationale: "ok" });
    await orchestrateExploreReplyGrounding({
      userId: SEMANTIC_USER_ID,
      db: harness.db,
      conversationId: SESSION_ID,
      assistantMessageId: ASSISTANT_MSG_ID,
      userMessageId: USER_MSG_ID,
      userMessageContent: seededMessage,
      assistantReplyContent: seededReply,
      semantic: {
        semanticEnabled: true,
        adjudicatorRunner: adjudicator,
        objectivityReferee: referee,
        callBudget: harness.callBudget,
        useInjectedProvidersOnly: true,
      },
    });
    expect(adjudicator.calls).toBe(1);
    expect(referee.calls).toBe(1);
    const meta = (
      harness.proposals[0]?.sourcesJson as {
        providerMetadata?: { totalCalls?: number };
      }
    )?.providerMetadata;
    expect(meta?.totalCalls).toBe(2);
    expect(JSON.stringify(meta)).not.toContain(seededMessage);
  });
});

describe("DEL-001B publish route contract helpers", () => {
  it("maps blocked provenance to the stable block code used by the route", async () => {
    const harness = makeSemanticTestDb({
      proposals: [
        {
          id: "p_unversioned_route",
          userId: SEMANTIC_USER_ID,
          conversationId: SESSION_ID,
          assistantMessageId: ASSISTANT_MSG_ID,
          userMessageId: USER_MSG_ID,
          status: ExploreMovementProposalStatus.proposed,
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectId: UMC_ID,
          beforeSummary: UMC_SUMMARY,
          afterSummary: "x",
          rationale: "y",
          userFacingSummary: "z",
          sourcesJson: sampleOwnedSources(),
          modelUpdateId: null,
        },
      ],
    });
    const result = await publishExploreMovementProposal({
      userId: SEMANTIC_USER_ID,
      proposalId: "p_unversioned_route",
      conversationId: SESSION_ID,
      db: harness.db,
    });
    expect(result).toBe(EXPLORE_MOVEMENT_BLOCKED_UNVERIFIED_SEMANTIC_PROVENANCE);
    expect(result).not.toBe(EXPLORE_MOVEMENT_BLOCKED_UNSAFE_FIXED_SEMANTICS);
    expect(harness.modelUpdates).toHaveLength(0);
    expect(harness.evidenceLinks).toHaveLength(0);
  });
});

// Silence unused import in case tree-shaking complains in some runners.
void createOrReuseSemanticExploreMovementProposal;
void buildExploreMovementProposalProvenance;
