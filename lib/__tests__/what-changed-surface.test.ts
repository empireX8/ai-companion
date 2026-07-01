import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { WhatChangedListItem } from "../public-intelligence-safe-slice";
import {
  WHAT_CHANGED_CONCLUSION_LABEL,
  splitWhatChangedMovements,
  toWhatChangedMovementTitle,
  WHAT_CHANGED_DISCONFIRMING_LABEL,
  WHAT_CHANGED_EMPTY_PRIMARY,
  WHAT_CHANGED_FIELDWORK_LABEL,
  WHAT_CHANGED_IMPACT_LABEL,
  WHAT_CHANGED_PAGE_INTRO,
  WHAT_CHANGED_PRIMARY_SECTION_LABEL,
  WHAT_CHANGED_PAGE_TITLE,
  WHAT_CHANGED_REALITY_GATE_LABEL,
  WHAT_CHANGED_REENTRY_LINKS,
  WHAT_CHANGED_REENTRY_LABEL,
  WHAT_CHANGED_UNCERTAINTY_LABEL,
  WHAT_CHANGED_EVIDENCE_LABEL,
  WHAT_CHANGED_WHAT_CHANGED_LABEL,
  WHAT_CHANGED_WHY_LABEL,
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
    expect(WHAT_CHANGED_PAGE_INTRO).toContain("briefing layer");
    expect(WHAT_CHANGED_PRIMARY_SECTION_LABEL).toBe("Scope / Evidence Packet");
    expect(WHAT_CHANGED_WHAT_CHANGED_LABEL).toBe("What changed");
    expect(WHAT_CHANGED_WHY_LABEL).toBe("Current read");
    expect(WHAT_CHANGED_EVIDENCE_LABEL).toBe("Evidence");
    expect(WHAT_CHANGED_DISCONFIRMING_LABEL).toBe("What weakens this");
    expect(WHAT_CHANGED_UNCERTAINTY_LABEL).toBe("What is not known yet");
    expect(WHAT_CHANGED_REALITY_GATE_LABEL).toBe("What would test this");
    expect(WHAT_CHANGED_FIELDWORK_LABEL).toBe("Evidence to generate next");
    expect(WHAT_CHANGED_CONCLUSION_LABEL).toBe("What would change this conclusion");
    expect(WHAT_CHANGED_REENTRY_LABEL).toBe("Re-entry");
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
    const pageBodySource = readSource("components/orvek-v0/pages/what-changed.tsx");
    const adapterSource = readSource("lib/orvek-adapters/what-changed.ts");

    expect(pageSource).toContain("splitWhatChangedMovements");
    expect(pageSource).toContain("OrvekWhatChangedView");
    expect(viewSource).toContain("buildWhatChangedProductionDataApi");
    expect(readSource("lib/orvek-v0/production/what-changed-api.ts")).toContain(
      "mapWhatChangedDataToV0Props"
    );
    expect(`${pageBodySource}\n${adapterSource}`).toContain("WHAT_CHANGED_EVIDENCE_LABEL");
    expect(`${pageBodySource}\n${adapterSource}`).toContain("WHAT_CHANGED_REENTRY_LABEL");
    expect(viewSource).toContain('objectType: "model_update"');
    expect(pageBodySource).toContain("onMovementSelect");
    expect(pageBodySource).toContain("what-changed-empty-shell");
    expect(pageBodySource).toContain("isProductionDisplay");
    expect(pageSource).toContain("ModelUpdateVisibility.user_visible");
    expect(pageSource).toContain("isMeaningful: true");
    expect(pageSource).not.toContain("beforeSummary");
    expect(pageSource).not.toContain("afterSummary");
    expect(pageBodySource).toMatch(/evidenceItems\.length > 0/);
    expect(WHAT_CHANGED_WHAT_CHANGED_LABEL).not.toContain("[");
    expect(WHAT_CHANGED_WHY_LABEL).not.toContain("[");
    expect(WHAT_CHANGED_EVIDENCE_LABEL).not.toContain("[");
    expect(WHAT_CHANGED_DISCONFIRMING_LABEL).not.toContain("[");
    expect(WHAT_CHANGED_UNCERTAINTY_LABEL).not.toContain("[");
    expect(WHAT_CHANGED_IMPACT_LABEL).not.toContain("[");
    expect(WHAT_CHANGED_FIELDWORK_LABEL).not.toContain("[");
    expect(WHAT_CHANGED_REALITY_GATE_LABEL).not.toContain("[");
    expect(WHAT_CHANGED_REENTRY_LABEL).not.toContain("[");
    expect(pageBodySource).toContain("WHAT_CHANGED_DISCONFIRMING_LABEL");
    expect(pageBodySource).toContain("WHAT_CHANGED_UNCERTAINTY_LABEL");
    expect(pageBodySource).toContain("WHAT_CHANGED_IMPACT_LABEL");
    expect(pageBodySource).toContain("WHAT_CHANGED_REALITY_GATE_LABEL");
    expect(pageBodySource).toContain("WHAT_CHANGED_FIELDWORK_LABEL");
    expect(pageBodySource).toContain("WHAT_CHANGED_CONCLUSION_LABEL");
    expect(viewSource).toContain('tab: "movement"');
  });
});
