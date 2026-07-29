/**
 * Phase 5 — current-understanding API route contract.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const readProjectionMock = vi.fn();
const readConceptMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

vi.mock("../prismadb", () => ({
  default: {},
}));

vi.mock("../current-understanding-product-projection", () => ({
  readCurrentUnderstandingProductProjection: (...args: unknown[]) =>
    readProjectionMock(...args),
  readCanonicalProductConceptForUser: (...args: unknown[]) =>
    readConceptMock(...args),
}));

import { CanonicalModelAuthorityError } from "../canonical-model-authority-errors";
import { GET as getCurrentUnderstanding } from "../../app/api/current-understanding/route";
import { GET as getCanonicalConcept } from "../../app/api/current-understanding/canonical-concepts/[id]/route";

describe("current-understanding route", () => {
  beforeEach(() => {
    authMock.mockReset();
    readProjectionMock.mockReset();
    readConceptMock.mockReset();
  });

  it("6. unauthenticated response is 401", async () => {
    authMock.mockResolvedValue({ userId: null });
    const response = await getCurrentUnderstanding();
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("7. API is user-scoped", async () => {
    authMock.mockResolvedValue({ userId: "user_a" });
    readProjectionMock.mockResolvedValue({
      projectionVersion: "canonical_product_projection:v1",
      userId: "user_a",
      items: [],
    });
    const response = await getCurrentUnderstanding();
    expect(response.status).toBe(200);
    expect(readProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_a" }),
    );
    const body = await response.json();
    expect(body.userId).toBe("user_a");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("8. does not consult feature-gate env (reader always invoked)", async () => {
    process.env.ORVEK_CANONICAL_MODEL_AUTHORITY_V1 = "0";
    delete process.env.ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS;
    authMock.mockResolvedValue({ userId: "user_a" });
    readProjectionMock.mockResolvedValue({
      projectionVersion: "canonical_product_projection:v1",
      userId: "user_a",
      items: [
        {
          authorityType: "canonical_concept_revision",
          conceptId: "c1",
          currentRevisionId: "r2",
          version: 2,
          title: "t",
          summary: "REVISION TWO",
          status: "emerging",
          confidenceScore: 0.5,
          confidenceLevel: "medium",
          evidenceCount: 1,
          rationale: null,
          acceptedAt: "2026-07-28T12:00:00.000Z",
          domain: "operating_logic",
          legacySeed: { objectType: "usermap_conclusion", objectId: "umc1" },
          evidence: [],
          revisionHistory: [],
          movementHistory: [],
          capabilities: {
            inspectEvidence: true,
            inspectMovementHistory: true,
            supportedWriteOperations: [],
          },
        },
      ],
    });
    const response = await getCurrentUnderstanding();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0].summary).toBe("REVISION TWO");
  });

  it("9. canonical corruption fails closed without legacy-only payload", async () => {
    authMock.mockResolvedValue({ userId: "user_a" });
    readProjectionMock.mockRejectedValue(
      new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PROJECTION",
        "broken pointer",
      ),
    );
    const response = await getCurrentUnderstanding();
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.code).toBe("canonical_model_unavailable");
    expect(body).not.toHaveProperty("items");
  });

  it("canonical concept detail returns 404 for missing/cross-user", async () => {
    authMock.mockResolvedValue({ userId: "user_a" });
    readConceptMock.mockResolvedValue("not_found");
    const response = await getCanonicalConcept(new Request("http://local"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("canonical concept detail fails closed on corruption", async () => {
    authMock.mockResolvedValue({ userId: "user_a" });
    readConceptMock.mockRejectedValue(
      new CanonicalModelAuthorityError(
        "BROKEN_CANONICAL_PROJECTION",
        "broken chain",
      ),
    );
    const response = await getCanonicalConcept(new Request("http://local"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.code).toBe("canonical_model_unavailable");
  });

  it("canonical concept detail 401 includes no-store", async () => {
    authMock.mockResolvedValue({ userId: null });
    const response = await getCanonicalConcept(new Request("http://local"), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
