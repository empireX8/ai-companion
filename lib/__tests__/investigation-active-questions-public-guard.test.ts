import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildPublicActiveInvestigationWhere } from "../investigation-public-visibility";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();

const prismaMock = {
  investigation: {
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
}));

describe("Active Questions public Investigation leak guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    prismaMock.investigation.findMany.mockResolvedValue([]);
    prismaMock.investigation.findFirst.mockResolvedValue(null);
  });

  it("queries only user_visible investigations with null or promoted candidate lifecycle", async () => {
    const route = await import("../../app/api/active-questions/route");
    await route.GET();

    expect(prismaMock.investigation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildPublicActiveInvestigationWhere({ userId: "user-1" }),
      })
    );
  });

  it("returns empty list when DB has no public-eligible rows (internal/proposed excluded by query)", async () => {
    prismaMock.investigation.findMany.mockResolvedValueOnce([]);

    const route = await import("../../app/api/active-questions/route");
    const response = await route.GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ items: [] });
  });

  it("returns 404 for detail when investigation is internal_only or candidate-proposed", async () => {
    const detailRoute = await import("../../app/api/active-questions/[id]/route");
    const response = await detailRoute.GET(
      new Request("http://localhost/api/active-questions/inv-internal"),
      { params: Promise.resolve({ id: "inv-internal" }) }
    );

    expect(response.status).toBe(404);
    expect(prismaMock.investigation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildPublicActiveInvestigationWhere({
          userId: "user-1",
          id: "inv-internal",
        }),
      })
    );
  });

  it("returns 404 for evidence when investigation fails public guard", async () => {
    const evidenceRoute = await import(
      "../../app/api/active-questions/[id]/evidence/route"
    );
    const response = await evidenceRoute.GET(
      new Request("http://localhost/api/active-questions/inv-proposed/evidence"),
      { params: Promise.resolve({ id: "inv-proposed" }) }
    );

    expect(response.status).toBe(404);
    expect(prismaMock.investigation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: buildPublicActiveInvestigationWhere({
          userId: "user-1",
          id: "inv-proposed",
        }),
      })
    );
  });
});
