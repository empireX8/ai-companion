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
    const containerSource = readSource("components/orvek-workbench/OrvekDecisionsPage.tsx");
    const adapterSource = readSource("lib/orvek-adapters/decisions.ts");
    const viewSource = readSource("components/orvek-v0/pages/decisions.tsx");
    const apiSource = readSource("lib/orvek-v0/production/decisions-api.ts");
    const wiring = `${containerSource}\n${adapterSource}\n${viewSource}\n${apiSource}`;

    expect(pageSource).toContain("OrvekDecisionsPage");
    expect(wiring).toContain("DECISIONS_PAGE_INTRO");
    expect(adapterSource).toContain('"Active"');
    expect(adapterSource).toContain('"Outcome due"');
    expect(viewSource).toContain("Options");
    expect(viewSource).toContain("Decisions");
    expect(apiSource).toContain("inspectorObjectType");
    expect(apiSource).toContain("pattern_claim");
    expect(wiring).not.toContain("Recommended for you");
    expect(wiring).not.toContain("Loading actions");
  });
});
