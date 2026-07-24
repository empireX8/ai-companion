import { describe, expect, it } from "vitest";

import type { ContradictionSourceSidePresentation } from "../contradiction-dual-source-presentation-contract";
import {
  beginContradictionInspectorDetailLoad,
  createEmptyContradictionInspectorDetailState,
  failContradictionInspectorDetailLoad,
  resolveContradictionInspectorDetailLoad,
  selectRenderableContradictionInspectorDetail,
} from "../contradiction-inspector-detail-state";
import type { InspectorContradictionProjection } from "../inspector-object-api";

type AvailableSide = Extract<
  ContradictionSourceSidePresentation,
  { availability: "available" }
>;

function makeAvailableSide(
  side: "A" | "B",
  spanId: string,
  messageId: string,
  exactQuote: string,
): AvailableSide {
  return {
    side,
    availability: "available",
    spanId,
    messageId,
    sessionId: null,
    sessionOrigin: "APP",
    sessionLabel: null,
    exactQuote,
    charStart: 0,
    charEnd: exactQuote.length,
    integrityVerified: true,
    recordedAt: "2026-07-24T00:00:00.000Z",
  };
}

function exactQuoteFor(
  detail: InspectorContradictionProjection | null,
  side: "sideA" | "sideB",
): string | null {
  if (!detail) {
    return null;
  }

  const source = detail.dualSource[side];
  return source.availability === "available" ? source.exactQuote : null;
}

const detailA: InspectorContradictionProjection = {
  id: "contradiction-a",
  title: "Shared title",
  sideA: "Side A interpretation A",
  sideB: "Side B interpretation A",
  status: "open",
  evidenceCount: 0,
  lastEvidenceAt: null,
  lastTouchedAt: "2026-07-24T00:00:00.000Z",
  dualSource: {
    lineageState: "complete_verified",
    sideA: makeAvailableSide("A", "span-a", "message-a", "quote-a"),
    sideB: makeAvailableSide("B", "span-b", "message-b", "quote-b"),
  },
};

const detailB: InspectorContradictionProjection = {
  ...detailA,
  id: "contradiction-b",
  sideA: "Side A interpretation B",
  sideB: "Side B interpretation B",
  dualSource: {
    ...detailA.dualSource,
    sideA: makeAvailableSide("A", "span-c", "message-c", "quote-c"),
    sideB: makeAvailableSide("B", "span-d", "message-d", "quote-d"),
  },
};

describe("contradiction inspector detail state", () => {
  it("hides live contradiction lineage immediately when selection moves to a same-title seed and restores it on reselection", () => {
    let state = createEmptyContradictionInspectorDetailState();
    state = beginContradictionInspectorDetailLoad("contradiction-a");
    state = resolveContradictionInspectorDetailLoad(state, "contradiction-a", detailA);

    expect(
      exactQuoteFor(selectRenderableContradictionInspectorDetail(state, "contradiction-a"), "sideA"),
    ).toBe("quote-a");
    expect(
      selectRenderableContradictionInspectorDetail(state, "contradiction-a")?.sideA,
    ).toBe("Side A interpretation A");

    state = beginContradictionInspectorDetailLoad(null);

    expect(selectRenderableContradictionInspectorDetail(state, null)).toBeNull();
    expect(
      selectRenderableContradictionInspectorDetail(state, "contradiction-a"),
    ).toBeNull();

    state = beginContradictionInspectorDetailLoad("contradiction-a");
    state = resolveContradictionInspectorDetailLoad(state, "contradiction-a", detailA);

    expect(
      exactQuoteFor(selectRenderableContradictionInspectorDetail(state, "contradiction-a"), "sideA"),
    ).toBe("quote-a");
    expect(
      selectRenderableContradictionInspectorDetail(state, "contradiction-a")?.sideB,
    ).toBe("Side B interpretation A");
  });

  it("does not let contradiction A flash under contradiction B while B is loading or if B fails", () => {
    let state = createEmptyContradictionInspectorDetailState();
    state = beginContradictionInspectorDetailLoad("contradiction-a");
    state = resolveContradictionInspectorDetailLoad(state, "contradiction-a", detailA);

    state = beginContradictionInspectorDetailLoad("contradiction-b");

    expect(
      selectRenderableContradictionInspectorDetail(state, "contradiction-b"),
    ).toBeNull();

    state = resolveContradictionInspectorDetailLoad(state, "contradiction-a", detailA);

    expect(
      selectRenderableContradictionInspectorDetail(state, "contradiction-b"),
    ).toBeNull();

    state = failContradictionInspectorDetailLoad(state, "contradiction-b");

    expect(
      selectRenderableContradictionInspectorDetail(state, "contradiction-b"),
    ).toBeNull();

    state = beginContradictionInspectorDetailLoad("contradiction-b");
    state = resolveContradictionInspectorDetailLoad(state, "contradiction-b", detailB);

    expect(
      exactQuoteFor(selectRenderableContradictionInspectorDetail(state, "contradiction-b"), "sideA"),
    ).toBe("quote-c");
    expect(
      selectRenderableContradictionInspectorDetail(state, "contradiction-b")?.sideB,
    ).toBe("Side B interpretation B");
  });
});
