import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { WhatChangedListItem } from "../public-intelligence-safe-slice";
import {
  splitWhatChangedMovements,
  toWhatChangedMovementTitle,
  WHAT_CHANGED_EMPTY_PRIMARY,
  WHAT_CHANGED_PAGE_INTRO,
  WHAT_CHANGED_PAGE_TITLE,
  WHAT_CHANGED_REENTRY_LINKS,
} from "../what-changed-surface";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function item(id: string): WhatChangedListItem {
  return {
    id,
    updateTypeLabel: "Strengthened",
    affectedObjectType: "pattern_claim",
    affectedObjectTypeLabel: "Pattern",
    affectedObjectId: "pc-1",
    affectedObjectHref: "/patterns/pc-1",
    userFacingSummary: "Evidence reinforced this pattern.",
    createdAt: "2026-06-20T10:00:00.000Z",
  };
}

describe("what-changed-surface", () => {
  it("uses governed Orvek explanation copy", () => {
    expect(WHAT_CHANGED_PAGE_TITLE).toBe("What Changed");
    expect(WHAT_CHANGED_PAGE_INTRO.toLowerCase()).toContain("mind model");
    expect(WHAT_CHANGED_EMPTY_PRIMARY).toContain("No published");
  });

  it("splits latest movement from earlier items", () => {
    const split = splitWhatChangedMovements([item("mu-1"), item("mu-2")]);
    expect(split.primary?.id).toBe("mu-1");
    expect(split.earlier.map((entry) => entry.id)).toEqual(["mu-2"]);
  });

  it("exposes real re-entry links", () => {
    expect(WHAT_CHANGED_REENTRY_LINKS.map((link) => link.href)).toEqual([
      "/",
      "/your-map",
      "/timeline",
      "/watch-for",
    ]);
  });

  it("builds movement titles from published-safe fields only", () => {
    expect(toWhatChangedMovementTitle(item("mu-1"))).toBe("Strengthened · Pattern");
  });
});

describe("what-changed page wiring", () => {
  it("renders report-style hierarchy without internal lifecycle fields", () => {
    const pageSource = readSource("app/(root)/(routes)/what-changed/page.tsx");
    const viewSource = readSource("components/orvek-workbench/OrvekWhatChangedPage.tsx");
    const adapterSource = readSource("lib/orvek-adapters/what-changed.ts");
    const inspectorSource = readSource("components/what-changed/WhatChangedInspectorButton.tsx");

    expect(pageSource).toContain("splitWhatChangedMovements");
    expect(pageSource).toContain("OrvekWhatChangedView");
    expect(viewSource).toContain("mapWhatChangedDataToV0Props");
    expect(`${viewSource}\n${adapterSource}`).toContain("WHAT_CHANGED_EVIDENCE_LABEL");
    expect(`${viewSource}\n${adapterSource}`).toContain("WHAT_CHANGED_REENTRY_LABEL");
    expect(viewSource).toContain("WhatChangedInspectorButton");
    expect(pageSource).toContain("ModelUpdateVisibility.user_visible");
    expect(pageSource).toContain("isMeaningful: true");
    expect(pageSource).not.toContain("beforeSummary");
    expect(pageSource).not.toContain("afterSummary");
    expect(viewSource).toMatch(/evidenceItems\.length > 0/);
    expect(inspectorSource).toContain('objectType: "model_update"');
    expect(inspectorSource).not.toContain('objectType: "decision"');
  });
});
