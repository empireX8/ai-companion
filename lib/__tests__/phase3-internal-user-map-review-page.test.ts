import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const authMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

const prismaMock = {
  userMapConclusion: {
    findMany: vi.fn(),
  },
  understandingEvidenceLink: {
    findMany: vi.fn(),
  },
};

const OLD_ENV = process.env;

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
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

describe("Phase 3 internal user-map review page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      INTERNAL_USER_MAP_REVIEWER_IDS: "reviewer-1",
    };
    authMock.mockResolvedValue({ userId: "reviewer-1" });
    prismaMock.userMapConclusion.findMany.mockResolvedValue([]);
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("denies access for non-reviewers", async () => {
    authMock.mockResolvedValueOnce({ userId: "non-reviewer" });

    const page = await import(
      "../../app/(root)/(routes)/internal/user-map/review/page"
    );

    await expect(page.default()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prismaMock.userMapConclusion.findMany).not.toHaveBeenCalled();
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("denies access when reviewer allowlist is empty", async () => {
    process.env = {
      ...OLD_ENV,
      INTERNAL_USER_MAP_REVIEWER_IDS: "",
    };

    const page = await import(
      "../../app/(root)/(routes)/internal/user-map/review/page"
    );

    await expect(page.default()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prismaMock.userMapConclusion.findMany).not.toHaveBeenCalled();
    expect(prismaMock.understandingEvidenceLink.findMany).not.toHaveBeenCalled();
  });

  it("renders internal candidate metadata for reviewers and keeps read-only UI", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([
      {
        id: "umc-internal-1",
        title: "Candidate title",
        summary: "Candidate summary",
        area: "operating_logic",
        status: "emerging",
        confidenceLevel: "low",
        visibility: "internal_only",
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      { targetId: "umc-internal-1", sourceType: "message" },
      { targetId: "umc-internal-1", sourceType: "pattern_claim" },
    ]);

    const page = await import(
      "../../app/(root)/(routes)/internal/user-map/review/page"
    );

    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Internal User Map Review");
    expect(html).toContain("Candidate title");
    expect(html).toContain("Candidate summary");
    expect(html).toContain("internal_only");
    expect(html).toContain("Evidence link count");
    expect(html).toContain("2");
    expect(html).toContain("message (1)");
    expect(html).toContain("pattern_claim (1)");
    expect(html).not.toContain("quote");
    expect(html).not.toContain("snippet");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Promote");
    expect(html).not.toContain("Publish");
    expect(html).not.toContain("Approve");
    expect(html).not.toContain("Reject");
    expect(html).not.toContain("Delete");
    expect(html).not.toContain("Edit");

    expect(prismaMock.userMapConclusion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          visibility: "internal_only",
        }),
        take: 50,
      })
    );
  });

  it("does not render user_visible rows even if an unsafe payload regresses", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([
      {
        id: "umc-internal-1",
        title: "Internal candidate",
        summary: "Safe summary",
        area: "operating_logic",
        status: "emerging",
        confidenceLevel: "low",
        visibility: "internal_only",
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
      {
        id: "umc-user-visible-1",
        title: "Should never render",
        summary: "Should never render",
        area: "state_ecology",
        status: "supported",
        confidenceLevel: "medium",
        visibility: "user_visible",
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    const page = await import(
      "../../app/(root)/(routes)/internal/user-map/review/page"
    );

    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Internal candidate");
    expect(html).not.toContain("Should never render");
  });
});
