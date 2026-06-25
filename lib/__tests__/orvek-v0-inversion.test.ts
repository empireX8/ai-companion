import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const PRODUCTION_ROUTE_FILES = [
  "app/(root)/page.tsx",
  "app/(root)/(routes)/your-map/page.tsx",
  "app/(root)/(routes)/explore/page.tsx",
  "app/(root)/(routes)/actions/page.tsx",
  "app/(root)/(routes)/timeline/page.tsx",
  "app/(root)/(routes)/what-changed/page.tsx",
] as const;

const ORVEK_PAGE_CONTAINERS = [
  "components/orvek-workbench/OrvekTodayPage.tsx",
  "components/orvek-workbench/OrvekMapPage.tsx",
  "components/orvek-workbench/OrvekExplorePage.tsx",
  "components/orvek-workbench/OrvekDecisionsPage.tsx",
  "components/orvek-workbench/OrvekTimelinePage.tsx",
  "components/orvek-workbench/OrvekWhatChangedPage.tsx",
] as const;

const FORBIDDEN_PRODUCTION_PAGE_BODIES = [
  "YourMapWorkbench",
  "YourMapMindContextPanel",
  "YourMapPreviewBands",
  "TimelineSurface",
  "SurfaceChatShell",
  "DecisionItemCard",
  "DecisionsPriorityBand",
  "WhatChangedHeroMovement",
  "WhatChangedMovementCard",
  "V0MapView",
  "V0TodayView",
  "V0ExploreView",
  "V0DecisionsView",
  "V0TimelineView",
] as const;

const V0_PAGE_IMPORTS = [
  "@/components/orvek-v0/pages/today",
  "@/components/orvek-v0/pages/map",
  "@/components/orvek-v0/pages/explore",
  "@/components/orvek-v0/pages/decisions",
  "@/components/orvek-v0/pages/timeline",
  "@/components/orvek-v0/pages/what-changed",
] as const;

describe("orvek v0 UI inversion", () => {
  it("exposes dev-only v0 reference route", () => {
    const page = readSource("app/dev/orvek-v0-reference/page.tsx");
    expect(page).toContain('data-testid="orvek-v0-reference-route"');
    expect(page).toContain("@/components/orvek-v0/workbench");
    expect(readSource("lib/orvek-v0/mock-api.ts")).toContain("createMockOrvekDataApi");
  });

  it("production Orvek*Page containers render v0 page components", () => {
    for (const file of ORVEK_PAGE_CONTAINERS) {
      const source = readSource(file);
      expect(source).toContain("OrvekV0PageShell");
      expect(source).toContain("OrvekDataProvider");
      expect(source).toMatch(/TodayPage|MapPage|ExplorePage|DecisionsPage|TimelinePage|WhatChangedPage/);
    }

    for (const importPath of V0_PAGE_IMPORTS) {
      const used = ORVEK_PAGE_CONTAINERS.some((file) =>
        readSource(file).includes(importPath)
      );
      expect(used).toBe(true);
    }
  });

  it("production route entrypoints do not import old visible page bodies", () => {
    for (const file of [...PRODUCTION_ROUTE_FILES, ...ORVEK_PAGE_CONTAINERS]) {
      const source = readSource(file);
      for (const forbidden of FORBIDDEN_PRODUCTION_PAGE_BODIES) {
        expect(source.includes(forbidden)).toBe(false);
      }
    }
  });

  it("adapters preserve v0 slot copy for sparse explore data", () => {
    const exploreAdapter = readSource("lib/orvek-adapters/explore.ts");
    expect(exploreAdapter).toContain("V0_EXPLORE_GROUNDING_EMPTY_CHIPS");
    expect(exploreAdapter).toContain("V0_EXPLORE_INVESTIGATIONS_EMPTY_LIST");
    expect(exploreAdapter).toContain("V0_EXPLORE_LIVE_DETECTION_COPY");
  });

  it("production containers do not import mock-orvek-data", () => {
    for (const file of ORVEK_PAGE_CONTAINERS) {
      const source = readSource(file);
      expect(source.includes("mock-orvek-data")).toBe(false);
      expect(source.includes("createMockOrvekDataApi")).toBe(false);
    }
  });

  it("mock data is confined to dev reference and mock api", () => {
    const mockApi = readSource("lib/orvek-v0/mock-api.ts");
    expect(mockApi).toContain("createMockOrvekDataApi");
    expect(readSource("app/dev/orvek-v0-reference/page.tsx")).not.toContain(
      "mapTodayDataToV0Props"
    );
  });
});
