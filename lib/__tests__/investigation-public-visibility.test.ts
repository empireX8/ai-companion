import { CandidateLifecycleStatus, InvestigationVisibility } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildPublicActiveInvestigationWhere,
  isPublicActiveInvestigationCandidateLifecycle,
  PUBLIC_INVESTIGATION_EXCLUDED_CANDIDATE_LIFECYCLE_STATUSES,
  PUBLIC_INVESTIGATION_VISIBILITY,
} from "../investigation-public-visibility";

describe("investigation public visibility guard", () => {
  it("builds Active Questions where with user_visible and public lifecycle allowlist", () => {
    expect(buildPublicActiveInvestigationWhere({ userId: "user-1" })).toEqual({
      userId: "user-1",
      visibility: PUBLIC_INVESTIGATION_VISIBILITY,
      status: {
        in: ["open", "gathering_evidence", "testing", "resolving", "reopened"],
      },
      OR: [
        { candidateLifecycleStatus: null },
        { candidateLifecycleStatus: CandidateLifecycleStatus.promoted },
      ],
    });
    expect(PUBLIC_INVESTIGATION_VISIBILITY).toBe(
      InvestigationVisibility.user_visible
    );
  });

  it("scopes detail queries by investigation id", () => {
    expect(
      buildPublicActiveInvestigationWhere({ userId: "user-1", id: "inv-1" })
    ).toMatchObject({
      id: "inv-1",
      userId: "user-1",
      visibility: InvestigationVisibility.user_visible,
    });
  });

  it("excludes internal candidate lifecycle states from public eligibility", () => {
    expect(PUBLIC_INVESTIGATION_EXCLUDED_CANDIDATE_LIFECYCLE_STATUSES).toEqual([
      CandidateLifecycleStatus.proposed,
      CandidateLifecycleStatus.held_for_more_evidence,
      CandidateLifecycleStatus.rejected,
      CandidateLifecycleStatus.superseded,
      CandidateLifecycleStatus.expired,
    ]);

    expect(isPublicActiveInvestigationCandidateLifecycle(null)).toBe(true);
    expect(
      isPublicActiveInvestigationCandidateLifecycle(
        CandidateLifecycleStatus.promoted
      )
    ).toBe(true);
    expect(
      isPublicActiveInvestigationCandidateLifecycle(
        CandidateLifecycleStatus.proposed
      )
    ).toBe(false);
    expect(
      isPublicActiveInvestigationCandidateLifecycle(
        CandidateLifecycleStatus.held_for_more_evidence
      )
    ).toBe(false);
    expect(
      isPublicActiveInvestigationCandidateLifecycle(
        CandidateLifecycleStatus.rejected
      )
    ).toBe(false);
    expect(
      isPublicActiveInvestigationCandidateLifecycle(
        CandidateLifecycleStatus.superseded
      )
    ).toBe(false);
    expect(
      isPublicActiveInvestigationCandidateLifecycle(
        CandidateLifecycleStatus.expired
      )
    ).toBe(false);
  });
});
