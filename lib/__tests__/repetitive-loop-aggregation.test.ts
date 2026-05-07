/**
 * Repetitive Loop Aggregation tests (Phase 2)
 *
 * Tests the two-stage session-aggregation pipeline for repetitive_loop.
 * Covers all 7 spec-required behavioral cases:
 *
 *  Should NOT emit:
 *   1. One single strong loop-like message in one session only
 *   2. Loop cue in one session + unrelated self-reflection in the other
 *   3. Loop-like language in assistant messages (excluded at cue stage)
 *
 *  Should emit:
 *   4. Two or more distinct sessions with loop-like self-referential messages
 *   5. Summary reflects recurrence, not just generic family naming
 *   6. Quote comes from an eligible representative message
 *   7. Evidence/receipt linkage (sessionId/messageId) is correct
 */

import { describe, expect, it } from "vitest";

import {
  RL_MIN_SESSIONS,
  RL_MAX_CLUES,
  detectRepetitiveLoopCueMessages,
  groupLoopCuesBySession,
  buildRepetitiveLoopCluesFromCues,
  buildRepetitiveLoopClueFromSessions,
} from "../repetitive-loop-aggregation";
import {
  detectRepetitiveLoopClues,
  REPETITIVE_LOOP_MARKERS,
} from "../repetitive-loop-adapter";
import type { NormalizedHistoryEntry } from "../history-synthesis";

// ── Helpers ───────────────────────────────────────────────────────────────────

