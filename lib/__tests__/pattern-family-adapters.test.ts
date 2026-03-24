/**
 * Pattern Family Adapters tests (P3-08)
 *
 * Covers inner_critic, repetitive_loop, and recovery_stabilizer adapters.
 * (contradiction_drift is covered in contradiction-drift-adapter.test.ts)
 * (trigger_condition is covered in trigger-condition-detector.test.ts)
 */

import { describe, expect, it } from "vitest";

import {
  detectInnerCriticClues,
  IC_MIN_MATCHES,
} from "../inner-critic-adapter";
import {
  detectRepetitiveLoopClues,
  RL_MIN_SESSIONS,
} from "../repetitive-loop-adapter";
import {
  detectRecoveryStabilizerClues,
  RS_MIN_MATCHES,
} from "../recovery-stabilizer-adapter";
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

// ── inner_critic ──────────────────────────────────────────────────────────────

describe("detectInnerCriticClues — threshold guards", () => {
  it(`returns empty when fewer than ${IC_MIN_MATCHES} matching messages`, () => {
    const entries = Array.from({ length: IC_MIN_MATCHES - 1 }, () =>
      makeEntry("I'm terrible at staying consistent")
    );
    expect(detectInnerCriticClues({ userId: "u1", entries })).toHaveLength(0);
  });

  it("returns empty for neutral messages", () => {
    const entries = [
      makeEntry("I went for a walk today."),
      makeEntry("The meeting went well."),
      makeEntry("I finished the report."),
    ];
    expect(detectInnerCriticClues({ userId: "u1", entries })).toHaveLength(0);
  });

  it("ignores assistant-role messages", () => {
    const entries = Array.from({ length: IC_MIN_MATCHES + 2 }, () =>
      makeEntry("I'm such a failure", { role: "assistant" })
    );
    expect(detectInnerCriticClues({ userId: "u1", entries })).toHaveLength(0);
  });
});

describe("detectInnerCriticClues — clue production", () => {
  it("produces one clue at threshold", () => {
    const entries = Array.from({ length: IC_MIN_MATCHES }, () =>
      makeEntry("I'm terrible at keeping my promises")
    );
    const result = detectInnerCriticClues({ userId: "u1", entries });
    expect(result).toHaveLength(1);
    expect(result[0]!.patternType).toBe("inner_critic");
    expect(result[0]!.userId).toBe("u1");
  });

  it("summary is stable across runs", () => {
    const stableRepresentative = "I can't do anything right when I panic";
    const small = [
      ...Array.from({ length: IC_MIN_MATCHES - 1 }, () =>
        makeEntry("I'm terrible at staying calm under pressure")
      ),
      makeEntry(stableRepresentative),
    ];
    const large = [
      ...Array.from({ length: IC_MIN_MATCHES + 2 }, () =>
        makeEntry("I always mess things up when I overthink")
      ),
      makeEntry(stableRepresentative),
    ];
    const s1 = detectInnerCriticClues({ userId: "u1", entries: small })[0]!;
    const s2 = detectInnerCriticClues({ userId: "u1", entries: large })[0]!;
    expect(s1.summary).toBe(s2.summary);
  });

  it("evidence comes from most recent matching message", () => {
    const old = makeEntry("I'm such a failure", {
      sessionId: "old_sess",
      messageId: "old_msg",
    });
    const recent = makeEntry("I always mess things up", {
      sessionId: "new_sess",
      messageId: "new_msg",
    });
    const filler = makeEntry("I'm terrible at keeping my promises");
    const clue = detectInnerCriticClues({
      userId: "u1",
      entries: [old, filler, recent],
    })[0]!;
    expect(clue.sessionId).toBe("new_sess");
    expect(clue.messageId).toBe("new_msg");
  });
});

describe("detectInnerCriticClues — marker coverage", () => {
  it.each([
    ["terrible at", "I'm terrible at being consistent"],
    ["can't do", "I can't do anything right"],
    ["why do I always", "why do I always sabotage myself"],
    ["such a failure", "I'm such a failure at everything"],
    ["I hate myself", "I hate myself for giving up again"],
    ["ruin everything", "I ruin everything I touch"],
  ])("detects '%s' marker", (_label, content) => {
    const matching = makeEntry(content);
    const fillers = Array.from({ length: IC_MIN_MATCHES - 1 }, () =>
      makeEntry("I always mess things up")
    );
    const result = detectInnerCriticClues({
      userId: "u1",
      entries: [...fillers, matching],
    });
    expect(result).toHaveLength(1);
  });
});

// ── repetitive_loop ───────────────────────────────────────────────────────────

describe("detectRepetitiveLoopClues — session threshold guards", () => {
  it("returns empty when loop cues exist in only one session", () => {
    // Three strong cues, all in default sess1 — single session, not enough
    const entries = [
      makeEntry("I keep falling back into the same pattern"),
      makeEntry("I keep going back to the same habits"),
      makeEntry("I find myself doing the same things over and over"),
    ];
    expect(detectRepetitiveLoopClues({ userId: "u1", entries })).toHaveLength(0);
  });

  it("returns empty for non-loop messages across multiple sessions", () => {
    const entries = [
      makeEntry("I tried something new today."),
      makeEntry("Making good progress.", { sessionId: "sess2" }),
      makeEntry("Things are going well.", { sessionId: "sess3" }),
    ];
    expect(detectRepetitiveLoopClues({ userId: "u1", entries })).toHaveLength(0);
  });
});

