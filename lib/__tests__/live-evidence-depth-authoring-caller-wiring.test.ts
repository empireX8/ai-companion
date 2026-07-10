import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ModelUpdateType,
  UnderstandingLinkRole,
  UnderstandingLinkTargetType,
} from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  evidenceDepthAuthoringRequestSchema,
  INTERNAL_MODEL_UPDATE_CANDIDATE_CREATE_AUTHORED_FROM,
  internalModelUpdateCandidateCreateBodySchema,
  toEvidenceDepthAuthoringInput,
  toStructuredModelUpdateCandidateProposal,
} from "../internal-model-update-candidate-create";
import { publishModelUpdateCandidate } from "../model-update-candidate-publish-helper";

const authMock = vi.fn();
const createFromOperatorMock = vi.fn();

const OLD_ENV = process.env;

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("../../lib/internal-model-update-candidate-create", async () => {
  const actual = await vi.importActual<
    typeof import("../../lib/internal-model-update-candidate-create")
  >("../../lib/internal-model-update-candidate-create");
  return {
    ...actual,
    createInternalModelUpdateCandidateFromOperator: (...args: unknown[]) =>
      createFromOperatorMock(...args),
  };
});

const HONEST_RATIONALE =
  "Connects evening overwork to the missing stop point before commitments lock.";
const SOURCE_TEXT =
  "I keep working past the stop point even when I said I would not.";
const MOVEMENT_SUMMARY =
  "There is early evidence that energy drops after meetings.";

function validProposal(overrides?: Record<string, unknown>) {
  return {
    updateType: ModelUpdateType.link_detected,
    userFacingSummary: MOVEMENT_SUMMARY,
    affectedObjectType: UnderstandingLinkTargetType.pattern_claim,
    affectedObjectId: "claim-1",
    evidenceSelections: [
      { sourceType: "pattern_claim", sourceId: "claim-1" },
      { sourceType: "pattern_claim", sourceId: "claim-2" },
      { sourceType: "message", sourceId: "msg-1" },
    ],
    ...overrides,
  };
}

function validAuthoring(overrides?: Record<string, unknown>) {
  return {
    authoredRationale: HONEST_RATIONALE,
    authoredFrom: INTERNAL_MODEL_UPDATE_CANDIDATE_CREATE_AUTHORED_FROM,
    sourceTextForValidation: SOURCE_TEXT,
    graphSlotLinks: [
      {
        targetType: UnderstandingLinkTargetType.usermap_conclusion,
        targetId: "conclusion-1",
        role: UnderstandingLinkRole.supports,
        graphSlot: "related" as const,
      },
    ],
    ...overrides,
  };
}

function validBody(overrides?: {
  proposal?: Record<string, unknown>;
  evidenceDepthAuthoring?: Record<string, unknown> | null;
}) {
  const body: Record<string, unknown> = {
    proposal: validProposal(overrides?.proposal),
  };
  if (overrides && "evidenceDepthAuthoring" in overrides) {
    if (overrides.evidenceDepthAuthoring !== null) {
      body.evidenceDepthAuthoring = overrides.evidenceDepthAuthoring;
    }
  } else {
    body.evidenceDepthAuthoring = validAuthoring();
  }
  return body;
}

