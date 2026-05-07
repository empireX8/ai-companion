/**
 * Trigger-Condition Detector tests (P3-07)
 */

import { describe, expect, it } from "vitest";

import {
  buildTriggerConditionSubgroupDiagnostics,
  classifyTriggerConditionSubgroup,
  detectTriggerConditionClues,
  TC_MIN_MATCHES,
} from "../trigger-condition-detector";
import type { NormalizedHistoryEntry } from "../history-synthesis";

// ── Helpers ───────────────────────────────────────────────────────────────────

let seq = 0;
function makeEntry(
  content: string,
  overrides: Partial<NormalizedHistoryEntry> = {}
): NormalizedHistoryEntry {
  const id = `msg_${++seq}`;
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

function makeTriggerEntries(count: number): NormalizedHistoryEntry[] {
  return Array.from({ length: count }, (_, i) =>
    makeEntry(`whenever I'm stressed, I tend to procrastinate. Message ${i}`)
  );
}

// ── detectTriggerConditionClues ───────────────────────────────────────────────

describe("detectTriggerConditionClues — threshold guards", () => {
  it("returns empty when fewer than TC_MIN_MATCHES matching messages", () => {
    const entries = makeTriggerEntries(TC_MIN_MATCHES - 1);
    const result = detectTriggerConditionClues({ userId: "u1", entries });
    expect(result).toHaveLength(0);
  });

  it("returns empty when there are no trigger-pattern messages", () => {
    const entries = [
      makeEntry("I had a nice day today."),
      makeEntry("The weather was great."),
      makeEntry("I finished my work early."),
    ];
    const result = detectTriggerConditionClues({ userId: "u1", entries });
    expect(result).toHaveLength(0);
  });

  it("returns empty when matching messages are all assistant-role", () => {
    const entries = makeTriggerEntries(TC_MIN_MATCHES + 2).map((e) => ({
      ...e,
      role: "assistant",
    }));
    const result = detectTriggerConditionClues({ userId: "u1", entries });
    expect(result).toHaveLength(0);
  });
});

describe("detectTriggerConditionClues — clue production", () => {
  it(`produces one clue when >= ${TC_MIN_MATCHES} matching user messages`, () => {
    const entries = makeTriggerEntries(TC_MIN_MATCHES);
    const result = detectTriggerConditionClues({ userId: "u1", entries });
    expect(result).toHaveLength(1);
  });

  it("clue has patternType=trigger_condition", () => {
    const entries = makeTriggerEntries(TC_MIN_MATCHES);
    const clue = detectTriggerConditionClues({ userId: "u1", entries })[0]!;
    expect(clue.patternType).toBe("trigger_condition");
  });

  it("clue userId matches input", () => {
    const entries = makeTriggerEntries(TC_MIN_MATCHES);
    const clue = detectTriggerConditionClues({ userId: "user99", entries })[0]!;
    expect(clue.userId).toBe("user99");
  });

  it("summary is stable across runs (content-stable for dedup)", () => {
    const stableRepresentative =
      "whenever I'm stressed, I tend to procrastinate in the same way";
    const entries1 = [
      ...Array.from({ length: TC_MIN_MATCHES - 1 }, () =>
        makeEntry("whenever deadlines pile up, I tend to freeze")
      ),
      makeEntry(stableRepresentative),
    ];
    const entries2 = [
      ...Array.from({ length: TC_MIN_MATCHES + 4 }, () =>
        makeEntry("every time conflict starts, I tend to shut down")
      ),
      makeEntry(stableRepresentative),
    ];
    const c1 = detectTriggerConditionClues({ userId: "u1", entries: entries1 })[0]!;
    const c2 = detectTriggerConditionClues({ userId: "u1", entries: entries2 })[0]!;
    expect(c1.summary).toBe(c2.summary);
  });

  it("evidence context comes from most recent matching message", () => {
    const early = makeEntry("whenever stressed I tend to avoid tasks", {
      sessionId: "sess_early",
      messageId: "msg_early",
      createdAt: new Date("2026-01-01"),
    });
    const late = makeEntry("every time work piles up I end up procrastinating", {
      sessionId: "sess_late",
      messageId: "msg_late",
      createdAt: new Date("2026-01-10"),
    });
    // Need TC_MIN_MATCHES total — add a third filler
    const filler = makeEntry("whenever I'm tired I tend to snack");
    const entries = [early, filler, late];
    const clue = detectTriggerConditionClues({ userId: "u1", entries })[0]!;
    expect(clue.sessionId).toBe("sess_late");
    expect(clue.messageId).toBe("msg_late");
  });
});

describe("detectTriggerConditionClues — marker coverage", () => {
  it.each([
    ["whenever", "whenever I'm anxious I tend to shut down"],
    ["every time", "every time I meet a deadline I end up staying up late"],
    ["triggers me", "this kind of pressure triggers me to avoid"],
    ["makes me want", "failure makes me want to give up"],
    ["if ... then I", "if things get hard then I always retreat"],
    ["always ... when", "I always tend to freeze up when I get criticized"],
  ])("detects '%s' marker", (_label, content) => {
    const matching = makeEntry(content);
    const fillers = makeTriggerEntries(TC_MIN_MATCHES - 1);
    const result = detectTriggerConditionClues({
      userId: "u1",
      entries: [...fillers, matching],
    });
    expect(result).toHaveLength(1);
  });
});

describe("trigger_condition subgroup diagnostics", () => {
  it.each([
    [
      "social_appeasement",
      "Whenever someone seems upset with me, I default to people-pleasing and walk back my boundary.",
    ],
    [
      "overwhelm_state_shift",
      "When I'm overwhelmed, my mode shifts and I feel like my identity changes under pressure.",
    ],
    [
      "coping_reactivity",
      "Every time stress rises I end up smoking weed, then tea and food become my default reset.",
    ],
    [
      "general",
      "Whenever this pattern appears, I notice that I keep reacting in the same old way.",
    ],
  ] as const)("classifies representative text into %s", (expected, content) => {
    expect(classifyTriggerConditionSubgroup(content)).toBe(expected);
  });

  it("builds deterministic subgroup counts, session spread, and samples from trigger matches only", () => {
    const entries = [
      makeEntry(
        "Whenever someone seems upset with me, I default to people-pleasing and walk back my boundary.",
        { messageId: "social-1", sessionId: "social-session-1", createdAt: new Date("2026-01-10") }
      ),
      makeEntry(
        "When I feel social pressure, I start appeasing people and over-explaining myself.",
        { messageId: "social-2", sessionId: "social-session-2", createdAt: new Date("2026-01-11") }
      ),
      makeEntry(
        "When I'm overwhelmed, I tend to feel my mode shift and my identity change under pressure.",
        { messageId: "overwhelm-1", sessionId: "overwhelm-session-1", createdAt: new Date("2026-01-12") }
      ),
      makeEntry(
        "Every time stress rises I end up smoking weed, then tea and food become my default reset.",
        { messageId: "coping-1", sessionId: "coping-session-1", createdAt: new Date("2026-01-13") }
      ),
      makeEntry(
        "Whenever this happens I tend to freeze up and lose momentum.",
        { messageId: "general-1", sessionId: "general-session-1", createdAt: new Date("2026-01-14") }
      ),
      makeEntry("I finished my workout and read a chapter today.", {
        messageId: "neutral-non-trigger",
        sessionId: "neutral-session",
        createdAt: new Date("2026-01-15"),
      }),
    ];

    const diagnostics = buildTriggerConditionSubgroupDiagnostics(entries);

    expect(diagnostics.social_appeasement.candidateCount).toBe(2);
    expect(diagnostics.social_appeasement.sessionCount).toBe(2);
    expect(diagnostics.social_appeasement.samples).toHaveLength(2);
    expect(diagnostics.social_appeasement.topMatchedMarkers.length).toBeGreaterThan(0);

    expect(diagnostics.overwhelm_state_shift.candidateCount).toBe(1);
    expect(diagnostics.overwhelm_state_shift.sessionCount).toBe(1);
    expect(diagnostics.coping_reactivity.candidateCount).toBe(1);
    expect(diagnostics.coping_reactivity.sessionCount).toBe(1);
    expect(diagnostics.general.candidateCount).toBe(1);
    expect(diagnostics.general.sessionCount).toBe(1);
  });

  it("keeps trigger clue emission at one clue even when matches span multiple diagnostic subgroups", () => {
    const entries = [
      makeEntry("Whenever someone seems upset with me, I default to people-pleasing.", {
        sessionId: "sess-social",
      }),
      makeEntry("When I'm overwhelmed, I tend to feel my mode shift and my identity feels unstable.", {
        sessionId: "sess-overwhelm",
      }),
      makeEntry("Every time stress rises, I end up smoking weed and overeating.", {
        sessionId: "sess-coping",
      }),
      makeEntry("Whenever this happens, I tend to freeze up.", {
        sessionId: "sess-general",
      }),
    ];

    const result = detectTriggerConditionClues({ userId: "u1", entries });
    expect(result).toHaveLength(1);
    expect(result[0]!.patternType).toBe("trigger_condition");
  });

  it("keeps supportEntries attached to all trigger matches (materialization path unchanged)", () => {
    const entries = [
      makeEntry("Whenever someone seems upset with me, I default to people-pleasing.", {
        sessionId: "sess-social",
        messageId: "msg-social",
      }),
      makeEntry("When I'm overwhelmed, I tend to feel my mode shift and my identity feels unstable.", {
        sessionId: "sess-overwhelm",
        messageId: "msg-overwhelm",
      }),
      makeEntry("Every time stress rises, I end up smoking weed and overeating.", {
        sessionId: "sess-coping",
        messageId: "msg-coping",
      }),
    ];

    const clue = detectTriggerConditionClues({ userId: "u1", entries })[0]!;
    expect(clue.supportEntries).toHaveLength(3);
    expect(new Set(clue.supportEntries?.map((entry) => entry.messageId))).toEqual(
      new Set(["msg-social", "msg-overwhelm", "msg-coping"])
    );
  });
});
