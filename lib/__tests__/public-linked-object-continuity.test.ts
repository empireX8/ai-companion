import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const prismaMock = {
  userMapConclusion: {
    findMany: vi.fn(),
  },
  patternClaim: {
    findMany: vi.fn(),
  },
  contradictionNode: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("../prismadb", () => ({
  default: prismaMock,
}));

describe("public linked-object continuity helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.patternClaim.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
  });

  it("resolves usermap_conclusion href only when user-owned and user_visible", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);

    const { resolvePublicLinkedObjectHref } = await import(
      "../public-linked-object-continuity"
    );
    const href = await resolvePublicLinkedObjectHref({
      userId: "user-1",
      linkedObjectType: "usermap_conclusion",
      linkedObjectId: "umc-1",
    });

    expect(href).toBe("/your-map/umc-1");
    expect(prismaMock.userMapConclusion.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        visibility: "user_visible",
        id: { in: ["umc-1"] },
      },
      select: { id: true },
    });
  });

  it("returns null for hidden, unowned, or missing usermap_conclusion", async () => {
    const { resolvePublicLinkedObjectHref } = await import(
      "../public-linked-object-continuity"
    );
    const href = await resolvePublicLinkedObjectHref({
      userId: "user-1",
      linkedObjectType: "usermap_conclusion",
      linkedObjectId: "umc-hidden",
    });

    expect(href).toBeNull();
  });

  it("resolves pattern and contradiction hrefs only when user-owned and non-candidate", async () => {
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([{ id: "pc-1" }]);
    prismaMock.contradictionNode.findMany.mockResolvedValueOnce([{ id: "cn-1" }]);

    const { resolvePublicLinkedObjectHrefs } = await import(
      "../public-linked-object-continuity"
    );
    const map = await resolvePublicLinkedObjectHrefs({
      userId: "user-1",
      targets: [
        { linkedObjectType: "pattern_claim", linkedObjectId: "pc-1" },
        { linkedObjectType: "contradiction_node", linkedObjectId: "cn-1" },
      ],
    });

    expect(map.get("pattern_claim:pc-1")).toBe("/patterns/pc-1");
    expect(map.get("contradiction_node:cn-1")).toBe("/contradictions/cn-1");
    expect(prismaMock.patternClaim.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: { not: "candidate" },
        id: { in: ["pc-1"] },
      },
      select: { id: true },
    });
    expect(prismaMock.contradictionNode.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: { not: "candidate" },
        id: { in: ["cn-1"] },
      },
      select: { id: true },
    });
  });

  it("returns null for candidate, unowned, stale, blank, and unsupported targets", async () => {
    const { resolvePublicLinkedObjectHref } = await import(
      "../public-linked-object-continuity"
    );

    const unsupported = [
      "investigation",
      "fieldwork_assignment",
      "model_update",
      "surfaced_action",
      "evidence_span",
      "reference_item",
      "session",
      "message",
      "import_record",
      "pattern_claim_evidence",
      "contradiction_evidence",
    ];

    for (const linkedObjectType of unsupported) {
      const href = await resolvePublicLinkedObjectHref({
        userId: "user-1",
        linkedObjectType,
        linkedObjectId: "any-id",
      });
      expect(href).toBeNull();
    }

    const blankHref = await resolvePublicLinkedObjectHref({
      userId: "user-1",
      linkedObjectType: "pattern_claim",
      linkedObjectId: "   ",
    });
    expect(blankHref).toBeNull();

    const syntheticHref = await resolvePublicLinkedObjectHref({
      userId: "user-1",
      linkedObjectType: "pattern_claim",
      linkedObjectId: "receipt-action-123",
    });
    expect(syntheticHref).toBeNull();
    expect(prismaMock.patternClaim.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: { not: "candidate" },
        id: { in: ["receipt-action-123"] },
      },
      select: { id: true },
    });
  });

  it("keeps mapping deterministic and does not create label-derived fallback IDs", async () => {
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([{ id: "pc-1" }]);

    const {
      linkedObjectHrefMapKey,
      resolvePublicLinkedObjectHrefs,
    } = await import("../public-linked-object-continuity");

    const map = await resolvePublicLinkedObjectHrefs({
      userId: "user-1",
      targets: [
        { linkedObjectType: "pattern_claim", linkedObjectId: "pc-1" },
        { linkedObjectType: "pattern_claim", linkedObjectId: "pc-1" },
        {
          linkedObjectType: "pattern_claim",
          linkedObjectId: "pattern title should never become id",
        },
      ],
    });

    expect(linkedObjectHrefMapKey({
      linkedObjectType: "pattern_claim",
      linkedObjectId: "pc-1",
    })).toBe("pattern_claim:pc-1");
    expect(
      linkedObjectHrefMapKey({
        linkedObjectType: "pattern_claim",
        linkedObjectId: "   ",
      })
    ).toBeNull();
    expect(map.get("pattern_claim:pc-1")).toBe("/patterns/pc-1");
    expect(
      map.has("pattern_claim:pattern title should never become id")
    ).toBe(false);

    const combined = JSON.stringify([...map.values()]);
    expect(combined).not.toContain("receipt-action-");
    expect(combined).not.toContain("receipt-user-map-");
  });

  it("applies verified affected-object hrefs and clears unverified links", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([{ id: "pc-safe" }]);
    prismaMock.contradictionNode.findMany.mockResolvedValueOnce([]);

    const { applyVerifiedAffectedObjectHrefs } = await import(
      "../public-linked-object-continuity"
    );

    const result = await applyVerifiedAffectedObjectHrefs({
      userId: "user-1",
      items: [
        {
          id: "mu-1",
          affectedObjectType: "usermap_conclusion",
          affectedObjectId: "umc-1",
          affectedObjectHref: "/your-map/umc-1",
        },
        {
          id: "mu-2",
          affectedObjectType: "pattern_claim",
          affectedObjectId: "pc-safe",
          affectedObjectHref: "/patterns/pc-safe",
        },
        {
          id: "mu-3",
          affectedObjectType: "contradiction_node",
          affectedObjectId: "cn-missing",
          affectedObjectHref: "/contradictions/cn-missing",
        },
        {
          id: "mu-4",
          affectedObjectType: "investigation",
          affectedObjectId: "inv-1",
          affectedObjectHref: null,
        },
      ],
    });

    expect(result).toEqual([
      {
        id: "mu-1",
        affectedObjectType: "usermap_conclusion",
        affectedObjectId: "umc-1",
        affectedObjectHref: "/your-map/umc-1",
      },
      {
        id: "mu-2",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pc-safe",
        affectedObjectHref: "/patterns/pc-safe",
      },
      {
        id: "mu-3",
        affectedObjectType: "contradiction_node",
        affectedObjectId: "cn-missing",
        affectedObjectHref: null,
      },
      {
        id: "mu-4",
        affectedObjectType: "investigation",
        affectedObjectId: "inv-1",
        affectedObjectHref: null,
      },
    ]);
  });
});
