/**
 * Trigger-Condition Detector tests (P3-07)
 */

import { describe, expect, it } from "vitest";

import {
  buildTriggerConditionSubgroupDiagnostics,
  classifyTriggerConditionSubgroup,
  detectTriggerConditionClues,
  TC_MAX_SUBGROUP_CLUES,
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

describe("detectTriggerConditionClues — subgroup pilot emission", () => {
  it("emits two subgroup-local clues when social_appeasement and overwhelm_state_shift both meet spread", () => {
    const entries = [
      makeEntry(
        "Whenever someone seems upset with me, I default to people-pleasing and walk back my boundary.",
        { sessionId: "social-1", messageId: "social-msg-1", createdAt: new Date("2026-01-01") }
      ),
      makeEntry(
        "When social pressure rises, I start appeasing people and over-explaining myself.",
        { sessionId: "social-2", messageId: "social-msg-2", createdAt: new Date("2026-01-02") }
      ),
      makeEntry(
        "If I think someone might be disappointed, I walk back my boundary to smooth it over.",
        { sessionId: "social-3", messageId: "social-msg-3", createdAt: new Date("2026-01-03") }
      ),
      makeEntry(
        "When I'm overwhelmed, I tend to feel my mode shift and my identity wobble under pressure.",
        { sessionId: "overwhelm-1", messageId: "overwhelm-msg-1", createdAt: new Date("2026-01-04") }
      ),
      makeEntry(
        "Every time this state hits, it triggers my emotional mode shift.",
        { sessionId: "overwhelm-2", messageId: "overwhelm-msg-2", createdAt: new Date("2026-01-05") }
      ),
      makeEntry(
        "When pressure builds, I usually feel that same state change again.",
        { sessionId: "overwhelm-3", messageId: "overwhelm-msg-3", createdAt: new Date("2026-01-06") }
      ),
      makeEntry(
        "When stress spikes, I end up smoking and making tea as a reset.",
        { sessionId: "coping-1", messageId: "coping-msg-1", createdAt: new Date("2026-01-07") }
      ),
      makeEntry(
        "Whenever this pattern repeats, I notice that I lose momentum.",
        { sessionId: "general-1", messageId: "general-msg-1", createdAt: new Date("2026-01-08") }
      ),
    ];

    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(2);
    expect(clues.length).toBeLessThanOrEqual(TC_MAX_SUBGROUP_CLUES);

    const social = clues.find((clue) =>
      clue.summary.startsWith("Trigger-response pattern (social appeasement): ")
    );
    const overwhelm = clues.find((clue) =>
      clue.summary.startsWith("Trigger-response pattern (overwhelm/state shift): ")
    );

    expect(social).toBeDefined();
    expect(overwhelm).toBeDefined();
    expect(
      social?.supportEntries?.every((entry) => entry.messageId?.startsWith("social-msg-"))
    ).toBe(true);
    expect(
      overwhelm?.supportEntries?.every((entry) => entry.messageId?.startsWith("overwhelm-msg-"))
    ).toBe(true);
  });

  it("does not emit coping_reactivity as its own clue when coping spread is below gate", () => {
    const entries = [
      makeEntry("Whenever someone seems upset with me, I default to people-pleasing.", {
        sessionId: "social-1",
        messageId: "social-msg-1",
      }),
      makeEntry("When social pressure rises, I start appeasing people and over-explaining.", {
        sessionId: "social-2",
        messageId: "social-msg-2",
      }),
      makeEntry("If tension shows up, I walk back my boundary.", {
        sessionId: "social-3",
        messageId: "social-msg-3",
      }),
      makeEntry("When stress spikes, I end up smoking and making tea as a reset.", {
        sessionId: "coping-1",
        messageId: "coping-msg-1",
      }),
    ];

    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]?.summary.startsWith("Trigger-response pattern (coping reactivity): ")).toBe(
      false
    );
  });

  it("prefers a strong overwhelm/identity-trigger quote over vague generic trigger text for subgroup summary", () => {
    const entries = [
      makeEntry(
        "I'm thinking double has to be the time, and every time there's an emotional moment it gets noisy.",
        { sessionId: "overwhelm-1", messageId: "overwhelm-weak-1", createdAt: new Date("2026-01-01") }
      ),
      makeEntry(
        "When I'm overwhelmed, I tend to feel my identity get triggered and my state shifts quickly.",
        { sessionId: "overwhelm-2", messageId: "overwhelm-strong-1", createdAt: new Date("2026-01-02") }
      ),
      makeEntry(
        "Every time this state hits, I start to feel my brain bubbling and my identity gets triggered.",
        { sessionId: "overwhelm-3", messageId: "overwhelm-strong-2", createdAt: new Date("2026-01-03") }
      ),
    ];

    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]?.summary.startsWith("Trigger-response pattern (overwhelm/state shift): ")).toBe(
      true
    );
    expect(clues[0]?.summary).not.toContain("I'm thinking double has to be the time");
    expect(clues[0]?.summary).toMatch(/overwhelm|identity|mode|state|brain/i);
  });

  it("prefers people-pleaser/social-pressure summary text over weaker adjacent social burden text", () => {
    const entries = [
      makeEntry("When social expectations stack up, it makes me feel doom and competency burden.", {
        sessionId: "social-1",
        messageId: "social-weak-1",
        createdAt: new Date("2026-01-01"),
      }),
      makeEntry("I notice I am definitely a people pleaser.", {
        sessionId: "social-2",
        messageId: "social-strong-1",
        createdAt: new Date("2026-01-02"),
      }),
      makeEntry("When social pressure rises, I start appeasing people instead of being direct.", {
        sessionId: "social-3",
        messageId: "social-strong-2",
        createdAt: new Date("2026-01-03"),
      }),
      makeEntry("When social expectations stack up, it makes me feel doom and competency burden.", {
        sessionId: "social-4",
        messageId: "social-weak-2",
        createdAt: new Date("2026-01-04"),
      }),
    ];

    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]?.summary.startsWith("Trigger-response pattern (social appeasement): ")).toBe(
      true
    );
    expect(clues[0]?.summary).not.toMatch(/doom|competen/i);
    expect(clues[0]?.summary).toMatch(/people\s*pleaser|social pressure|appeasing/i);
  });

  it("falls back to current representative selection when no better theme-local quote exists", () => {
    const entries = [
      makeEntry("When pressure rises, I always pause and overthink the same way.", {
        sessionId: "overwhelm-1",
        messageId: "overwhelm-fallback-1",
        createdAt: new Date("2026-01-01"),
      }),
      makeEntry("If pressure keeps climbing, I tend to loop mentally for hours.", {
        sessionId: "overwhelm-2",
        messageId: "overwhelm-fallback-2",
        createdAt: new Date("2026-01-02"),
      }),
      makeEntry("Whenever pressure is high, I usually end up freezing in place.", {
        sessionId: "overwhelm-3",
        messageId: "overwhelm-fallback-3",
        createdAt: new Date("2026-01-03"),
      }),
    ];

    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]?.summary.startsWith("Trigger-response pattern (overwhelm/state shift): ")).toBe(
      true
    );
    expect(clues[0]?.summary).toContain("Whenever pressure is high, I usually end up freezing in place.");
  });

  it("filters overwhelm support to identity/mode/overwhelm evidence when filtered spread remains viable", () => {
    const entries = [
      makeEntry("Every time emotional stuff comes up, I end up going in circles.", {
        sessionId: "overwhelm-1",
        messageId: "overwhelm-weak-1",
        createdAt: new Date("2026-01-01"),
      }),
      makeEntry("When I'm overwhelmed, it triggers my identity immediately.", {
        sessionId: "overwhelm-2",
        messageId: "overwhelm-strong-1",
        createdAt: new Date("2026-01-02"),
      }),
      makeEntry("Every time this happens, I feel this way in this mode.", {
        sessionId: "overwhelm-3",
        messageId: "overwhelm-strong-2",
        createdAt: new Date("2026-01-03"),
      }),
      makeEntry("When pressure rises, I tend to feel my brain bubbling.", {
        sessionId: "overwhelm-4",
        messageId: "overwhelm-strong-3",
        createdAt: new Date("2026-01-04"),
      }),
    ];

    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]?.summary.startsWith("Trigger-response pattern (overwhelm/state shift): ")).toBe(
      true
    );
    expect(new Set(clues[0]?.supportEntries?.map((entry) => entry.messageId))).toEqual(
      new Set(["overwhelm-strong-1", "overwhelm-strong-2", "overwhelm-strong-3"])
    );
  });

  it("filters social support to social evidence and excludes weed-loop text when spread remains viable", () => {
    const entries = [
      makeEntry("Whenever someone seems upset with me, I default to people-pleasing.", {
        sessionId: "social-1",
        messageId: "social-strong-1",
        createdAt: new Date("2026-01-01"),
      }),
      makeEntry("When social pressure rises, I start appeasing people instead of being direct.", {
        sessionId: "social-2",
        messageId: "social-strong-2",
        createdAt: new Date("2026-01-02"),
      }),
      makeEntry(
        "Every time social influences show up, I feel shy and I start appeasing to avoid conflict.",
        {
        sessionId: "social-3",
        messageId: "social-strong-3",
        createdAt: new Date("2026-01-03"),
      }),
      makeEntry("When social pressure rises, I always end up going back to weed.", {
        sessionId: "social-4",
        messageId: "social-weed-1",
        createdAt: new Date("2026-01-04"),
      }),
    ];

    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]?.summary.startsWith("Trigger-response pattern (social appeasement): ")).toBe(
      true
    );
    expect(new Set(clues[0]?.supportEntries?.map((entry) => entry.messageId))).toEqual(
      new Set(["social-strong-1", "social-strong-2", "social-strong-3"])
    );
  });

  it("falls back to subgroup-local support pool when filtered support would drop below spread gate", () => {
    const entries = [
      makeEntry("When I'm overwhelmed, it triggers my identity immediately.", {
        sessionId: "overwhelm-1",
        messageId: "overwhelm-strong-1",
        createdAt: new Date("2026-01-01"),
      }),
      makeEntry("Every time emotional stuff comes up, I end up going in circles.", {
        sessionId: "overwhelm-2",
        messageId: "overwhelm-weak-1",
        createdAt: new Date("2026-01-02"),
      }),
      makeEntry("When pressure rises, I always freeze and overthink.", {
        sessionId: "overwhelm-3",
        messageId: "overwhelm-weak-2",
        createdAt: new Date("2026-01-03"),
      }),
    ];

    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]?.summary.startsWith("Trigger-response pattern (overwhelm/state shift): ")).toBe(
      true
    );
    expect(new Set(clues[0]?.supportEntries?.map((entry) => entry.messageId))).toEqual(
      new Set(["overwhelm-strong-1", "overwhelm-weak-1", "overwhelm-weak-2"])
    );
  });

  it("keeps trigger clue emission count unchanged under support filtering", () => {
    const entries = [
      makeEntry("Whenever someone seems upset with me, I default to people-pleasing.", {
        sessionId: "social-1",
        messageId: "social-1",
      }),
      makeEntry("When social pressure rises, I start appeasing people.", {
        sessionId: "social-2",
        messageId: "social-2",
      }),
      makeEntry("Every time family expectations show up, I walk back my boundary.", {
        sessionId: "social-3",
        messageId: "social-3",
      }),
      makeEntry("When I'm overwhelmed, it triggers my identity immediately.", {
        sessionId: "overwhelm-1",
        messageId: "overwhelm-1",
      }),
      makeEntry("Every time this happens, I feel this way in this mode.", {
        sessionId: "overwhelm-2",
        messageId: "overwhelm-2",
      }),
      makeEntry("When pressure rises, I tend to feel my brain bubbling.", {
        sessionId: "overwhelm-3",
        messageId: "overwhelm-3",
      }),
      makeEntry("When social pressure rises, I always end up going back to weed.", {
        sessionId: "social-4",
        messageId: "social-weed",
      }),
      makeEntry("Every time emotional stuff comes up, I end up going in circles.", {
        sessionId: "overwhelm-4",
        messageId: "overwhelm-weak",
      }),
    ];

    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(2);
  });

  it("does not emit general as a subgroup clue even when general messages dominate", () => {
    const entries = [
      makeEntry("Whenever I hit this pattern, I tend to freeze up.", {
        sessionId: "general-1",
      }),
      makeEntry("Every time this cycle appears, I always lose momentum.", {
        sessionId: "general-2",
      }),
      makeEntry("When this comes up, I usually shut down and stall.", {
        sessionId: "general-3",
      }),
      makeEntry("Whenever this pattern repeats, I notice I fall behind.", {
        sessionId: "general-4",
      }),
    ];

    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]?.summary.startsWith("Trigger-response pattern: ")).toBe(true);
  });

  it("falls back to one broad trigger clue when no subgroup meets session spread gate", () => {
    const entries = [
      makeEntry("Whenever someone seems upset with me, I default to people-pleasing.", {
        sessionId: "social-only",
        messageId: "msg-social",
      }),
      makeEntry("When I'm overwhelmed, I tend to feel my mode shift.", {
        sessionId: "overwhelm-only",
        messageId: "msg-overwhelm",
      }),
      makeEntry("Every time stress rises, I end up smoking and making tea.", {
        sessionId: "coping-only",
        messageId: "msg-coping",
      }),
    ];

    const clues = detectTriggerConditionClues({ userId: "u1", entries });
    expect(clues).toHaveLength(1);
    expect(clues[0]?.summary.startsWith("Trigger-response pattern: ")).toBe(true);
    expect(new Set(clues[0]?.supportEntries?.map((entry) => entry.messageId))).toEqual(
      new Set(["msg-social", "msg-overwhelm", "msg-coping"])
    );
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
