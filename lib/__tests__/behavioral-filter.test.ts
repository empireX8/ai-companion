/**
 * Behavioral Filter tests (Phase 1)
 *
 * Proves:
 *  1. Known false positives (non-behavioral) are rejected
 *  2. Known true positives (behavioral) are accepted
 *  3. Assistant-directed messages are rejected
 *  4. Question-like messages are rejected
 *  5. Detectors do not emit clues from rejected messages (integration)
 *  6. Legitimate behavioral messages still pass through (integration)
 */

import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  analyzeBehavioralEligibility,
  filterBehavioralMessages,
  isAssistantDirected,
  isEvidenceEligible,
  isQuestionLike,
  isSelfReferential,
} from "../behavioral-filter";
import type { NormalizedHistoryEntry } from "../history-synthesis";
import { patternDetectorV1 } from "../pattern-detector-v1";

// ── Helpers ───────────────────────────────────────────────────────────────────

function entry(
  content: string,
  role: "user" | "assistant" = "user"
): NormalizedHistoryEntry {
  return {
    messageId: `m_${Math.random().toString(36).slice(2)}`,
    sessionId: "sess1",
    sessionOrigin: "APP",
    sessionStartedAt: new Date("2026-01-01"),
    role,
    content,
    createdAt: new Date("2026-01-01"),
  };
}

// ── 1. Known false positives — spec examples ──────────────────────────────────

