/**
 * Pattern Quote Selection tests (Phase 4)
 *
 * Covers all 10 required scenarios:
 *  1. Better quote chosen over weaker quote
 *  2. Bad quote loses to no quote
 *  3. Classification still happens without a quote
 *  4. Question rejected
 *  5. Assistant-directed statement rejected
 *  6. Concise behavioral quote beats longer ambiguous paragraph
 *  7. Transcript/log/code text rejected
 *  8. Existing legitimate quotes still survive
 *  9. Family detectors call shared quote selector (integration)
 * 10. "Bad quote beats no quote" regression test
 *
 * Plus: score dimension verification
 */

import { describe, expect, it } from "vitest";

import {
  containsRawSelfAttackLanguage,
  scorePatternQuoteCandidate,
  isDisplaySafePatternQuote,
  selectBestDisplayQuote,
  MAX_QUOTE_LENGTH,
  MIN_QUOTE_SCORE,
} from "../pattern-quote-selection";

import { detectTriggerConditionClues, TC_MIN_MATCHES } from "../trigger-condition-detector";
import { detectInnerCriticClues, IC_MIN_MATCHES } from "../inner-critic-adapter";
import { detectRecoveryStabilizerClues, RS_MIN_MATCHES } from "../recovery-stabilizer-adapter";
import { detectRepetitiveLoopClues } from "../repetitive-loop-adapter";
import type { NormalizedHistoryEntry } from "../history-synthesis";

// ── Helpers ───────────────────────────────────────────────────────────────────

