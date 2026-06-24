/**
 * V1 Navigation Structure regression tests
 *
 * Guards the Orvek workbench IA constants against accidental drift.
 * Source of truth: lib/v1-nav.ts
 */

import { describe, expect, it } from "vitest";
import {
  V1_CORE_ROUTES,
  V1_HIDDEN_HREFS,
  V1_HIDDEN_INTERNAL_ROUTES,
  V1_LAYER_ROUTES,
  V1_LEGACY_SUPPORT_ROUTES,
  V1_PRIMARY_ROUTES,
  V1_SECONDARY_ROUTES,
  V1_VISIBLE_HREFS,
  resolveV1SectionLabel,
} from "../v1-nav";

const primaryHrefs = V1_PRIMARY_ROUTES.map((route) => route.href);
const layerHrefs = V1_LAYER_ROUTES.map((route) => route.href);
const legacyHrefs = V1_LEGACY_SUPPORT_ROUTES.map((route) => route.href);
const hiddenHrefs = V1_HIDDEN_INTERNAL_ROUTES.map((route) => route.href);

describe("V1_PRIMARY_ROUTES", () => {
  it("locks the five primary workbench surfaces", () => {
    expect(V1_PRIMARY_ROUTES).toHaveLength(5);
    expect(primaryHrefs).toEqual(["/", "/your-map", "/actions", "/timeline", "/explore"]);
  });

  it("labels Decisions on /actions", () => {
    expect(V1_PRIMARY_ROUTES.find((route) => route.href === "/actions")?.label).toBe(
      "Decisions"
    );
  });

  it("does not promote Import as a primary surface", () => {
    expect(primaryHrefs).not.toContain("/import");
  });
});

describe("V1_LAYER_ROUTES", () => {
  it("groups utility surfaces separately from primary nav", () => {
    expect(layerHrefs).toContain("/what-changed");
    expect(layerHrefs).toContain("/watch-for");
    expect(layerHrefs).toContain("/import");
    expect(layerHrefs).toContain("/context");
    expect(layerHrefs).toContain("/memories");
  });

  it("does not duplicate primary destinations", () => {
    for (const href of primaryHrefs) {
      expect(layerHrefs).not.toContain(href);
    }
  });
});

describe("V1_LEGACY_SUPPORT_ROUTES", () => {
  it("keeps legacy MindLab routes reachable in support grouping", () => {
    expect(legacyHrefs).toContain("/chat");
    expect(legacyHrefs).toContain("/patterns");
    expect(legacyHrefs).toContain("/history");
    expect(legacyHrefs).toContain("/contradictions");
    expect(legacyHrefs).toContain("/check-ins");
    expect(legacyHrefs).toContain("/journal-chat");
  });

  it("does not promote legacy routes to primary IA", () => {
    for (const href of legacyHrefs) {
      expect(primaryHrefs).not.toContain(href);
    }
  });
});

describe("V1_HIDDEN_INTERNAL_ROUTES", () => {
  it("keeps engineering surfaces out of primary/layer lists", () => {
    expect(hiddenHrefs).toContain("/audit");
    expect(hiddenHrefs).toContain("/evidence");
    expect(hiddenHrefs).toContain("/metrics");
    for (const href of hiddenHrefs) {
      expect(primaryHrefs).not.toContain(href);
      expect(layerHrefs).not.toContain(href);
    }
  });

  it("no longer hides contradictions from support access", () => {
    expect(hiddenHrefs).not.toContain("/contradictions");
    expect(legacyHrefs).toContain("/contradictions");
  });
});

describe("deprecated aliases", () => {
  it("maps V1_CORE_ROUTES to primary routes", () => {
    expect(V1_CORE_ROUTES).toEqual(V1_PRIMARY_ROUTES);
  });

  it("maps V1_SECONDARY_ROUTES to layer routes", () => {
    expect(V1_SECONDARY_ROUTES).toEqual(V1_LAYER_ROUTES);
  });
});

describe("V1_VISIBLE_HREFS", () => {
  it("includes primary, layer, and legacy support without hidden engineering routes", () => {
    for (const href of [...primaryHrefs, ...layerHrefs, ...legacyHrefs]) {
      expect(V1_VISIBLE_HREFS.has(href)).toBe(true);
    }
    for (const href of hiddenHrefs) {
      expect(V1_VISIBLE_HREFS.has(href)).toBe(false);
    }
  });
});

describe("resolveV1SectionLabel", () => {
  it("returns primary labels for workbench routes", () => {
    expect(resolveV1SectionLabel("/")).toBe("Today");
    expect(resolveV1SectionLabel("/your-map/umc-1")).toBe("Map");
    expect(resolveV1SectionLabel("/actions")).toBe("Decisions");
    expect(resolveV1SectionLabel("/timeline")).toBe("Timeline");
    expect(resolveV1SectionLabel("/explore")).toBe("Explore");
  });

  it("returns legacy labels for support routes", () => {
    expect(resolveV1SectionLabel("/chat")).toBe("Chat");
    expect(resolveV1SectionLabel("/patterns")).toBe("Patterns");
  });
});
