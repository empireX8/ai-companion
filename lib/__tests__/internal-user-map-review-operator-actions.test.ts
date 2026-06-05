import {
  CandidateLifecycleStatus,
  InvestigationVisibility,
  UserMapConclusionVisibility,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  canPublishInternalCandidate,
  canPublishInternalInvestigationCandidate,
  getInternalOperatorLifecycleActions,
  internalCandidateLifecycleApiPath,
  internalCandidatePublishApiPath,
  internalInvestigationCandidateLifecycleApiPath,
  internalInvestigationCandidatePublishApiPath,
  lifecycleActionToStatus,
} from "../internal-user-map-review-operator-actions";

describe("internal user-map review operator actions", () => {
  it("maps operator actions to lifecycle statuses", () => {
    expect(lifecycleActionToStatus("promote")).toBe(
      CandidateLifecycleStatus.promoted
    );
    expect(lifecycleActionToStatus("hold_for_more_evidence")).toBe(
      CandidateLifecycleStatus.held_for_more_evidence
    );
    expect(lifecycleActionToStatus("reject")).toBe(
      CandidateLifecycleStatus.rejected
    );
  });

  it("exposes hold and reject for proposed candidates", () => {
    expect(
      getInternalOperatorLifecycleActions(CandidateLifecycleStatus.proposed)
    ).toEqual(["hold_for_more_evidence", "reject"]);
  });

  it("exposes promote and reject for held candidates", () => {
    expect(
      getInternalOperatorLifecycleActions(
        CandidateLifecycleStatus.held_for_more_evidence
      )
    ).toEqual(["promote", "reject"]);
  });

  it("allows publish only for promoted internal_only candidates", () => {
    expect(
      canPublishInternalCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        visibility: UserMapConclusionVisibility.internal_only,
      })
    ).toBe(true);

    expect(
      canPublishInternalCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
        visibility: UserMapConclusionVisibility.internal_only,
      })
    ).toBe(false);

    expect(
      canPublishInternalCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        visibility: UserMapConclusionVisibility.user_visible,
      })
    ).toBe(false);
  });

  it("builds internal-only API paths", () => {
    expect(internalCandidateLifecycleApiPath("abc/123")).toBe(
      "/api/internal/user-map/candidates/abc%2F123/lifecycle"
    );
    expect(internalCandidatePublishApiPath("abc/123")).toBe(
      "/api/internal/user-map/candidates/abc%2F123/publish"
    );
  });

  it("allows Investigation publish only for promoted internal_only candidates", () => {
    expect(
      canPublishInternalInvestigationCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        visibility: InvestigationVisibility.internal_only,
      })
    ).toBe(true);

    expect(
      canPublishInternalInvestigationCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
        visibility: InvestigationVisibility.internal_only,
      })
    ).toBe(false);
  });

  it("builds Investigation internal API paths", () => {
    expect(internalInvestigationCandidateLifecycleApiPath("inv/1")).toBe(
      "/api/internal/investigations/candidates/inv%2F1/lifecycle"
    );
    expect(internalInvestigationCandidatePublishApiPath("inv/1")).toBe(
      "/api/internal/investigations/candidates/inv%2F1/publish"
    );
  });
});