let seq = 0;
function makeEntry(
  content: string,
  overrides: Partial<NormalizedHistoryEntry> = {}
): NormalizedHistoryEntry {
  const id = `qs_${++seq}`;
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

function makeCandidate(content: string) {
  return { content };
}

// ── Spec example lists ────────────────────────────────────────────────────────

const SPEC_FAIL = [
  "How difficult would it be to open up a foster care system in Florida",
  "What's our plan for today?",
  "I think you're finally starting to see my issue",
  "Can't lie, that whole thing is resonating",
  "user@host % npm run build",
  "TypeError: Cannot read properties of undefined",
  "User: I always mess this up",
];

const SPEC_PASS = [
  "I notice I am definitely a people pleaser",
  "I always end up back in the same mindset when things get difficult",
  "I keep doing this even though I know it hurts me",
  "I struggle to trust my own judgment",
  "I've been doing better lately",
  "My default is to shut down when I feel pressure",
];

const RAW_SELF_ATTACK_FAIL = [
  "I hate myself for doing this again",
  "I'm such a failure, I can't get anything right",
];

// ── Spec examples ─────────────────────────────────────────────────────────────

describe("isDisplaySafePatternQuote — spec FAIL examples", () => {
  it.each(SPEC_FAIL)("rejects: %s", (text) => {
    expect(isDisplaySafePatternQuote(text)).toBe(false);
  });
});

describe("isDisplaySafePatternQuote — spec PASS examples", () => {
  it.each(SPEC_PASS)("accepts: %s", (text) => {
    expect(isDisplaySafePatternQuote(text)).toBe(true);
  });
});

describe("scorePatternQuoteCandidate — score=0 for all spec FAIL examples", () => {
  it.each(SPEC_FAIL)("score is 0: %s", (text) => {
    expect(scorePatternQuoteCandidate(text).score).toBe(0);
  });
});

describe("raw self attack must not be display safe", () => {
  it.each(RAW_SELF_ATTACK_FAIL)("rejects raw self-attack quote: %s", (text) => {
    expect(containsRawSelfAttackLanguage(text)).toBe(true);
    expect(isDisplaySafePatternQuote(text)).toBe(false);
    const score = scorePatternQuoteCandidate(text);
    expect(score.isRawSelfAttack).toBe(true);
    expect(score.score).toBe(0);
  });

  it("does not overblock legitimate inner-critic quotes", () => {
    const safeExamples = [
      "I struggle to trust my own judgment",
      "I doubt myself more when I have to commit",
    ];

    for (const text of safeExamples) {
      expect(containsRawSelfAttackLanguage(text)).toBe(false);
      expect(isDisplaySafePatternQuote(text)).toBe(true);
    }
  });
});

// ── Case 1: Better quote chosen over weaker quote ─────────────────────────────

describe("Case 1 — better quote chosen over weaker", () => {
  it("prefers self-referential behavioral quote over topic query", () => {
    const result = selectBestDisplayQuote([
      makeCandidate("How difficult is it to break out of the same loop"),
      makeCandidate("I keep falling back into the same pattern"),
    ]);
    expect(result).toBe("I keep falling back into the same pattern");
  });

  it("higher firstPersonOwnership score wins over behavioral-only score", () => {
    const s1 = scorePatternQuoteCandidate("whenever I'm stressed I tend to procrastinate");
    const s2 = scorePatternQuoteCandidate("I keep falling back into the same pattern");
    expect(s1.firstPersonOwnership).toBe(false);
    expect(s2.firstPersonOwnership).toBe(true);
    expect(s2.score).toBeGreaterThan(s1.score);
    const result = selectBestDisplayQuote([
      makeCandidate("whenever I'm stressed I tend to procrastinate"),
      makeCandidate("I keep falling back into the same pattern"),
    ]);
    expect(result).toBe("I keep falling back into the same pattern");
  });

  it("prefers shorter quote over longer one with same pattern quality", () => {
    const longMsg =
      "I keep falling back into the same pattern and I've been trying to understand why this happens for such a long time now and it seems to involve many different aspects of my life and personality that I have not yet fully come to terms with despite many attempts";
    const shortMsg = "I keep falling back into the same pattern";
    expect(longMsg.length).toBeGreaterThan(shortMsg.length);
    const result = selectBestDisplayQuote([
      makeCandidate(longMsg),
      makeCandidate(shortMsg),
    ]);
    expect(result).toBe(shortMsg);
  });
});

// ── Case 2: Bad quote loses to no quote ───────────────────────────────────────

describe("Case 2 — bad quotes return null", () => {
  it("returns null when all candidates are topic queries or pasted content", () => {
    const result = selectBestDisplayQuote([
      makeCandidate("How difficult would it be to change this pattern"),
      makeCandidate("TypeError: Cannot read properties of undefined"),
      makeCandidate("User: I always mess this up"),
    ]);
    expect(result).toBeNull();
  });

  it("returns null when all candidates are assistant-directed", () => {
    const result = selectBestDisplayQuote([
      makeCandidate("Can you help me understand why I keep avoiding things"),
      makeCandidate("I think you're starting to understand my situation"),
    ]);
    expect(result).toBeNull();
  });

  it("returns null for empty candidate list", () => {
    expect(selectBestDisplayQuote([])).toBeNull();
  });

  it("returns null when all candidates are raw self-attack", () => {
    const result = selectBestDisplayQuote([
      makeCandidate("I hate myself for doing this again"),
      makeCandidate("I'm such a failure, I can't get anything right"),
    ]);
    expect(result).toBeNull();
  });
});

// ── Case 3: Classification still happens without a quote ──────────────────────

describe("Case 3 — classification survives with null display quote", () => {
  it("selectBestDisplayQuote returns null for display-unsafe candidates", () => {
    const candidates = [
      makeCandidate("Can you help me think through this pattern"),
      makeCandidate("What's the cycle that keeps repeating in my life?"),
    ];
    expect(selectBestDisplayQuote(candidates)).toBeNull();
    // A PatternClue with quote=undefined is still a valid classification signal.
    // The clue carries sessionId/messageId from the classification representative
    // independently of the display quote path.
  });

  it("TC: classification still produces a clue when all matches exceed display length", () => {
    const overlong =
      "whenever I'm stressed I tend to procrastinate and avoid everything and I've noticed this same pattern for a very long time now, it seems to affect my work and personal life in many interconnected ways that I'm still working hard to understand and address";
    expect(overlong.length).toBeGreaterThan(MAX_QUOTE_LENGTH);
    const entries = Array.from({ length: TC_MIN_MATCHES }, () =>
      makeEntry(overlong)
    );
    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1); // classification still happens
    expect(clues[0]!.quote).toBeUndefined(); // but no display quote
  });

  it("IC: classification still produces a clue when all matches are raw self-attack", () => {
    const entries = Array.from({ length: IC_MIN_MATCHES }, () =>
      makeEntry("I hate myself for doing this again")
    );
    const clues = detectInnerCriticClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]!.quote).toBeUndefined();
  });
});

