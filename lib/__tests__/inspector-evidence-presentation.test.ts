import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  dedupeInspectorEvidenceLinks,
  filterResolvableEvidenceRefs,
  isUnresolvedEvidenceRefDisplay,
  projectInspectorEvidenceCard,
  resolveInspectorEvidenceTitle,
  UNRESOLVED_DUPLICATE_EVIDENCE_REF_DISPLAY,
} from "../inspector-evidence-presentation";
import type { InspectorEvidenceLinkItem } from "../inspector-object-api";
import type { RealityTrackingEvidenceRef } from "../reality-tracking-output-contract";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function makeEvidenceItem(
  overrides: Partial<InspectorEvidenceLinkItem> = {}
): InspectorEvidenceLinkItem {
  return {
    sourceTypeLabel: "Related pattern",
    evidenceSummaryLabel: "Linked evidence",
    sourceObjectHref: "/patterns/pc-1",
    createdAt: "2026-06-09T09:00:00.000Z",
    hasEvidence: true,
    sourceType: "pattern_claim",
    sourceId: "pc-1",
    ...overrides,
  };
}

function makeEvidenceRef(
  overrides: Partial<RealityTrackingEvidenceRef> = {}
): RealityTrackingEvidenceRef {
  return {
    id: "ref-1",
    sourceType: "reference_item",
    sourceTypeLabel: "Reference item",
    sourceId: "ri-1",
    role: "supports",
    label: "Reference item",
    href: null,
    createdAt: "2026-06-09T09:00:00.000Z",
    ...overrides,
  };
}

describe("inspector evidence presentation", () => {
  it("dedupes evidence cards by sourceType:sourceId and keeps the newest link", () => {
    const items = dedupeInspectorEvidenceLinks([
      makeEvidenceItem({
        createdAt: "2026-06-08T09:00:00.000Z",
        objectTitle: "Older duplicate",
      }),
      makeEvidenceItem({
        createdAt: "2026-06-09T09:00:00.000Z",
        objectTitle: "Newest pattern summary",
      }),
      makeEvidenceItem({
        sourceType: "contradiction_node",
        sourceId: "cn-1",
        sourceObjectHref: "/contradictions/cn-1",
        objectTitle: "Signal title",
      }),
    ]);

    expect(items).toHaveLength(2);
    expect(resolveInspectorEvidenceTitle(items[0]!)).toBe("Newest pattern summary");
    expect(resolveInspectorEvidenceTitle(items[1]!)).toBe("Signal title");
  });

  it("projects meaningful card titles and compact fallbacks instead of generic continuity labels", () => {
    const withSummary = projectInspectorEvidenceCard(
      makeEvidenceItem({ objectTitle: "Recovery loop after constraint naming" })
    );
    const fallback = projectInspectorEvidenceCard(
      makeEvidenceItem({ objectTitle: null, evidenceSummaryLabel: "Linked evidence" })
    );

    expect(withSummary.title).toBe("Recovery loop after constraint naming");
    expect(withSummary.sourceKind).toBe("Pattern");
    expect(fallback.title).toBe("Linked pattern evidence");
    expect(fallback.title).not.toBe("Related pattern");
  });

  it("treats duplicate Reference item labels as unresolved and filters them from movement refs", () => {
    const unresolved = makeEvidenceRef();
    expect(isUnresolvedEvidenceRefDisplay(unresolved)).toBe(true);
    expect(filterResolvableEvidenceRefs([unresolved])).toEqual([]);
    expect(UNRESOLVED_DUPLICATE_EVIDENCE_REF_DISPLAY).toBe("Reference item · Reference item");
  });

  it("keeps hydrated movement refs visible when labels are meaningful", () => {
    const resolved = makeEvidenceRef({
      sourceType: "journal_entry",
      sourceTypeLabel: "Journal entry",
      label: "Journal entry · Evening reset note",
    });

    expect(isUnresolvedEvidenceRefDisplay(resolved)).toBe(false);
    expect(filterResolvableEvidenceRefs([resolved])).toHaveLength(1);
  });

  it("does not render unresolved duplicate placeholder labels in the movement panel", () => {
    const movementPanel = readSource(
      "components/inspector/panels/ModelMovementInspectorPanel.tsx"
    );

    expect(movementPanel).toContain("filterResolvableEvidenceRefs");
    expect(movementPanel).toContain("formatEvidenceRefDisplay");
    expect(movementPanel).not.toContain(UNRESOLVED_DUPLICATE_EVIDENCE_REF_DISPLAY);
  });
});
