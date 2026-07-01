import { describe, expect, it } from "vitest";

import type { MindContextDisplayItem } from "../mind-context-surface";
import type { UserMapConclusionPublicApiListItem } from "../public-intelligence-safe-slice";
import { resolveMapWorkbenchSelectedId } from "../orvek-v0/production/map-selection";

const MIND_CONTEXT_ITEMS = [
  {
    id: "memory-ref-1",
  },
  {
    id: "pattern-pc-1",
  },
] as MindContextDisplayItem[];

const CONCLUSIONS = [
  {
    id: "c-1",
  },
] as UserMapConclusionPublicApiListItem[];

describe("map workbench selection", () => {
  it("keeps a preferred context selection when conclusions are empty", () => {
    expect(
      resolveMapWorkbenchSelectedId({
        items: [],
        preferredSelectionId: "context-pattern-pc-1",
        mindContextItems: MIND_CONTEXT_ITEMS,
      })
    ).toBe("context-pattern-pc-1");
  });

  it("falls back to the first context item when conclusions are empty and no context is selected", () => {
    expect(
      resolveMapWorkbenchSelectedId({
        items: [],
        preferredSelectionId: null,
        mindContextItems: MIND_CONTEXT_ITEMS,
      })
    ).toBe("context-memory-ref-1");
  });

  it("still prefers map conclusions when they exist", () => {
    expect(
      resolveMapWorkbenchSelectedId({
        items: CONCLUSIONS,
        preferredSelectionId: null,
        mindContextItems: MIND_CONTEXT_ITEMS,
      })
    ).toBe("c-1");
  });
});
