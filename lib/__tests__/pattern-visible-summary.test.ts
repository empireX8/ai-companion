import { describe, expect, it } from "vitest";

import {
  generateVisiblePatternSummary,
  shouldSurfacePatternClaim,
} from "../pattern-visible-summary";

function receipts(...quotes: string[]) {
  return quotes.map((quote) => ({ quote }));
}

describe("generateVisiblePatternSummary", () => {
  it("hardcoded shell summary is rejected when evidence is too generic", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "trigger_condition",
      persistedSummary: "Recurring trigger-response patterns in conversation history",
      receipts: receipts(
        "I notice this comes up sometimes",
        "I keep thinking about this pattern"
      ),
    });

    expect(summary).toBeNull();
    expect(
      shouldSurfacePatternClaim({
        patternType: "trigger_condition",
        persistedSummary: "Recurring trigger-response patterns in conversation history",
        receipts: receipts(
          "I notice this comes up sometimes",
          "I keep thinking about this pattern"
        ),
      })
    ).toBe(false);
  });

  it("clustered trigger clues yield a specific summary", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "trigger_condition",
      persistedSummary: "Recurring trigger-response patterns in conversation history",
      receipts: receipts(
        "I default to people-pleasing when someone seems upset with me",
        "When pressure rises, I start appeasing people instead of staying honest",
        "I walk it back quickly if a boundary might disappoint someone"
      ),
    });

    expect(summary).toBe("When pressure rises, you default to pleasing or appeasing.");
  });

  it("recognizes people pleaser wording as the same trigger family signal", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "trigger_condition",
      persistedSummary: 'Trigger-response pattern: "I notice I am definitely a people pleaser"',
      receipts: receipts(
        "I notice I am definitely a people pleaser",
        "When pressure rises, I start appeasing people instead of staying honest"
      ),
    });

    expect(summary).toBe("When pressure rises, you default to pleasing or appeasing.");
  });

  it("replays the imported people-pleaser bundle when a second quote describes feeling submissive", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "trigger_condition",
      persistedSummary: 'Trigger-response pattern: "I notice I am definitely a people pleaser"',
      receipts: receipts(
        "I notice I am definitely a people pleaser",
        "The combination of those three is what makes me feel like, populationly submissive, like, yo.",
        "The combination of those three is what makes me feel like, populationly submissive, like, yo."
      ),
    });

    expect(summary).toBe("When pressure rises, you default to pleasing or appeasing.");
  });

  it("does not let generic again-noise count as trigger-condition support", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "trigger_condition",
      persistedSummary: 'Trigger-response pattern: "I notice I am definitely a people pleaser"',
      receipts: receipts(
        "I notice I am definitely a people pleaser",
        "Again — good for creativity,",
        "You’ll see categories again while you sort out the database."
      ),
    });

    expect(summary).toBeNull();
  });

  it("single weak clue does not produce a visible claim", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "inner_critic",
      persistedSummary: "Recurring self-critical pattern in conversation history",
      receipts: receipts("I feel weird about this sometimes"),
    });

    expect(summary).toBeNull();
  });

  it("repetitive recurrence sharpens the summary", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "repetitive_loop",
      persistedSummary: "Recurring repetitive loop in conversation history",
      receipts: receipts(
        "I keep circling back to the same regret about wasting my potential",
        "The same confidence regret comes back whenever I think about what I could have done",
        "I revisit that wasted-potential feeling over and over"
      ),
    });

    expect(summary).toBe("The same confidence-related regret keeps resurfacing.");
  });

  it("summary and quote are not conflated", () => {
    const quoteA = "I struggle to trust my own judgment when I have to commit";
    const quoteB = "I doubt myself more whenever I have to assess my ability";

    const summary = generateVisiblePatternSummary({
      patternType: "inner_critic",
      persistedSummary: "Recurring self-critical pattern in conversation history",
      receipts: receipts(quoteA, quoteB),
    });

    expect(summary).toBe("Self-doubt shows up when you assess your own ability.");
    expect(summary).not.toBe(quoteA);
    expect(summary).not.toBe(quoteB);
  });

  it("recurring have-a-hard-time clues yield a specific inner_critic summary", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "inner_critic",
      persistedSummary: "Recurring self-critical pattern in conversation history",
      receipts: receipts(
        "I have a hard time being assertive when someone pushes back",
        "I have a hard time saying no even when I know I should"
      ),
    });

    expect(summary).toBe(
      "You often find certain areas hard and doubt your own ability to handle them."
    );
  });

  it("recognizes contracted can't-do wording as incapability evidence", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "inner_critic",
      persistedSummary: 'Self-critical pattern: "So, yeah, I can\'t do that."',
      receipts: receipts(
        "So, yeah, I can't do that.",
        "When the pressure is on, I can't do that."
      ),
    });

    expect(summary).toBe("You often tell yourself you can't do it or get it right.");
  });

  it("bad generic fallback loses to abstention when evidence has no recovery signal", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "recovery_stabilizer",
      persistedSummary: "Recurring recovery pattern in conversation history",
      receipts: receipts(
        "Things were different this week",
        "I've been handling it differently"
      ),
    });

    expect(summary).toBeNull();
  });

  it("overwhelm / identity-state trigger produces a visible summary", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "trigger_condition",
      persistedSummary: "Recurring trigger-response patterns in conversation history",
      receipts: receipts(
        "triggers my internal hood identity",
        "I always feel this way in this mode",
        "brain like bubbling when I see something that starts to trigger my identity"
      ),
    });

    expect(summary).toBe("When something activates your identity, your internal state shifts.");
  });

  it("weak unrelated trigger returns null — no identity or overwhelm signal", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "trigger_condition",
      persistedSummary: "Recurring trigger-response patterns in conversation history",
      receipts: receipts(
        "It was a nice day outside",
        "I had coffee this morning"
      ),
    });

    expect(summary).toBeNull();
  });

  it("reassurance-seeking repetitive_loop produces a visible summary", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "repetitive_loop",
      persistedSummary: "Recurring repetitive loop in conversation history",
      receipts: receipts(
        "constantly seeking reassurance",
        "I don't want to keep going through this",
        "confirm you're not doing that"
      ),
    });

    expect(summary).toBe("You keep returning to the same need for reassurance or confirmation.");
  });

  it("live reassurance-loop evidence (process loop) returns a visible summary", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "repetitive_loop",
      persistedSummary:
        'Repetitive loop (assistant/process loop) across sessions: "Yeah, facts, I agree. And that\'s what I\'ve been trying to do this time around, just commit to the be"',
      receipts: receipts(
        "and actually he was updating the aestehtic and you was just gonna skip over it, i need to confirm youre not doing that again before i continue watching",
        "But the thing is, I don't want to keep going through this, because it's like I'm constantly seeking reassurance, bro.",
        "But again, weirdly, I don't know if we've done this video, but we've done that already as well, so I'm a bit confused.",
        "bruv cant i do this later, surely i can keep watching the course video now"
      ),
    });

    expect(summary).not.toBeNull();
    expect(summary).toBe("You keep returning to the same need for reassurance or confirmation.");
  });

  it("weak unrelated repetitive_loop returns null — no reassurance or confirmation signal", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "repetitive_loop",
      persistedSummary: "Recurring repetitive loop in conversation history",
      receipts: receipts(
        "I keep thinking about the same thing",
        "I always do this anyway"
      ),
    });

    expect(summary).toBeNull();
  });

  it("recovery progress wording includes progress token for lexical overlap", () => {
    const summary = generateVisiblePatternSummary({
      patternType: "recovery_stabilizer",
      persistedSummary: "Recurring recovery pattern in conversation history",
      receipts: receipts(
        "We're making progress though.",
        "I feel like things are finally making progress"
      ),
    });

    expect(summary).toBe("You describe progress when momentum becomes visible.");
  });
});