describe("detectRepetitiveLoopClues — clue production", () => {
  it(`produces one clue when loop cues appear across ${RL_MIN_SESSIONS} sessions`, () => {
    const entries = [
      makeEntry("I keep falling back into the same pattern", { sessionId: "sess1" }),
      makeEntry("I keep ending up in the same place mentally", { sessionId: "sess2" }),
    ];
    const result = detectRepetitiveLoopClues({ userId: "u1", entries });
    expect(result).toHaveLength(1);
    expect(result[0]!.patternType).toBe("repetitive_loop");
    expect(result[0]!.userId).toBe("u1");
  });

  it("summary is stable across runs with the same representative content", () => {
    const s1 = detectRepetitiveLoopClues({
      userId: "u1",
      entries: [
        makeEntry("I keep falling back into the same pattern", { sessionId: "sess1" }),
        makeEntry("I keep falling back into the same pattern", { sessionId: "sess2" }),
      ],
    })[0]!;
    const s2 = detectRepetitiveLoopClues({
      userId: "u1",
      entries: [
        makeEntry("I keep falling back into the same pattern", { sessionId: "sess1" }),
        makeEntry("I keep falling back into the same pattern", { sessionId: "sess2" }),
        makeEntry("I keep falling back into the same pattern", { sessionId: "sess3" }),
      ],
    })[0]!;
    expect(s1.summary).toBe(s2.summary);
  });

  it("evidence comes from the representative eligible message", () => {
    const a = makeEntry("I keep ending up in the same place mentally", {
      sessionId: "sessA",
      messageId: "msgA",
    });
    const b = makeEntry("I keep falling back into the same pattern", {
      sessionId: "sessB",
      messageId: "msgB",
    });
    const clue = detectRepetitiveLoopClues({ userId: "u1", entries: [a, b] })[0]!;
    // last eligible (I-starting) = b
    expect(clue.sessionId).toBe("sessB");
    expect(clue.messageId).toBe("msgB");
  });
});

describe("detectRepetitiveLoopClues — marker coverage across sessions", () => {
  it.each([
    ["I keep doing", "I keep doing the same thing"],
    ["here I am again", "here I am again in the same place"],
    ["same pattern", "the same pattern is back"],
    ["falling back", "falling back into old habits"],
    ["back to square one", "back to square one it seems"],
    ["cycle repeats", "the cycle repeats every month"],
  ])("detects '%s' marker across two sessions", (_label, content) => {
    // filler in sess1 provides the first session; marker content in sess2 provides the second
    const entries = [
      makeEntry("I keep going back to old ways", { sessionId: "sess1" }),
      makeEntry(content, { sessionId: "sess2" }),
    ];
    const result = detectRepetitiveLoopClues({ userId: "u1", entries });
    expect(result).toHaveLength(1);
  });
});

// ── recovery_stabilizer ───────────────────────────────────────────────────────

describe("detectRecoveryStabilizerClues — threshold guards", () => {
  it(`returns empty when fewer than ${RS_MIN_MATCHES} matching messages`, () => {
    const entries = Array.from({ length: RS_MIN_MATCHES - 1 }, () =>
      makeEntry("I've been doing better lately")
    );
    expect(
      detectRecoveryStabilizerClues({ userId: "u1", entries })
    ).toHaveLength(0);
  });

  it("returns empty for neutral messages", () => {
    const entries = [
      makeEntry("I went for a walk."),
      makeEntry("Had a meeting today."),
    ];
    expect(
      detectRecoveryStabilizerClues({ userId: "u1", entries })
    ).toHaveLength(0);
  });
});

describe("detectRecoveryStabilizerClues — clue production", () => {
  it("produces one clue at threshold", () => {
    const entries = Array.from({ length: RS_MIN_MATCHES }, () =>
      makeEntry("I've been doing better with my routines")
    );
    const result = detectRecoveryStabilizerClues({ userId: "u1", entries });
    expect(result).toHaveLength(1);
    expect(result[0]!.patternType).toBe("recovery_stabilizer");
  });

  it("summary is stable across runs", () => {
    const stableRepresentative = "I'm getting better now that I'm resting";
    const s1 = detectRecoveryStabilizerClues({
      userId: "u1",
      entries: [
        ...Array.from({ length: RS_MIN_MATCHES - 1 }, () =>
          makeEntry("I've been doing better with my routines")
        ),
        makeEntry(stableRepresentative),
      ],
    })[0]!;
    const s2 = detectRecoveryStabilizerClues({
      userId: "u1",
      entries: [
        ...Array.from({ length: RS_MIN_MATCHES + 1 }, () =>
          makeEntry("I'm making real progress lately")
        ),
        makeEntry(stableRepresentative),
      ],
    })[0]!;
    expect(s1.summary).toBe(s2.summary);
  });
});

describe("detectRecoveryStabilizerClues — marker coverage", () => {
  it.each([
    ["doing better", "I've been doing better this week"],
    ["finally managed", "finally managed to stick with it"],
    ["making progress", "I'm making real progress lately"],
    ["things are getting better", "things are getting better than before"],
    ["bouncing back", "I'm bouncing back from the rough patch"],
  ])("detects '%s' marker", (_label, content) => {
    const matching = makeEntry(content);
    const filler = makeEntry("I've been doing well");
    const result = detectRecoveryStabilizerClues({
      userId: "u1",
      entries: [filler, matching],
    });
    expect(result).toHaveLength(1);
  });
});