describe("live evidence depth authoring caller wiring — contract", () => {
  it("accepts valid operator payload with evidenceDepthAuthoring", () => {
    const parsed = internalModelUpdateCandidateCreateBodySchema.safeParse(validBody());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const authoring = toEvidenceDepthAuthoringInput(parsed.data.evidenceDepthAuthoring!);
    expect(authoring.authoredRationale).toBe(HONEST_RATIONALE);
    expect(authoring.authoredRationale).not.toBe(MOVEMENT_SUMMARY);
    expect(authoring.authoredRationale).not.toBe(SOURCE_TEXT);
    expect(authoring.graphSlotLinks[0]?.graphSlot).toBe("related");
  });

  it("maps proposal without inventing graphSlot from role", () => {
    const proposal = toStructuredModelUpdateCandidateProposal(validProposal() as never);
    expect(proposal.updateType).toBe("link_detected");
    expect(proposal.evidenceSelections.every((s) => !("graphSlot" in s))).toBe(true);
  });

  it("rejects missing graphSlot links at request schema", () => {
    const parsed = evidenceDepthAuthoringRequestSchema.safeParse({
      authoredRationale: HONEST_RATIONALE,
      authoredFrom: "internal",
      graphSlotLinks: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid graphSlot value at request schema", () => {
    const parsed = evidenceDepthAuthoringRequestSchema.safeParse({
      authoredRationale: HONEST_RATIONALE,
      authoredFrom: "internal",
      graphSlotLinks: [
        {
          targetType: UnderstandingLinkTargetType.usermap_conclusion,
          targetId: "conclusion-1",
          role: UnderstandingLinkRole.supports,
          graphSlot: "related_inferred",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("allows candidate create body without evidenceDepthAuthoring (backwards compatible)", () => {
    const parsed = internalModelUpdateCandidateCreateBodySchema.safeParse({
      proposal: validProposal(),
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.evidenceDepthAuthoring).toBeUndefined();
  });
});

describe("live evidence depth authoring caller wiring — helper", () => {
  async function realCreate() {
    const actual = await vi.importActual<
      typeof import("../internal-model-update-candidate-create")
    >("../internal-model-update-candidate-create");
    return actual.createInternalModelUpdateCandidateFromOperator;
  }

  it("passes evidenceDepthAuthoring into persistInternalModelUpdateCandidate", async () => {
    const persistCandidate = vi.fn().mockResolvedValue({
      runId: "run-1",
      artifactId: "art-1",
      artifactType: "model_update_candidate",
      processorVersion: "v1",
      runCreatedAt: "2026-07-09T00:00:00.000Z",
      persistedAt: "2026-07-09T00:00:00.000Z",
      diagnostics: { notes: [] },
      payload: {
        notes: ["evidenceDepthAuthoringReady:true", "persistedModelUpdateId:mu-1"],
        candidatesWritten: 1,
        blockedWriteReasons: [],
      },
      persistedModelUpdateId: "mu-1",
    });

    const body = internalModelUpdateCandidateCreateBodySchema.parse(validBody());
    const create = await realCreate();
    const result = await create({
      userId: "reviewer-1",
      body,
      persistCandidate: persistCandidate as never,
    });

    expect(persistCandidate).toHaveBeenCalledOnce();
    const call = persistCandidate.mock.calls[0]![0];
    expect(call.userId).toBe("reviewer-1");
    expect(call.evidenceDepthAuthoring).toEqual(
      toEvidenceDepthAuthoringInput(body.evidenceDepthAuthoring!),
    );
    expect(call.proposal.userFacingSummary).toBe(MOVEMENT_SUMMARY);
    expect(call.evidenceDepthAuthoring.authoredRationale).not.toBe(
      call.proposal.userFacingSummary,
    );
    expect(result.evidenceDepthAuthoringProvided).toBe(true);
    expect(result.evidenceDepthAuthoringReady).toBe(true);
    expect(result.evidenceDepthAuthoringBlockers).toEqual([]);
  });

  it("omits evidenceDepthAuthoring when not provided (backwards compatible)", async () => {
    const persistCandidate = vi.fn().mockResolvedValue({
      runId: "run-1",
      artifactId: "art-1",
      artifactType: "model_update_candidate",
      processorVersion: "v1",
      runCreatedAt: "2026-07-09T00:00:00.000Z",
      persistedAt: "2026-07-09T00:00:00.000Z",
      diagnostics: { notes: [] },
      payload: {
        notes: ["persistedModelUpdateId:mu-2"],
        candidatesWritten: 1,
        blockedWriteReasons: [],
      },
      persistedModelUpdateId: "mu-2",
    });

    const body = internalModelUpdateCandidateCreateBodySchema.parse({
      proposal: validProposal(),
    });
    const create = await realCreate();
    const result = await create({
      userId: "reviewer-1",
      body,
      persistCandidate: persistCandidate as never,
    });

    expect(persistCandidate.mock.calls[0]![0].evidenceDepthAuthoring).toBeUndefined();
    expect(result.evidenceDepthAuthoringProvided).toBe(false);
    expect(result.evidenceDepthAuthoringReady).toBe(false);
  });

  it("surfaces authoring blockers from persistence notes without inventing ready", async () => {
    const persistCandidate = vi.fn().mockResolvedValue({
      runId: "run-1",
      artifactId: "art-1",
      artifactType: "model_update_candidate",
      processorVersion: "v1",
      runCreatedAt: "2026-07-09T00:00:00.000Z",
      persistedAt: "2026-07-09T00:00:00.000Z",
      diagnostics: { notes: [] },
      payload: {
        notes: [
          "evidenceDepthAuthoringBlockers:generic_stored_rationale,no_eligible_graph_slot_links",
          "persistedModelUpdateId:mu-3",
        ],
        candidatesWritten: 1,
        blockedWriteReasons: [],
      },
      persistedModelUpdateId: "mu-3",
    });

    const body = internalModelUpdateCandidateCreateBodySchema.parse(
      validBody({
        evidenceDepthAuthoring: validAuthoring({
          authoredRationale: "Surfaced from your recent material.",
        }),
      }),
    );

    const create = await realCreate();
    const result = await create({
      userId: "reviewer-1",
      body,
      persistCandidate: persistCandidate as never,
    });

    expect(result.evidenceDepthAuthoringReady).toBe(false);
    expect(result.evidenceDepthAuthoringBlockers).toEqual([
      "generic_stored_rationale",
      "no_eligible_graph_slot_links",
    ]);
  });

  it("supports contradiction_node affected object type in create contract", () => {
    const parsed = internalModelUpdateCandidateCreateBodySchema.safeParse(
      validBody({
        proposal: {
          affectedObjectType: UnderstandingLinkTargetType.contradiction_node,
          affectedObjectId: "node-1",
        },
      }),
    );
    expect(parsed.success).toBe(true);
  });
});

describe("live evidence depth authoring caller wiring — publish after create notes", () => {
  it("valid authoring ready note implies materialization path remains available via publish helper", async () => {
    // Contract: create returns ready note; publish helper is the materializer entry.
    // This test locks the wiring boundary without inventing authoring at publish.
    const publishSource = readFileSync(
      join(process.cwd(), "lib/model-update-candidate-publish-helper.ts"),
      "utf8",
    );
    expect(publishSource).toContain("maybeMaterializeEvidenceDepthForPublishedModelUpdate");
    expect(publishSource).not.toContain("userFacingSummary as whyItMatters");
    expect(typeof publishModelUpdateCandidate).toBe("function");
  });

  it("create helper never falls back to userFacingSummary as authoredRationale", () => {
    const helperSource = readFileSync(
      join(process.cwd(), "lib/internal-model-update-candidate-create.ts"),
      "utf8",
    );
    expect(helperSource).toContain("evidenceDepthAuthoring");
    expect(helperSource).not.toMatch(
      /authoredRationale:\s*(body\.)?proposal\.userFacingSummary/,
    );
    expect(helperSource).not.toMatch(/graphSlot:\s*infer/i);
  });
});

describe("internal ModelUpdate candidate create route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = {
      ...OLD_ENV,
      INTERNAL_USER_MAP_REVIEWER_IDS: "reviewer-1",
    };
    authMock.mockResolvedValue({ userId: "reviewer-1" });
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const route = await import("../../app/api/internal/model-updates/candidates/route");
    const response = await route.POST(
      new Request("http://localhost/api/internal/model-updates/candidates", {
        method: "POST",
        body: JSON.stringify(validBody()),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 for non-reviewer", async () => {
    authMock.mockResolvedValueOnce({ userId: "non-reviewer" });
    const route = await import("../../app/api/internal/model-updates/candidates/route");
    const response = await route.POST(
      new Request("http://localhost/api/internal/model-updates/candidates", {
        method: "POST",
        body: JSON.stringify(validBody()),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid authoring payload (missing graphSlot)", async () => {
    const route = await import("../../app/api/internal/model-updates/candidates/route");
    const response = await route.POST(
      new Request("http://localhost/api/internal/model-updates/candidates", {
        method: "POST",
        body: JSON.stringify(
          validBody({
            evidenceDepthAuthoring: {
              authoredRationale: HONEST_RATIONALE,
              authoredFrom: "internal",
              graphSlotLinks: [
                {
                  targetType: UnderstandingLinkTargetType.usermap_conclusion,
                  targetId: "conclusion-1",
                  role: UnderstandingLinkRole.supports,
                },
              ],
            },
          }),
        ),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(createFromOperatorMock).not.toHaveBeenCalled();
  });

  it("returns 200 and forwards evidenceDepthAuthoring to create helper", async () => {
    createFromOperatorMock.mockResolvedValueOnce({
      persistence: {
        runId: "run-1",
        persistedModelUpdateId: "mu-created-1",
        payload: {
          candidatesWritten: 1,
          blockedWriteReasons: [],
          notes: ["evidenceDepthAuthoringReady:true"],
        },
      },
      evidenceDepthAuthoringProvided: true,
      evidenceDepthAuthoringReady: true,
      evidenceDepthAuthoringBlockers: [],
      evidenceDepthAuthoringSkippedReason: null,
    });

    const route = await import("../../app/api/internal/model-updates/candidates/route");
    const response = await route.POST(
      new Request("http://localhost/api/internal/model-updates/candidates", {
        method: "POST",
        body: JSON.stringify(validBody()),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe("mu-created-1");
    expect(body.evidenceDepthAuthoringReady).toBe(true);
    expect(createFromOperatorMock).toHaveBeenCalledOnce();
    const call = createFromOperatorMock.mock.calls[0]![0];
    expect(call.userId).toBe("reviewer-1");
    expect(call.body.evidenceDepthAuthoring.authoredRationale).toBe(HONEST_RATIONALE);
    expect(call.body.evidenceDepthAuthoring.graphSlotLinks[0].graphSlot).toBe("related");
  });

  it("returns 200 with authoring blockers when create helper reports not ready", async () => {
    createFromOperatorMock.mockResolvedValueOnce({
      persistence: {
        runId: "run-2",
        persistedModelUpdateId: "mu-created-2",
        payload: {
          candidatesWritten: 1,
          blockedWriteReasons: [],
          notes: ["evidenceDepthAuthoringBlockers:movement_copy_used_as_rationale"],
        },
      },
      evidenceDepthAuthoringProvided: true,
      evidenceDepthAuthoringReady: false,
      evidenceDepthAuthoringBlockers: ["movement_copy_used_as_rationale"],
      evidenceDepthAuthoringSkippedReason: null,
    });

    const route = await import("../../app/api/internal/model-updates/candidates/route");
    const response = await route.POST(
      new Request("http://localhost/api/internal/model-updates/candidates", {
        method: "POST",
        body: JSON.stringify(
          validBody({
            evidenceDepthAuthoring: validAuthoring({
              authoredRationale: MOVEMENT_SUMMARY,
            }),
          }),
        ),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe("mu-created-2");
    expect(body.evidenceDepthAuthoringReady).toBe(false);
    expect(body.evidenceDepthAuthoringBlockers).toContain(
      "movement_copy_used_as_rationale",
    );
  });
});

describe("live evidence depth authoring caller wiring — #121 composition from operator payload", () => {
  it("valid pattern_claim operator authoring persists rationale + graphSlot via #121", async () => {
    const { maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate } = await import(
      "../live-evidence-depth-authoring-path"
    );

    const upsertRationale = vi.fn().mockResolvedValue({ id: "rat-1" });
    const upsertGraphSlotLinks = vi.fn().mockResolvedValue({
      written: [{ id: "uel-1", created: true }],
      skippedIneligible: 0,
    });

    const body = internalModelUpdateCandidateCreateBodySchema.parse(validBody());
    const outcome = await maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate(
      {
        userId: "reviewer-1",
        affectedObjectType: body.proposal.affectedObjectType,
        affectedObjectId: body.proposal.affectedObjectId,
        userFacingSummary: body.proposal.userFacingSummary,
        authoring: toEvidenceDepthAuthoringInput(body.evidenceDepthAuthoring!),
      },
      {
        db: {} as never,
        upsertRationale,
        upsertGraphSlotLinks,
        checkPublicTargetEligibility: async () => true,
      },
    );

    expect("skipped" in outcome).toBe(false);
    if ("skipped" in outcome) return;
    expect(outcome.ready).toBe(true);
    expect(upsertRationale).toHaveBeenCalledOnce();
    expect(upsertGraphSlotLinks).toHaveBeenCalledOnce();
    expect(upsertRationale.mock.calls[0]![0].input.rationale).toBe(HONEST_RATIONALE);
    expect(upsertRationale.mock.calls[0]![0].input.rationale).not.toBe(MOVEMENT_SUMMARY);
  });

  it("valid contradiction_node operator authoring persists via #121", async () => {
    const { maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate } = await import(
      "../live-evidence-depth-authoring-path"
    );

    const upsertRationale = vi.fn().mockResolvedValue({ id: "rat-2" });
    const upsertGraphSlotLinks = vi.fn().mockResolvedValue({
      written: [{ id: "uel-2", created: true }],
      skippedIneligible: 0,
    });

    const body = internalModelUpdateCandidateCreateBodySchema.parse(
      validBody({
        proposal: {
          affectedObjectType: UnderstandingLinkTargetType.contradiction_node,
          affectedObjectId: "node-1",
        },
      }),
    );

    const outcome = await maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate(
      {
        userId: "reviewer-1",
        affectedObjectType: "contradiction_node",
        affectedObjectId: "node-1",
        userFacingSummary: body.proposal.userFacingSummary,
        authoring: toEvidenceDepthAuthoringInput(body.evidenceDepthAuthoring!),
      },
      {
        db: {} as never,
        upsertRationale,
        upsertGraphSlotLinks,
        checkPublicTargetEligibility: async () => true,
      },
    );

    expect("skipped" in outcome).toBe(false);
    if ("skipped" in outcome) return;
    expect(outcome.ready).toBe(true);
  });

  it("blocks movement-copy / generic / sourceText-equal rationale from operator payload", async () => {
    const { maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate } = await import(
      "../live-evidence-depth-authoring-path"
    );

    for (const authoredRationale of [
      MOVEMENT_SUMMARY,
      "Surfaced from your recent material.",
      SOURCE_TEXT,
    ]) {
      const body = internalModelUpdateCandidateCreateBodySchema.parse(
        validBody({
          evidenceDepthAuthoring: validAuthoring({ authoredRationale }),
        }),
      );
      const outcome = await maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate(
        {
          userId: "reviewer-1",
          affectedObjectType: "pattern_claim",
          affectedObjectId: "claim-1",
          userFacingSummary: MOVEMENT_SUMMARY,
          authoring: toEvidenceDepthAuthoringInput(body.evidenceDepthAuthoring!),
        },
        {
          db: {} as never,
          upsertRationale: vi.fn().mockResolvedValue({ id: "rat-x" }),
          upsertGraphSlotLinks: vi.fn().mockResolvedValue({
            written: [],
            skippedIneligible: 0,
          }),
          checkPublicTargetEligibility: async () => true,
        },
      );
      expect("skipped" in outcome).toBe(false);
      if ("skipped" in outcome) continue;
      expect(outcome.ready).toBe(false);
    }
  });

  it("excludes private/ineligible target links from operator authoring", async () => {
    const { maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate } = await import(
      "../live-evidence-depth-authoring-path"
    );

    const upsertRationale = vi.fn().mockResolvedValue({ id: "rat-3" });
    const upsertGraphSlotLinks = vi.fn().mockResolvedValue({
      written: [],
      skippedIneligible: 1,
    });

    const body = internalModelUpdateCandidateCreateBodySchema.parse(validBody());
    const outcome = await maybePersistEvidenceDepthAuthoringFromModelUpdateCandidate(
      {
        userId: "reviewer-1",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "claim-1",
        userFacingSummary: MOVEMENT_SUMMARY,
        authoring: toEvidenceDepthAuthoringInput(body.evidenceDepthAuthoring!),
      },
      {
        db: {} as never,
        upsertRationale,
        upsertGraphSlotLinks,
        checkPublicTargetEligibility: async () => false,
      },
    );

    expect("skipped" in outcome).toBe(false);
    if ("skipped" in outcome) return;
    expect(outcome.ready).toBe(false);
    expect(outcome.blockers).toContain("no_eligible_graph_slot_links");
  });
});

describe("live evidence depth authoring caller wiring — no UI drift", () => {
  it("does not change Today gate or reference route files", () => {
    const todayGate = readFileSync(
      join(
        process.cwd(),
        "lib/orvek-v0/production/today-evidence-pointer-depth-gate.ts",
      ),
      "utf8",
    );
    expect(todayGate).toContain("REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS");

    const createHelper = readFileSync(
      join(process.cwd(), "lib/internal-model-update-candidate-create.ts"),
      "utf8",
    );
    expect(createHelper).not.toContain("components/");
    expect(createHelper).not.toContain("orvek-v0-reference");
  });
});
