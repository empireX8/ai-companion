import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();

const prismaMock = {
  modelUpdate: {
    findMany: vi.fn(),
  },
  userMapConclusion: {
    findMany: vi.fn(),
  },
  patternClaim: {
    findMany: vi.fn(),
  },
  contradictionNode: {
    findMany: vi.fn(),
  },
  investigation: {
    findMany: vi.fn(),
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

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("../prismadb", () => ({
  default: prismaMock,
}));

describe("Phase 3 What Changed page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.modelUpdate.findMany.mockResolvedValue([]);
    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.patternClaim.findMany.mockResolvedValue([]);
    prismaMock.contradictionNode.findMany.mockResolvedValue([]);
    prismaMock.investigation.findMany.mockResolvedValue([]);
  });

  it("filters to authenticated user-owned meaningful user_visible updates and shows honest empty state", async () => {
    const page = await import("../../app/(root)/(routes)/what-changed/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("No meaningful changes yet.");
    expect(prismaMock.modelUpdate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          visibility: "user_visible",
          isMeaningful: true,
        },
      })
    );
  });

  it("renders only verified allowlisted links and keeps unsupported/hidden/candidate/missing targets in honest non-link state", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValueOnce([
      {
        id: "mu-1",
        updateType: "conclusion_strengthened",
        affectedObjectType: "usermap_conclusion",
        affectedObjectId: "umc-1",
        userFacingSummary: "Recovered from afternoon overload after moving meetings earlier.",
        createdAt: new Date("2026-05-17T10:00:00.000Z"),
      },
      {
        id: "mu-2",
        updateType: "correction_applied",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pc-safe",
        userFacingSummary: "Pattern was corrected to remove an overbroad interpretation.",
        createdAt: new Date("2026-05-17T09:30:00.000Z"),
      },
      {
        id: "mu-3",
        updateType: "conclusion_disputed",
        affectedObjectType: "contradiction_node",
        affectedObjectId: "cn-safe",
        userFacingSummary: "A contradiction now disputes the older certainty claim.",
        createdAt: new Date("2026-05-17T09:00:00.000Z"),
      },
      {
        id: "mu-3b",
        updateType: "conclusion_disputed",
        affectedObjectType: "usermap_conclusion",
        affectedObjectId: "umc-hidden",
        userFacingSummary: "Hidden or unowned target should stay non-link.",
        createdAt: new Date("2026-05-17T08:45:00.000Z"),
      },
      {
        id: "mu-3c",
        updateType: "correction_applied",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pc-candidate",
        userFacingSummary: "Candidate pattern target should stay non-link.",
        createdAt: new Date("2026-05-17T08:40:00.000Z"),
      },
      {
        id: "mu-3d",
        updateType: "conclusion_disputed",
        affectedObjectType: "contradiction_node",
        affectedObjectId: "cn-candidate",
        userFacingSummary: "Candidate contradiction target should stay non-link.",
        createdAt: new Date("2026-05-17T08:35:00.000Z"),
      },
      {
        id: "mu-4",
        updateType: "strategy_adjusted",
        affectedObjectType: "model_update",
        affectedObjectId: "mu-target-1",
        userFacingSummary: "Unsupported target type must not create a public detail link.",
        createdAt: new Date("2026-05-17T08:30:00.000Z"),
      },
      {
        id: "mu-5",
        updateType: "strategy_adjusted",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "   ",
        userFacingSummary: "Blank target ID must not create a public detail link.",
        createdAt: new Date("2026-05-17T08:00:00.000Z"),
      },
      {
        id: "   ",
        updateType: "strategy_adjusted",
        affectedObjectType: "usermap_conclusion",
        affectedObjectId: "umc-2",
        userFacingSummary: "mu-from-summary should never become an ID",
        createdAt: new Date("2026-05-17T07:00:00.000Z"),
      },
    ]);
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([{ id: "umc-1" }]);
    prismaMock.patternClaim.findMany.mockResolvedValueOnce([{ id: "pc-safe" }]);
    prismaMock.contradictionNode.findMany.mockResolvedValueOnce([{ id: "cn-safe" }]);

    const page = await import("../../app/(root)/(routes)/what-changed/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("/your-map/umc-1");
    expect(html).toContain("/patterns/pc-safe");
    expect(html).toContain("/contradictions/cn-safe");
    expect(html).not.toContain("/your-map/umc-hidden");
    expect(html).not.toContain("/patterns/pc-candidate");
    expect(html).not.toContain("/contradictions/cn-candidate");
    expect(html).not.toContain("/model-updates/mu-target-1");
    expect(html).not.toMatch(/>umc-hidden</);
    expect(html).not.toMatch(/>pc-candidate</);
    expect(html).not.toMatch(/>cn-candidate</);
    expect(html).toContain(
      "This update is visible, but its linked object is not available."
    );
    expect(html).not.toContain("internal review");
    expect(html).not.toContain("lifecycle");
    expect(html).not.toContain("Promote");
    expect(html).not.toContain("mu-from-summary should never become an ID");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Promote");
    expect(html).not.toContain("Publish");
    expect(html).not.toContain("Edit");
    expect(html).not.toContain("Delete");
    expect(prismaMock.userMapConclusion.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        visibility: "user_visible",
        id: { in: ["umc-1", "umc-hidden"] },
      },
      select: { id: true },
    });
    expect(prismaMock.patternClaim.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: { not: "candidate" },
        id: { in: ["pc-safe", "pc-candidate"] },
      },
      select: { id: true },
    });
    expect(prismaMock.contradictionNode.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: { not: "candidate" },
        id: { in: ["cn-safe", "cn-candidate"] },
      },
      select: { id: true },
    });
  });

  it("keeps What Changed list-only and avoids forbidden internal/detail endpoint usage", async () => {
    const detailRoutePath = path.join(
      process.cwd(),
      "app/(root)/(routes)/what-changed/[id]/page.tsx"
    );
    expect(existsSync(detailRoutePath)).toBe(false);

    const source = readFileSync(
      path.join(process.cwd(), "app/(root)/(routes)/what-changed/page.tsx"),
      "utf8"
    );

    expect(source.includes("/api/model-updates/[id]")).toBe(false);
    expect(source.includes("/api/internal/user-map/review-candidates")).toBe(false);
    expect(source.includes("/internal/user-map/review")).toBe(false);
    expect(source.includes("internal_only")).toBe(false);
    expect(source.includes("receipt-action-")).toBe(false);
  });
});
