import { describe, expect, it } from "vitest";

import {
  detectReferenceIntentType,
  isAffirmative,
  isNegative,
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

