import { describe, expect, it } from "vitest";

import {
  groupUserMapConclusionsByStatus,
  pickInitialYourMapSelectionId,
  summarizeCentreEvidence,
  YOUR_MAP_CONCLUSIONS_ENDPOINT,
} from "../your-map-surface";
import type { UserMapConclusionPublicApiListItem } from "../public-intelligence-safe-slice";

function item(
  overrides: Partial<UserMapConclusionPublicApiListItem> & Pick<UserMapConclusionPublicApiListItem, "id" | "status">
): UserMapConclusionPublicApiListItem {
  return {
    id: overrides.id,
    title: overrides.title ?? "Title",
    summary: overrides.summary ?? "Summary",
    area: overrides.area ?? "recovery_architecture",
    status: overrides.status,
    confidenceLevel: overrides.confidenceLevel ?? "medium",
    evidenceCount: overrides.evidenceCount ?? 1,
    updatedAt: overrides.updatedAt ?? "2026-05-17T10:00:00.000Z",
  };
}

describe("your-map-surface", () => {
  it("groups conclusions by real status metadata only", () => {
    const groups = groupUserMapConclusionsByStatus([
      item({ id: "umc-1", status: "supported" }),
      item({ id: "umc-2", status: "emerging" }),
      item({ id: "umc-3", status: "tentative" }),
      item({ id: "umc-4", status: "hypothesis" }),
      item({ id: "umc-5", status: "disputed" }),
      item({ id: "umc-6", status: "superseded" }),
    ]);

    expect(groups.map((group) => group.label)).toEqual([
      "Established",
      "Emerging",
      "Needs more evidence",
      "Conflicting signal",
      "Superseded",
    ]);
    expect(groups.find((group) => group.key === "emerging")?.items).toHaveLength(2);
    expect(groups.find((group) => group.key === "superseded")?.deferred).toBe(true);
  });

  it("omits empty status groups instead of inventing sections", () => {
    const groups = groupUserMapConclusionsByStatus([
      item({ id: "umc-1", status: "supported" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe("established");
  });

  it("picks preferred selection id when present, otherwise first item", () => {
    const items = [
      item({ id: "umc-1", status: "supported" }),
      item({ id: "umc-2", status: "emerging" }),
    ];

    expect(pickInitialYourMapSelectionId(items, "umc-2")).toBe("umc-2");
    expect(pickInitialYourMapSelectionId(items, "missing")).toBe("umc-1");
    expect(pickInitialYourMapSelectionId([], "umc-1")).toBeNull();
  });

  it("summarizes centre evidence without duplicating the full inspector list", () => {
    const links = Array.from({ length: 6 }, (_, index) => ({
      sourceTypeLabel: `Source ${index}`,
      evidenceSummaryLabel: `Summary ${index}`,
      sourceObjectHref: `/patterns/pc-${index}`,
      createdAt: "2026-05-18T10:00:00.000Z",
      hasEvidence: true as const,
    }));

    const summary = summarizeCentreEvidence(links, 4);
    expect(summary.preview).toHaveLength(4);
    expect(summary.hasMore).toBe(true);
  });

  it("uses the public user-map conclusions list endpoint", () => {
    expect(YOUR_MAP_CONCLUSIONS_ENDPOINT).toBe(
      "/api/user-map/conclusions?limit=50&sortOrder=desc"
    );
  });
});
