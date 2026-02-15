import { describe, expect, it } from "vitest";

import {
  createContradictionSchema,
  patchContradictionSchema,
} from "../contradiction-schema";

describe("contradiction schema", () => {
  it("accepts a valid create payload", () => {
    const payload = {
      title: "Want stability but chase novelty",
      sideA: "I want predictable routines",
      sideB: "I keep making last-minute plan changes",
      type: "goal_behavior_gap",
      confidence: "medium",
      sourceSessionId: " session-1 ",
      sourceMessageId: " message-1 ",
      evidence: [{ sessionId: "session-1", messageId: "message-1", quote: "example" }],
      rung: "rung2_explicit_contradiction",
      snoozedUntil: "2026-02-20T12:00:00.000Z",
    };

    const parsed = createContradictionSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid create payload", () => {
    const parsed = createContradictionSchema.safeParse({
      title: " ",
      sideA: "",
      sideB: "ok",
      type: "not_real",
      confidence: "high",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a valid patch payload", () => {
    const parsed = patchContradictionSchema.safeParse({
      action: "accept_tradeoff",
      status: "explored",
      rung: null,
      weightDelta: 2.5,
      snoozedUntil: null,
      touch: true,
      addEvidence: [{ sessionId: "session-2", quote: "follow-up" }],
      title: "Updated title",
      sideA: "Updated A",
      sideB: "Updated B",
      type: "value_conflict",
      confidence: "high",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid patch payload", () => {
    const parsed = patchContradictionSchema.safeParse({
      action: "unknown_action",
      weightDelta: 11,
      snoozedUntil: "not-a-date",
    });

    expect(parsed.success).toBe(false);
  });
});
