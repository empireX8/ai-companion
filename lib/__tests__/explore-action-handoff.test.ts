import { describe, expect, it } from "vitest";

import type { ActionsPageData, SurfacedActionView } from "../actions-api";
import {
  buildExploreActionHandoffHref,
  EXPLORE_ACTION_ID_PARAM,
  parseExploreActionIdParam,
  resolveExploreActionHandoffContext,
} from "../explore-action-handoff";

function makeAction(
  overrides: Partial<SurfacedActionView> = {}
): SurfacedActionView {
  return {
    id: "action-1",
    title: "Take a ten-minute reset",
    whySuggested: "You tend to recover after a short reset window.",
    bucket: "stabilize",
    effort: "Low",
    linkedFamily: "trigger_condition",
    linkedFamilyLabel: "Trigger condition",
    linkedClaimId: "claim-1",
    linkedClaimSummary: "Evening rumination rises after long stretches of context-switching.",
    linkedGoalId: null,
    linkedGoalStatement: null,
    linkedSourceLabel: "Pattern",
    status: "not_started",
    note: "private note that must never be surfaced in handoff context",
    surfacedAt: "2026-05-24T10:00:00.000Z",
    updatedAt: "2026-05-24T10:00:00.000Z",
    ...overrides,
  };
}

function makeActionsPageData(
  overrides: Partial<ActionsPageData> = {}
): ActionsPageData {
  return {
    currentPriority: {
      featured: [],
      totalActive: 0,
      totalCandidate: 0,
      hasData: true,
    },
    stabilizeNow: [makeAction()],
    buildForward: [
      makeAction({
        id: "action-2",
        bucket: "build",
        title: "Run a small planning experiment",
        linkedClaimId: null,
        linkedClaimSummary: null,
        linkedSourceLabel: "Goal",
        status: "helped",
      }),
    ],
    ...overrides,
  };
}

describe("parseExploreActionIdParam", () => {
  it("accepts a valid action id", () => {
    expect(parseExploreActionIdParam("action-1")).toBe("action-1");
  });

  it("trims surrounding whitespace", () => {
    expect(parseExploreActionIdParam("  action_2  ")).toBe("action_2");
  });

  it("rejects empty or missing values", () => {
    expect(parseExploreActionIdParam("")).toBeNull();
    expect(parseExploreActionIdParam("   ")).toBeNull();
    expect(parseExploreActionIdParam(null)).toBeNull();
  });

  it("rejects malformed ids", () => {
    expect(parseExploreActionIdParam("action id")).toBeNull();
    expect(parseExploreActionIdParam("action/1")).toBeNull();
    expect(parseExploreActionIdParam("action?1")).toBeNull();
  });
});

describe("buildExploreActionHandoffHref", () => {
  it("builds explore handoff href with action id param", () => {
    expect(buildExploreActionHandoffHref("action-1")).toBe(
      `/explore?${EXPLORE_ACTION_ID_PARAM}=action-1`
    );
  });

  it("returns null for malformed ids", () => {
    expect(buildExploreActionHandoffHref("bad id")).toBeNull();
  });
});

describe("resolveExploreActionHandoffContext", () => {
  it("returns safe context from stabilize actions", () => {
    const context = resolveExploreActionHandoffContext(
      makeActionsPageData(),
      "action-1"
    );

    expect(context).toEqual({
      actionId: "action-1",
      title: "Take a ten-minute reset",
      bucket: "stabilize",
      whySuggested: "You tend to recover after a short reset window.",
      linkedClaimSummary:
        "Evening rumination rises after long stretches of context-switching.",
      linkedSourceLabel: "Pattern",
      linkedClaimId: "claim-1",
      status: "not_started",
    });
  });

  it("returns safe context from build actions", () => {
    const context = resolveExploreActionHandoffContext(
      makeActionsPageData(),
      "action-2"
    );

    expect(context?.bucket).toBe("build");
    expect(context?.status).toBe("helped");
    expect(context?.linkedClaimSummary).toBeNull();
  });

  it("returns null for unknown or invalid handoff ids", () => {
    const data = makeActionsPageData();
    expect(resolveExploreActionHandoffContext(data, "missing")).toBeNull();
    expect(resolveExploreActionHandoffContext(data, null)).toBeNull();
    expect(resolveExploreActionHandoffContext(null, "action-1")).toBeNull();
  });

  it("never includes raw action note text in handoff context", () => {
    const context = resolveExploreActionHandoffContext(
      makeActionsPageData(),
      "action-1"
    );

    expect(context).not.toBeNull();
    const json = JSON.stringify(context);
    expect(json).not.toContain("private note that must never be surfaced");
    expect(Object.keys(context ?? {})).not.toContain("note");
  });
});
