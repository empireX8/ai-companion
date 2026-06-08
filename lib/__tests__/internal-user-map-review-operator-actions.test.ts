import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  CandidateLifecycleStatus,
  FieldworkAssignmentVisibility,
  FieldworkStatus,
  InvestigationStatus,
  InvestigationVisibility,
  ModelUpdateVisibility,
  UserMapConclusionVisibility,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  canPublishInternalCandidate,
  canPublishInternalFieldworkCandidate,
  canPublishInternalInvestigationCandidate,
  canPublishInternalModelUpdateCandidate,
  formatReviewTabLabel,
  getFieldworkReviewTriageBucket,
  getInternalOperatorLifecycleActions,
  getInvestigationReviewTriageBucket,
  getModelUpdateReviewTriageBucket,
  getUserMapReviewTriageBucket,
  groupReviewCandidatesByTriage,
  internalCandidateLifecycleApiPath,
  internalCandidatePublishApiPath,
  internalFieldworkCandidateLifecycleApiPath,
  internalFieldworkCandidatePublishApiPath,
  internalInvestigationCandidateLifecycleApiPath,
  internalInvestigationCandidatePublishApiPath,
  internalModelUpdateCandidatePublishApiPath,
  isActiveQuestionVisibleInvestigationStatus,
  lifecycleActionToStatus,
  LIFECYCLE_TRIAGE_BUCKET_ORDER,
  matchesReviewTriageFilter,
  MODEL_UPDATE_TRIAGE_BUCKET_ORDER,
} from "../internal-user-map-review-operator-actions";
import { WATCH_FOR_VISIBLE_FIELDWORK_STATUSES } from "../fieldwork-status-publishability";
import { ACTIVE_QUESTION_VISIBLE_STATUSES } from "../public-intelligence-safe-slice";

