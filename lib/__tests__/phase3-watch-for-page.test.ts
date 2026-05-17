import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const authMock = vi.fn();

const prismaMock = {
  fieldworkAssignment: {
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

describe("Phase 3 Watch For page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.fieldworkAssignment.findMany.mockResolvedValue([]);
  });

  it("filters to authenticated user-owned watch-for records and shows honest empty state", async () => {
    const page = await import("../../app/(root)/(routes)/watch-for/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("No watch-for prompts right now.");
    expect(prismaMock.fieldworkAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          status: { in: ["assigned", "active"] },
        },
      })
    );
  });

  it("renders real fieldwork IDs only and keeps unresolved targets non-linkable", async () => {
    prismaMock.fieldworkAssignment.findMany.mockResolvedValueOnce([
      {
        id: "fw-1",
        prompt: "Track post-meeting crash",
        reason: "Validate energy-drop hypothesis",
        status: "assigned",
        linkedObjectType: "investigation",
        linkedObjectId: "inv-12",
        priority: 1,
        updatedAt: new Date("2026-05-17T09:00:00.000Z"),
      },
      {
        id: "fw-2",
        prompt: "Watch for certainty spikes",
        reason: "Candidate-linked prompt should not fake a route",
        status: "active",
        linkedObjectType: "usermap_conclusion",
        linkedObjectId: "umc-internal-1",
        priority: null,
        updatedAt: new Date("2026-05-17T08:00:00.000Z"),
      },
      {
        id: "  ",
        prompt: "fw-from-prompt should never become an ID",
        reason: "Synthetic fallback row",
        status: "assigned",
        linkedObjectType: "investigation",
        linkedObjectId: "inv-fake",
        priority: null,
        updatedAt: new Date("2026-05-17T07:00:00.000Z"),
      },
    ]);

    const page = await import("../../app/(root)/(routes)/watch-for/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("/watch-for/fw-1");
    expect(html).toContain("/active-questions/inv-12");
    expect(html).toContain("umc-internal-1");
    expect(html).toContain("No linked detail available yet.");
    expect(html).not.toContain("fw-from-prompt should never become an ID");
  });
});
