import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildPublicActiveInvestigationWhere } from "../investigation-public-visibility";
import {
  EXPLORE_INVESTIGATIONS_ENDPOINT,
  EXPLORE_INVESTIGATIONS_LIMIT,
  buildPublicExploreInvestigationWhere,
  dedupeExploreInvestigationItems,
  fetchExploreInvestigationItems,
  normalizeExploreInvestigationItemsPayload,
  toExploreInvestigationItem,
} from "../investigations";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();

const prismaMock = {
  investigation: {
    findMany: vi.fn(),
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prismadb", () => ({
  default: prismaMock,
}));

vi.mock("../prismadb", () => ({
  default: prismaMock,
}));

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("/api/explore/investigations public list contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.investigation.findMany.mockResolvedValue([]);
  });

  it("requires auth for the Explore Investigations list route", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const route = await import("../../app/api/explore/investigations/route");
    const response = await route.GET();

    expect(response.status).toBe(401);
    expect(prismaMock.investigation.findMany).not.toHaveBeenCalled();
  });

  it("applies user ownership, lifecycle allowlist, and complementary status filter", async () => {
    const route = await import("../../app/api/explore/investigations/route");
    const response = await route.GET();

    expect(response.status).toBe(200);
    expect(prismaMock.investigation.findMany).toHaveBeenCalledWith({
      where: buildPublicExploreInvestigationWhere({ userId: "user-1" }),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: EXPLORE_INVESTIGATIONS_LIMIT,
      select: {
        id: true,
        title: true,
        organizingQuestion: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("excludes Active Questions-owned statuses from the Explore Investigations query", async () => {
    const route = await import("../../app/api/explore/investigations/route");
    await route.GET();

    const where = prismaMock.investigation.findMany.mock.calls[0]?.[0]?.where;
    expect(where?.status).toEqual({
      notIn: ["open", "gathering_evidence", "testing", "resolving", "reopened"],
    });
    expect(buildPublicActiveInvestigationWhere({ userId: "user-1" }).status).toEqual({
      in: ["open", "gathering_evidence", "testing", "resolving", "reopened"],
    });
  });

  it("returns safe projected fields only and drops malformed rows", async () => {
    prismaMock.investigation.findMany.mockResolvedValueOnce([
      {
        id: "inv-resolved-1",
        title: "Did the prototype reduce uncertainty?",
        organizingQuestion: "Whether the first prototype meaningfully lowered design risk.",
        status: "resolved",
        createdAt: new Date("2026-05-21T09:00:00.000Z"),
        updatedAt: new Date("2026-05-21T10:00:00.000Z"),
      },
      {
        id: "   ",
        title: "Synthetic fallback should be filtered",
        organizingQuestion: "Invalid id row.",
        status: "abandoned",
        createdAt: new Date("2026-05-21T08:00:00.000Z"),
        updatedAt: new Date("2026-05-21T08:30:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/explore/investigations/route");
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      items: [
        {
          id: "inv-resolved-1",
          title: "Did the prototype reduce uncertainty?",
          organizingQuestion: "Whether the first prototype meaningfully lowered design risk.",
          status: "resolved",
          statusLabel: "Resolved",
          createdAt: "2026-05-21T09:00:00.000Z",
          updatedAt: "2026-05-21T10:00:00.000Z",
        },
      ],
    });

    const body = JSON.stringify(payload);
    expect(body).not.toContain("competingTheories");
    expect(body).not.toContain("evidenceNeeded");
    expect(body).not.toContain("candidateLifecycleStatus");
    expect(body).not.toContain("userId");
    expect(body).not.toContain("seedType");
    expect(body).not.toContain("Synthetic fallback should be filtered");
  });

  it("does not select raw JSON blobs from the database", async () => {
    const route = await import("../../app/api/explore/investigations/route");
    await route.GET();

    const select = prismaMock.investigation.findMany.mock.calls[0]?.[0]?.select;
    expect(select).not.toHaveProperty("competingTheories");
    expect(select).not.toHaveProperty("evidenceNeeded");
    expect(select).not.toHaveProperty("candidateLifecycleStatus");
    expect(select).not.toHaveProperty("visibility");
    expect(select).not.toHaveProperty("userId");
  });

  it("dedupes duplicate investigation rows by id", async () => {
    prismaMock.investigation.findMany.mockResolvedValueOnce([
      {
        id: "inv-resolved-1",
        title: "First copy",
        organizingQuestion: "Question one",
        status: "resolved",
        createdAt: new Date("2026-05-21T09:00:00.000Z"),
        updatedAt: new Date("2026-05-21T10:00:00.000Z"),
      },
      {
        id: "inv-resolved-1",
        title: "Duplicate copy",
        organizingQuestion: "Question duplicate",
        status: "resolved",
        createdAt: new Date("2026-05-21T08:00:00.000Z"),
        updatedAt: new Date("2026-05-21T08:30:00.000Z"),
      },
    ]);

    const route = await import("../../app/api/explore/investigations/route");
    const response = await route.GET();
    const payload = await response.json();

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.title).toBe("First copy");
  });

  it("leaves /api/active-questions query contract unchanged", async () => {
    const activeQuestionsRoute = await import("../../app/api/active-questions/route");
    await activeQuestionsRoute.GET();

    expect(prismaMock.investigation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildPublicActiveInvestigationWhere({ userId: "user-1" }),
      })
    );
  });

  it("wires Explore Investigations fetch into the root hybrid hook", () => {
    const hookSource = readSource("components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts");

    expect(hookSource).toContain("fetchExploreInvestigationItems");
    expect(hookSource).toContain("buildInvestigationsProductionDataApi");
    expect(hookSource).toContain("investigationsApi");
  });

  it("keeps Investigations tab rendering unchanged", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const investigationsBlock =
      explorePageSource.match(/function Investigations\(\) \{([\s\S]*?)\n\}\n\nfunction InvBlock/)?.[1] ??
      "";

    expect(investigationsBlock).toContain('["inv-1", "inv-2", "inv-3"]');
    expect(investigationsBlock).toContain("isProductionDisplay(data)");
    expect(investigationsBlock).not.toContain("hasLiveInvestigations");
    expect(investigationsBlock).not.toContain("fetchExploreInvestigationItems");
  });

  it("keeps Active Questions and Fieldwork Bridge untouched", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");

    expect(explorePageSource).toContain("hasLiveQuestions");
    expect(explorePageSource).toContain("hasLiveFieldwork");
    expect(explorePageSource).toContain("resolveActiveQuestionsOpenSelectionId");
    expect(explorePageSource).toContain("resolveExperimentOpenSelectionId");
  });

  it("keeps Explore chat untouched", () => {
    const explorePageSource = readSource("components/orvek-v0/pages/explore.tsx");
    const freeExploreBlock =
      explorePageSource.match(/function FreeExplore\(\) \{([\s\S]*?)\n\}\n\nfunction Bubble/)?.[1] ??
      "";

    expect(freeExploreBlock).toContain("exploreHandlers?.onSend");
    expect(freeExploreBlock).not.toContain("fetchExploreInvestigationItems");
    expect(freeExploreBlock).not.toContain("exploreInvestigationIds");
  });

  it("keeps the old production shell quarantined", () => {
    const shellSource = readSource("components/orvek-workbench/OrvekWorkbenchShell.tsx");
    const workbenchSource = readSource("components/orvek-v0/workbench.tsx");

    expect(shellSource).not.toContain("RouteTopBar");
    expect(workbenchSource).toContain("<ExplorePage />");
    expect(workbenchSource).toContain("createMockOrvekDataApi");
  });
});