// ── Case 4: Question rejected ─────────────────────────────────────────────────

describe("Case 4 — questions rejected", () => {
  it("rejects questions ending with ?", () => {
    expect(isDisplaySafePatternQuote("What's our plan for today?")).toBe(false);
    expect(isDisplaySafePatternQuote("Why do I always end up doing this?")).toBe(false);
    expect(isDisplaySafePatternQuote("I wonder if I tend to shut down when stressed?")).toBe(false);
  });

  it("scorePatternQuoteCandidate marks isQuestion=true for ? endings", () => {
    const s = scorePatternQuoteCandidate("Why do I always end up doing this?");
    expect(s.isQuestion).toBe(true);
    expect(s.score).toBe(0);
  });

  it("selectBestDisplayQuote skips questions even when they contain behavioral language", () => {
    const result = selectBestDisplayQuote([
      makeCandidate("Do I always tend to shut down when things get hard?"),
      makeCandidate("I keep falling back into the same pattern"),
    ]);
    expect(result).toBe("I keep falling back into the same pattern");
  });
});

// ── Case 5: Assistant-directed statement rejected ─────────────────────────────

describe("Case 5 — assistant-directed statements rejected", () => {
  it("rejects spec example: I think you're finally starting to see my issue", () => {
    expect(isDisplaySafePatternQuote("I think you're finally starting to see my issue")).toBe(false);
  });

  it("rejects: can you help me understand why I do this", () => {
    expect(isDisplaySafePatternQuote("can you help me understand why I do this")).toBe(false);
  });

  it("rejects: you're starting to understand me better", () => {
    expect(isDisplaySafePatternQuote("you're starting to understand me better")).toBe(false);
  });

  it("scorePatternQuoteCandidate marks isAssistantDirected=true", () => {
    const s = scorePatternQuoteCandidate("I think you're finally starting to see my issue");
    expect(s.isAssistantDirected).toBe(true);
    expect(s.score).toBe(0);
  });
});

// ── Case 6: Concise beats longer ambiguous paragraph ─────────────────────────

describe("Case 6 — concise behavioral quote beats longer ambiguous paragraph", () => {
  it("assigns higher score to shorter quote", () => {
    const short = scorePatternQuoteCandidate("I struggle to trust myself");
    const long = scorePatternQuoteCandidate(
      "I struggle to trust myself and it has been a really long journey trying to understand why that is and there are many factors and I am not sure I can articulate them all but I know it affects my life"
    );
    expect(short.brevityFactor).toBeGreaterThan(long.brevityFactor);
    expect(short.score).toBeGreaterThan(long.score);
  });

  it("selectBestDisplayQuote returns the concise version when both are present", () => {
    const concise = "I keep doing this even though I know better";
    const verbose =
      "I keep doing this even though I know better and it happens every single time whenever I am in a situation where I feel pressure and I end up defaulting to the same old pattern no matter what I try";
    const result = selectBestDisplayQuote([
      makeCandidate(verbose),
      makeCandidate(concise),
    ]);
    expect(result).toBe(concise);
  });
});

// ── Case 7: Transcript/log/code text rejected ─────────────────────────────────

describe("Case 7 — transcript and structured content rejected", () => {
  it("rejects code fence content", () => {
    expect(isDisplaySafePatternQuote("```\nconst x = 1;\n```")).toBe(false);
  });

  it("rejects speaker-prefixed transcript", () => {
    expect(isDisplaySafePatternQuote("User: I always mess this up")).toBe(false);
  });

  it("rejects shell prompt", () => {
    expect(isDisplaySafePatternQuote("user@host % npm run build")).toBe(false);
  });

  it("rejects JS error text", () => {
    expect(isDisplaySafePatternQuote("TypeError: Cannot read properties of undefined")).toBe(false);
  });

  it("scorePatternQuoteCandidate marks isQuotedOrPasted=true for all structured content", () => {
    const cases = [
      "```\nconst x = 1;\n```",
      "User: I always mess this up",
      "user@host % npm run build",
      "TypeError: Cannot read properties of undefined",
    ];
    for (const c of cases) {
      const s = scorePatternQuoteCandidate(c);
      expect(s.isQuotedOrPasted).toBe(true);
      expect(s.score).toBe(0);
    }
  });
});

