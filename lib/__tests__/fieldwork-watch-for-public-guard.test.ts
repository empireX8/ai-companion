import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildPublicWatchForWhere } from "../fieldwork-public-visibility";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();

const prismaMock = {
  fieldworkAssignment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
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

vi.mock("@/lib/public-linked-object-continuity", () => ({
  resolvePublicLinkedObjectHref: vi.fn().mockResolvedValue(null),
  resolvePublicLinkedObjectHrefs: vi.fn().mockResolvedValue(new Map()),
  linkedObjectHrefMapKey: vi.fn(),
}));

describe("Watch For public FieldworkAssignment leak guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.fieldworkAssignment.findMany.mockResolvedValue([]);
    prismaMock.fieldworkAssignment.findFirst.mockResolvedValue(null);
  });

  it("queries only user_visible fieldworkAssignments with null or promoted candidate lifecycle", async () => {
    const route = await import("../../app/api/watch-for/route");
    await route.GET();

    expect(prismaMock.fieldworkAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildPublicWatchForWhere({ userId: "user-1" }),
      })
    );
  });

  it("returns empty list when DB has no public-eligible rows (internal/proposed excluded by query)", async () => {
    prismaMock.fieldworkAssignment.findMany.mockResolvedValueOnce([]);

    const route = await import("../../app/api/watch-for/route");
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ items: [] });
  });

  it("returns 404 for detail when fieldworkAssignment is internal_only or candidate-proposed", async () => {
    const detailRoute = await import("../../app/api/watch-for/[id]/route");
    const response = await detailRoute.GET(
      new Request("http://localhost/api/watch-for/fw-internal"),
      { params: Promise.resolve({ id: "fw-internal" }) }
    );

    expect(response.status).toBe(404);
    expect(prismaMock.fieldworkAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildPublicWatchForWhere({
          userId: "user-1",
          id: "fw-internal",
        }),
      })
    );
  });

  it("returns 404 for evidence when fieldworkAssignment fails public guard", async () => {
    const evidenceRoute = await import(
      "../../app/api/watch-for/[id]/evidence/route"
    );
    const response = await evidenceRoute.GET(
      new Request("http://localhost/api/watch-for/fw-proposed/evidence"),
      { params: Promise.resolve({ id: "fw-proposed" }) }
    );

    expect(response.status).toBe(404);
    expect(prismaMock.fieldworkAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildPublicWatchForWhere({
          userId: "user-1",
          id: "fw-proposed",
        }),
      })
    );
  });
});
