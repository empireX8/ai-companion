import { describe, expect, it } from "vitest";

import {
  buildFieldworkDraftFromAction,
  canBuildFieldworkFromAction,
} from "../action-fieldwork-bridge";

describe("action-fieldwork-bridge", () => {
  it("accepts a valid surfaced action shape", () => {
    const action = {
      id: "action-1",
      title: "Take a ten-minute reset",
      whySuggested: "This helps reduce escalation after context switching.",
    };

    expect(canBuildFieldworkFromAction(action)).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(
      canBuildFieldworkFromAction({
        id: "action-1",
        title: "",
        whySuggested: "reason",
      })
    ).toBe(false);

    expect(
      canBuildFieldworkFromAction({
        id: "",
        title: "title",
        whySuggested: "reason",
      })
    ).toBe(false);

    expect(
      canBuildFieldworkFromAction({
        id: "action-1",
        title: "title",
        whySuggested: "   ",
      })
    ).toBe(false);
  });

  it("builds a safe fieldwork draft from action context", () => {
    const draft = buildFieldworkDraftFromAction({
      id: " action-1 ",
      title: " Track post-meeting crash ",
      whySuggested: " Validate whether energy drops after high-switch sessions. ",
    });

    expect(draft).toEqual({
      prompt: "Track post-meeting crash",
      reason: "Validate whether energy drops after high-switch sessions.",
      status: "assigned",
      linkedObjectType: "surfaced_action",
      linkedObjectId: "action-1",
    });
  });

  it("returns null for invalid action data", () => {
    expect(
      buildFieldworkDraftFromAction({
        id: "action-1",
        title: "Valid title",
        whySuggested: "",
      })
    ).toBeNull();
  });

  it("never copies unrelated action fields into the draft payload", () => {
    const draft = buildFieldworkDraftFromAction({
      id: "action-1",
      title: "Observe the transition window",
      whySuggested: "Clarify whether this trigger is reliable.",
      // private/noisy fields from SurfacedAction should never be forwarded
      // even if present on the incoming object.
      note: "private note",
      linkedClaimSummary: "raw summary",
    } as unknown as {
      id: string;
      title: string;
      whySuggested: string;
    });

    expect(draft).not.toBeNull();
    const keys = Object.keys(draft ?? {});
    expect(keys).toEqual(
      expect.arrayContaining([
        "prompt",
        "reason",
        "status",
        "linkedObjectType",
        "linkedObjectId",
      ])
    );
    expect(keys).not.toContain("note");
    expect(keys).not.toContain("linkedClaimSummary");
  });
});
