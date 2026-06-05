import {
  CandidateLifecycleStatus,
  InvestigationStatus,
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
  isActiveQuestionVisibleInvestigationStatus,
  lifecycleActionToStatus,
} from "../internal-user-map-review-operator-actions";
import { ACTIVE_QUESTION_VISIBLE_STATUSES } from "../public-intelligence-safe-slice";

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

  it("matches Active Questions visible investigation statuses", () => {
    for (const status of ACTIVE_QUESTION_VISIBLE_STATUSES) {
      expect(isActiveQuestionVisibleInvestigationStatus(status)).toBe(true);
    }

    expect(isActiveQuestionVisibleInvestigationStatus(InvestigationStatus.resolved)).toBe(
      false
    );
    expect(isActiveQuestionVisibleInvestigationStatus(InvestigationStatus.abandoned)).toBe(
      false
    );
  });

  it("allows Investigation publish only for promoted internal_only active-status candidates", () => {
    for (const status of ACTIVE_QUESTION_VISIBLE_STATUSES) {
      expect(
        canPublishInternalInvestigationCandidate({
          candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
          visibility: InvestigationVisibility.internal_only,
          status,
        })
      ).toBe(true);
    }

    expect(
      canPublishInternalInvestigationCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        visibility: InvestigationVisibility.internal_only,
        status: InvestigationStatus.resolved,
      })
    ).toBe(false);

    expect(
      canPublishInternalInvestigationCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        visibility: InvestigationVisibility.internal_only,
        status: InvestigationStatus.abandoned,
      })
    ).toBe(false);

    expect(
      canPublishInternalInvestigationCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        visibility: InvestigationVisibility.user_visible,
        status: InvestigationStatus.open,
      })
    ).toBe(false);

    expect(
      canPublishInternalInvestigationCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
        visibility: InvestigationVisibility.internal_only,
        status: InvestigationStatus.open,
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
