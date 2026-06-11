import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { buildPublicWatchForWhere } from "../fieldwork-public-visibility";

const authMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const resolvePublicLinkedObjectHrefMock = vi.fn();
const resolvePublicLinkedObjectHrefsMock = vi.fn();

const prismaMock = {
  fieldworkAssignment: {
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

vi.mock("@/lib/watch-for", async () => {
  const actual = await import("../watch-for");
  return actual;
});

vi.mock("@/lib/public-intelligence-safe-slice", async () => {
  const actual = await import("../public-intelligence-safe-slice");
  return actual;
});

vi.mock("@/lib/public-continuity-display", async () => {
  const actual = await import("../public-continuity-display");
  return actual;
});

vi.mock("@/lib/public-linked-object-continuity", () => ({
  resolvePublicLinkedObjectHref: resolvePublicLinkedObjectHrefMock,
  resolvePublicLinkedObjectHrefs: resolvePublicLinkedObjectHrefsMock,
  linkedObjectHrefMapKey: ({ linkedObjectType, linkedObjectId }: {
    linkedObjectType: string | null | undefined;
    linkedObjectId: string | null | undefined;
  }) => {
    if (typeof linkedObjectType !== "string" || typeof linkedObjectId !== "string") {
      return null;
    }
    const safeId = linkedObjectId.trim();
    if (!safeId) {
      return null;
    }
    return `${linkedObjectType}:${safeId}`;
  },
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

describe("Phase 3 Watch For page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.fieldworkAssignment.findMany.mockResolvedValue([]);
    prismaMock.fieldworkAssignment.findFirst.mockResolvedValue(null);
    resolvePublicLinkedObjectHrefsMock.mockResolvedValue(new Map());
    resolvePublicLinkedObjectHrefMock.mockResolvedValue(null);
  });

  it("filters to authenticated user-owned watch-for records and shows honest empty state", async () => {
    const page = await import("../../app/(root)/(routes)/watch-for/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Nothing to watch for yet.");
    expect(prismaMock.fieldworkAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildPublicWatchForWhere({ userId: "user-1" }),
      })
    );
  });

  it("renders verified links only for allowlisted targets and keeps unsupported targets non-linkable", async () => {
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
        prompt: "Watch for map conclusion confirmations",
        reason: "Safe map target should be linkable",
        status: "active",
        linkedObjectType: "pattern_claim",
        linkedObjectId: "pc-1",
        priority: null,
        updatedAt: new Date("2026-05-17T08:00:00.000Z"),
      },
      {
        id: "fw-3",
        prompt: "Watch contradiction escalation",
        reason: "Safe contradiction target should be linkable",
        status: "active",
        linkedObjectType: "contradiction_node",
        linkedObjectId: "cn-1",
        priority: null,
        updatedAt: new Date("2026-05-17T08:00:00.000Z"),
      },
      {
        id: "fw-4",
        prompt: "Watch map stabilization",
        reason: "Safe user map target should be linkable",
        status: "assigned",
        linkedObjectType: "usermap_conclusion",
        linkedObjectId: "umc-1",
        priority: 2,
        updatedAt: new Date("2026-05-17T07:30:00.000Z"),
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
    resolvePublicLinkedObjectHrefsMock.mockResolvedValueOnce(
      new Map<string, string>([
        ["pattern_claim:pc-1", "/patterns/pc-1"],
        ["contradiction_node:cn-1", "/contradictions/cn-1"],
        ["usermap_conclusion:umc-1", "/your-map/umc-1"],
      ])
    );

    const page = await import("../../app/(root)/(routes)/watch-for/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("/watch-for/fw-1");
    expect(html).toContain("/patterns/pc-1");
    expect(html).toContain("/contradictions/cn-1");
    expect(html).toContain("/your-map/umc-1");
    expect(html).not.toContain("/active-questions/inv-12");
    expect(html).not.toMatch(/>inv-12</);
    expect(html).toContain("Source unavailable.");
    expect(html).not.toContain("fw-from-prompt should never become an ID");
    expect(resolvePublicLinkedObjectHrefsMock).toHaveBeenCalledWith({
      userId: "user-1",
      targets: [
        { linkedObjectType: "investigation", linkedObjectId: "inv-12" },
        { linkedObjectType: "pattern_claim", linkedObjectId: "pc-1" },
        { linkedObjectType: "contradiction_node", linkedObjectId: "cn-1" },
        { linkedObjectType: "usermap_conclusion", linkedObjectId: "umc-1" },
      ],
    });
  });

  it("hides detail rows outside assigned/active through the same not-found path", async () => {
    const page = await import("../../app/(root)/(routes)/watch-for/[id]/page");

    await expect(
      page.default({ params: Promise.resolve({ id: "fw-completed" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(prismaMock.fieldworkAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildPublicWatchForWhere({
          userId: "user-1",
          id: "fw-completed",
        }),
      })
    );
  });

  it("renders verified allowlisted links in watch-for detail", async () => {
    resolvePublicLinkedObjectHrefMock.mockResolvedValueOnce("/patterns/pc-1");
    prismaMock.fieldworkAssignment.findFirst.mockResolvedValueOnce({
      id: "fw-1",
      prompt: "Track post-meeting crash",
      reason: "Validate energy-drop hypothesis",
      status: "assigned",
      linkedObjectType: "pattern_claim",
      linkedObjectId: "pc-1",
      priority: 1,
      observationNote: null,
      observationOutcome: null,
      expiresAt: new Date("2026-05-20T09:00:00.000Z"),
      createdAt: new Date("2026-05-17T09:00:00.000Z"),
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    });

    const page = await import("../../app/(root)/(routes)/watch-for/[id]/page");
    const element = await page.default({
      params: Promise.resolve({ id: "fw-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("/patterns/pc-1");
    expect(resolvePublicLinkedObjectHrefMock).toHaveBeenCalledWith({
      userId: "user-1",
      linkedObjectType: "pattern_claim",
      linkedObjectId: "pc-1",
    });
    expect(html).not.toContain("receipt-action-");
    expect(html).not.toContain("receipt-user-map-");
    expect(html).not.toContain("/api/internal/user-map/review-candidates");
  });

  it("falls back for unsupported or unresolved targets in watch-for detail and keeps read-only framing", async () => {
    prismaMock.fieldworkAssignment.findFirst.mockResolvedValueOnce({
      id: "fw-1",
      prompt: "Track post-meeting crash",
      reason: "Validate energy-drop hypothesis",
      status: "assigned",
      linkedObjectType: "investigation",
      linkedObjectId: "inv-12",
      priority: 1,
      observationNote: null,
      observationOutcome: null,
      expiresAt: new Date("2026-05-20T09:00:00.000Z"),
      createdAt: new Date("2026-05-17T09:00:00.000Z"),
      updatedAt: new Date("2026-05-17T10:00:00.000Z"),
    });

    const page = await import("../../app/(root)/(routes)/watch-for/[id]/page");
    const element = await page.default({
      params: Promise.resolve({ id: "fw-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Watch until");
    expect(html).not.toContain("Completed at");
    expect(html).toContain("Source unavailable.");
    expect(html).not.toContain("/active-questions/inv-12");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Promote");
    expect(html).not.toContain("Edit");
    expect(html).not.toContain("Delete");
  });
});
