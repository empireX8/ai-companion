import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const authMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const listYourMapPublicEvidenceContinuityMock = vi.fn();

const prismaMock = {
  userMapConclusion: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/components/AppShell", () => ({
  PageHeader: () => null,
  SectionLabel: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/lib/public-intelligence-safe-slice", async () => {
  const actual = await import("../public-intelligence-safe-slice");
  return actual;
});

vi.mock("@/lib/public-evidence-continuity", () => ({
  listYourMapPublicEvidenceContinuity: listYourMapPublicEvidenceContinuityMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("../prismadb", () => ({
  default: prismaMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

describe("Phase 3 Your Map page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.userMapConclusion.findFirst.mockResolvedValue(null);
    listYourMapPublicEvidenceContinuityMock.mockResolvedValue([]);
  });

  it("filters to authenticated user-owned user_visible conclusions and shows honest empty state", async () => {
    const page = await import("../../app/(root)/(routes)/your-map/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Nothing on your map yet.");
    expect(prismaMock.userMapConclusion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          visibility: "user_visible",
        },
      })
    );
  });

  it("renders detail links from real conclusion IDs only and drops invalid fallback rows", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([
      {
        id: "umc-1",
        title: "Rest before overload events",
        summary: "Recovery windows improve regulation after high-conflict periods.",
        area: "recovery_architecture",
        status: "supported",
        confidenceLevel: "medium",
        evidenceCount: 3,
        updatedAt: new Date("2026-05-17T09:00:00.000Z"),
      },
      {
        id: "   ",
        title: "umc-from-title should never become an ID",
        summary: "Synthetic fallback row",
        area: "operating_logic",
        status: "emerging",
        confidenceLevel: "low",
        evidenceCount: 0,
        updatedAt: new Date("2026-05-17T08:00:00.000Z"),
      },
    ]);

    const page = await import("../../app/(root)/(routes)/your-map/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("/your-map/umc-1");
    expect(html).toContain("Rest before overload events");
    expect(html).not.toContain("umc-from-title should never become an ID");
  });

  it("hides detail for missing, unowned, and internal-only records through the same not-found path", async () => {
    const page = await import("../../app/(root)/(routes)/your-map/[id]/page");

    await expect(
      page.default({ params: Promise.resolve({ id: "umc-missing" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      page.default({ params: Promise.resolve({ id: "umc-unowned" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      page.default({ params: Promise.resolve({ id: "umc-internal" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(prismaMock.userMapConclusion.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          id: "umc-missing",
          userId: "user-1",
          visibility: "user_visible",
        },
      })
    );
    expect(prismaMock.userMapConclusion.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: "umc-unowned",
          userId: "user-1",
          visibility: "user_visible",
        },
      })
    );
    expect(prismaMock.userMapConclusion.findFirst).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: {
          id: "umc-internal",
          userId: "user-1",
          visibility: "user_visible",
        },
      })
    );
  });

  it("renders read-only detail with honest linked-evidence fallback and no promotion/write controls", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce({
      id: "umc-1",
      title: "Recovery depends on earlier decompression",
      summary: "Short decompression windows reduce late-day escalation patterns.",
      area: "recovery_architecture",
      status: "supported",
      confidenceLevel: "medium",
      evidenceCount: 2,
      sourceDiversity: 2,
      timeSpreadDays: 7,
      createdAt: new Date("2026-05-10T09:00:00.000Z"),
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    });

    const page = await import("../../app/(root)/(routes)/your-map/[id]/page");
    const element = await page.default({
      params: Promise.resolve({ id: "umc-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Short decompression windows reduce late-day escalation patterns.");
    expect(html).toContain("No linked public evidence yet.");
    expect(listYourMapPublicEvidenceContinuityMock).toHaveBeenCalledWith({
      userId: "user-1",
      targetId: "umc-1",
    });
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Promote");
    expect(html).not.toContain("Publish");
    expect(html).not.toContain("Edit");
    expect(html).not.toContain("Delete");
  });

  it("renders linked evidence list from verified pattern/contradiction sources only", async () => {
    prismaMock.userMapConclusion.findFirst.mockResolvedValueOnce({
      id: "umc-1",
      title: "Recovery depends on earlier decompression",
      summary: "Short decompression windows reduce late-day escalation patterns.",
      area: "recovery_architecture",
      status: "supported",
      confidenceLevel: "medium",
      evidenceCount: 2,
      sourceDiversity: 2,
      timeSpreadDays: 7,
      createdAt: new Date("2026-05-10T09:00:00.000Z"),
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    });
    listYourMapPublicEvidenceContinuityMock.mockResolvedValueOnce([
      {
        id: "link-pattern-1",
        sourceType: "pattern_claim",
        sourceTypeLabel: "Related pattern",
        sourceId: "pc-1",
        href: "/patterns/pc-1",
        createdAt: "2026-05-18T10:00:00.000Z",
      },
      {
        id: "link-contradiction-1",
        sourceType: "contradiction_node",
        sourceTypeLabel: "Related signal",
        sourceId: "cn-1",
        href: "/contradictions/cn-1",
        createdAt: "2026-05-18T09:00:00.000Z",
      },
    ]);

    const page = await import("../../app/(root)/(routes)/your-map/[id]/page");
    const element = await page.default({
      params: Promise.resolve({ id: "umc-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Provenance");
    expect(html).toContain("Related pattern");
    expect(html).toContain("Related signal");
    expect(html).toContain("/patterns/pc-1");
    expect(html).toContain("/contradictions/cn-1");
    expect(html).not.toContain("No linked public evidence yet.");
    expect(html).not.toMatch(/>pc-1</);
    expect(html).not.toMatch(/>cn-1</);
    expect(html).not.toContain("/active-questions/");
    expect(html).not.toContain("/watch-for/");
    expect(html).not.toContain("receipt-user-map-");
    expect(html).not.toContain("receipt-action-");
    expect(html).not.toContain("internalNotes");
    expect(html).not.toContain("quote");
  });
});