// ── Case 8: Existing legitimate quotes still survive ─────────────────────────

describe("Case 8 — legitimate quotes survive (regression)", () => {
  it("accepts trigger example: whenever I'm stressed, I tend to procrastinate", () => {
    expect(isDisplaySafePatternQuote("whenever I'm stressed, I tend to procrastinate")).toBe(true);
  });

  it("accepts RL example: I keep falling back into the same pattern", () => {
    expect(isDisplaySafePatternQuote("I keep falling back into the same pattern")).toBe(true);
  });

  it("accepts IC example: I'm terrible at staying on track", () => {
    expect(isDisplaySafePatternQuote("I'm terrible at staying on track")).toBe(true);
  });

  it("accepts RS example: I've been doing better with my routines", () => {
    expect(isDisplaySafePatternQuote("I've been doing better with my routines")).toBe(true);
  });

  it("accepts: My default is to shut down when I feel pressure", () => {
    expect(isDisplaySafePatternQuote("My default is to shut down when I feel pressure")).toBe(true);
  });

  it("accepts: I struggle to trust my own judgment", () => {
    expect(isDisplaySafePatternQuote("I struggle to trust my own judgment")).toBe(true);
  });

  it("accepts: I doubt myself more when I have to commit", () => {
    expect(isDisplaySafePatternQuote("I doubt myself more when I have to commit")).toBe(true);
  });
});

// ── Case 9: Family detectors call shared quote selector (integration) ─────────

describe("Case 9 — family detectors use shared selectBestDisplayQuote", () => {
  it("TC: produced quote is display-safe when good candidates exist", () => {
    const entries = Array.from({ length: TC_MIN_MATCHES }, () =>
      makeEntry("whenever I'm stressed, I tend to procrastinate")
    );
    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]!.quote).toBeDefined();
    expect(isDisplaySafePatternQuote(clues[0]!.quote!)).toBe(true);
  });

  it("IC: produced quote is display-safe when good candidates exist", () => {
    const entries = Array.from({ length: IC_MIN_MATCHES }, () =>
      makeEntry("I'm terrible at following through on commitments")
    );
    const clues = detectInnerCriticClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]!.quote).toBeDefined();
    expect(isDisplaySafePatternQuote(clues[0]!.quote!)).toBe(true);
  });

  it("RS: produced quote is display-safe when good candidates exist", () => {
    const entries = Array.from({ length: RS_MIN_MATCHES }, () =>
      makeEntry("I've been doing better with my routines this week")
    );
    const clues = detectRecoveryStabilizerClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]!.quote).toBeDefined();
    expect(isDisplaySafePatternQuote(clues[0]!.quote!)).toBe(true);
  });

  it("RL: produced quote is display-safe when good candidates exist", () => {
    const clues = detectRepetitiveLoopClues({
      userId: "u1",
      entries: [
        makeEntry("I keep falling back into the same pattern", { sessionId: "sA" }),
        makeEntry("I keep ending up in the same place mentally", { sessionId: "sB" }),
      ],
    });
    expect(clues).toHaveLength(1);
    expect(clues[0]!.quote).toBeDefined();
    expect(isDisplaySafePatternQuote(clues[0]!.quote!)).toBe(true);
  });

  it("TC: quote is undefined when all matches exceed display length", () => {
    // Construct a message > MAX_QUOTE_LENGTH that still matches TC markers
    const overlong =
      "whenever I'm stressed I tend to procrastinate and avoid everything and I've noticed this same pattern for a very long time now, it seems to affect my work and personal life in many interconnected ways that I'm still working hard to understand and address";
    expect(overlong.length).toBeGreaterThan(MAX_QUOTE_LENGTH);
    const entries = Array.from({ length: TC_MIN_MATCHES }, () =>
      makeEntry(overlong)
    );
    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1); // classification still happens
    expect(clues[0]!.quote).toBeUndefined(); // no display quote
  });
});

// ── Case 10: "Bad quote beats no quote" regression ────────────────────────────