describe("internal user-map review operator actions", () => {
  it("does not import server-only fieldwork publish helper", () => {
    const modulePath = fileURLToPath(
      new URL("../internal-user-map-review-operator-actions.ts", import.meta.url)
    );
    const source = readFileSync(modulePath, "utf8");

    expect(source).not.toContain("fieldwork-publish-helper");
    expect(source).not.toContain("prismadb");
  });

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
    expect(lifecycleActionToStatus("expire")).toBe(
      CandidateLifecycleStatus.expired
    );
  });

  it("exposes hold, reject, and expire for proposed candidates", () => {
    expect(
      getInternalOperatorLifecycleActions(CandidateLifecycleStatus.proposed)
    ).toEqual(["hold_for_more_evidence", "reject", "expire"]);
  });

  it("exposes promote, reject, and expire for held candidates", () => {
    expect(
      getInternalOperatorLifecycleActions(
        CandidateLifecycleStatus.held_for_more_evidence
      )
    ).toEqual(["promote", "reject", "expire"]);
  });

  it("does not expose lifecycle actions for ModelUpdate publish-only candidates", () => {
    expect(getInternalOperatorLifecycleActions(null)).toEqual([]);
    expect(
      getInternalOperatorLifecycleActions(CandidateLifecycleStatus.promoted)
    ).not.toContain("expire");
    expect(
      canPublishInternalModelUpdateCandidate({
        visibility: ModelUpdateVisibility.internal_only,
        isMeaningful: false,
        evidenceLinkCount: 1,
      })
    ).toBe(true);
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

  it("allows Fieldwork publish only for promoted internal_only Watch For-visible statuses", () => {
    for (const status of WATCH_FOR_VISIBLE_FIELDWORK_STATUSES) {
      expect(
        canPublishInternalFieldworkCandidate({
          candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
          visibility: FieldworkAssignmentVisibility.internal_only,
          status,
        })
      ).toBe(true);
    }

    expect(
      canPublishInternalFieldworkCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        visibility: FieldworkAssignmentVisibility.internal_only,
        status: FieldworkStatus.completed,
      })
    ).toBe(false);

    expect(
      canPublishInternalFieldworkCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        visibility: FieldworkAssignmentVisibility.internal_only,
        status: FieldworkStatus.dismissed,
      })
    ).toBe(false);

    expect(
      canPublishInternalFieldworkCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        visibility: FieldworkAssignmentVisibility.internal_only,
        status: FieldworkStatus.expired,
      })
    ).toBe(false);

    expect(
      canPublishInternalFieldworkCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
        visibility: FieldworkAssignmentVisibility.internal_only,
        status: FieldworkStatus.assigned,
      })
    ).toBe(false);

    expect(
      canPublishInternalFieldworkCandidate({
        candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        visibility: FieldworkAssignmentVisibility.user_visible,
        status: FieldworkStatus.assigned,
      })
    ).toBe(false);
  });

  it("builds Fieldwork internal API paths", () => {
    expect(internalFieldworkCandidateLifecycleApiPath("fw/1")).toBe(
      "/api/internal/fieldwork/candidates/fw%2F1/lifecycle"
    );
    expect(internalFieldworkCandidatePublishApiPath("fw/1")).toBe(
      "/api/internal/fieldwork/candidates/fw%2F1/publish"
    );
  });

  it("does not import server-only model update publish helper", () => {
    const modulePath = fileURLToPath(
      new URL("../internal-user-map-review-operator-actions.ts", import.meta.url)
    );
    const source = readFileSync(modulePath, "utf8");

    expect(source).not.toContain("model-update-candidate-publish-helper");
    expect(source).not.toContain("prismadb");
  });

  it("allows ModelUpdate publish only for internal_only non-meaningful candidates with evidence", () => {
    expect(
      canPublishInternalModelUpdateCandidate({
        visibility: ModelUpdateVisibility.internal_only,
        isMeaningful: false,
        evidenceLinkCount: 1,
      })
    ).toBe(true);

    expect(
      canPublishInternalModelUpdateCandidate({
        visibility: ModelUpdateVisibility.user_visible,
        isMeaningful: false,
        evidenceLinkCount: 1,
      })
    ).toBe(false);

    expect(
      canPublishInternalModelUpdateCandidate({
        visibility: ModelUpdateVisibility.internal_only,
        isMeaningful: true,
        evidenceLinkCount: 1,
      })
    ).toBe(false);

    expect(
      canPublishInternalModelUpdateCandidate({
        visibility: ModelUpdateVisibility.internal_only,
        isMeaningful: false,
        evidenceLinkCount: 0,
      })
    ).toBe(false);
  });

  it("builds ModelUpdate internal publish API path", () => {
    expect(internalModelUpdateCandidatePublishApiPath("mu/1")).toBe(
      "/api/internal/model-updates/candidates/mu%2F1/publish"
    );
  });

  it("formats review tab labels with counts and publish-ready suffix", () => {
    expect(formatReviewTabLabel("User Map", 0)).toBe("User Map");
    expect(formatReviewTabLabel("User Map", 3)).toBe("User Map (3)");
    expect(formatReviewTabLabel("User Map", 3, 1)).toBe("User Map (3) · 1 ready");
    expect(formatReviewTabLabel("ModelUpdate", 2, 0)).toBe("ModelUpdate (2)");
  });

  it("matches triage filters to lifecycle and model-update buckets", () => {
    expect(matchesReviewTriageFilter("publish_ready", "all")).toBe(true);
    expect(matchesReviewTriageFilter("needs_lifecycle", "publish_ready")).toBe(
      false
    );
    expect(matchesReviewTriageFilter("publish_ready", "publish_ready")).toBe(
      true
    );
    expect(matchesReviewTriageFilter("needs_lifecycle", "needs_action")).toBe(
      true
    );
    expect(matchesReviewTriageFilter("needs_evidence", "needs_action")).toBe(
      true
    );
    expect(matchesReviewTriageFilter("blocked", "needs_action")).toBe(false);
  });

  it("assigns lifecycle triage buckets from publish and lifecycle affordances", () => {
    expect(
      getUserMapReviewTriageBucket({
        candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        visibility: UserMapConclusionVisibility.internal_only,
      })
    ).toBe("publish_ready");

    expect(
      getUserMapReviewTriageBucket({
        candidateLifecycleStatus: CandidateLifecycleStatus.proposed,
        visibility: UserMapConclusionVisibility.internal_only,
      })
    ).toBe("needs_lifecycle");

    expect(
      getInvestigationReviewTriageBucket({
        candidateLifecycleStatus: CandidateLifecycleStatus.rejected,
        visibility: InvestigationVisibility.internal_only,
        status: InvestigationStatus.open,
      })
    ).toBe("blocked");

    expect(
      getFieldworkReviewTriageBucket({
        candidateLifecycleStatus: CandidateLifecycleStatus.promoted,
        visibility: FieldworkAssignmentVisibility.internal_only,
        status: FieldworkStatus.assigned,
      })
    ).toBe("publish_ready");
  });

  it("assigns ModelUpdate triage buckets from publish readiness and evidence", () => {
    expect(
      getModelUpdateReviewTriageBucket({
        visibility: ModelUpdateVisibility.internal_only,
        isMeaningful: false,
        evidenceLinkCount: 2,
      })
    ).toBe("publish_ready");

    expect(
      getModelUpdateReviewTriageBucket({
        visibility: ModelUpdateVisibility.internal_only,
        isMeaningful: false,
        evidenceLinkCount: 0,
      })
    ).toBe("needs_evidence");

    expect(
      getModelUpdateReviewTriageBucket({
        visibility: ModelUpdateVisibility.user_visible,
        isMeaningful: false,
        evidenceLinkCount: 1,
      })
    ).toBe("blocked");
  });

  it("groups and sorts review candidates by triage bucket", () => {
    const items = [
      { id: "older", updatedAt: "2026-05-10T10:00:00.000Z", status: "proposed" },
      { id: "newer", updatedAt: "2026-05-20T10:00:00.000Z", status: "promoted" },
    ] as const;

    const groups = groupReviewCandidatesByTriage({
      items: [...items],
      getBucket: (item) =>
        item.status === "promoted" ? "publish_ready" : "needs_lifecycle",
      filter: "all",
      bucketOrder: LIFECYCLE_TRIAGE_BUCKET_ORDER,
      getSortTimestamp: (item) => item.updatedAt,
    });

    expect(groups.map((group) => group.bucket)).toEqual([
      "publish_ready",
      "needs_lifecycle",
    ]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["newer"]);
    expect(groups[1]?.items.map((item) => item.id)).toEqual(["older"]);

    const publishReadyOnly = groupReviewCandidatesByTriage({
      items: [...items],
      getBucket: (item) =>
        item.status === "promoted" ? "publish_ready" : "needs_lifecycle",
      filter: "publish_ready",
      bucketOrder: LIFECYCLE_TRIAGE_BUCKET_ORDER,
      getSortTimestamp: (item) => item.updatedAt,
    });

    expect(publishReadyOnly).toHaveLength(1);
    expect(publishReadyOnly[0]?.bucket).toBe("publish_ready");
    expect(publishReadyOnly[0]?.items).toHaveLength(1);

    const modelUpdateGroups = groupReviewCandidatesByTriage({
      items: [
        { id: "a", createdAt: "2026-05-01T00:00:00.000Z", ready: false },
        { id: "b", createdAt: "2026-05-02T00:00:00.000Z", ready: true },
      ],
      getBucket: (item) => (item.ready ? "publish_ready" : "needs_evidence"),
      filter: "all",
      bucketOrder: MODEL_UPDATE_TRIAGE_BUCKET_ORDER,
      getSortTimestamp: (item) => item.createdAt,
    });

    expect(modelUpdateGroups[0]?.items.map((item) => item.id)).toEqual(["b"]);
  });
});
