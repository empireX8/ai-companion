import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DECISIONS_EMPTY_COPY,
  DECISIONS_PAGE_INTRO,
  DECISIONS_PAGE_TITLE,
  groupDecisionsByResolution,
  toDecisionStatusLabel,
} from "../decisions-surface";
import type { SurfacedActionView } from "../actions-api";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function action(
  id: string,
  status: SurfacedActionView["status"]
): SurfacedActionView {
  return {
    id,
    title: `Choice ${id}`,
    whySuggested: "Because recent pattern signal supports it.",
    bucket: "stabilize",
    effort: "Low",
    linkedFamily: null,
    linkedFamilyLabel: null,
    linkedClaimId: "pc-1",
    linkedClaimSummary: "I overcommit",
    linkedGoalId: null,
    linkedGoalStatement: null,
    linkedSourceLabel: "Pattern",
    status,
    note: null,
    surfacedAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
  };
}

describe("decisions-surface", () => {
  it("uses governed Orvek decision copy", () => {
    expect(DECISIONS_PAGE_TITLE).toBe("Decisions");
    expect(DECISIONS_PAGE_INTRO.toLowerCase()).toContain("mind model");
    expect(DECISIONS_EMPTY_COPY).toContain("No decision invitations");
  });

  it("groups unresolved choices before outcome learning", () => {
    const groups = groupDecisionsByResolution([
      action("a-1", "helped"),
      action("a-2", "not_started"),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["open", "outcomes"]);
    expect(groups[0]?.items[0]?.id).toBe("a-2");
  });

  it("omits empty decision groups", () => {
    const groups = groupDecisionsByResolution([action("a-1", "not_started")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe("open");
  });

  it("labels statuses for decision tracking not task completion", () => {
    expect(toDecisionStatusLabel("not_started")).toBe("Unresolved");
    expect(toDecisionStatusLabel("helped")).toBe("Helped");
  });
});

describe("decisions page wiring", () => {
  it("renders governed decisions surface on /actions", () => {
    const pageSource = readSource("app/(root)/(routes)/actions/page.tsx");
    const cardSource = readSource("components/decisions/DecisionItemCard.tsx");

    expect(pageSource).toContain("DECISIONS_PAGE_INTRO");
    expect(pageSource).toContain("groupDecisionsByResolution");
    expect(pageSource).toContain("DecisionsPriorityBand");
    expect(pageSource).toContain("DecisionItemCard");
    expect(pageSource).toContain('data-testid="decisions-list"');
    expect(cardSource).toContain('objectType: "pattern_claim"');
    expect(cardSource).toContain('sourceSurface: "decisions"');
    expect(cardSource).toContain("buildPublicReceiptHref");
    expect(cardSource).not.toContain('objectType: "decision"');
    expect(pageSource).not.toContain("Recommended for you");
    expect(pageSource).not.toContain("Loading actions");
  });
});
