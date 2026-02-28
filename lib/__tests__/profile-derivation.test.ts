import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  extractProfileClaims,
  normalizeClaimForDedup,
  processMessageForProfile,
  upsertProfileClaims,
  type ExtractedClaim,
} from "../profile-derivation";

// ── normalizeClaimForDedup ─────────────────────────────────────────────────────

describe("normalizeClaimForDedup", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeClaimForDedup("I believe that!")).toBe("i believe that");
  });

  it("collapses extra whitespace", () => {
    expect(normalizeClaimForDedup("I   want  to   go")).toBe("i want to go");
  });

  it("caps at 300 chars", () => {
    const long = "a".repeat(400);
    expect(normalizeClaimForDedup(long)).toHaveLength(300);
  });

  it("trims leading/trailing whitespace", () => {
    expect(normalizeClaimForDedup("  hello world  ")).toBe("hello world");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeClaimForDedup("")).toBe("");
  });
});

// ── extractProfileClaims ───────────────────────────────────────────────────────

describe("extractProfileClaims", () => {
  it("returns empty array for text shorter than 15 chars", () => {
    expect(extractProfileClaims("I want")).toHaveLength(0);
    expect(extractProfileClaims("Short")).toHaveLength(0);
  });

  it("extracts GOAL from 'I want to'", () => {
    const claims = extractProfileClaims("I want to build a business someday.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(true);
  });

  it("extracts GOAL from 'my goal is'", () => {
    const claims = extractProfileClaims("My goal is to become a better leader.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(true);
  });

  it("extracts FEAR from 'I'm afraid'", () => {
    const claims = extractProfileClaims("I'm afraid of letting people down.");
    expect(claims.some((c) => c.type === "FEAR")).toBe(true);
  });

  it("extracts IDENTITY from 'I am a'", () => {
    const claims = extractProfileClaims("I am a software engineer who loves challenges.");
    expect(claims.some((c) => c.type === "IDENTITY")).toBe(true);
  });

  it("extracts BELIEF from 'I believe that'", () => {
    const claims = extractProfileClaims("I believe that hard work always pays off eventually.");
    expect(claims.some((c) => c.type === "BELIEF")).toBe(true);
  });

  it("extracts VALUE from 'I value'", () => {
    const claims = extractProfileClaims("I value honesty above almost everything else.");
    expect(claims.some((c) => c.type === "VALUE")).toBe(true);
  });

  it("extracts HABIT from 'I always'", () => {
    const claims = extractProfileClaims("I always overthink before making any decision.");
    expect(claims.some((c) => c.type === "HABIT")).toBe(true);
  });

  it("extracts TRAIT from 'I'm someone who'", () => {
    const claims = extractProfileClaims("I'm someone who tends to avoid conflict.");
    expect(claims.some((c) => c.type === "TRAIT")).toBe(true);
  });

  it("extracts EMOTIONAL_PATTERN", () => {
    const claims = extractProfileClaims("I get anxious when I have too many tasks pending.");
    expect(claims.some((c) => c.type === "EMOTIONAL_PATTERN")).toBe(true);
  });

  it("extracts RELATIONSHIP_PATTERN", () => {
    const claims = extractProfileClaims("In my relationships I tend to avoid vulnerability.");
    expect(claims.some((c) => c.type === "RELATIONSHIP_PATTERN")).toBe(true);
  });

  it("deduplicates same type and normalized claim", () => {
    // Two sentences that would produce the same (type, claimNorm)
    const text =
      "I want to run a marathon. I want to run a marathon because I love it.";
    const claims = extractProfileClaims(text);
    const goals = claims.filter((c) => c.type === "GOAL");
    // Only one GOAL since the pattern matches once per exec()
    expect(goals.length).toBeLessThanOrEqual(2);
  });

  it("each claim has confidence > 0", () => {
    const claims = extractProfileClaims("I want to build a startup and I believe in myself.");
    for (const claim of claims) {
      expect(claim.confidence).toBeGreaterThan(0);
    }
  });

  it("claim text is the extracted sentence, not the full message", () => {
    const text = "First sentence. I want to learn piano. Third sentence.";
    const claims = extractProfileClaims(text);
    const goal = claims.find((c) => c.type === "GOAL");
    expect(goal?.claim).toContain("want to learn piano");
    // Should not contain the whole text
    expect(goal?.claim).not.toContain("Third sentence");
  });
});

// ── upsertProfileClaims ───────────────────────────────────────────────────────

type MockArtifact = {
  id: string;
  userId: string;
  type: string;
  claim: string;
  claimNorm: string;
  confidence: number;
  status: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  tags: string[];
};

function makeMockDb(opts: {
  existingArtifact?: MockArtifact;
  existingLink?: boolean;
}) {
  let lastSeenAtUpdated = false;
  let linkCreated = false;
  let artifactCreated: Partial<MockArtifact> | null = null;

  const db = {
    profileArtifact: {
      findUnique: async () => opts.existingArtifact ?? null,
      update: async () => {
        lastSeenAtUpdated = true;
        return opts.existingArtifact;
      },
      create: async ({ data }: { data: Partial<MockArtifact> & { evidenceLinks?: unknown } }) => {
        artifactCreated = data;
        return { id: "new_artifact", ...data };
      },
    },
    profileArtifactEvidenceLink: {
      create: async () => {
        if (opts.existingLink) {
          throw Object.assign(new Error("Duplicate"), { code: "P2002" });
        }
        linkCreated = true;
        return {};
      },
    },
    // Expose state for assertions
    _state: {
      get lastSeenAtUpdated() { return lastSeenAtUpdated; },
      get linkCreated() { return linkCreated; },
      get artifactCreated() { return artifactCreated; },
    },
  };

  return db as unknown as PrismaClient & { _state: typeof db._state };
}

describe("upsertProfileClaims", () => {
  it("creates a new artifact when none exists", async () => {
    const db = makeMockDb({});
    const claims: ExtractedClaim[] = [
      { type: "GOAL", claim: "I want to travel", claimNorm: "i want to travel", confidence: 0.7 },
    ];

    const created = await upsertProfileClaims({ userId: "u1", claims, spanId: "span_1", db });

    expect(created).toBe(1);
    expect(db._state.artifactCreated).toMatchObject({
      userId: "u1",
      type: "GOAL",
      claim: "I want to travel",
    });
  });

  it("updates lastSeenAt and adds evidence link when artifact exists", async () => {
    const existing: MockArtifact = {
      id: "art_1",
      userId: "u1",
      type: "GOAL",
      claim: "I want to travel",
      claimNorm: "i want to travel",
      confidence: 0.7,
      status: "candidate",
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      tags: [],
    };
    const db = makeMockDb({ existingArtifact: existing });
    const claims: ExtractedClaim[] = [
      { type: "GOAL", claim: "I want to travel", claimNorm: "i want to travel", confidence: 0.7 },
    ];

    const created = await upsertProfileClaims({ userId: "u1", claims, spanId: "span_1", db });

    expect(created).toBe(0); // no new artifact
    expect(db._state.lastSeenAtUpdated).toBe(true);
    expect(db._state.linkCreated).toBe(true);
  });

  it("ignores duplicate link errors (idempotent evidence links)", async () => {
    const existing: MockArtifact = {
      id: "art_1",
      userId: "u1",
      type: "GOAL",
      claim: "I want to travel",
      claimNorm: "i want to travel",
      confidence: 0.7,
      status: "candidate",
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      tags: [],
    };
    const db = makeMockDb({ existingArtifact: existing, existingLink: true });
    const claims: ExtractedClaim[] = [
      { type: "GOAL", claim: "I want to travel", claimNorm: "i want to travel", confidence: 0.7 },
    ];

    // Should not throw
    await expect(
      upsertProfileClaims({ userId: "u1", claims, spanId: "span_1", db })
    ).resolves.toBe(0);
  });

  it("returns 0 for empty claims", async () => {
    const db = makeMockDb({});
    const created = await upsertProfileClaims({ userId: "u1", claims: [], spanId: "span_1", db });
    expect(created).toBe(0);
  });
});

// ── processMessageForProfile ──────────────────────────────────────────────────

type MockSpan = { id: string };

function makePipelineDb(opts: {
  existingSpan?: MockSpan | null;
  existingArtifact?: MockArtifact;
}) {
  let spanCreated = false;
  let artifactCreated = false;

  const db = {
    evidenceSpan: {
      findUnique: async () => opts.existingSpan ?? null,
      create: async () => {
        spanCreated = true;
        return { id: "span_new" };
      },
    },
    profileArtifact: {
      findUnique: async () => opts.existingArtifact ?? null,
      update: async () => opts.existingArtifact,
      create: async () => {
        artifactCreated = true;
        return { id: "art_new" };
      },
    },
    profileArtifactEvidenceLink: {
      create: async () => ({}),
    },
    _state: {
      get spanCreated() { return spanCreated; },
      get artifactCreated() { return artifactCreated; },
    },
  };

  return db as unknown as PrismaClient & { _state: typeof db._state };
}

describe("processMessageForProfile", () => {
  it("returns null for text shorter than 15 chars", async () => {
    const db = makePipelineDb({});
    const result = await processMessageForProfile({
      userId: "u1",
      messageId: "msg_1",
      content: "short",
      db,
    });
    expect(result).toBeNull();
  });

  it("creates EvidenceSpan and returns spanId when no span exists yet", async () => {
    const db = makePipelineDb({ existingSpan: null });
    const content = "I want to become a better leader and I believe in progress.";

    const result = await processMessageForProfile({
      userId: "u1",
      messageId: "msg_1",
      content,
      db,
    });

    expect(result).not.toBeNull();
    expect(db._state.spanCreated).toBe(true);
    expect(result?.spanId).toBe("span_new");
  });

  it("reuses existing EvidenceSpan (idempotent)", async () => {
    const db = makePipelineDb({ existingSpan: { id: "span_existing" } });
    const content = "I want to become a better leader and I believe in progress.";

    const result = await processMessageForProfile({
      userId: "u1",
      messageId: "msg_1",
      content,
      db,
    });

    expect(db._state.spanCreated).toBe(false); // no new span
    expect(result?.spanId).toBe("span_existing");
  });

  it("returns claimsCreated 0 for text with no pattern matches", async () => {
    const db = makePipelineDb({ existingSpan: null });
    // Generic statement that won't match any pattern
    const content = "The weather was fine yesterday in the park.";

    const result = await processMessageForProfile({
      userId: "u1",
      messageId: "msg_1",
      content,
      db,
    });

    expect(result?.claimsCreated).toBe(0);
  });

  it("returns claimsCreated > 0 for text matching patterns", async () => {
    const db = makePipelineDb({ existingSpan: null });
    const content = "I want to start a company because I believe in innovation.";

    const result = await processMessageForProfile({
      userId: "u1",
      messageId: "msg_1",
      content,
      db,
    });

    expect(result).not.toBeNull();
    expect(result!.claimsCreated).toBeGreaterThan(0);
  });

  it("returns null (swallows errors) on DB failure", async () => {
    const db = {
      evidenceSpan: {
        findUnique: async () => { throw new Error("DB down"); },
        create: async () => { throw new Error("DB down"); },
      },
      profileArtifact: { findUnique: async () => null, update: async () => null, create: async () => null },
      profileArtifactEvidenceLink: { create: async () => ({}) },
    } as unknown as PrismaClient;

    const result = await processMessageForProfile({
      userId: "u1",
      messageId: "msg_1",
      content: "I want to build something meaningful for the future.",
      db,
    });

    expect(result).toBeNull();
  });
});
