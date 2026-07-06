import { CandidateLifecycleStatus, InvestigationVisibility } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildPublicActiveInvestigationWhere,
  buildPublicExploreInvestigationWhere,
  buildPublicInvestigationCandidateLifecycleOrFilter,
  EXPLORE_INVESTIGATION_VISIBLE_STATUSES,
  isPublicActiveInvestigationCandidateLifecycle,
  PUBLIC_INVESTIGATION_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES,
  PUBLIC_INVESTIGATION_VISIBILITY,
} from "../investigation-public-visibility";

describe("investigation public visibility guard", () => {
  it("pins the fail-closed public lifecycle allow-list", () => {
    expect(PUBLIC_INVESTIGATION_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES).toEqual([
      null,
      CandidateLifecycleStatus.promoted,
    ]);
  });

  it("builds Active Questions where with user_visible and public lifecycle allowlist", () => {
    expect(buildPublicActiveInvestigationWhere({ userId: "user-1" })).toEqual({
      userId: "user-1",
      visibility: PUBLIC_INVESTIGATION_VISIBILITY,
      status: {
        in: ["open", "gathering_evidence", "testing", "resolving", "reopened"],
      },
      OR: buildPublicInvestigationCandidateLifecycleOrFilter(),
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

  it("builds Explore Investigations where with complementary statuses only", () => {
    expect(EXPLORE_INVESTIGATION_VISIBLE_STATUSES).toEqual(["resolved", "abandoned"]);
    expect(buildPublicExploreInvestigationWhere({ userId: "user-1" })).toEqual({
      userId: "user-1",
      visibility: PUBLIC_INVESTIGATION_VISIBILITY,
      status: {
        notIn: ["open", "gathering_evidence", "testing", "resolving", "reopened"],
      },
      OR: buildPublicInvestigationCandidateLifecycleOrFilter(),
    });
  });

  it("scopes Explore Investigations detail queries by investigation id", () => {
    expect(
      buildPublicExploreInvestigationWhere({ userId: "user-1", id: "inv-resolved-1" })
    ).toMatchObject({
      id: "inv-resolved-1",
      userId: "user-1",
      visibility: InvestigationVisibility.user_visible,
      status: {
        notIn: ["open", "gathering_evidence", "testing", "resolving", "reopened"],
      },
    });
  });

  it("uses the same allow-list for Prisma OR filters and lifecycle eligibility checks", () => {
    for (const status of PUBLIC_INVESTIGATION_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES) {
      expect(isPublicActiveInvestigationCandidateLifecycle(status)).toBe(true);
    }

    expect(isPublicActiveInvestigationCandidateLifecycle(undefined)).toBe(false);

    for (const status of [
      CandidateLifecycleStatus.proposed,
      CandidateLifecycleStatus.held_for_more_evidence,
      CandidateLifecycleStatus.rejected,
      CandidateLifecycleStatus.superseded,
      CandidateLifecycleStatus.expired,
    ]) {
      expect(isPublicActiveInvestigationCandidateLifecycle(status)).toBe(false);
    }
  });
});
