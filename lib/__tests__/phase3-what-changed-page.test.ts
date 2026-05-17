import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const authMock = vi.fn();

const prismaMock = {
  modelUpdate: {
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

  it("renders allowlisted real-ID links only and keeps unsupported/missing targets in honest non-link state", async () => {
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
        affectedObjectId: "pc-2",
        userFacingSummary: "Pattern was corrected to remove an overbroad interpretation.",
        createdAt: new Date("2026-05-17T09:30:00.000Z"),
      },
      {
        id: "mu-3",
        updateType: "conclusion_disputed",
        affectedObjectType: "contradiction_node",
        affectedObjectId: "cn-4",
        userFacingSummary: "A contradiction now disputes the older certainty claim.",
        createdAt: new Date("2026-05-17T09:00:00.000Z"),
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

    const page = await import("../../app/(root)/(routes)/what-changed/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("/your-map/umc-1");
    expect(html).toContain("/patterns/pc-2");
    expect(html).toContain("/contradictions/cn-4");
    expect(html).toContain("No linked detail available yet.");
    expect(html).not.toContain("mu-from-summary should never become an ID");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Promote");
    expect(html).not.toContain("Publish");
    expect(html).not.toContain("Edit");
    expect(html).not.toContain("Delete");
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