describe("Case 10 — REGRESSION: bad quote must NOT beat no quote", () => {
  it("selectBestDisplayQuote does NOT return a weak quote when no good option exists", () => {
    const weakCandidates = [
      makeCandidate("How difficult would it be to open up a foster care system in Florida"),
      makeCandidate("What's our plan for today?"),
      makeCandidate("I think you're finally starting to see my issue"),
      makeCandidate("Can't lie, that whole thing is resonating"),
    ];
    // Old behavior: would return last/first match regardless of quality.
    // New behavior: must return null.
    expect(selectBestDisplayQuote(weakCandidates)).toBeNull();
  });

  it("null is returned rather than pasted/error content", () => {
    const result = selectBestDisplayQuote([
      makeCandidate("user@host % npm run build"),
      makeCandidate("TypeError: Cannot read properties of undefined"),
    ]);
    expect(result).toBeNull();
  });

  it("null is returned rather than transcript-style content", () => {
    const result = selectBestDisplayQuote([
      makeCandidate("User: I always mess this up"),
      makeCandidate("Assistant: I understand that must be hard"),
    ]);
    expect(result).toBeNull();
  });

  it("chooses a safer IC quote over a raw self-attack quote when both are present", () => {
    const result = selectBestDisplayQuote([
      makeCandidate("I hate myself for doing this again"),
      makeCandidate("I struggle to trust my own judgment"),
    ]);
    expect(result).toBe("I struggle to trust my own judgment");
  });
});

// ── Score dimension verification ──────────────────────────────────────────────

describe("scorePatternQuoteCandidate — score dimensions", () => {
  it("first-person + behavioral scores 70–100", () => {
    const s = scorePatternQuoteCandidate("I keep doing this even though I know it hurts me");
    expect(s.firstPersonOwnership).toBe(true);
    expect(s.hasBehavioralLanguage).toBe(true);
    expect(s.score).toBeGreaterThanOrEqual(70);
  });

  it("behavioral-only (no first-person start) scores 30–60", () => {
    const s = scorePatternQuoteCandidate("whenever I'm stressed I tend to procrastinate");
    expect(s.firstPersonOwnership).toBe(false);
    expect(s.hasBehavioralLanguage).toBe(true);
    expect(s.score).toBeGreaterThanOrEqual(MIN_QUOTE_SCORE);
    expect(s.score).toBeLessThan(70);
  });

  it("no behavioral language → isVague=true → score=0", () => {
    const s = scorePatternQuoteCandidate("I went for a walk today");
    expect(s.hasBehavioralLanguage).toBe(false);
    expect(s.isVague).toBe(true);
    expect(s.score).toBe(0);
  });

  it("autobiographical non-behavioral statement scores 0", () => {
    expect(scorePatternQuoteCandidate("When I was younger I lived in London").score).toBe(0);
    expect(scorePatternQuoteCandidate("I grew up in a small town near the coast").score).toBe(0);
  });

  it("brevityFactor is 1.0 at ≤80 chars and 0 at ≥250 chars", () => {
    const short = "I keep doing this"; // 17 chars
    const sShort = scorePatternQuoteCandidate(
      "I keep doing this even though I know it hurts"
    );
    expect(sShort.brevityFactor).toBe(1.0);

    const atLimit = "x".repeat(250);
    // purely structural — score is 0 anyway due to isVague, but brevityFactor=0
    expect(scorePatternQuoteCandidate(atLimit).brevityFactor).toBe(0);
    void short; // used above
  });

  it("isTooLong fires for text over MAX_QUOTE_LENGTH", () => {
    const over = "I keep struggling with this pattern. ".repeat(8); // > 250
    const s = scorePatternQuoteCandidate(over);
    expect(s.isTooLong).toBe(true);
    expect(s.score).toBe(0);
  });

  it("last-wins tie-breaking: equal-score candidates, last one returned", () => {
    // Both have behavioral language, neither starts with I/My/Me → same score
    const a = makeCandidate("whenever I'm stressed I tend to avoid tasks");
    const b = makeCandidate("every time work piles up I end up procrastinating");
    const result = selectBestDisplayQuote([a, b]);
    expect(result).toBe("every time work piles up I end up procrastinating");
  });
});
