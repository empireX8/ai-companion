import { beforeEach, describe, expect, it, vi } from "vitest";

import { projectVisiblePatternClaim } from "../pattern-visible-claim";

const authMock = vi.fn();

const prismaMock = {
  patternClaim: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  message: {
    count: vi.fn(),
  },
  session: {
    count: vi.fn(),
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("@/lib/pattern-visible-claim", async () => {
  const actual = await import("../pattern-visible-claim");
  return actual;
});

vi.mock("@/lib/patterns-api", async () => {
  const actual = await import("../patterns-api");
  return actual;
});

vi.mock("@/lib/pattern-action-generator", async () => {
  const actual = await import("../pattern-action-generator");
  return actual;
});

vi.mock("@/lib/pattern-claim-action", async () => {
  const actual = await import("../pattern-claim-action");
  return actual;
});

vi.mock("@/lib/pattern-batch-orchestrator", () => ({
  patternBatchOrchestrator: {
    runForUser: vi.fn(),
  },
}));

function makeEvidence(quotes: string[]) {
  return quotes.map((quote, index) => ({
    id: `ev-${index + 1}`,
    source: "derivation",
    sessionId: `sess-${index + 1}`,
    messageId: `msg-${index + 1}`,
    quote,
    createdAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`),
  }));
}

function makeClaim(overrides: Partial<Parameters<typeof projectVisiblePatternClaim>[0]> = {}) {
  return {
    id: "claim-1",
    patternType: "trigger_condition" as const,
    summary: "Recurring trigger-response patterns in conversation history",
    status: "active" as const,
    strengthLevel: "developing" as const,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    evidence: makeEvidence([
      "I default to people-pleasing when someone seems upset with me",
      "When pressure rises, I start appeasing people instead of staying honest",
      "I walk it back quickly if a boundary might disappoint someone",
    ]),
    actions: [],
    ...overrides,
  };
}

describe("projectVisiblePatternClaim", () => {
  it("omits claims that only have shell summary + weak receipts", () => {
    const projected = projectVisiblePatternClaim(
      makeClaim({
        evidence: makeEvidence([
          "I notice this sometimes",
          "I keep thinking about this",
        ]),
      })
    );

    expect(projected).toBeNull();
  });

  it("projects clustered evidence into a specific visible claim", () => {
    const projected = projectVisiblePatternClaim(makeClaim());

    expect(projected).not.toBeNull();
    expect(projected!.summary).toBe(
      "When pressure rises, you default to pleasing or appeasing."
    );
  });

  it("keeps summary distinct from literal quote", () => {
    const projected = projectVisiblePatternClaim(
      makeClaim({
        patternType: "inner_critic",
        summary: "Recurring self-critical pattern in conversation history",
        evidence: makeEvidence([
          "I struggle to trust my own judgment when I have to commit",
          "I doubt myself more whenever I have to assess my ability",
        ]),
      })
    );

    expect(projected).not.toBeNull();
    expect(projected!.summary).toBe("Self-doubt shows up when you assess your own ability.");
    expect(projected!.summary).not.toBe(projected!.receipts[0]!.quote);
  });

  it("keeps contradiction_drift separate", () => {
    const projected = projectVisiblePatternClaim(
      makeClaim({
        patternType: "contradiction_drift",
        summary: "Recurring goal behavior gap across 3 contradictions",
        evidence: [],
      })
    );

    expect(projected).not.toBeNull();
    expect(projected!.summary).toBe("Recurring goal behavior gap across 3 contradictions");
  });
});

describe("/api/patterns visible projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "u1" });
    prismaMock.message.count.mockResolvedValue(42);
    prismaMock.session.count.mockResolvedValue(7);
  });

  it("omits claims with no safe visible summary and keeps projected claims", async () => {
    prismaMock.patternClaim.findMany.mockResolvedValue([
      {
        id: "claim-unsafe",
        userId: "u1",
        patternType: "trigger_condition",
        summary: "Recurring trigger-response patterns in conversation history",
        status: "active",
        strengthLevel: "developing",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        evidence: makeEvidence(["I notice this sometimes", "I keep thinking about this"]),
        actions: [],
      },
      {
        id: "claim-safe",
        userId: "u1",
        patternType: "trigger_condition",
        summary: "Recurring trigger-response patterns in conversation history",
        status: "active",
        strengthLevel: "developing",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        evidence: makeEvidence([
          "I default to people-pleasing when someone seems upset with me",
          "When pressure rises, I start appeasing people instead of staying honest",
          "I walk it back quickly if a boundary might disappoint someone",
        ]),
        actions: [],
      },
    ]);

    const route = await import("../../app/api/patterns/route");
    const response = await route.GET();
    const payload = await response.json();

    const triggerSection = payload.sections.find(
      (section: { familyKey: string }) => section.familyKey === "trigger_condition"
    );

    expect(triggerSection.claims).toHaveLength(1);
    expect(triggerSection.claims[0]!.id).toBe("claim-safe");
    expect(triggerSection.claims[0]!.summary).toBe(
      "When pressure rises, you default to pleasing or appeasing."
    );
  });
});

describe("/api/patterns/actions visible projection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "u1" });
  });

  it("rejects action generation when the claim has no safe visible summary", async () => {
    prismaMock.patternClaim.findFirst.mockResolvedValue({
      id: "claim-unsafe",
      userId: "u1",
      patternType: "trigger_condition",
      summary: "Recurring trigger-response patterns in conversation history",
      status: "active",
      strengthLevel: "developing",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      evidence: makeEvidence(["I notice this sometimes", "I keep thinking about this"]),
      actions: [],
    });

    const route = await import("../../app/api/patterns/actions/route");
    const request = new Request("http://localhost/api/patterns/actions", {
      method: "POST",
      body: JSON.stringify({ claimId: "claim-unsafe" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await route.POST(request);
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.code).toBe("CLAIM_NOT_READY");
  });
});
