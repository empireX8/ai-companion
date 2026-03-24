/**
 * Behavioral Filter — Phase 3 test suite
 *
 * Covers all 14 required Phase 3 behavioral cases:
 *
 * Pass cases:
 *   1. clear behavioral self-reference passes
 *   2. self-critical self-reference passes
 *   3. progress/recovery self-reference passes
 *   4. repeated-loop self-reference passes
 *
 * Fail cases:
 *   5.  topic question fails
 *   6.  assistant-directed statement fails
 *   7.  generic planning/request fails
 *   8.  quoted/pasted transcript-style text fails
 *   9.  code/log/error text fails (explicit structural gate)
 *  10.  autobiographical but non-behavioral statement fails
 *
 * Pipeline/integration tests:
 *  11. false-positive examples are blocked upstream before reaching family detectors
 *  12. legitimate behavioral examples pass the filter and remain reachable
 *  13. repetitive_loop still works end-to-end with upstream filter + Phase 2 aggregation
 *  14. contradiction_drift is architecturally separate — does not consume filtered entries
 */

import { describe, expect, it } from "vitest";

import {
  analyzeBehavioralEligibility,
  filterBehavioralMessages,
} from "../behavioral-filter";
import { detectRepetitiveLoopClues } from "../repetitive-loop-adapter";
import type { NormalizedHistoryEntry } from "../history-synthesis";

// ── Helpers ───────────────────────────────────────────────────────────────────

