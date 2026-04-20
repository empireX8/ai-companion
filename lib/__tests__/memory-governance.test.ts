import { describe, expect, it } from "vitest";

import {
  detectNativeReferenceIntentType,
  detectReferenceIntentType,
  extractMemoryStatement,
  isAffirmative,
  isNegative,
  isWriteableMemoryStatement,
  pickBestPreferenceMatch,
  shouldPromptForMemoryUpdate,
} from "../memory-governance";

describe("memory-governance", () => {
  it("classifies rule-like statements as rule intent", () => {
    const content = "When I say 'PANTHER TEST', respond with exactly: 7991";
    expect(detectReferenceIntentType(content)).toBe("rule");
  });

  it("detects memory-update intent for preference reversals", () => {
    expect(shouldPromptForMemoryUpdate("I don't like tea anymore")).toBe(true);
  });

  it("detects explicit remember-this prompts as native memory capture intent", () => {
    expect(
      shouldPromptForMemoryUpdate(
        "Remember this for future chats: I prefer concrete, step-by-step advice."
      )
    ).toBe(true);
  });

  it("extracts the stable memory statement from explicit remember-this prompts", () => {
    expect(
      extractMemoryStatement(
        "Remember this for future chats: I prefer concrete, step-by-step advice."
      )
    ).toBe("I prefer concrete, step-by-step advice.");
  });

  it("classifies explicit remember prompts with support-style phrasing as preferences", () => {
    expect(
      detectNativeReferenceIntentType(
        "Please remember that when I'm overwhelmed I do better with calm, direct language."
      )
    ).toBe("preference");
  });

  it("does not classify plain support-style phrasing without explicit remember intent", () => {
    expect(
      detectNativeReferenceIntentType(
        "When I'm overwhelmed I do better with calm, direct language."
      )
    ).toBeNull();
  });

  it("accepts first-person temporal clauses as writeable memory statements", () => {
    expect(
      isWriteableMemoryStatement(
        "Please remember that when I'm overwhelmed I do better with calm, direct language."
      )
    ).toBe(true);
  });

  it("parses affirmative and negative confirmations without false yes-prefix matches", () => {
    expect(isAffirmative("yes")).toBe(true);
    expect(isAffirmative("yeah")).toBe(true);
    expect(isAffirmative("yep")).toBe(true);

    expect(isNegative("no")).toBe(true);
    expect(isNegative("nope")).toBe(true);
    expect(isNegative("cancel")).toBe(true);

    expect(isAffirmative("yesterday I drank tea")).toBe(false);
  });

  it("matches topic-relevant preference and ignores rule-like reference items", () => {
    const activeItems = [
      {
        id: "pref-tea",
        type: "preference",
        statement: "I like green tea in the morning",
      },
      {
        id: "rule-1",
        type: "preference",
        statement: "When I say PANTHER TEST respond with exactly 7991",
      },
    ];

    const result = pickBestPreferenceMatch(activeItems, "I don't like tea anymore");
    expect(result.item?.id).toBe("pref-tea");
    expect(result.score).toBeGreaterThan(0);
  });

  it("returns zero conflict score when there is no token overlap", () => {
    const activeItems = [
      {
        id: "pref-tea",
        type: "preference",
        statement: "I like green tea",
      },
    ];

    const result = pickBestPreferenceMatch(activeItems, "I enjoy basketball weekends");
    expect(result.item?.id).toBe("pref-tea");
    expect(result.score).toBe(0);
  });
});