describe("analyzeBehavioralEligibility — known NOT-eligible messages", () => {
  it.each([
    [
      "topic query — no first person",
      "How difficult would it be to open up a foster care system in Florida",
    ],
    [
      "assistant directed — you're",
      "I think you're finally starting to see my issue",
    ],
    [
      "imperative — let's",
      "Let's talk about a few questions. How many more layers are we gonna need",
    ],
    [
      "question + assistant directed — can you",
      "Can you help me think through this?",
    ],
    ["question — ends with ?", "what's our plan for today?"],
  ])("rejects: %s", (_label, text) => {
    const result = analyzeBehavioralEligibility(text);
    expect(result.eligible).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

// ── 2. Known true positives — spec examples ───────────────────────────────────

describe("analyzeBehavioralEligibility — known ELIGIBLE messages", () => {
  it.each([
    [
      "self-label + habit",
      "I notice I am definitely a people pleaser",
    ],
    [
      "self-judgment + regret",
      "I realised when I was younger I was actually talented and I look back and regret not having the confidence",
    ],
    [
      "habit language — always end up",
      "I always end up overthinking when I have to make a decision",
    ],
    [
      "self-judgment — struggle + follow through",
      "I struggle to follow through once the excitement wears off",
    ],
    [
      "progress language — doing better",
      "I've been doing better lately when I go for walks",
    ],
    [
      "trigger language — default to people-pleasing",
      "Whenever someone seems upset with me, I default to people-pleasing.",
    ],
    [
      "trigger language — walk back my boundary",
      "When I think I might disappoint someone, I walk back my boundary.",
    ],
    [
      "progress language — doing a better job",
      "Lately I've been doing a better job of slowing down before reacting.",
    ],
    [
      "self-judgment — have a hard time (IC vocabulary)",
      "I have a hard time being assertive when someone pushes back.",
    ],
    [
      "self-judgment — probably can't (IC vocabulary)",
      "I probably can't handle this without reverting to old habits.",
    ],
    [
      "self-judgment — worried that I'll (IC vocabulary)",
      "I'm worried that I'll disappoint everyone when it matters most.",
    ],
  ])("accepts: %s", (_label, text) => {
    const result = analyzeBehavioralEligibility(text);
    expect(result.eligible).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

// ── 3. Assistant-directed rejection ──────────────────────────────────────────

describe("isAssistantDirected", () => {
  it.each([
    "I think you're finally starting to see my issue",
    "you're really helping me",
    "Can you help me with this?",
    "could you explain that?",
    "you seem to understand now",
    "you keep missing my point",
  ])("detects assistant-directed: %s", (text) => {
    expect(isAssistantDirected(text)).toBe(true);
  });

  it.each([
    "I always end up overthinking",
    "I struggle to follow through",
    "whenever I'm stressed I tend to shut down",
    "I've been doing better lately",
  ])("does NOT flag self-referential: %s", (text) => {
    expect(isAssistantDirected(text)).toBe(false);
  });
});

describe("analyzeBehavioralEligibility — assistant-directed rejected", () => {
  it("rejects assistant-directed even when it has first person", () => {
    const result = analyzeBehavioralEligibility(
      "I think you're finally starting to see my issue"
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("assistant_directed");
    expect(result.features.assistantDirected).toBe(true);
  });

  it("reasons show assistant_directed when fired", () => {
    const result = analyzeBehavioralEligibility("can you help me think through this?");
    expect(result.reasons).toContain("assistant_directed");
  });
});

// ── 4. Question-like rejection ────────────────────────────────────────────────

describe("isQuestionLike", () => {
  it.each([
    "what's our plan for today?",
    "Can you help me think through this?",
    "why do I always do this?",
  ])("detects question: %s", (text) => {
    expect(isQuestionLike(text)).toBe(true);
  });

  it.each([
    "I always end up overthinking when I have to make a decision",
    "I notice I am definitely a people pleaser",
    "How difficult would it be to open a foster care system in Florida",
  ])("does NOT flag non-question: %s", (text) => {
    expect(isQuestionLike(text)).toBe(false);
  });
});

describe("analyzeBehavioralEligibility — question-like rejected", () => {
  it("rejects message ending with ?", () => {
    const result = analyzeBehavioralEligibility("what's our plan for today?");
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("question_like");
    expect(result.features.questionLike).toBe(true);
  });
});

// ── isSelfReferential ─────────────────────────────────────────────────────────

describe("isSelfReferential", () => {
  it("true for messages with 'I'", () => {
    expect(isSelfReferential("I always end up overthinking")).toBe(true);
  });

  it("true for messages with 'me'", () => {
    expect(isSelfReferential("this triggers me to shut down")).toBe(true);
  });

  it("true for messages with 'my'", () => {
    expect(isSelfReferential("finally managed to keep my routine")).toBe(true);
  });

  it("false for third-person only text", () => {
    expect(
      isSelfReferential(
        "How difficult would it be to open a foster care system in Florida"
      )
    ).toBe(false);
  });
});

// ── isEvidenceEligible ────────────────────────────────────────────────────────

describe("isEvidenceEligible", () => {
  it("true for clean behavioral I-start message", () => {
    expect(
      isEvidenceEligible("I always end up overthinking when I have to make a decision")
    ).toBe(true);
  });

  it("false for non-behavioral message", () => {
    expect(
      isEvidenceEligible(
        "How difficult would it be to open up a foster care system in Florida"
      )
    ).toBe(false);
  });

  it("false for message not starting with I", () => {
    expect(isEvidenceEligible("this triggers me to shut down")).toBe(false);
  });

  it("false for message over 300 chars", () => {
    const long =
      "I always ".repeat(40) + "end up overthinking"; // >300 chars
    expect(isEvidenceEligible(long)).toBe(false);
  });

  it("false for speaker-prefixed message", () => {
    expect(isEvidenceEligible("I: I always end up overthinking")).toBe(false);
  });
});

// ── filterBehavioralMessages ──────────────────────────────────────────────────

describe("filterBehavioralMessages", () => {
  it("removes non-behavioral user messages", () => {
    const entries = [
      entry("I always end up overthinking when I have to make a decision"),
      entry("Can you help me think through this?"),
      entry("How difficult would it be to open up a foster care system in Florida"),
    ];
    const result = filterBehavioralMessages(entries);
    expect(result).toHaveLength(1);
    expect(result[0]!.content).toMatch(/overthinking/);
  });

  it("excludes assistant messages — output is eligible user messages only", () => {
    const entries = [
      entry("Can you help me?", "assistant"),
      entry("I always end up overthinking", "user"),
    ];
    const result = filterBehavioralMessages(entries);
    expect(result).toHaveLength(1); // only the eligible user message
    expect(result[0]!.role).toBe("user");
  });

  it("removes all user messages when none are behavioral", () => {
    const entries = [
      entry("Can you help me think through this?"),
      entry("Let's talk about the plan"),
      entry("what's our plan for today?"),
    ];
    expect(filterBehavioralMessages(entries)).toHaveLength(0);
  });

  it("passes all eligible user messages through", () => {
    const entries = [
      entry("I always end up overthinking"),
      entry("I struggle to follow through once the excitement wears off"),
      entry("I've been doing better lately when I go for walks"),
    ];
    expect(filterBehavioralMessages(entries)).toHaveLength(3);
  });
});

// ── Feature flag correctness ──────────────────────────────────────────────────

describe("analyzeBehavioralEligibility — feature flags", () => {
  it("firstPersonStart is true when message starts with I", () => {
    const { features } = analyzeBehavioralEligibility(
      "I always end up overthinking"
    );
    expect(features.firstPersonStart).toBe(true);
  });

  it("firstPersonStart is false when message does not start with I", () => {
    const { features } = analyzeBehavioralEligibility(
      "this triggers me to shut down every time"
    );
    expect(features.firstPersonStart).toBe(false);
  });

  it("containsHabitLanguage is true for 'always end up'", () => {
    const { features } = analyzeBehavioralEligibility(
      "I always end up overthinking when I have to make a decision"
    );
    expect(features.containsHabitLanguage).toBe(true);
  });

  it("containsSelfJudgmentLanguage is true for 'struggle'", () => {
    const { features } = analyzeBehavioralEligibility(
      "I struggle to follow through once the excitement wears off"
    );
    expect(features.containsSelfJudgmentLanguage).toBe(true);
  });

  it("containsProgressLanguage is true for 'doing better'", () => {
    const { features } = analyzeBehavioralEligibility(
      "I've been doing better lately when I go for walks"
    );
    expect(features.containsProgressLanguage).toBe(true);
  });

  it("containsHabitLanguage is true for 'default to'", () => {
    const { features } = analyzeBehavioralEligibility(
      "Whenever someone seems upset with me, I default to people-pleasing."
    );
    expect(features.containsHabitLanguage).toBe(true);
  });

  it("containsProgressLanguage is true for 'doing a better job'", () => {
    const { features } = analyzeBehavioralEligibility(
      "Lately I've been doing a better job of slowing down before reacting."
    );
    expect(features.containsProgressLanguage).toBe(true);
  });

  it("imperativeLike is true for let's", () => {
    const { features } = analyzeBehavioralEligibility(
      "Let's talk about a few questions. How many more layers are we gonna need"
    );
    expect(features.imperativeLike).toBe(true);
  });

  it("likelyTopicQuery is true for 'How difficult'", () => {
    const { features } = analyzeBehavioralEligibility(
      "How difficult would it be to open up a foster care system in Florida"
    );
    expect(features.likelyTopicQuery).toBe(true);
  });

  it("tooShort is true for very short text", () => {
    const { features } = analyzeBehavioralEligibility("ok");
    expect(features.tooShort).toBe(true);
  });

  it("eligible reasons list shows positive signals when accepted", () => {
    const { eligible, reasons } = analyzeBehavioralEligibility(
      "I always end up overthinking when I have to make a decision"
    );
    expect(eligible).toBe(true);
    expect(reasons).toContain("has_habit_language");
  });
});

// ── Additional edge cases ─────────────────────────────────────────────────────

describe("analyzeBehavioralEligibility — additional edge cases", () => {
  it("rejects pure filler with first person but no behavioral signal", () => {
    const result = analyzeBehavioralEligibility("I just wanted to say hello");
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("no_behavioral_signal");
  });

  it("rejects topic query even when it contains 'I' in body", () => {
    // "what's our" starts with "what" but it ends with ? so question_like fires
    const result = analyzeBehavioralEligibility("what's our plan today? I'm wondering");
    expect(result.eligible).toBe(false);
  });

  it("accepts self-referential regret without explicit habit marker", () => {
    const result = analyzeBehavioralEligibility(
      "I realised when I was younger I was actually talented and I look back and regret not having the confidence"
    );
    expect(result.eligible).toBe(true);
    expect(result.features.containsSelfJudgmentLanguage).toBe(true);
  });

  it("accepts 'people pleaser' as self-judgment", () => {
    const result = analyzeBehavioralEligibility(
      "I notice I am definitely a people pleaser"
    );
    expect(result.eligible).toBe(true);
  });

  it("does NOT reject 'why do I always' — no ? and has habit language", () => {
    // This is a self-referential rhetorical statement, not a topic query
    const result = analyzeBehavioralEligibility("why do I always mess this up");
    expect(result.eligible).toBe(true);
    expect(result.features.containsHabitLanguage).toBe(true);
  });
});

// ── Journal-style phrase regression tests ────────────────────────────────────
// These three phrases are representative of real journal entry phrasing that
// must survive the behavioral filter after the keeps?/overthink\w* fix.

describe("analyzeBehavioralEligibility — journal-style phrase regression", () => {
  it("accepts phrase A: 'I start overthinking' (self-judgment via overthink\\w*)", () => {
    const result = analyzeBehavioralEligibility(
      "When I feel pressure building, I start overthinking every possible outcome and then I avoid taking action."
    );
    expect(result.eligible).toBe(true);
    expect(result.features.containsSelfJudgmentLanguage).toBe(true);
  });

  it("accepts phrase B: 'This keeps happening' (habit language via keeps?\\s+\\w+ing)", () => {
    const result = analyzeBehavioralEligibility(
      "This keeps happening when I have something important to do. I freeze, delay, then criticise myself afterwards."
    );
    expect(result.eligible).toBe(true);
    expect(result.features.containsHabitLanguage).toBe(true);
  });

  it("accepts phrase C: 'same loop' (habit language via same\\s+loop — unchanged)", () => {
    const result = analyzeBehavioralEligibility(
      "I notice the same loop: pressure, overthinking, avoidance, then frustration with myself."
    );
    expect(result.eligible).toBe(true);
    expect(result.features.containsHabitLanguage).toBe(true);
  });

  it("containsHabitLanguage is true for 'keeps happening'", () => {
    const { features } = analyzeBehavioralEligibility(
      "This keeps happening when I have something important to do."
    );
    expect(features.containsHabitLanguage).toBe(true);
  });

  it("containsSelfJudgmentLanguage is true for 'overthinking'", () => {
    const { features } = analyzeBehavioralEligibility(
      "I start overthinking every possible outcome."
    );
    expect(features.containsSelfJudgmentLanguage).toBe(true);
  });

  it("containsHabitLanguage is true for 'keep happening' (base form)", () => {
    const { features } = analyzeBehavioralEligibility(
      "Things keep happening that I don't know how to handle."
    );
    expect(features.containsHabitLanguage).toBe(true);
  });
});

// ── Integration: detectors do NOT emit from rejected messages ─────────────────

// Minimal mock DB for integration tests (mirrors packet3-smoke.test.ts pattern)
type ClaimRow = { id: string; patternType: string; status: string };
type MessageRow = {
  id: string;
  sessionId: string;
  userId: string;
  role: string;
  content: string;
  createdAt: Date;
  session: { origin: string; startedAt: Date };
};

type JournalEntryRow = {
  id: string;
  userId: string;
  body: string;
  authoredAt: Date | null;
  createdAt: Date;
};

let rowSeq = 0;
const nextId = () => `row_${++rowSeq}`;

function makeMockDb(messages: MessageRow[], journalEntries: JournalEntryRow[] = []) {
  const claims: ClaimRow[] = [];
  const evidence: Array<Record<string, unknown>> = [];

  return {
    message: { findMany: async () => messages },
    journalEntry: { findMany: async () => journalEntries },
    contradictionNode: { findMany: async () => [] },
    patternClaim: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        const key = where.userId_patternType_summaryNorm as Record<
          string,
          string
        >;
        return (
          claims.find(
            (c: ClaimRow & Record<string, string>) =>
              c.userId === key.userId &&
              c.patternType === key.patternType &&
              (c as Record<string, string>).summaryNorm === key.summaryNorm
          ) ?? null
        );
      },
      findFirst: async ({ where }: { where: { id?: string } }) =>
        claims.find((c) => c.id === where.id) ?? null,
      findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => {
        if (!where) return claims;
        return claims.filter((c) => {
          if (where.userId && (c as Record<string, unknown>).userId !== where.userId)
            return false;
          return true;
        });
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId(), ...data } as ClaimRow;
        claims.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const idx = claims.findIndex((c) => c.id === where.id);
        if (idx === -1) throw new Error(`claim ${where.id} not found`);
        claims[idx] = { ...claims[idx]!, ...data } as ClaimRow;
        return claims[idx]!;
      },
    },
    patternClaimEvidence: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        evidence.find(
          (e) =>
            e.claimId === where.claimId &&
            (where.messageId === undefined || e.messageId === where.messageId) &&
            (where.journalEntryId === undefined ||
              e.journalEntryId === where.journalEntryId) &&
            (where.quote === undefined || e.quote === where.quote)
        ) ?? null,
      findMany: async ({ where }: { where: { claimId?: string } }) =>
        evidence.filter((e) => !where.claimId || e.claimId === where.claimId),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId(), ...data };
        evidence.push(row);
        return row;
      },
    },
    _claims: claims,
  } as unknown as PrismaClient & { _claims: ClaimRow[] };
}

function makeMsg(
  content: string,
  opts: Partial<MessageRow> = {}
): MessageRow {
  return {
    id: nextId(),
    sessionId: "sess1",
    userId: "u1",
    role: "user",
    content,
    createdAt: new Date("2026-01-10"),
    session: { origin: "APP", startedAt: new Date("2026-01-01") },
    ...opts,
  };
}

// 5. Detectors do NOT emit clues from rejected messages
describe("integration — detectors do not emit from rejected messages", () => {
  it("produces 0 claims when all messages are non-behavioral", async () => {
    // "I think you're finally starting to see my issue" previously could fire
    // recovery_stabilizer due to "finally starting to" — now blocked by
    // assistantDirected filter
    const db = makeMockDb([
      makeMsg("I think you're finally starting to see my issue"),
      makeMsg("I think you're finally starting to see my issue", {
        sessionId: "s2",
      }),
      makeMsg("I think you're finally starting to see my issue", {
        sessionId: "s3",
      }),
    ]);

    const count = await patternDetectorV1({
      userId: "u1",
      messageIds: [],
      runId: "run1",
      db,
    });

    expect(count).toBe(0);
    expect(db._claims).toHaveLength(0);
  });

  it("produces 0 claims for a set of topic queries and questions", async () => {
    const db = makeMockDb([
      makeMsg("Can you help me think through this?"),
      makeMsg("How difficult would it be to open a foster care system?", {
        sessionId: "s2",
      }),
      makeMsg("what's our plan for today?", { sessionId: "s3" }),
      makeMsg("Let's talk about this further", { sessionId: "s4" }),
    ]);

    const count = await patternDetectorV1({
      userId: "u1",
      messageIds: [],
      runId: "run1",
      db,
    });

    expect(count).toBe(0);
  });
});

// 6. Legitimate behavioral messages still pass through
describe("integration — legitimate behavioral messages pass through", () => {
  it("produces trigger_condition claim from behavioral trigger messages", async () => {
    // All three start with "I" to satisfy the detector's selfReferenceMatches guard
    const db = makeMockDb([
      makeMsg("I tend to procrastinate whenever I'm stressed"),
      makeMsg("I always end up avoiding work when pressure builds", {
        sessionId: "s2",
      }),
      makeMsg("I notice I automatically shut down under this kind of pressure", {
        sessionId: "s3",
      }),
    ]);

    const count = await patternDetectorV1({
      userId: "u1",
      messageIds: [],
      runId: "run1",
      db,
    });

    expect(count).toBeGreaterThanOrEqual(1);
    const tc = db._claims.find((c) => c.patternType === "trigger_condition");
    expect(tc).toBeDefined();
  });

  it("produces inner_critic claim from behavioral self-critical messages", async () => {
    const db = makeMockDb([
      makeMsg("I'm terrible at staying on track"),
      makeMsg("I can't do anything right", { sessionId: "s2" }),
      makeMsg("why do I always mess this up", { sessionId: "s3" }),
    ]);

    await patternDetectorV1({ userId: "u1", messageIds: [], runId: "run1", db });

    expect(db._claims.find((c) => c.patternType === "inner_critic")).toBeDefined();
  });

  it("produces recovery_stabilizer claim from spec-example eligible message", async () => {
    const db = makeMockDb([
      makeMsg("I've been doing better lately when I go for walks"),
      makeMsg("I've been doing better lately when I go for walks", {
        sessionId: "s2",
      }),
    ]);

    await patternDetectorV1({ userId: "u1", messageIds: [], runId: "run1", db });

    expect(
      db._claims.find((c) => c.patternType === "recovery_stabilizer")
    ).toBeDefined();
  });

  it("mixed batch: non-behavioral messages do not prevent detection from behavioral ones", async () => {
    const db = makeMockDb([
      // Non-behavioral (should be filtered out)
      makeMsg("Can you help me think through this?"),
      makeMsg("How difficult would it be to open a foster care system?", {
        sessionId: "s2",
      }),
      // Behavioral trigger_condition messages starting with "I" (should pass)
      makeMsg("I tend to procrastinate whenever I'm stressed", {
        sessionId: "s3",
      }),
      makeMsg("I always end up avoiding work when pressure builds", {
        sessionId: "s4",
      }),
      makeMsg("I notice I automatically shut down under this kind of pressure", {
        sessionId: "s5",
      }),
    ]);

    const count = await patternDetectorV1({
      userId: "u1",
      messageIds: [],
      runId: "run1",
      db,
    });

    expect(count).toBeGreaterThanOrEqual(1);
    expect(db._claims.find((c) => c.patternType === "trigger_condition")).toBeDefined();
  });

  it("native-like trigger phrasing now survives the behavioral gate and persists a claim", async () => {
    const db = makeMockDb([
      makeMsg("Whenever someone seems upset with me, I default to people-pleasing."),
      makeMsg("When I think I might disappoint someone, I walk back my boundary.", {
        sessionId: "s2",
      }),
      makeMsg("If there's tension, I start appeasing people instead of being direct.", {
        sessionId: "s3",
      }),
    ]);

    const count = await patternDetectorV1({
      userId: "u1",
      messageIds: [],
      runId: "run1",
      db,
    });

    expect(count).toBeGreaterThanOrEqual(1);
    const tc = db._claims.find((c) => c.patternType === "trigger_condition");
    expect(tc).toBeDefined();
  });
});
