import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authMock = vi.fn();
const buildDetailMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/what-changed-reality-report", () => ({
  buildWhatChangedInspectorDetail: buildDetailMock,
}));

function makeReport() {
  return {
    contractVersion: "orvek-reality-tracking-output-v0.9",
    promptVersion: "orvek-reality-tracking-model-movement-v1",
    generatedAt: "2026-06-27T09:00:00.000Z",
    generator: "deterministic_fallback" as const,
    evidencePacketSummary: {
      targetLabel: "Recovery architecture",
      targetObjectTypeLabel: "Related map item",
      dateRangeLabel: "27 Jun 2026",
      receiptCount: 3,
      sourceTypeCount: 2,
      linkedObjectCount: 2,
      linkedDecisionCount: 0,
      activeQuestionCount: 0,
      fieldworkCount: 1,
      correctionCount: 0,
      recentMovementCount: 1,
    },
    facts: {
      items: [],
      emptyState: "No direct facts are available from the linked packet yet.",
    },
    stronglySupportedClaims: {
      items: [],
      emptyState:
        "Linked evidence is not strong enough yet to promote a stronger claim beyond the stored movement.",
    },
    inferences: {
      items: [],
      emptyState: "No additional inference is justified beyond the stored movement.",
    },
    speculations: {
      items: [],
      emptyState: "No extra speculation is needed beyond the recorded uncertainty.",
    },
    overreachGuardrails: {
      items: [],
      emptyState: null,
    },
    loopPatternDetection: {
      items: [],
      emptyState: "No repeat structure is visible from the linked packet yet.",
    },
    modelMovement: {
      items: [],
      emptyState: "No additional movement detail is available beyond the stored update.",
      before: "Earlier view",
      after: "Newer view",
      confidenceShift: 0.2,
    },
    realityGate: {
      items: [],
      emptyState: "REALITY GATE: PENDING EVIDENCE",
    },
    fieldworkWatchFor: {
      items: [],
      emptyState: "No fieldwork is available yet.",
    },
    reentryAction: {
      items: [],
      emptyState: "No immediate re-entry action is available yet.",
    },
    whatWouldChangeThisConclusion: {
      items: [],
      emptyState: "No explicit disconfirmation condition is available yet.",
    },
  };
}

describe("/api/what-changed/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "user-1" });
    buildDetailMock.mockResolvedValue(null);
  });

  it("blocks unauthenticated requests with 401", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    const route = await import("../../app/api/what-changed/[id]/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "mu-1" }),
    });

    expect(response.status).toBe(401);
    expect(buildDetailMock).not.toHaveBeenCalled();
  });

  it("delegates to the reality-report builder and returns a structured movement report", async () => {
    buildDetailMock.mockResolvedValueOnce({
      item: {
        id: "mu-1",
        updateTypeLabel: "Conclusion Strengthened",
        affectedObjectType: "usermap_conclusion",
        affectedObjectTypeLabel: "Related map item",
        affectedObjectId: "umc-1",
        affectedObjectHref: "/your-map/umc-1",
        userFacingSummary: "The recovery pattern strengthened.",
        createdAt: "2026-06-27T09:00:00.000Z",
      },
      report: makeReport(),
    });

    const route = await import("../../app/api/what-changed/[id]/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "mu-1" }),
    });

    expect(response.status).toBe(200);
    expect(buildDetailMock).toHaveBeenCalledWith({
      userId: "user-1",
      modelUpdateId: "mu-1",
    });

    const payload = await response.json();
    expect(payload.item?.id).toBe("mu-1");
    expect(payload.item?.affectedObjectHref).toBe("/your-map/umc-1");
    expect(payload.report?.modelMovement?.before).toBe("Earlier view");
    expect(payload.report?.modelMovement?.after).toBe("Newer view");
    expect(payload.report?.modelMovement?.confidenceShift).toBe(0.2);

    const body = JSON.stringify(payload);
    expect(body).not.toContain("beforeSummary");
    expect(body).not.toContain("afterSummary");
    expect(body).not.toContain("confidenceDelta");
    expect(body).not.toContain("sourceRunId");
    expect(body).not.toContain("internalNotes");
  });

  it("returns 404 when the builder does not find an authenticated visible update", async () => {
    buildDetailMock.mockResolvedValueOnce(null);

    const route = await import("../../app/api/what-changed/[id]/route");
    const response = await route.GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "mu-hidden" }),
    });

    expect(response.status).toBe(404);
  });

  it("keeps detail route read-only and delegates heavy logic to the report builder", () => {
    const routeSource = readFileSync(
      path.join(process.cwd(), "app/api/what-changed/[id]/route.ts"),
      "utf8"
    );
    const routeBody = routeSource
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

    expect(routeSource.includes("export async function GET")).toBe(true);
    expect(routeSource.includes("export async function POST")).toBe(false);
    expect(routeSource.includes("buildWhatChangedInspectorDetail")).toBe(true);
    expect(routeBody.includes("beforeSummary")).toBe(false);
    expect(routeBody.includes("afterSummary")).toBe(false);
    expect(routeBody.includes("confidenceDelta")).toBe(false);
    expect(routeSource.includes("/api/model-updates/[id]")).toBe(false);
  });
});
