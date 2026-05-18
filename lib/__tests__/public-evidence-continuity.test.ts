import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const prismaMock = {
  userMapConclusion: {
    findFirst: vi.fn(),
  },
  understandingEvidenceLink: {
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

describe("public evidence continuity helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.userMapConclusion.findFirst.mockResolvedValue({ id: "umc-1" });
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
    prismaMock.patternClaim.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
  });

  it("returns empty when target is missing, unowned, or not user_visible", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce(null);

    const { listYourMapPublicEvidenceContinuity } = await import(
      "../public-evidence-continuity"
    );
    const items = await listYourMapPublicEvidenceContinuity({
      userId: "user-1",
      targetId: "umc-missing",
    });

    expect(items).toEqual([]);
    expect(prismaMock.userMapConclusion.findFirst).toHaveBeenCalledWith({
      where: {
        id: "umc-missing",
        userId: "user-1",
        visibility: "user_visible",
      },
      select: { id: true },
    });
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("filters to user-owned usermap_conclusion target + allowlisted source types with deterministic ordering and cap", async () => {
    const { listYourMapPublicEvidenceContinuity } = await import(
      "../public-evidence-continuity"
    );

    await listYourMapPublicEvidenceContinuity({
      userId: "user-1",
      targetId: "umc-1",
    });

    expect(prismaMock.understandingEvidenceLink.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        targetType: "usermap_conclusion",
        targetId: "umc-1",
        sourceType: {
          in: ["pattern_claim", "contradiction_node"],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 6,
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        createdAt: true,
      },
    });
  });

  it("verifies source existence before emitting links and omits unsupported, stale, missing, and candidate-only sources", async () => {
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        id: "link-1",
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        createdAt: new Date("2026-05-18T10:00:00.000Z"),
      },
      {
        id: "link-2",
        sourceType: "pattern_claim",
        sourceId: "pc-candidate",
        createdAt: new Date("2026-05-18T09:00:00.000Z"),
      },
      {
        id: "link-3",
        sourceType: "pattern_claim",
        sourceId: "pc-missing",
        createdAt: new Date("2026-05-18T08:00:00.000Z"),
      },
      {
        id: "link-4",
        sourceType: "contradiction_node",
        sourceId: "cn-1",
        createdAt: new Date("2026-05-18T07:00:00.000Z"),
      },
      {
        id: "link-5",
        sourceType: "contradiction_node",
        sourceId: "cn-candidate",
        createdAt: new Date("2026-05-18T06:00:00.000Z"),
      },
      {
        id: "link-6",
        sourceType: "contradiction_node",
        sourceId: "   ",
        createdAt: new Date("2026-05-18T05:00:00.000Z"),
      },
      {
        id: "link-7",
        sourceType: "session",
        sourceId: "sess-1",
        createdAt: new Date("2026-05-18T04:00:00.000Z"),
      },
    ]);

    prismaMock.patternClaim.findMany.mockResolvedValueOnce([{ id: "pc-1" }]);
    prismaMock.contradictionNode.findMany.mockResolvedValueOnce([{ id: "cn-1" }]);

    const { listYourMapPublicEvidenceContinuity } = await import(
      "../public-evidence-continuity"
    );
    const items = await listYourMapPublicEvidenceContinuity({
      userId: "user-1",
      targetId: "umc-1",
    });

    expect(prismaMock.patternClaim.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        id: {
          in: ["pc-1", "pc-candidate", "pc-missing"],
        },
        status: { not: "candidate" },
      },
      select: { id: true },
    });
    expect(prismaMock.contradictionNode.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        id: {
          in: ["cn-1", "cn-candidate"],
        },
        status: { not: "candidate" },
      },
      select: { id: true },
    });

    expect(items).toEqual([
      {
        id: "link-1",
        sourceType: "pattern_claim",
        sourceTypeLabel: "Pattern Claim",
        sourceId: "pc-1",
        href: "/patterns/pc-1",
        createdAt: "2026-05-18T10:00:00.000Z",
      },
      {
        id: "link-4",
        sourceType: "contradiction_node",
        sourceTypeLabel: "Contradiction Node",
        sourceId: "cn-1",
        href: "/contradictions/cn-1",
        createdAt: "2026-05-18T07:00:00.000Z",
      },
    ]);

    expect(items.every((item) => item.id.startsWith("receipt-") === false)).toBe(
      true
    );
    expect(
      items.every((item) => item.id.startsWith("receipt-action-") === false)
    ).toBe(true);
  });

  it("returns allowlisted safe fields only and omits forbidden evidence/internal payload fields", async () => {
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        id: "link-1",
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        createdAt: new Date("2026-05-18T10:00:00.000Z"),
      },
    ]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([{ id: "pc-1" }]);

    const { listYourMapPublicEvidenceContinuity } = await import(
      "../public-evidence-continuity"
    );
    const items = await listYourMapPublicEvidenceContinuity({
      userId: "user-1",
      targetId: "umc-1",
    });

    expect(items).toHaveLength(1);
    expect(Object.keys(items[0] ?? {}).sort()).toEqual([
      "createdAt",
      "href",
      "id",
      "sourceId",
      "sourceType",
      "sourceTypeLabel",
    ]);

    const combined = JSON.stringify(items);
    expect(combined).not.toContain("meta");
    expect(combined).not.toContain("summary");
    expect(combined).not.toContain("snippet");
    expect(combined).not.toContain("quote");
    expect(combined).not.toContain("text");
    expect(combined).not.toContain("internalNotes");
  });
});