describe("fetchExploreInvestigationItems transport helper", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns [] when the public list fetch fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ items: [] }),
    }) as typeof fetch;

    await expect(fetchExploreInvestigationItems()).resolves.toEqual([]);
    expect(globalThis.fetch).toHaveBeenCalledWith(EXPLORE_INVESTIGATIONS_ENDPOINT, {
      cache: "no-store",
    });
  });

  it("tolerates malformed payloads and keeps only safe items", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "inv-resolved-1",
            title: "Resolved thread",
            organizingQuestion: "Did the prototype help?",
            status: "resolved",
            statusLabel: "Resolved",
            createdAt: "2026-05-21T09:00:00.000Z",
            updatedAt: "2026-05-21T10:00:00.000Z",
          },
          {
            id: "inv-bad",
            title: "Missing fields",
          },
          null,
          {
            competingTheories: ["raw json should not pass transport filter"],
          },
        ],
      }),
    }) as typeof fetch;

    await expect(fetchExploreInvestigationItems()).resolves.toEqual([
      {
        id: "inv-resolved-1",
        title: "Resolved thread",
        organizingQuestion: "Did the prototype help?",
        status: "resolved",
        statusLabel: "Resolved",
        createdAt: "2026-05-21T09:00:00.000Z",
        updatedAt: "2026-05-21T10:00:00.000Z",
      },
    ]);
  });

  it("dedupes transport payloads by investigation id", () => {
    const items = dedupeExploreInvestigationItems([
      toExploreInvestigationItem({
        id: "inv-resolved-1",
        title: "First",
        organizingQuestion: "Question",
        status: "resolved",
        createdAt: new Date("2026-05-21T09:00:00.000Z"),
        updatedAt: new Date("2026-05-21T10:00:00.000Z"),
      })!,
      toExploreInvestigationItem({
        id: "inv-resolved-1",
        title: "Duplicate",
        organizingQuestion: "Question duplicate",
        status: "resolved",
        createdAt: new Date("2026-05-21T08:00:00.000Z"),
        updatedAt: new Date("2026-05-21T08:30:00.000Z"),
      })!,
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("First");
  });

  it("returns [] for non-object and non-array transport payloads", () => {
    expect(normalizeExploreInvestigationItemsPayload(null)).toEqual([]);
    expect(normalizeExploreInvestigationItemsPayload({ items: "not-an-array" })).toEqual([]);
    expect(normalizeExploreInvestigationItemsPayload({})).toEqual([]);
  });
});
