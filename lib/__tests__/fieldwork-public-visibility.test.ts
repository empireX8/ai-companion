import { CandidateLifecycleStatus, FieldworkAssignmentVisibility } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildPublicFieldworkCandidateLifecycleOrFilter,
  buildPublicWatchForWhere,
  isPublicWatchForCandidateLifecycle,
  PUBLIC_FIELDWORK_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES,
  PUBLIC_FIELDWORK_ASSIGNMENT_VISIBILITY,
} from "../fieldwork-public-visibility";

describe("fieldwork public visibility guard", () => {
  it("pins the fail-closed public lifecycle allow-list", () => {
    expect(PUBLIC_FIELDWORK_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES).toEqual([
      null,
      CandidateLifecycleStatus.promoted,
    ]);
  });

  it("builds Watch For where with user_visible and public lifecycle allowlist", () => {
    expect(buildPublicWatchForWhere({ userId: "user-1" })).toEqual({
      userId: "user-1",
      visibility: PUBLIC_FIELDWORK_ASSIGNMENT_VISIBILITY,
      status: {
        in: ["assigned", "active"],
      },
      OR: buildPublicFieldworkCandidateLifecycleOrFilter(),
    });
    expect(PUBLIC_FIELDWORK_ASSIGNMENT_VISIBILITY).toBe(
      FieldworkAssignmentVisibility.user_visible
    );
  });

  it("scopes detail queries by fieldwork id", () => {
    expect(
      buildPublicWatchForWhere({ userId: "user-1", id: "fw-1" })
    ).toMatchObject({
      id: "fw-1",
      userId: "user-1",
      visibility: FieldworkAssignmentVisibility.user_visible,
    });
  });

  it("uses the same allow-list for Prisma OR filters and lifecycle eligibility checks", () => {
    for (const status of PUBLIC_FIELDWORK_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES) {
      expect(isPublicWatchForCandidateLifecycle(status)).toBe(true);
    }

    expect(isPublicWatchForCandidateLifecycle(undefined)).toBe(false);

    for (const status of [
      CandidateLifecycleStatus.proposed,
      CandidateLifecycleStatus.held_for_more_evidence,
      CandidateLifecycleStatus.rejected,
      CandidateLifecycleStatus.superseded,
      CandidateLifecycleStatus.expired,
    ]) {
      expect(isPublicWatchForCandidateLifecycle(status)).toBe(false);
    }
  });
});
