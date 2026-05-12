import { describe, expect, it } from "vitest";

import {
  formatContradictionPrimaryTitle,
  formatContradictionPrimaryTitles,
  summarizeContradictionSide,
} from "../pattern-contradiction-title";
import { computeContradictionTitle } from "../contradiction-title-adapter";
import type { PatternContradictionView } from "../patterns-api";

function makeItem(
  overrides: Partial<PatternContradictionView> = {}
): PatternContradictionView {
  return {
    id: "contradiction-1",
    title: "Goal behavior gap",
    sideA: "I want predictable routines",
    sideB: "I keep making last-minute plan changes",
    type: "goal_behavior_gap",
    status: "open",
    lastEvidenceAt: null,
    lastTouchedAt: "2026-04-20T09:00:00.000Z",
    ...overrides,
  };
}

describe("summarizeContradictionSide", () => {
  it("drops formulaic first-person framing to surface the core phrase", () => {
    expect(summarizeContradictionSide("I want predictable routines")).toBe(
      "wanting predictable routines"
    );
    expect(
      summarizeContradictionSide("I keep making last-minute plan changes")
    ).toBe("last-minute plan changes");
  });

  it("prefers a compact high-signal clause over transcript filler", () => {
    expect(
      summarizeContradictionSide(
        "I mean, I want clean execution, but I keep copying fixes from other people because I'm under pressure."
      )
    ).toBe("copying fixes from other people");
  });

  it("removes meta wrappers without inventing new meaning", () => {
    expect(
      summarizeContradictionSide("You keep describing missed follow-through.")
    ).toBe("missed follow-through");
  });
});

describe("formatContradictionPrimaryTitle", () => {
  it("renders nested tension titles as concise pull-vs-pull summaries", () => {
    expect(formatContradictionPrimaryTitle(makeItem())).toBe(
      "Wanting predictable routines vs last-minute plan changes"
    );
  });

  it("falls back to a tidied readable fragment when no stronger summary is available", () => {
    expect(
      formatContradictionPrimaryTitle(
        makeItem({
          sideA:
            "Quarterly planning work with extra detail around sequence, staffing, and operating constraints",
          sideB: "I skipped the review again.",
        })
      )
    ).toBe("Quarterly planning work with extra detail… vs skipping review again");
  });
});

describe("formatContradictionPrimaryTitles", () => {
  it("returns deterministic pull-vs-pull titles for sibling items", () => {
    const items = [
      makeItem({
        id: "contradiction-1",
        sideA: "I want strategic clarity",
        sideB: "I keep relying on copied fixes",
      }),
      makeItem({
        id: "contradiction-2",
        sideA: "I want clean execution",
        sideB: "I keep defaulting to copied fixes",
      }),
    ];

    const titles = formatContradictionPrimaryTitles(items);

    expect(titles.get("contradiction-1")).toBe(
      "Wanting strategic clarity vs relying on copied fixes"
    );
    expect(titles.get("contradiction-2")).toBe(
      "Wanting clean execution vs defaulting to copied fixes"
    );
  });
});

describe("computeContradictionTitle (adapter)", () => {
  it("returns computed title when sideA/sideB are present", () => {
    const title = computeContradictionTitle({
      id: "test-1",
      title: "Goal behavior gap",
      sideA: "I want predictable routines",
      sideB: "I keep making last-minute plan changes",
      type: "goal_behavior_gap",
      status: "open",
    });
    expect(title).toBe(
      "Wanting predictable routines vs last-minute plan changes"
    );
  });

  it("falls back to raw title when sideA/sideB are missing", () => {
    const title = computeContradictionTitle({
      id: "test-2",
      title: "Goal behavior gap",
      sideA: "",
      sideB: "",
      type: "goal_behavior_gap",
      status: "open",
    });
    expect(title).toBe("Goal behavior gap");
  });

  it("does not return 'Goal behavior gap' when a better computed title is possible", () => {
    const title = computeContradictionTitle({
      id: "test-3",
      title: "Goal behavior gap",
      sideA: "I need to finish this book though",
      sideB: "I skipped reading again and watched videos instead",
      type: "goal_behavior_gap",
      status: "open",
    });
    expect(title).not.toContain("Goal behavior gap");
    expect(title).toContain(" vs ");
  });

  it("does not return 'Constraint conflict' when a better computed title is possible", () => {
    const title = computeContradictionTitle({
      id: "test-4",
      title: "Constraint conflict",
      sideA: "I always optimise for objectivity",
      sideB: "I'm in an exhaustive phase at the moment",
      type: "constraint_conflict",
      status: "open",
    });
    expect(title).not.toContain("Constraint conflict");
    expect(title).toContain(" vs ");
  });

  it("handles TitleableContradiction shape from list items", () => {
    const title = computeContradictionTitle({
      id: "test-5",
      title: "Goal behavior gap",
      sideA: "I want to simplify my life",
      sideB: "I kept opening new threads and drifting into distractions",
      type: "goal_behavior_gap",
      status: "open",
      lastEvidenceAt: null,
      lastTouchedAt: "2026-04-20T09:00:00.000Z",
    });
    expect(title).toContain(" vs ");
    expect(title).not.toBe("Goal behavior gap");
  });
});
