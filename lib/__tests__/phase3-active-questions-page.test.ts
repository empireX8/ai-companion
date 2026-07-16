import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { buildPublicActiveInvestigationWhere } from "../investigation-public-visibility";

const authMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const resolvePublicLinkedObjectHrefMock = vi.fn();
const loadProductionInvestigationDetailMock = vi.fn();
const listAvailableEvidenceSpansForUserMock = vi.fn();

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

vi.mock("@/components/investigations/InvestigationCreateCard", () => ({
  InvestigationCreateCard: () =>
    React.createElement("div", { "data-testid": "investigation-create-card" }),
}));

vi.mock("@/components/investigations/InvestigationDetailActions", () => ({
  InvestigationDetailActions: () =>
    React.createElement("div", { "data-testid": "investigation-detail-actions" }),
}));

vi.mock("@/components/investigations/InvestigationDetailInspectorSync", () => ({
  InvestigationDetailInspectorSync: () => null,
}));

vi.mock("@/lib/public-intelligence-safe-slice", async () => {
  const actual = await import("../public-intelligence-safe-slice");
  return actual;
});

vi.mock("@/lib/active-questions", async () => {
  const actual = await import("../active-questions");
  return actual;
});

vi.mock("@/lib/public-linked-object-continuity", () => ({
  resolvePublicLinkedObjectHref: resolvePublicLinkedObjectHrefMock,
}));

vi.mock("@/lib/investigation-production-detail", () => ({
  loadProductionInvestigationDetail: loadProductionInvestigationDetailMock,
  listAvailableEvidenceSpansForUser: listAvailableEvidenceSpansForUserMock,
}));

vi.mock("@/lib/public-continuity-display", async () => {
  const actual = await import("../public-continuity-display");
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
    resolvePublicLinkedObjectHrefMock.mockResolvedValue(null);
    loadProductionInvestigationDetailMock.mockResolvedValue(null);
    listAvailableEvidenceSpansForUserMock.mockResolvedValue([]);
  });

  it("filters to authenticated user-owned investigation records and shows honest empty state", async () => {
    const page = await import("../../app/(root)/(routes)/active-questions/page");
    const element = await page.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("No open questions yet.");
    expect(html).toContain("investigation-create-card");
    expect(prismaMock.investigation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildPublicActiveInvestigationWhere({ userId: "user-1" }),
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
    expect(html).toContain("Investigation ID inv-1");
    expect(html).not.toContain("inv-from-title should never become an ID");
  });

  it("uses the durable detail loader and falls through to notFound only when no real record is returned", async () => {
    const page = await import(
      "../../app/(root)/(routes)/active-questions/[id]/page"
    );

    loadProductionInvestigationDetailMock.mockResolvedValueOnce(null);

    await expect(
      page.default({ params: Promise.resolve({ id: "inv-resolved" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(loadProductionInvestigationDetailMock).toHaveBeenCalledWith({
      userId: "user-1",
      id: "inv-resolved",
    });
    expect(listAvailableEvidenceSpansForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      investigationId: "inv-resolved",
    });
  });

  it("renders durable investigation detail, linked evidence, and fieldwork context", async () => {
    loadProductionInvestigationDetailMock.mockResolvedValueOnce({
      id: "inv-1",
      title: "Observe shutdown patterns",
      detailHref: "/active-questions/inv-1",
      organizingQuestion: "What precedes shutdown mode?",
      status: "resolving",
      statusLabel: "Resolving",
      seedType: "pattern",
      seedTypeLabel: "Pattern",
      priority: 2,
      createdAt: "2026-05-17T07:00:00.000Z",
      updatedAt: "2026-05-17T09:00:00.000Z",
      resolutionSummary: "Likely routes through recovery architecture.",
      resolvedAt: "2026-05-18T09:00:00.000Z",
      resolvedConclusionId: "umc-1",
      resolvedConclusionHref: "/your-map/umc-1",
      reopenReason: null,
      competingTheories: ["Theory one"],
      evidenceNeeded: ["Need one more receipt"],
      linkedEvidence: [
        {
          linkId: "link-1",
          evidenceId: "es-1",
          messageId: "msg-1",
          excerpt: "Direct evidence excerpt",
          sessionId: "sess-1",
          sessionLabel: "Evidence session",
          origin: "APP",
          role: "supports",
          createdAt: "2026-05-17T09:30:00.000Z",
          evidenceHref: "/evidence/es-1",
        },
      ],
      linkedFieldwork: [
        {
          id: "fw-1",
          prompt: "Watch the shutdown pattern",
          reason: "Check whether the stop point arrives first",
          status: "active",
          statusLabel: "Active",
          linkedObjectType: "investigation",
          linkedObjectId: "inv-1",
          observationNote: "Observed one clean stop point.",
          observationOutcome: "Supports the current investigation.",
          completedAt: null,
          createdAt: "2026-05-17T09:15:00.000Z",
          updatedAt: "2026-05-17T09:45:00.000Z",
          detailHref: "/watch-for/fw-1",
        },
      ],
      isClosed: false,
      closureStateLabel: "Open",
    });
    listAvailableEvidenceSpansForUserMock.mockResolvedValueOnce([]);

    const page = await import("../../app/(root)/(routes)/active-questions/[id]/page");
    const element = await page.default({
      params: Promise.resolve({ id: "inv-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Investigation ID inv-1");
    expect(html).toContain("Lifecycle resolving");
    expect(html).toContain("Evidence ID es-1");
    expect(html).toContain("Fieldwork ID fw-1");
    expect(html).toContain("/your-map/umc-1");
    expect(html).toContain("investigation-detail-actions");
  });

  it("keeps the same durable detail URL reviewable after closure", async () => {
    loadProductionInvestigationDetailMock.mockResolvedValueOnce({
      id: "inv-1",
      title: "Observe shutdown patterns",
      detailHref: "/active-questions/inv-1",
      organizingQuestion: "What precedes shutdown mode?",
      status: "resolved",
      statusLabel: "Resolved",
      seedType: "pattern",
      seedTypeLabel: "Pattern",
      priority: 2,
      createdAt: "2026-05-17T07:00:00.000Z",
      updatedAt: "2026-05-17T09:00:00.000Z",
      resolutionSummary: "Likely routes through recovery architecture.",
      resolvedAt: "2026-05-18T09:00:00.000Z",
      resolvedConclusionId: "umc-hidden",
      resolvedConclusionHref: null,
      reopenReason: null,
      competingTheories: [],
      evidenceNeeded: [],
      linkedEvidence: [],
      linkedFieldwork: [],
      isClosed: true,
      closureStateLabel: "Closed as resolved",
    });
    listAvailableEvidenceSpansForUserMock.mockResolvedValueOnce([]);

    const page = await import("../../app/(root)/(routes)/active-questions/[id]/page");
    const element = await page.default({
      params: Promise.resolve({ id: "inv-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Closed as resolved");
    expect(html).toContain("This investigation remains reviewable");
    expect(html).toContain("Source unavailable.");
    expect(html).not.toContain("/your-map/umc-hidden");
  });
});
