import {
  CandidateLifecycleStatus,
  InvestigationStatus,
  InvestigationVisibility,
  UnderstandingLinkTargetType,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildPublicActiveInvestigationWhere } from "../investigation-public-visibility";
import { isEvidenceLinkTargetPublicEligible } from "../understanding-evidence-link-public-eligibility";

describe("Investigation candidate lifecycle/publish public safety", () => {
  it("buildPublicActiveInvestigationWhere excludes internal proposed investigations", () => {
    const where = buildPublicActiveInvestigationWhere({ userId: "user-1" });

    expect(where).toEqual({
      userId: "user-1",
      visibility: InvestigationVisibility.user_visible,
      status: { in: expect.any(Array) },
      OR: [{ candidateLifecycleStatus: null }, { candidateLifecycleStatus: "promoted" }],
    });

    expect(where.OR).not.toContainEqual({
      candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
    });
    expect(where.visibility).toBe(InvestigationVisibility.user_visible);
  });

  it("buildPublicActiveInvestigationWhere includes published promoted investigations", () => {
    const where = buildPublicActiveInvestigationWhere({
      userId: "user-1",
      id: "inv-published",
    });

    expect(where).toMatchObject({
      userId: "user-1",
      id: "inv-published",
      visibility: InvestigationVisibility.user_visible,
      OR: [{ candidateLifecycleStatus: null }, { candidateLifecycleStatus: "promoted" }],
    });
  });

  it("evidence-link eligibility excludes internal proposed investigation targets", async () => {
    const db = {
      investigation: {
        findMany: async () => [],
      },
    };

    const eligible = await isEvidenceLinkTargetPublicEligible({
      userId: "user-1",
      targetType: UnderstandingLinkTargetType.investigation,
      targetId: "inv-internal-proposed",
      db: db as never,
    });

    expect(eligible).toBe(false);
  });

  it("evidence-link eligibility allows published promoted investigation targets", async () => {
    const db = {
      investigation: {
        findMany: async () => [{ id: "inv-published" }],
      },
    };

    const eligible = await isEvidenceLinkTargetPublicEligible({
      userId: "user-1",
      targetType: UnderstandingLinkTargetType.investigation,
      targetId: "inv-published",
      db: db as never,
    });

    expect(eligible).toBe(true);
  });

  it("documents published investigation shape expected by public guards", () => {
    const publishedInvestigation = {
      visibility: InvestigationVisibility.user_visible,
      candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
      status: InvestigationStatus.open,
    };

    expect(publishedInvestigation.visibility).toBe(InvestigationVisibility.user_visible);
    expect(publishedInvestigation.candidateLifecycleStatus).toBe(
      CandidateLifecycleStatus.promoted
    );
    expect(publishedInvestigation.status).toBe(InvestigationStatus.open);
  });
});
