import React from "react";
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
  derivationArtifact: {
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

vi.mock(
  "../../app/(root)/(routes)/internal/user-map/review/_components/InternalUserMapReviewWorkbench",
  () => ({
    InternalUserMapReviewWorkbench: ({
      candidates,
    }: {
      candidates: Array<{ title: string; candidateLifecycleStatus: string | null }>;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "internal-user-map-review-workbench" },
        candidates.map((candidate) =>
          React.createElement(
            "div",
            { key: candidate.title },
            candidate.title,
            candidate.candidateLifecycleStatus ?? "legacy"
          )
        )
      ),
  })
);

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
    prismaMock.derivationArtifact.findMany.mockResolvedValue([]);
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

  it("renders internal candidate metadata and operator controls for reviewers", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([
      {
        id: "umc-internal-1",
        title: "Candidate title",
        summary: "Candidate summary",
        area: "operating_logic",
        status: "emerging",
        confidenceLevel: "low",
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        notes: null,
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([
      {
        targetId: "umc-internal-1",
        sourceType: "message",
        sourceId: "msg-1",
        meta: null,
      },
      {
        targetId: "umc-internal-1",
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        meta: null,
      },
    ]);

    const page = await import(
      "../../app/(root)/(routes)/internal/user-map/review/page"
    );

    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Internal User Map Review");
    expect(html).toContain("operator workbench");
    expect(html).toContain("Candidate title");
    expect(html).toContain("proposed");

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
        candidateLifecycleStatus: "proposed",
        notes: null,
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
        candidateLifecycleStatus: "promoted",
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
