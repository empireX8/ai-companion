import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { INSPECTOR_SELECTABLE_OBJECT_TYPES } from "../inspector-selection";
import { EXPLORE_REENTRY_LINKS } from "../explore-surface";
import { TIMELINE_REENTRY_LINKS } from "../timeline-model-layers";
import { WHAT_CHANGED_REENTRY_LINKS } from "../what-changed-surface";
import { V1_VISIBLE_HREFS } from "../v1-nav";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const ALL_REENTRY_HREFS = [
  ...WHAT_CHANGED_REENTRY_LINKS.map((link) => link.href),
  ...TIMELINE_REENTRY_LINKS.map((link) => link.href),
  ...EXPLORE_REENTRY_LINKS.map((link) => link.href),
];

describe("orvek ux integration — re-entry links", () => {
  it("points re-entry footers only at visible workbench routes", () => {
    for (const href of ALL_REENTRY_HREFS) {
      expect(V1_VISIBLE_HREFS.has(href)).toBe(true);
    }
  });

  it("covers primary surfaces across the re-entry graph", () => {
    const linked = new Set(ALL_REENTRY_HREFS);
    expect(linked.has("/")).toBe(true);
    expect(linked.has("/your-map")).toBe(true);
    expect(linked.has("/what-changed")).toBe(true);
    expect(linked.has("/timeline")).toBe(true);
    expect(linked.has("/watch-for")).toBe(true);
    expect(linked.has("/actions")).toBe(true);
  });
});

describe("orvek ux integration — inspector safety", () => {
  it("limits inspector object types to published-safe selectors", () => {
    expect(INSPECTOR_SELECTABLE_OBJECT_TYPES).toEqual([
      "usermap_conclusion",
      "model_update",
      "pattern_claim",
      "contradiction_node",
    ]);
  });

  it("keeps explore draft review separate from published movement inspector wiring", () => {
    const movementStrip = readSource("components/explore/ExploreModelMovementStrip.tsx");
    const reviewStrip = readSource("components/explore/ExploreConversationReviewStrip.tsx");

    expect(movementStrip).toContain("ExploreInspectorAction");
    expect(movementStrip).toContain("EXPLORE_MOVEMENT_PUBLISHED_BADGE");
    expect(reviewStrip).toContain("EXPLORE_REVIEW_DRAFT_BADGE");
    expect(reviewStrip).not.toContain('objectType: "model_update"');
  });

  it("routes timeline fieldwork to real pages when inspector is unsupported", () => {
    const container = readSource("components/orvek-workbench/OrvekTimelinePage.tsx");
    const view = readSource("components/orvek-workbench/views/V0TimelineView.tsx");
    const adapter = readSource("lib/orvek-adapters/timeline.ts");
    const timelineSurface = `${container}\n${view}\n${adapter}`;
    expect(timelineSurface).toContain("parseSelectableObjectFromHref");
    expect(timelineSurface).toContain("TimelineInspectorAction");
    expect(timelineSurface).toContain("row.href");
  });
});

describe("orvek ux integration — surface copy modules", () => {
  const surfaceModules = [
    "lib/today-reentry.ts",
    "lib/your-map-surface.ts",
    "lib/watch-for-surface.ts",
    "lib/decisions-surface.ts",
    "lib/what-changed-surface.ts",
    "lib/timeline-model-layers.ts",
    "lib/explore-surface.ts",
  ];

  it("centralizes Orvek copy in surface helper modules", () => {
    for (const modulePath of surfaceModules) {
      const source = readSource(modulePath);
      expect(source.includes("ORVEK_COPY") || source.includes("PRODUCT_NAME")).toBe(true);
    }
  });

  it("avoids lifecycle/internal field leaks in public surface modules", () => {
    for (const modulePath of surfaceModules) {
      const source = readSource(modulePath);
      expect(source.includes("internal_only")).toBe(false);
      expect(source.includes("candidateLifecycleStatus")).toBe(false);
      expect(source.includes("beforeSummary")).toBe(false);
    }
  });
});

describe("orvek ux integration — today to what-changed bridge", () => {
  it("keeps Today movement preview linked to What Changed", () => {
    const todayPage = readSource("components/orvek-workbench/OrvekTodayPage.tsx");
    const adapter = readSource("lib/orvek-adapters/today.ts");
    expect(`${todayPage}\n${adapter}`).toContain("TODAY_CHANGES_VIEW_ALL_HREF");
    expect(todayPage).toContain('objectType: "model_update"');
    expect(todayPage).toContain('tab: "movement"');
  });

  it("keeps Map movement preview linked to What Changed", () => {
    const previewSource = readSource("lib/your-map-preview-surface.ts");
    expect(previewSource).toContain("MAP_MOVEMENT_VIEW_ALL_HREF");
    expect(previewSource).toContain("TODAY_CHANGES_VIEW_ALL_HREF");
  });
});
