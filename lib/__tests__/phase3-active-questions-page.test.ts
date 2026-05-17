import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const authMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

const prismaMock = {
  investigation: {
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

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("../prismadb", () => ({
  default: prismaMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

describe("Phase 3 Active Questions page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.investigation.findMany.mockResolvedValue([]);
    prismaMock.investigation.findFirst.mockResolvedValue(null);
  });

  it("filters to authenticated user-owned investigation records and shows honest empty state", async () => {
    const page = await import("../../app/(root)/(routes)/active-questions/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("No active questions right now.");
    expect(prismaMock.investigation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          status: {
            in: ["open", "gathering_evidence", "testing", "resolving", "reopened"],
          },
        },
      })
    );
  });

  it("renders links from real investigation IDs only and drops invalid fallback rows", async () => {
    prismaMock.investigation.findMany.mockResolvedValueOnce([
      {
        id: "inv-1",
        title: "Observe shutdown patterns",
        organizingQuestion: "What precedes shutdown mode?",
        status: "open",
        seedType: "pattern",
        priority: 2,
        updatedAt: new Date("2026-05-17T09:00:00.000Z"),
      },
      {
        id: "   ",
        title: "inv-from-title should never become an ID",
        organizingQuestion: "Synthetic fallback should be filtered.",
        status: "testing",
        seedType: "user_curiosity",
        priority: null,
        updatedAt: new Date("2026-05-17T08:00:00.000Z"),
      },
    ]);

    const page = await import("../../app/(root)/(routes)/active-questions/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("/active-questions/inv-1");
    expect(html).toContain("Observe shutdown patterns");
    expect(html).not.toContain("inv-from-title should never become an ID");
  });

  it("hides detail rows outside first-slice statuses through the same not-found path", async () => {
    const page = await import(
      "../../app/(root)/(routes)/active-questions/[id]/page"
    );

    await expect(
      page.default({ params: Promise.resolve({ id: "inv-resolved" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(prismaMock.investigation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "inv-resolved",
          userId: "user-1",
          status: {
            in: ["open", "gathering_evidence", "testing", "resolving", "reopened"],
          },
        },
      })
    );
  });
});
