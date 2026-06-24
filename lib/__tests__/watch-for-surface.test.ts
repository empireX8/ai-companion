import { describe, expect, it } from "vitest";

import type { WatchForListItem } from "../public-intelligence-safe-slice";
import {
  getWatchForInspectorSelection,
  groupWatchForListItems,
  toWatchForFieldActionHint,
  WATCH_FOR_EMPTY_PRIMARY,
  WATCH_FOR_PAGE_INTRO,
  WATCH_FOR_PAGE_TITLE,
} from "../watch-for-surface";

function listItem(id: string): WatchForListItem {
  return {
    id,
    prompt: `Prompt ${id}`,
    reason: `Reason ${id}`,
    statusLabel: id.startsWith("a") ? "Active" : "Assigned",
    linkedObjectType: "pattern_claim",
    linkedObjectTypeLabel: "Pattern",
    linkedObjectId: "pc-1",
    linkedObjectHref: "/patterns/pc-1",
    priority: null,
    updatedAt: "2026-06-20T10:00:00.000Z",
    detailHref: `/watch-for/${id}`,
  };
}

describe("watch-for-surface", () => {
  it("uses governed Fieldwork / Orvek copy", () => {
    expect(WATCH_FOR_PAGE_TITLE).toBe("Fieldwork");
    expect(WATCH_FOR_PAGE_INTRO.toLowerCase()).toContain("mind model");
    expect(WATCH_FOR_EMPTY_PRIMARY).toContain("No fieldwork prompts");
  });

  it("groups active items before assigned items", () => {
    const statusById = new Map([
      ["a-1", "active" as const],
      ["s-1", "assigned" as const],
    ]);

    const groups = groupWatchForListItems([listItem("a-1"), listItem("s-1")], statusById);
    expect(groups.map((group) => group.key)).toEqual(["active", "assigned"]);
    expect(groups[0]?.items[0]?.id).toBe("a-1");
  });

  it("omits empty groups instead of inventing sections", () => {
    const groups = groupWatchForListItems([listItem("a-1")], new Map([["a-1", "active"]]));
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe("active");
  });

  it("returns field action hints only for supported statuses", () => {
    expect(toWatchForFieldActionHint("active")).toContain("evidence");
    expect(toWatchForFieldActionHint("assigned")).toContain("Try");
    expect(toWatchForFieldActionHint("completed")).toBeNull();
  });

  it("allows Inspector selection only for supported linked object hrefs", () => {
    expect(
      getWatchForInspectorSelection({
        linkedObjectHref: "/patterns/pc-1",
        title: "Prompt",
      })
    ).toEqual({
      objectType: "pattern_claim",
      objectId: "pc-1",
      title: "Prompt",
    });

    expect(
      getWatchForInspectorSelection({
        linkedObjectHref: null,
        title: "Prompt",
      })
    ).toBeNull();
  });
});