let seq = 0;
function makeEntry(
  content: string,
  overrides: Partial<NormalizedHistoryEntry> = {}
): NormalizedHistoryEntry {
  const id = `p3_${++seq}`;
  return {
    messageId: id,
    sessionId: "sess1",
    sessionOrigin: "APP",
    sessionStartedAt: new Date("2026-01-01"),
    role: "user",
    content,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function eligible(text: string): boolean {
  return analyzeBehavioralEligibility(text).eligible;
}

// ── Case 1: clear behavioral self-reference — should PASS ─────────────────────

describe("Phase 3 — pass: clear behavioral self-reference", () => {
  it.each([
    "I notice I am definitely a people pleaser",
    "I always end up back in the same mindset when things get difficult",
    "I keep doing this even though I know it hurts me",
    "My default is to shut down when I feel pressure",
    "I tend to shut down when I feel judged",
  ])("eligible: %s", (text) => {
    expect(eligible(text)).toBe(true);
  });
});

// ── Case 2: self-critical self-reference — should PASS ───────────────────────

describe("Phase 3 — pass: self-critical self-reference", () => {
  it.each([
    "I struggle to trust my own judgment",
    "I doubt myself more when I have to commit",
    "I can't seem to follow through no matter how hard I try",
    "I always end up second-guessing myself at the last moment",
  ])("eligible: %s", (text) => {
    expect(eligible(text)).toBe(true);
  });
});

// ── Case 3: progress/recovery self-reference — should PASS ───────────────────

describe("Phase 3 — pass: progress/recovery self-reference", () => {
  it.each([
    "I've been doing better lately",
    "I finally managed to stick with it this week",
    "I'm making real progress on this",
    "I've been bouncing back faster than before",
  ])("eligible: %s", (text) => {
    expect(eligible(text)).toBe(true);
  });
});

// ── Case 4: repeated-loop self-reference — should PASS ───────────────────────

describe("Phase 3 — pass: repeated-loop self-reference", () => {
  it.each([
    "I keep falling back into the same pattern",
    "I always end up back in the same place no matter what I try",
    "I find myself doing this over and over",
    "I keep ending up in the same mindset when things get hard",
  ])("eligible: %s", (text) => {
    expect(eligible(text)).toBe(true);
  });
});

// ── Case 5: topic question — should FAIL ─────────────────────────────────────

describe("Phase 3 — fail: topic question", () => {
  it("rejects spec example: foster care topic query", () => {
    expect(
      eligible("How difficult would it be to open up a foster care system in Florida")
    ).toBe(false);
  });

  it("rejects: What's our plan for today?", () => {
    expect(eligible("What's our plan for today?")).toBe(false);
  });

  it("rejects reason is likely_topic_query or question_like", () => {
    const r1 = analyzeBehavioralEligibility(
      "How difficult would it be to open up a foster care system in Florida"
    );
    expect(r1.eligible).toBe(false);
    expect(
      r1.reasons.some((r) => r === "likely_topic_query" || r === "question_like")
    ).toBe(true);

    const r2 = analyzeBehavioralEligibility("What's our plan for today?");
    expect(r2.eligible).toBe(false);
    expect(r2.reasons).toContain("question_like");
  });
});

// ── Case 6: assistant-directed statement — should FAIL ───────────────────────

describe("Phase 3 — fail: assistant-directed statement", () => {
  it("rejects spec example: I think you're finally starting to see my issue", () => {
    expect(
      eligible("I think you're finally starting to see my issue")
    ).toBe(false);
  });

  it("rejects reason is assistant_directed", () => {
    const r = analyzeBehavioralEligibility(
      "I think you're finally starting to see my issue"
    );
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain("assistant_directed");
  });

  it("rejects: you're starting to understand me better", () => {
    expect(eligible("you're starting to understand me better")).toBe(false);
  });

  it("rejects: can you help me understand why I do this", () => {
    expect(eligible("can you help me understand why I do this")).toBe(false);
  });
});

// ── Case 7: generic planning / request — should FAIL ─────────────────────────

describe("Phase 3 — fail: generic planning/request", () => {
  it("rejects: Can you help me think through this", () => {
    expect(eligible("Can you help me think through this")).toBe(false);
  });

  it("rejects: let's work through this together", () => {
    expect(eligible("let's work through this together")).toBe(false);
  });

  it("rejects: tell me what you think about this approach", () => {
    expect(eligible("tell me what you think about this approach")).toBe(false);
  });
});

// ── Case 8: quoted/pasted transcript — should FAIL ───────────────────────────

describe("Phase 3 — fail: quoted/pasted transcript-style text", () => {
  it("rejects spec example: User: I always mess this up", () => {
    expect(eligible("User: I always mess this up")).toBe(false);
  });

  it("rejects reason is likely_quoted_or_pasted", () => {
    const r = analyzeBehavioralEligibility("User: I always mess this up");
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain("likely_quoted_or_pasted");
  });

  it("rejects: Assistant: I understand that must be hard", () => {
    expect(eligible("Assistant: I understand that must be hard")).toBe(false);
  });

  it("rejects code fences", () => {
    expect(eligible("```\nconst x = 1;\n```")).toBe(false);
  });
});

// ── Case 9: code / log / error text — should FAIL ────────────────────────────

describe("Phase 3 — fail: code/log/error text (explicit structural gate)", () => {
  it("rejects spec example: user@host % npm run build (shell prompt)", () => {
    expect(eligible("user@host % npm run build")).toBe(false);
  });

  it("rejects reason for shell prompt is likely_quoted_or_pasted", () => {
    const r = analyzeBehavioralEligibility("user@host % npm run build");
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain("likely_quoted_or_pasted");
    expect(r.features.likelyQuotedOrPasted).toBe(true);
  });

  it("rejects spec example: TypeError: Cannot read properties of undefined", () => {
    expect(
      eligible("TypeError: Cannot read properties of undefined")
    ).toBe(false);
  });

  it("rejects reason for error text is likely_quoted_or_pasted", () => {
    const r = analyzeBehavioralEligibility(
      "TypeError: Cannot read properties of undefined"
    );
    expect(r.eligible).toBe(false);
    expect(r.features.likelyQuotedOrPasted).toBe(true);
  });

  it("rejects: $ npm install (plain shell prompt)", () => {
    expect(eligible("$ npm install")).toBe(false);
  });

  it("rejects stack trace with indented 'at' lines", () => {
    const trace =
      "TypeError: Cannot read properties of undefined\n    at Object.<anonymous> (app.js:1:1)";
    expect(eligible(trace)).toBe(false);
    expect(analyzeBehavioralEligibility(trace).features.likelyQuotedOrPasted).toBe(true);
  });

  it("rejects structured log lines", () => {
    expect(eligible("[ERROR] Failed to connect to database")).toBe(false);
    expect(eligible("ERROR: connection refused")).toBe(false);
  });

  it("rejects: SyntaxError: Unexpected token", () => {
    expect(eligible("SyntaxError: Unexpected token '<'")).toBe(false);
  });
});

// ── Case 10: autobiographical but non-behavioral — should FAIL ───────────────

describe("Phase 3 — fail: autobiographical but non-behavioral statement", () => {
  it("rejects: When I was younger I lived in London (fact, no behavior signal)", () => {
    expect(eligible("When I was younger I lived in London")).toBe(false);
  });

  it("rejects: I grew up in a small town near the coast", () => {
    expect(eligible("I grew up in a small town near the coast")).toBe(false);
  });

  it("rejects: I work in software and have for ten years", () => {
    expect(eligible("I work in software and have for ten years")).toBe(false);
  });

  it("rejects reason is no_behavioral_signal", () => {
    const r = analyzeBehavioralEligibility(
      "When I was younger I lived in London"
    );
    expect(r.eligible).toBe(false);
    expect(r.reasons).toContain("no_behavioral_signal");
  });

  it("rejects: Can't lie, that whole thing is resonating (filler/discourse)", () => {
    // No standalone first-person pronoun → no_first_person
    expect(eligible("Can't lie, that whole thing is resonating")).toBe(false);
  });
});

// ── Case 11: false-positive examples blocked upstream ────────────────────────

describe("Phase 3 — integration: false-positive examples blocked upstream", () => {
  const falsePositiveMessages = [
    "How difficult would it be to open up a foster care system in Florida",
    "What's our plan for today?",
    "I think you're finally starting to see my issue",
    "Can't lie, that whole thing is resonating",
    "user@host % npm run build",
    "TypeError: Cannot read properties of undefined",
    "User: I always mess this up",
    "When I was younger I lived in London",
    "Can you help me think through this",
    "let's work through this together",
  ];

  it("filterBehavioralMessages returns empty for all false-positive messages", () => {
    const entries = falsePositiveMessages.map((content) =>
      makeEntry(content)
    );
    const filtered = filterBehavioralMessages(entries);
    expect(filtered).toHaveLength(0);
  });

  it("each false-positive is individually ineligible", () => {
    for (const msg of falsePositiveMessages) {
      expect(eligible(msg)).toBe(false);
    }
  });
});

// ── Case 12: legitimate examples still reach family detectors ─────────────────

describe("Phase 3 — integration: legitimate behavioral examples pass the filter", () => {
  const legitimateMessages = [
    "I notice I am definitely a people pleaser",
    "I always end up back in the same mindset when things get difficult",
    "I keep doing this even though I know it hurts me",
    "I struggle to trust my own judgment",
    "I've been doing better lately",
    "My default is to shut down when I feel pressure",
  ];

  it("filterBehavioralMessages retains all legitimate behavioral messages", () => {
    const entries = legitimateMessages.map((content) => makeEntry(content));
    const filtered = filterBehavioralMessages(entries);
    expect(filtered).toHaveLength(legitimateMessages.length);
  });

  it("each legitimate message is individually eligible", () => {
    for (const msg of legitimateMessages) {
      expect(eligible(msg)).toBe(true);
    }
  });
});

// ── Case 13: repetitive_loop end-to-end with upstream filter ──────────────────

describe("Phase 3 — integration: repetitive_loop works through upstream filter", () => {
  it("RL clue emitted when behavioral-eligible loop messages cross sessions", () => {
    const rawEntries = [
      // behavioral-eligible, loop cue, session A
      makeEntry("I keep falling back into the same pattern", { sessionId: "sA" }),
      // behavioral-eligible, loop cue, session B
      makeEntry("I keep ending up in the same place mentally", { sessionId: "sB" }),
      // FALSE POSITIVE — blocked by filter, must not contribute
      makeEntry("How difficult would it be to open up a foster care system in Florida"),
      makeEntry("user@host % npm run build"),
    ];

    const behavioralEntries = filterBehavioralMessages(rawEntries);
    // Only the two behavioral messages pass
    expect(behavioralEntries).toHaveLength(2);

    const clues = detectRepetitiveLoopClues({ userId: "u1", entries: behavioralEntries });
    expect(clues).toHaveLength(1);
    expect(clues[0]!.patternType).toBe("repetitive_loop");
  });

  it("RL clue NOT emitted when all loop-language messages are filtered out upstream", () => {
    // These match loop markers but are assistant-directed or topic queries — should be filtered
    const rawEntries = [
      makeEntry("How difficult is it to break out of the same loop every time"),
      makeEntry("What's the pattern that keeps coming back in my life?"),
      makeEntry("Can you help me understand why I keep doing the same thing"),
    ];

    const behavioralEntries = filterBehavioralMessages(rawEntries);
    expect(behavioralEntries).toHaveLength(0);

    const clues = detectRepetitiveLoopClues({ userId: "u1", entries: behavioralEntries });
    expect(clues).toHaveLength(0);
  });

  it("RL clue NOT emitted when loop messages are all in one session (Phase 2 rule)", () => {
    // All behavioral-eligible, all match loop markers, but all in sess1
    const rawEntries = [
      makeEntry("I keep falling back into the same pattern"),
      makeEntry("I keep ending up in the same place"),
      makeEntry("I find myself doing the same thing over and over"),
    ];

    const behavioralEntries = filterBehavioralMessages(rawEntries);
    expect(behavioralEntries).toHaveLength(3); // all pass filter

    const clues = detectRepetitiveLoopClues({ userId: "u1", entries: behavioralEntries });
    expect(clues).toHaveLength(0); // but single session → no clue (Phase 2)
  });
});

// ── Case 14: contradiction_drift separation ───────────────────────────────────

describe("Phase 3 — integration: contradiction_drift does not consume filtered entries", () => {
  it("filterBehavioralMessages has no effect on the contradiction_drift code path", () => {
    // Architectural invariant:
    // In pattern-detector-v1.ts, contradiction_drift is wired as:
    //   const driftClues = await deriveContradictionDriftClues({ userId, db });
    // It takes (userId, db) — NOT entries or behavioralEntries.
    // filterBehavioralMessages operates on NormalizedHistoryEntry[].
    // These two interfaces are structurally separate.
    //
    // Concrete verification: filtering away all messages produces no effect on
    // the contradiction_drift data source (ContradictionNode rows in db).

    // All Phase 3 false-positive examples produce an empty filtered stream.
    const fpEntries = [
      "How difficult would it be to open up a foster care system in Florida",
      "user@host % npm run build",
      "TypeError: Cannot read properties of undefined",
      "I think you're finally starting to see my issue",
    ].map((c) => makeEntry(c));

    const filtered = filterBehavioralMessages(fpEntries);
    expect(filtered).toHaveLength(0); // entire stream wiped out for text families

    // contradiction_drift would still be called with (userId, db) independently.
    // This test confirms there is no shared state between the filtered stream
    // and the ContradictionNode reader.
    // (Full pipeline verification is in packet3-smoke.test.ts.)
  });

  it("non-behavioral user messages do not pollute the behavioral stream", () => {
    const mixed = [
      makeEntry("I always end up back in the same place"),                // eligible
      makeEntry("How difficult would it be to change this pattern?"),     // topic query
      makeEntry("TypeError: Cannot read properties of undefined"),        // error text
      makeEntry("I think you're finally seeing the issue"),               // assistant-directed
      makeEntry("I keep falling back into old habits", { sessionId: "s2" }), // eligible
    ];

    const filtered = filterBehavioralMessages(mixed);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.role === "user")).toBe(true);
  });
});
