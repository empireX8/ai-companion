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
  investigation: {
    findMany: vi.fn(),
  },
  fieldworkAssignment: {
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

vi.mock("@/lib/internal-fieldwork-review-candidates", async () => {
  return vi.importActual("../internal-fieldwork-review-candidates");
});

vi.mock(
  "../../app/(root)/(routes)/internal/user-map/review/_components/InternalUserMapReviewWorkbench",
  () => ({
    InternalUserMapReviewWorkbench: ({
      userMapCandidates,
      investigationCandidates,
      fieldworkCandidates,
    }: {
      userMapCandidates: Array<{
        title: string;
        candidateLifecycleStatus: string | null;
      }>;
      investigationCandidates: Array<{
        title: string;
        candidateLifecycleStatus: string;
      }>;
      fieldworkCandidates: Array<{
        prompt: string;
        candidateLifecycleStatus: string;
      }>;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "internal-user-map-review-workbench" },
        userMapCandidates.map((candidate) =>
          React.createElement(
            "div",
            { key: `usermap-${candidate.title}` },
            candidate.title,
            candidate.candidateLifecycleStatus ?? "legacy"
          )
        ),
        investigationCandidates.map((candidate) =>
          React.createElement(
            "div",
            { key: `investigation-${candidate.title}` },
            candidate.title,
            candidate.candidateLifecycleStatus
          )
        ),
        fieldworkCandidates.map((candidate) =>
          React.createElement(
            "div",
            { key: `fieldwork-${candidate.prompt}` },
            candidate.prompt,
            candidate.candidateLifecycleStatus
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
    prismaMock.investigation.findMany.mockResolvedValue([]);
    prismaMock.fieldworkAssignment.findMany.mockResolvedValue([]);
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
    expect(prismaMock.investigation.findMany).not.toHaveBeenCalled();
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
    expect(prismaMock.investigation.findMany).not.toHaveBeenCalled();
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

    expect(html).toContain("Internal Candidate Review");
    expect(html).toContain("operator workbench");
    expect(html).toContain("Fieldwork");
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
    expect(prismaMock.investigation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          visibility: "internal_only",
          candidateLifecycleStatus: { not: null },
        }),
        take: 50,
      })
    );
    expect(prismaMock.fieldworkAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "reviewer-1",
          visibility: "internal_only",
          candidateLifecycleStatus: { not: null },
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

  it("renders User Map workbench when Investigation list fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
    prismaMock.investigation.findMany.mockRejectedValueOnce(
      new Error("investigation list failed")
    );
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([]);

    const page = await import(
      "../../app/(root)/(routes)/internal/user-map/review/page"
    );

    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Candidate title");
    expect(html).not.toContain("Could not load internal review candidates right now.");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[INTERNAL_INVESTIGATION_REVIEW_LIST_ERROR]",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it("renders User Map workbench when Fieldwork list fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
    prismaMock.fieldworkAssignment.findMany.mockRejectedValueOnce(
      new Error("fieldwork list failed")
    );
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValueOnce([]);

    const page = await import(
      "../../app/(root)/(routes)/internal/user-map/review/page"
    );

    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Candidate title");
    expect(html).not.toContain("Could not load internal review candidates right now.");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[INTERNAL_FIELDWORK_REVIEW_LIST_ERROR]",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it("passes internal Fieldwork candidates to the workbench", async () => {
    prismaMock.userMapConclusion.findMany.mockResolvedValueOnce([]);
    prismaMock.fieldworkAssignment.findMany.mockResolvedValueOnce([
      {
        id: "fw-internal-1",
        prompt: "Watch for Sunday tension",
        reason: "Need more weekend signal",
        status: "assigned",
        visibility: "internal_only",
        candidateLifecycleStatus: "proposed",
        linkedObjectType: "pattern_claim",
        linkedObjectId: "pc-1",
        expiresAt: null,
        createdAt: new Date("2026-05-15T10:00:00.000Z"),
        updatedAt: new Date("2026-05-15T11:00:00.000Z"),
      },
    ]);

    const page = await import(
      "../../app/(root)/(routes)/internal/user-map/review/page"
    );

    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Watch for Sunday tension");
    expect(html).toContain("proposed");
  });

  it("fails when User Map list fails even if Investigation list would succeed", async () => {
    prismaMock.userMapConclusion.findMany.mockRejectedValueOnce(
      new Error("user map list failed")
    );
    prismaMock.investigation.findMany.mockResolvedValueOnce([]);

    const page = await import(
      "../../app/(root)/(routes)/internal/user-map/review/page"
    );

    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Could not load internal review candidates right now.");
  });
});
