import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  TIMELINE_ACTIVITY_EMPTY_COPY,
  TIMELINE_PAGE_INTRO,
  TIMELINE_PAGE_META,
  TIMELINE_REENTRY_LINKS,
} from "../timeline-model-layers";
import {
  TIMELINE_LANE_LABELS,
  TIMELINE_SEMANTIC_FILTERS,
} from "../timeline-semantic-layers";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("timeline surface copy", () => {
  it("uses governed Orvek semantic evolution language", () => {
    expect(TIMELINE_PAGE_META.toLowerCase()).toContain("semantic evolution");
    expect(TIMELINE_PAGE_INTRO.toLowerCase()).toContain("mind model");
    expect(TIMELINE_PAGE_INTRO.toLowerCase()).toContain("not a generic activity feed");
    expect(TIMELINE_ACTIVITY_EMPTY_COPY).toContain("No published evolution");
  });

  it("exposes real re-entry links across surfaces", () => {
    expect(TIMELINE_REENTRY_LINKS.map((link) => link.href)).toEqual([
      "/",
      "/your-map",
      "/what-changed",
      "/watch-for",
      "/actions",
    ]);
  });

  it("uses Orvek lane and filter labels without feed language", () => {
    const filterLabels = TIMELINE_SEMANTIC_FILTERS.map((filter) => filter.label);
    expect(filterLabels).toContain("Mind Model movement");
    expect(filterLabels).not.toContain("Sessions / activity");
    expect(TIMELINE_LANE_LABELS.receipts_activity).toBe("Evidence");
    expect(TIMELINE_LANE_LABELS.reports).toBe("Imports");
  });
});

describe("timeline surface wiring", () => {
  it("renders intro, evolution stream, and inspector actions without internal fields", () => {
    const surfaceSource = readSource(
      "app/(root)/(routes)/timeline/_components/TimelineSurface.tsx"
    );
    const inspectorSource = readSource("components/timeline/TimelineInspectorAction.tsx");

    expect(surfaceSource).toContain("TIMELINE_PAGE_INTRO");
    expect(surfaceSource).toContain("TIMELINE_REENTRY_LINKS");
    expect(surfaceSource).toContain("TimelineInspectorAction");
    expect(surfaceSource).toContain("parseSelectableObjectFromHref");
    expect(surfaceSource).not.toContain("beforeSummary");
    expect(surfaceSource).not.toContain("afterSummary");
    expect(surfaceSource).not.toContain("internal_only");
    expect(surfaceSource).not.toContain("lifecycle");
    expect(inspectorSource).toContain("TIMELINE_MOVEMENT_INSPECTOR_LABEL");
    expect(inspectorSource).toContain("TIMELINE_INSPECTOR_LABEL");
    expect(inspectorSource).not.toContain('objectType: "decision"');
    expect(inspectorSource).not.toContain('objectType: "fieldwork"');
  });

  it("links fieldwork and sessions to real pages when inspector is unsupported", () => {
    const semanticSource = readSource("lib/timeline-semantic-layers.ts");
    expect(semanticSource).toContain('href: `/watch-for/${item.id}`');
    expect(semanticSource).toContain('href: `/active-questions/${item.id}`');
    expect(semanticSource).toContain("selectableObjectType: null");
  });
});
