import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  dedupeInspectorEvidenceLinks,
  filterResolvableEvidenceRefs,
  isLegacyInspectorEvidenceHref,
  isUnresolvedEvidenceRefDisplay,
  projectInspectorEvidenceCard,
  resolveInspectorEvidenceSelection,
  resolveInspectorEvidenceTitle,
  UNRESOLVED_DUPLICATE_EVIDENCE_REF_DISPLAY,
} from "../inspector-evidence-presentation";
import type { InspectorEvidenceLinkItem } from "../inspector-object-api";
import type { RealityTrackingEvidenceRef } from "../reality-tracking-output-contract";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function extractFunctionBody(
  source: string,
  startMarker: string,
  endMarker: string
): string {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Missing start marker: ${startMarker}`);
  }
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) {
    throw new Error(`Missing end marker: ${endMarker}`);
  }
  return source.slice(start, end);
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
    expect(movementPanel).not.toContain("<Link href={ref.href}");
    expect(movementPanel).toContain("InspectorEvidenceSelectionControl");
  });

  it("maps legacy pattern and signal hrefs to inspector-selectable objects", () => {
    expect(isLegacyInspectorEvidenceHref("/patterns/pc-1")).toBe(true);
    expect(isLegacyInspectorEvidenceHref("/contradictions/cn-1")).toBe(true);
    expect(isLegacyInspectorEvidenceHref("/your-map/umc-1")).toBe(false);

    expect(
      resolveInspectorEvidenceSelection({
        href: "/patterns/pc-1",
        sourceType: "pattern_claim",
        sourceId: "pc-1",
      })
    ).toEqual({ objectType: "pattern_claim", objectId: "pc-1" });

    expect(
      resolveInspectorEvidenceSelection({
        href: "/active-questions/inv-1",
        sourceType: "investigation",
        sourceId: "inv-1",
      })
    ).toBeNull();
  });

  it("forbids legacy pattern/contradiction Link navigation in inspector evidence panels", () => {
    const evidencePanel = readSource(
      "components/inspector/panels/SelectedObjectEvidencePanel.tsx"
    );

    expect(evidencePanel).toContain("InspectorEvidenceSelectionControl");
    expect(evidencePanel).not.toContain("<Link href={card.href}");
    expect(evidencePanel).not.toContain("<Link href={ref.href}");
    expect(evidencePanel).not.toMatch(/<Link[^>]+href=\{[^}]*\/patterns/);
    expect(evidencePanel).not.toMatch(/<Link[^>]+href=\{[^}]*\/contradictions/);
  });

  it("keeps model_update evidence panels on affected-object context instead of movement-owned copy", () => {
    const evidencePanel = readSource(
      "components/inspector/panels/SelectedObjectEvidencePanel.tsx"
    );
    const modelUpdatePanel = extractFunctionBody(
      evidencePanel,
      "function ModelUpdateEvidencePanel",
      "function SelectedObjectEvidencePanel"
    );

    expect(modelUpdatePanel).toContain('typeLabel="Related map item"');
    expect(modelUpdatePanel).toContain("Supporting evidence");
    expect(modelUpdatePanel).toContain("Open the {ORVEK_COPY.mindModelMovementTab} tab");
    expect(modelUpdatePanel).not.toContain("MIND MODEL MOVEMENT");
    expect(modelUpdatePanel).not.toContain("Movement summary");
    expect(modelUpdatePanel).not.toContain("What Would Change This Conclusion");
    expect(modelUpdatePanel).not.toContain("What would change this");
  });
});
