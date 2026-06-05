import {
  CandidateLifecycleStatus,
  FieldworkAssignmentVisibility,
  FieldworkStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildPublicWatchForWhere } from "../fieldwork-public-visibility";
import { buildWhatChangedAffectedObjectHref } from "../public-intelligence-safe-slice";

const prismaMock = {
  fieldworkAssignment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
};

vi.mock("../prismadb", () => ({
  default: prismaMock,
}));

describe("Fieldwork candidate lifecycle/publish public safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.fieldworkAssignment.findMany.mockResolvedValue([]);
    prismaMock.fieldworkAssignment.findFirst.mockResolvedValue(null);
  });

  it("buildPublicWatchForWhere excludes internal proposed rows", () => {
    const publicWhere = buildPublicWatchForWhere({ userId: "user-1" });

    expect(publicWhere.visibility).toBe(FieldworkAssignmentVisibility.user_visible);
    expect(publicWhere.OR).toEqual([
      { candidateLifecycleStatus: null },
      { candidateLifecycleStatus: CandidateLifecycleStatus.promoted },
    ]);
    expect(publicWhere.status).toEqual({
      in: [FieldworkStatus.assigned, FieldworkStatus.active],
    });
    expect(publicWhere).not.toMatchObject({
      candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
    });
  });

  it("buildPublicWatchForWhere includes published promoted assigned rows", () => {
    const detailWhere = buildPublicWatchForWhere({
      userId: "user-1",
      id: "fw-published",
      status: FieldworkStatus.assigned,
    });

    expect(detailWhere).toMatchObject({
      id: "fw-published",
      userId: "user-1",
      visibility: FieldworkAssignmentVisibility.user_visible,
      status: FieldworkStatus.assigned,
    });
  });

  it("buildWhatChangedAffectedObjectHref maps fieldwork_assigned to /watch-for/{id}", () => {
    expect(
      buildWhatChangedAffectedObjectHref({
        affectedObjectType: "fieldwork_assignment",
        affectedObjectId: "fw-1",
      })
    ).toBe("/watch-for/fw-1");
  });

  it("evidence-link public eligibility excludes internal Fieldwork before publish", async () => {
    const { isEvidenceLinkTargetPublicEligible } = await import(
      "../understanding-evidence-link-public-eligibility"
    );

    const eligible = await isEvidenceLinkTargetPublicEligible({
      userId: "user-1",
      targetType: "fieldwork_assignment",
      targetId: "fw-internal",
      db: prismaMock as never,
    });

    expect(eligible).toBe(false);
    expect(prismaMock.fieldworkAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ...buildPublicWatchForWhere({ userId: "user-1" }),
          id: { in: ["fw-internal"] },
        }),
      })
    );
  });

  it("evidence-link public eligibility allows published Fieldwork after publish", async () => {
    prismaMock.fieldworkAssignment.findMany.mockResolvedValueOnce([{ id: "fw-public" }]);

    const { isEvidenceLinkTargetPublicEligible } = await import(
      "../understanding-evidence-link-public-eligibility"
    );

    const eligible = await isEvidenceLinkTargetPublicEligible({
      userId: "user-1",
      targetType: "fieldwork_assignment",
      targetId: "fw-public",
      db: prismaMock as never,
    });

    expect(eligible).toBe(true);
  });

});
