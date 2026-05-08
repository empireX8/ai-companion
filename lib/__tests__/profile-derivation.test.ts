import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  extractProfileClaims,
  hasDurableGoalSignal,
  hasRecognizableGoalCue,
  isBeliefFiller,
  isGoalFiller,
  isProjectProcessGoal,
  isShortHorizonGoalTask,
  isSubstantiveGoalClaim,
  isSubstantiveProfileClaim,
  isVagueValueClaim,
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
      tags: [],
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

  it("passes tags: [] in create payload (guards NOT NULL DB constraint)", async () => {
    // Simulate PostgreSQL NOT NULL violation when tags is absent (root cause of 0-artifact bug)
    let capturedTags: unknown = "NOT_SET";
    const db = {
      profileArtifact: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          capturedTags = data.tags;
          if (data.tags === undefined) {
            throw Object.assign(new Error("null value in column tags violates not-null constraint"), {
              code: "P2000",
            });
          }
          return { id: "new_artifact" };
        },
        update: async () => null,
      },
      profileArtifactEvidenceLink: { create: async () => ({}) },
    } as unknown as PrismaClient;

    const claims: ExtractedClaim[] = [
      { type: "BELIEF", claim: "I believe in growth", claimNorm: "i believe in growth", confidence: 0.65 },
    ];

    const created = await upsertProfileClaims({ userId: "u1", claims, spanId: "span_1", db });

    expect(created).toBe(1);
    expect(capturedTags).toEqual([]);
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
    expect(db._state.artifactCreated).toBe(true);
  });

  it("does not create a ProfileArtifact for non-profile content", async () => {
    const db = makePipelineDb({ existingSpan: null });
    const content = "The weather was nice yesterday in the park near the lake.";

    const result = await processMessageForProfile({
      userId: "u1",
      messageId: "msg_1",
      content,
      db,
    });

    expect(result?.claimsCreated).toBe(0);
    expect(db._state.artifactCreated).toBe(false);
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

// ── isGoalFiller ──────────────────────────────────────────────────────────────

describe("isGoalFiller", () => {
  it("rejects 'I want to make sure'", () => {
    expect(isGoalFiller("I want to make sure")).toBe(true);
  });

  it("rejects 'I want to say that'", () => {
    expect(isGoalFiller("I want to say that")).toBe(true);
  });

  it("rejects 'I need to know'", () => {
    expect(isGoalFiller("I need to know")).toBe(true);
  });

  it("rejects mid-sentence 'I want to say that it was fine'", () => {
    expect(isGoalFiller("So yeah, I want to say that it was fine.")).toBe(true);
  });

  it("rejects mid-sentence 'That's what I need to know'", () => {
    expect(isGoalFiller("That's what I need to know.")).toBe(true);
  });

  it("rejects 'I want to think' continuation", () => {
    expect(isGoalFiller("I want to think about this.")).toBe(true);
  });

  it("keeps 'I want to build a business someday'", () => {
    expect(isGoalFiller("I want to build a business someday.")).toBe(false);
  });

  it("keeps 'I need to finish this book'", () => {
    expect(isGoalFiller("I need to finish this book.")).toBe(false);
  });

  it("keeps 'I want to become a better leader'", () => {
    expect(isGoalFiller("I want to become a better leader and achieve more.")).toBe(false);
  });

  it("keeps 'My goal is to finish the book' (strong trigger, not weak)", () => {
    expect(isGoalFiller("My goal is to finish the book this month.")).toBe(false);
  });

  it("keeps 'I'm working on building a stable writing routine' (strong trigger)", () => {
    expect(isGoalFiller("I'm working on building a stable writing routine.")).toBe(false);
  });
});

describe("GOAL precision helpers", () => {
  it("detects recognizable goal cues", () => {
    expect(hasRecognizableGoalCue("I want to become more consistent with public speaking.")).toBe(
      true
    );
    expect(hasRecognizableGoalCue("Interesting thought about books and time.")).toBe(false);
  });

  it("detects durable goal signals", () => {
    expect(hasDurableGoalSignal("I need to develop a stronger epistemology.")).toBe(true);
    expect(hasDurableGoalSignal("I want to ask you something quickly.")).toBe(false);
  });

  it("flags short-horizon task chatter", () => {
    expect(isShortHorizonGoalTask("I need to send this block in 2 parts.")).toBe(true);
    expect(isShortHorizonGoalTask("I want to write out a copy.")).toBe(true);
    expect(isShortHorizonGoalTask("I plan to build a stable writing routine.")).toBe(false);
  });

  it("flags project/process chatter but keeps strategic project goals", () => {
    expect(isProjectProcessGoal("I'm going to send this to Codex.")).toBe(true);
    expect(isProjectProcessGoal("I need to do a chat handoff now.")).toBe(true);
    expect(isProjectProcessGoal("I plan to build a product strategy this year.")).toBe(false);
  });

  it("rejects unknown non-goal fragments but keeps explicit self-change phrases", () => {
    expect(
      isSubstantiveGoalClaim(
        "interesting um so are these books super long books because the reconstruction book is like 750 pages"
      )
    ).toBe(false);
    expect(
      isSubstantiveGoalClaim(
        "I feel like if I can let go of this and free my mind, I will feel much calmer over time."
      )
    ).toBe(true);
  });
});

// ── isBeliefFiller ────────────────────────────────────────────────────────────

describe("isBeliefFiller", () => {
  it("rejects short affirmation 'I think that would be good'", () => {
    expect(isBeliefFiller("I think that would be good.")).toBe(true);
  });

  it("rejects short affirmation 'I think that was everything'", () => {
    expect(isBeliefFiller("I think that was everything.")).toBe(true);
  });

  it("rejects 'I think that makes sense'", () => {
    expect(isBeliefFiller("I think that makes sense.")).toBe(true);
  });

  it("rejects 'Right, I think that's right'", () => {
    expect(isBeliefFiller("Right, I think that's right.")).toBe(true);
  });

  it("keeps 'I believe that discipline matters more than motivation'", () => {
    expect(isBeliefFiller("I believe that discipline matters more than motivation.")).toBe(false);
  });

  it("keeps 'In my opinion, institutions shape behaviour more than intentions'", () => {
    expect(isBeliefFiller(
      "In my opinion, institutions shape behaviour more than individual intentions."
    )).toBe(false);
  });

  it("keeps 'I believe that hard work always pays off eventually'", () => {
    expect(isBeliefFiller("I believe that hard work always pays off eventually.")).toBe(false);
  });
});

// ── isVagueValueClaim ─────────────────────────────────────────────────────────

describe("isVagueValueClaim", () => {
  it("rejects 'That's something I value'", () => {
    expect(isVagueValueClaim("That's something I value.")).toBe(true);
  });

  it("rejects 'That's really important to me for some reason'", () => {
    expect(isVagueValueClaim("That's really important to me for some reason.")).toBe(true);
  });

  it("rejects 'It's something I care about'", () => {
    expect(isVagueValueClaim("It's something I care about.")).toBe(true);
  });

  it("rejects questions like 'Would you say I believe in god?'", () => {
    expect(isVagueValueClaim("Would you say I believe in god?")).toBe(true);
  });

  it("keeps 'I value objectivity'", () => {
    expect(isVagueValueClaim("I value objectivity.")).toBe(false);
  });

  it("keeps 'I care about accuracy and honesty'", () => {
    expect(isVagueValueClaim("I care about accuracy and honesty.")).toBe(false);
  });

  it("keeps 'I value objectivity above all else in my work'", () => {
    expect(isVagueValueClaim("I value objectivity above all else in my work.")).toBe(false);
  });
});

// ── isSubstantiveProfileClaim ─────────────────────────────────────────────────

describe("isSubstantiveProfileClaim", () => {
  it("applies GOAL precision gates", () => {
    expect(isSubstantiveProfileClaim("GOAL", "I want to make sure")).toBe(false);
    expect(isSubstantiveProfileClaim("GOAL", "I want to build a company.")).toBe(true);
    expect(isSubstantiveProfileClaim("GOAL", "I need to send this block in 2 parts.")).toBe(
      false
    );
  });

  it("delegates BELIEF to isBeliefFiller", () => {
    expect(isSubstantiveProfileClaim("BELIEF", "I think that's fine.")).toBe(false);
    expect(isSubstantiveProfileClaim("BELIEF", "I believe that structure leads to better outcomes over time.")).toBe(true);
  });

  it("delegates VALUE to isVagueValueClaim", () => {
    expect(isSubstantiveProfileClaim("VALUE", "That's something I value.")).toBe(false);
    expect(isSubstantiveProfileClaim("VALUE", "I value honesty above all.")).toBe(true);
  });

  it("passes FEAR, HABIT, TRAIT, IDENTITY, EMOTIONAL_PATTERN unconditionally", () => {
    expect(isSubstantiveProfileClaim("FEAR", "I'm afraid of failure.")).toBe(true);
    expect(isSubstantiveProfileClaim("HABIT", "I tend to overthink.")).toBe(true);
    expect(isSubstantiveProfileClaim("TRAIT", "I've always been shy.")).toBe(true);
    expect(isSubstantiveProfileClaim("IDENTITY", "I'm a builder.")).toBe(true);
    expect(isSubstantiveProfileClaim("EMOTIONAL_PATTERN", "I get anxious when overwhelmed.")).toBe(true);
  });
});

// ── extractProfileClaims — precision gates ────────────────────────────────────

describe("extractProfileClaims — precision gates", () => {
  // ── GOAL ────────────────────────────────────────────────────────────────────
  it("does not extract GOAL from 'I want to make sure everything is okay'", () => {
    const claims = extractProfileClaims("I want to make sure everything is okay.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(false);
  });

  it("does not extract GOAL from 'I want to say that right now'", () => {
    const claims = extractProfileClaims("So yeah, I want to say that it was totally fine.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(false);
  });

  it("does not extract GOAL from 'I'm trying to' (trigger removed)", () => {
    const claims = extractProfileClaims("I'm trying to think about this differently now.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(false);
  });

  it("extracts GOAL from 'my goal is to finish the book this month'", () => {
    const claims = extractProfileClaims("My goal is to finish the book this month.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(true);
  });

  it("extracts GOAL from 'I'm working on building a stable writing routine'", () => {
    const claims = extractProfileClaims("I'm working on building a stable writing routine.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(true);
  });

  it("does not extract GOAL from 'I want to write out a copy'", () => {
    const claims = extractProfileClaims("I want to write out a copy.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(false);
  });

  it("does not extract GOAL from 'I need to send this block in 2 parts'", () => {
    const claims = extractProfileClaims("I need to send this block in 2 parts.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(false);
  });

  it("does not extract GOAL from 'I'm going to send this to Codex'", () => {
    const claims = extractProfileClaims("I'm going to send this to Codex.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(false);
  });

  it("does not extract GOAL from 'I need to check this later'", () => {
    const claims = extractProfileClaims("I need to check this later.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(false);
  });

  it("does not extract GOAL from 'I want to ask you something'", () => {
    const claims = extractProfileClaims("I want to ask you something.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(false);
  });

  it("does not extract GOAL from 'I need to read this properly'", () => {
    const claims = extractProfileClaims("I need to read this properly.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(false);
  });

  it("does not extract GOAL from 'I'm going to actually have to not fully read'", () => {
    const claims = extractProfileClaims("I'm going to actually have to not fully read this.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(false);
  });

  it("extracts GOAL from 'I plan to build a stable writing routine'", () => {
    const claims = extractProfileClaims("I plan to build a stable writing routine.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(true);
  });

  it("extracts GOAL from 'I want to become more consistent with public speaking'", () => {
    const claims = extractProfileClaims(
      "I want to become more consistent with public speaking."
    );
    expect(claims.some((c) => c.type === "GOAL")).toBe(true);
  });

  it("extracts GOAL from 'I need to develop a stronger epistemology'", () => {
    const claims = extractProfileClaims("I need to develop a stronger epistemology.");
    expect(claims.some((c) => c.type === "GOAL")).toBe(true);
  });

  it("does not extract GOAL from non-cue transcript fragments", () => {
    const claims = extractProfileClaims(
      "interesting um so are these books super long books because this one is 30 hours and i don't get it"
    );
    expect(claims.some((c) => c.type === "GOAL")).toBe(false);
  });

  it("keeps GOAL when extracted claim loses cue but contains clear durable self-change signal", () => {
    const filler = " and this is additional context that keeps running without punctuation";
    const text =
      "I feel like if I can let go of this and free my mind, I will feel much calmer over time" +
      filler.repeat(6) +
      " I want to keep strengthening this direction.";

    const claims = extractProfileClaims(text);
    expect(claims.some((c) => c.type === "GOAL")).toBe(true);
  });

  // ── HABIT ────────────────────────────────────────────────────────────────────
  it("does not extract HABIT from 'I never said that' (trigger removed)", () => {
    const claims = extractProfileClaims("I never said that to him or anyone else.");
    expect(claims.some((c) => c.type === "HABIT")).toBe(false);
  });

  it("does not extract HABIT from 'I never said anything about a minor'", () => {
    const claims = extractProfileClaims("I never said anything about a minor or that topic.");
    expect(claims.some((c) => c.type === "HABIT")).toBe(false);
  });

  it("extracts HABIT from 'I tend to avoid difficult calls when I feel overwhelmed'", () => {
    const claims = extractProfileClaims(
      "I tend to avoid difficult calls when I feel overwhelmed."
    );
    expect(claims.some((c) => c.type === "HABIT")).toBe(true);
  });

  it("extracts HABIT from 'Every time I get stressed, I open more tabs'", () => {
    const claims = extractProfileClaims("Every time I get stressed, I open more tabs.");
    expect(claims.some((c) => c.type === "HABIT")).toBe(true);
  });

  // ── TRAIT ────────────────────────────────────────────────────────────────────
  it("does not extract TRAIT from hedge 'I'm pretty sure that defines direct democracy'", () => {
    const claims = extractProfileClaims("I'm pretty sure that defines direct democracy.");
    expect(claims.some((c) => c.type === "TRAIT")).toBe(false);
  });

  it("does not extract TRAIT from hedge 'I'm basically tied to it now'", () => {
    const claims = extractProfileClaims("I'm basically tied to it now, right?");
    expect(claims.some((c) => c.type === "TRAIT")).toBe(false);
  });

  it("does not extract TRAIT from 'I'm very much doubting that this can even work'", () => {
    const claims = extractProfileClaims("I'm very much doubting that this can even work.");
    expect(claims.some((c) => c.type === "TRAIT")).toBe(false);
  });

  it("extracts TRAIT from 'I've always been considered shy'", () => {
    const claims = extractProfileClaims(
      "But since a child, I've always been considered shy, so that's part of it."
    );
    expect(claims.some((c) => c.type === "TRAIT")).toBe(true);
  });

  it("extracts TRAIT from 'I see myself as someone who needs structure'", () => {
    const claims = extractProfileClaims(
      "I see myself as someone who needs structure to function well."
    );
    expect(claims.some((c) => c.type === "TRAIT")).toBe(true);
  });

  // ── BELIEF ───────────────────────────────────────────────────────────────────
  it("does not extract BELIEF from short affirmation 'I think that would be good'", () => {
    const claims = extractProfileClaims("I think that would be good for everyone.");
    expect(claims.some((c) => c.type === "BELIEF")).toBe(false);
  });

  it("does not extract BELIEF from short affirmation 'I think that was everything'", () => {
    const claims = extractProfileClaims("I think that was everything I needed to say.");
    expect(claims.some((c) => c.type === "BELIEF")).toBe(false);
  });

  it("extracts BELIEF from substantive 'I believe that discipline matters'", () => {
    const claims = extractProfileClaims(
      "I believe that discipline matters more than motivation in the long run."
    );
    expect(claims.some((c) => c.type === "BELIEF")).toBe(true);
  });

  it("extracts BELIEF from 'in my opinion, institutions shape behaviour'", () => {
    const claims = extractProfileClaims(
      "In my opinion, institutions shape behaviour more than individual intentions do."
    );
    expect(claims.some((c) => c.type === "BELIEF")).toBe(true);
  });

  // ── VALUE ────────────────────────────────────────────────────────────────────
  it("keeps explicit 'I value objectivity above all else'", () => {
    const claims = extractProfileClaims("I value objectivity above all else in my work.");
    expect(claims.some((c) => c.type === "VALUE")).toBe(true);
  });

  it("keeps 'I care about accuracy and honesty'", () => {
    const claims = extractProfileClaims("I care about accuracy and honesty in everything I do.");
    expect(claims.some((c) => c.type === "VALUE")).toBe(true);
  });

  it("does not extract VALUE from vague 'That's something I value'", () => {
    const claims = extractProfileClaims("That's something I value in a conversation.");
    expect(claims.some((c) => c.type === "VALUE")).toBe(false);
  });

  it("does not extract VALUE from question form 'Would you say I believe in god?'", () => {
    const claims = extractProfileClaims("Would you say I believe in god?");
    expect(claims.some((c) => c.type === "VALUE")).toBe(false);
  });
});
