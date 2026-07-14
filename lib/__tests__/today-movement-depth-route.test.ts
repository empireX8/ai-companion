import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();

const prismaMock = {
  modelUpdate: {
    findMany: vi.fn(),
  },
  understandingEvidenceLink: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
};

const applyVerifiedMock = vi.fn(async ({ items }: { items: unknown[] }) => items);

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
  applyVerifiedAffectedObjectHrefs: applyVerifiedMock,
}));

vi.mock("../public-linked-object-continuity", () => ({
  applyVerifiedAffectedObjectHrefs: applyVerifiedMock,
}));

describe("/api/today/movement-depth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user_test" });
    prismaMock.modelUpdate.findMany.mockResolvedValue([]);
    prismaMock.understandingEvidenceLink.count.mockResolvedValue(0);
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([]);
  });

  it("requires auth", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const route = await import("../../app/api/today/movement-depth/route");
    const response = await route.GET(new Request("http://localhost/api/today/movement-depth"));
    expect(response.status).toBe(401);
  });

  it("returns workbench depth using before/after/rationale field names only", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValue([
      {
        id: "mu-1",
        updateType: "link_detected",
        affectedObjectType: "pattern_claim",
        affectedObjectId: "pc-1",
        userFacingSummary: "Pattern strengthened.",
        beforeSummary: "Tentative only.",
        afterSummary: "Supported by three receipts.",
        internalNotes: "movementRationale::Receipts align across two weeks.",
        createdAt: new Date("2026-06-20T10:00:00.000Z"),
      },
    ]);
    prismaMock.understandingEvidenceLink.count.mockResolvedValue(2);
    prismaMock.understandingEvidenceLink.findMany.mockResolvedValue([
      {
        targetId: "mu-1",
        summary: "I keep working past the stop point.",
      },
    ]);

    const route = await import("../../app/api/today/movement-depth/route");
    const response = await route.GET(new Request("http://localhost/api/today/movement-depth"));
    const payload = (await response.json()) as {
      items: Array<{
        before: string | null;
        after: string | null;
        movementRationale: string | null;
        evidenceQuotes?: string[];
      }>;
    };

    expect(response.status).toBe(200);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.before).toBe("Tentative only.");
    expect(payload.items[0]?.after).toBe("Supported by three receipts.");
    expect(payload.items[0]?.movementRationale).toBe("Receipts align across two weeks.");
    expect(payload.items[0]?.evidenceQuotes).toEqual(["I keep working past the stop point."]);
  });

  it("returns fixture user depth only for the authenticated owner", async () => {
    const fixtureRow = {
      id: "mu-fixture-owner",
      updateType: "link_detected",
      affectedObjectType: "pattern_claim",
      affectedObjectId: "pc-fixture",
      userFacingSummary: "Fixture movement.",
      beforeSummary: "Before fixture.",
      afterSummary: "After fixture.",
      internalNotes: "movementRationale::Fixture rationale.",
      createdAt: new Date("2026-06-20T10:00:00.000Z"),
    };

    authMock.mockResolvedValueOnce({ userId: "user_fixture" });
    prismaMock.modelUpdate.findMany.mockImplementation(
      async ({ where }: { where: { userId: string; id?: { in: string[] } } }) => {
        if (where.userId !== "user_fixture") {
          return [];
        }
        if (where.id?.in?.length && !where.id.in.includes("mu-fixture-owner")) {
          return [];
        }
        return [fixtureRow];
      },
    );
    prismaMock.understandingEvidenceLink.count.mockResolvedValue(1);

    const route = await import("../../app/api/today/movement-depth/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/today/movement-depth?ids=mu-fixture-owner",
      ),
    );
    const payload = (await response.json()) as { items: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.id).toBe("mu-fixture-owner");
    expect(prismaMock.modelUpdate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user_fixture" }),
      }),
    );
  });

  it("does not return another user's movement depth rows", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_other" });
    prismaMock.modelUpdate.findMany.mockResolvedValue([]);

    const route = await import("../../app/api/today/movement-depth/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/today/movement-depth?ids=mu-fixture-owner",
      ),
    );
    const payload = (await response.json()) as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(payload.items).toEqual([]);
    expect(prismaMock.modelUpdate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user_other" }),
      }),
    );
  });

  it("returns an honest empty result for unknown ids", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValue([]);

    const route = await import("../../app/api/today/movement-depth/route");
    const response = await route.GET(
      new Request(
        "http://localhost/api/today/movement-depth?ids=unknown-missing-id",
      ),
    );
    const payload = (await response.json()) as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(payload.items).toEqual([]);
  });

  it("returns an honest empty result for malformed id params", async () => {
    prismaMock.modelUpdate.findMany.mockResolvedValue([]);

    const route = await import("../../app/api/today/movement-depth/route");
    const response = await route.GET(
      new Request("http://localhost/api/today/movement-depth?ids=,,,  "),
    );
    const payload = (await response.json()) as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(payload.items).toEqual([]);
  });
});