let seq = 0;
function makeEntry(
  content: string,
  overrides: Partial<NormalizedHistoryEntry> = {}
): NormalizedHistoryEntry {
  const id = `rl_${++seq}`;
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

function makeJournalEntry(
  content: string,
  journalEntryId = `j_rl_${++seq}`
): NormalizedHistoryEntry {
  return {
    sourceKind: "journal_entry",
    messageId: null,
    sessionId: null,
    journalEntryId,
    sessionOrigin: null,
    sessionStartedAt: null,
    role: "user",
    content,
    createdAt: new Date("2026-01-01"),
  };
}

// ── Case 1: single session only — should NOT emit ─────────────────────────────

describe("should NOT emit — one session only", () => {
  it("does not emit when multiple strong loop cues are all in a single session", () => {
    const entries = [
      makeEntry("I keep falling back into the same pattern"),
      makeEntry("I find myself doing the same thing over and over"),
      makeEntry("I keep ending up in the same place mentally"),
    ];
    // All three match loop markers but all live in sess1
    expect(detectRepetitiveLoopClues({ userId: "u1", entries })).toHaveLength(0);
  });

  it("does not emit for a single emotionally real but non-recurring statement", () => {
    // Spec example: self-reflective, matches self-judgment language, but not a loop pattern
    // Does not match REPETITIVE_LOOP_MARKERS — correctly filtered at cue stage
    const entries = [
      makeEntry(
        "I realised when I was younger I was actually talented and I look back and regret not having the confidence"
      ),
    ];
    expect(detectRepetitiveLoopClues({ userId: "u1", entries })).toHaveLength(0);
  });
});

// ── Case 2: loop cue in one session, no loop cue in the other — should NOT emit

describe("should NOT emit — loop cue in only one session", () => {
  it("does not emit when second session has no loop markers", () => {
    const entries = [
      makeEntry("I keep falling back into the same pattern", { sessionId: "sessA" }),
      // sessB: self-reflective but no loop-marker language
      makeEntry("I've been thinking a lot about how I handle stress", { sessionId: "sessB" }),
    ];
    expect(detectRepetitiveLoopClues({ userId: "u1", entries })).toHaveLength(0);
  });

  it("groupLoopCuesBySession: only sessions with cue messages are counted", () => {
    const cues = [
      makeEntry("I keep falling back into the same pattern", { sessionId: "sessA" }),
    ];
    const groups = groupLoopCuesBySession(cues);
    expect(groups.size).toBe(1); // below RL_MIN_SESSIONS
    expect(buildRepetitiveLoopClueFromSessions("u1", groups)).toBeNull();
  });
});

// ── Case 3: loop language in non-user messages — should NOT emit ──────────────

describe("should NOT emit — loop language in assistant messages", () => {
  it("does not count assistant-role loop-language messages toward session threshold", () => {
    const entries = [
      // Only one user session with a loop cue
      makeEntry("I keep falling back into the same pattern", { sessionId: "sessA" }),
      // Loop language in an assistant message — must not count toward sessions
      makeEntry("I keep ending up in the same place", {
        role: "assistant",
        sessionId: "sessB",
      }),
    ];
    // detectRepetitiveLoopCueMessages filters to role === "user" only
    const cues = detectRepetitiveLoopCueMessages(entries, REPETITIVE_LOOP_MARKERS);
    expect(cues).toHaveLength(1); // only the user message qualifies
    expect(detectRepetitiveLoopClues({ userId: "u1", entries })).toHaveLength(0);
  });
});

// ── Case 4: two or more distinct sessions — SHOULD emit ──────────────────────

describe("should emit — cross-session loop cues", () => {
  it(`emits when loop cues appear in exactly ${RL_MIN_SESSIONS} distinct sessions`, () => {
    const entries = [
      makeEntry("I keep ending up in the same place mentally", { sessionId: "sessA" }),
      makeEntry("I keep falling back into the same pattern", { sessionId: "sessB" }),
    ];
    const result = detectRepetitiveLoopClues({ userId: "u1", entries });
    expect(result).toHaveLength(1);
    expect(result[0]!.patternType).toBe("repetitive_loop");
    expect(result[0]!.userId).toBe("u1");
  });

  it("emits when loop cues span three sessions (spec cross-session example)", () => {
    // Using spec examples adapted to current loop markers:
    //   session A: "I keep ending up in the same place mentally"  → matches "i keep \w+ing"
    //   session B: "here I am again, falling into the same pattern" → matches "here I am again"
    //   session C: "I keep falling back into old habits every time" → matches "i keep \w+ing"
    const entries = [
      makeEntry("I keep ending up in the same place mentally", { sessionId: "sessA" }),
      makeEntry("here I am again, falling into the same pattern", { sessionId: "sessB" }),
      makeEntry("I keep falling back into old habits every time", { sessionId: "sessC" }),
    ];
    const result = detectRepetitiveLoopClues({ userId: "u1", entries });
    expect(result).toHaveLength(1);
  });

  it(`RL_MIN_SESSIONS constant is ${RL_MIN_SESSIONS}`, () => {
    expect(RL_MIN_SESSIONS).toBe(2);
  });
});

// ── Case 5: summary reflects recurrence ──────────────────────────────────────

describe("summary reflects recurrence", () => {
  it("summary contains 'sessions' to indicate cross-session nature", () => {
    const entries = [
      makeEntry("I keep falling back into the same pattern", { sessionId: "sessA" }),
      makeEntry("I keep ending up in the same place", { sessionId: "sessB" }),
    ];
    const result = detectRepetitiveLoopClues({ userId: "u1", entries });
    expect(result[0]!.summary).toContain("sessions");
  });

  it("summary is not a bare family name", () => {
    const entries = [
      makeEntry("I keep falling back into the same pattern", { sessionId: "sessA" }),
      makeEntry("I keep ending up in the same place", { sessionId: "sessB" }),
    ];
    const result = detectRepetitiveLoopClues({ userId: "u1", entries });
    expect(result[0]!.summary).not.toBe("repetitive_loop");
    expect(result[0]!.summary.length).toBeGreaterThan(20);
  });

  it("summary is content-stable when more sessions are added", () => {
    const content = "I keep falling back into the same pattern";
    const run1 = detectRepetitiveLoopClues({
      userId: "u1",
      entries: [
        makeEntry(content, { sessionId: "sA" }),
        makeEntry(content, { sessionId: "sB" }),
      ],
    })[0]!;
    const run2 = detectRepetitiveLoopClues({
      userId: "u1",
      entries: [
        makeEntry(content, { sessionId: "sA" }),
        makeEntry(content, { sessionId: "sB" }),
        makeEntry(content, { sessionId: "sC" }),
      ],
    })[0]!;
    expect(run1.summary).toBe(run2.summary);
  });
});

// ── Case 6: quote from eligible representative ────────────────────────────────

describe("quote from eligible representative", () => {
  it("prefers an I-starting cue message as the representative", () => {
    const entries = [
      // sessA: loop cue, does not start with "I"
      makeEntry("here I am again in the same place", { sessionId: "sessA" }),
      // sessB: loop cue, starts with "I" — eligible
      makeEntry("I keep falling back into the same pattern", { sessionId: "sessB" }),
    ];
    const result = detectRepetitiveLoopClues({ userId: "u1", entries });
    expect(result[0]!.quote).toContain("I keep falling back");
  });

  it("falls back to the last cue when no I-starting cue is eligible", () => {
    const entries = [
      makeEntry("here I am again doing the same thing", { sessionId: "sessA" }),
      makeEntry("the same pattern keeps repeating itself", { sessionId: "sessB" }),
    ];
    const result = detectRepetitiveLoopClues({ userId: "u1", entries });
    expect(result).toHaveLength(1);
    // Last cue is the sessB message (fallback)
    expect(result[0]!.quote).toBe("the same pattern keeps repeating itself");
  });
});

// ── Case 7: evidence/receipt linkage ─────────────────────────────────────────

describe("evidence linkage — sessionId and messageId", () => {
  it("sessionId and messageId come from the representative message", () => {
    const entries = [
      makeEntry("I keep ending up in the same place mentally", {
        sessionId: "sessA",
        messageId: "msgA",
      }),
      makeEntry("I keep falling back into the same pattern", {
        sessionId: "sessB",
        messageId: "msgB",
      }),
    ];
    const result = detectRepetitiveLoopClues({ userId: "u1", entries });
    // Both start with "I"; last eligible = sessB
    expect(result[0]!.sessionId).toBe("sessB");
    expect(result[0]!.messageId).toBe("msgB");
  });

  it("sessionId and messageId are present on the returned clue", () => {
    const entries = [
      makeEntry("I keep falling back", { sessionId: "sA", messageId: "mA" }),
      makeEntry("I keep ending up in the same loop", { sessionId: "sB", messageId: "mB" }),
    ];
    const clue = detectRepetitiveLoopClues({ userId: "u1", entries })[0]!;
    expect(clue.sessionId).toBeDefined();
    expect(clue.messageId).toBeDefined();
  });
});

describe("multi-clue subgroup emission", () => {
  it("emits multiple clues when distinct recurring loop subgroups independently meet session threshold", () => {
    const entries = [
      makeEntry("I keep going back to smoking whenever I feel pressure", { sessionId: "substanceA" }),
      makeEntry("I keep slipping back to weed after short breaks", { sessionId: "substanceB" }),
      makeEntry("I keep overthinking and ending up in the same place mentally", { sessionId: "cognitiveA" }),
      makeEntry("I keep getting overstimulated and running into the same loop", { sessionId: "cognitiveB" }),
    ];

    const result = detectRepetitiveLoopClues({ userId: "u1", entries });

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.every((clue) => clue.patternType === "repetitive_loop")).toBe(true);
    expect(new Set(result.map((clue) => clue.summary)).size).toBe(result.length);
  });

  it("caps emitted repetitive_loop clues at RL_MAX_CLUES", () => {
    const entries = [
      makeEntry("I keep going back to smoking when stress spikes", { sessionId: "subA" }),
      makeEntry("I keep slipping back to weed after a few days", { sessionId: "subB" }),

      makeEntry("I keep overthinking and ending up in the same place mentally", { sessionId: "cogA" }),
      makeEntry("I keep getting overstimulated and stuck in this loop", { sessionId: "cogB" }),

      makeEntry("I keep asking codex to update the project and hitting the same loop", { sessionId: "assistA" }),
      makeEntry("I keep reworking the same prompt in this assistant flow", { sessionId: "assistB" }),

      makeEntry("I keep crashing out and calming down then doing this again", { sessionId: "emoA" }),
      makeEntry("I keep trying to accept reality and move forward but ending up back here", { sessionId: "emoB" }),

      makeEntry("I keep ending up in the same pattern at work", { sessionId: "generalA" }),
      makeEntry("I keep going back to the same routine again", { sessionId: "generalB" }),
    ];

    const result = detectRepetitiveLoopClues({ userId: "u1", entries });

    expect(result).toHaveLength(RL_MAX_CLUES);
  });

  it("keeps supportEntries scoped to each subgroup", () => {
    const cues = [
      makeEntry("I keep going back to smoking when pressure rises", { sessionId: "subA" }),
      makeEntry("I keep slipping back to weed after short breaks", { sessionId: "subB" }),
      makeEntry("I keep overthinking and ending up in the same place mentally", { sessionId: "cogA" }),
      makeEntry("I keep getting overstimulated and running into the same loop", { sessionId: "cogB" }),
      makeJournalEntry("I keep slipping back to nicotine when stress rises."),
      makeJournalEntry("I keep overthinking this and my brain loops until I feel mentally overloaded."),
    ];

    const result = buildRepetitiveLoopCluesFromCues({
      userId: "u1",
      cues,
      maxClues: RL_MAX_CLUES,
    });

    const substanceClue = result.find((clue) => clue.summary.includes("substance/relapse loop"));
    const cognitiveClue = result.find((clue) => clue.summary.includes("cognitive overload loop"));

    expect(substanceClue).toBeDefined();
    expect(cognitiveClue).toBeDefined();

    expect(
      substanceClue!.supportEntries!.every((entry) =>
        /\b(?:weed|smok\w*|nicotine)\b/i.test(entry.content)
      )
    ).toBe(true);
    expect(
      cognitiveClue!.supportEntries!.every((entry) =>
        /\b(?:overthink\w*|overstim\w*|brain|mental(?:ly)?)\b/i.test(entry.content)
      )
    ).toBe(true);
  });

  it("preserves one-clue behavior when only one subgroup independently meets session threshold", () => {
    const entries = [
      makeEntry("I keep slipping back to smoking when stressed", { sessionId: "substanceA" }),
      makeEntry("I keep going back to weed after I calm down", { sessionId: "substanceB" }),
      makeEntry("I keep overthinking this same issue", { sessionId: "singleCognitiveSessionOnly" }),
    ];

    const result = detectRepetitiveLoopClues({ userId: "u1", entries });

    expect(result).toHaveLength(1);
    expect(result[0]!.summary).toContain("substance/relapse loop");
  });
});

// ── Helper unit tests ─────────────────────────────────────────────────────────

describe("detectRepetitiveLoopCueMessages", () => {
  it("returns only user messages matching loop markers", () => {
    const entries = [
      makeEntry("I keep falling back into the same pattern", { role: "user" }),
      makeEntry("I keep ending up here", { role: "assistant" }),
      makeEntry("Today was fine.", { role: "user" }),
    ];
    const cues = detectRepetitiveLoopCueMessages(entries, REPETITIVE_LOOP_MARKERS);
    expect(cues).toHaveLength(1);
    expect(cues[0]!.role).toBe("user");
  });
});

describe("groupLoopCuesBySession", () => {
  it("groups cues by sessionId", () => {
    const cues = [
      makeEntry("I keep falling back", { sessionId: "sA" }),
      makeEntry("I keep ending up here", { sessionId: "sB" }),
      makeEntry("I find myself back again", { sessionId: "sA" }),
    ];
    const groups = groupLoopCuesBySession(cues);
    expect(groups.size).toBe(2);
    expect(groups.get("sA")).toHaveLength(2);
    expect(groups.get("sB")).toHaveLength(1);
  });
});
