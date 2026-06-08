import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import {
  InternalUserMapReviewWorkbench,
  candidateHasPendingAction,
  endPendingAction,
  startPendingAction,
} from "../../app/(root)/(routes)/internal/user-map/review/_components/InternalUserMapReviewWorkbench";
import { lifecycleActionToStatus } from "../internal-user-map-review-operator-actions";
import type { InternalFieldworkReviewCandidate } from "../internal-fieldwork-review-candidates";
import type { InternalInvestigationReviewCandidate } from "../internal-investigation-review-candidates";
import type { InternalModelUpdateReviewCandidate } from "../internal-model-update-review-candidates";
import type { InternalUserMapReviewCandidate } from "../internal-user-map-review-candidates";

const baseCandidate: InternalUserMapReviewCandidate = {
  id: "umc-1",
  title: "Candidate title",
  summary: "Candidate summary",
  area: "operating_logic",
  status: "emerging",
  confidenceLevel: "low",
  visibility: "internal_only",
  candidateLifecycleStatus: "proposed",
  createdAt: "2026-05-15T10:00:00.000Z",
  updatedAt: "2026-05-15T11:00:00.000Z",
  evidence: {
    linkCount: 1,
    sourceTypes: { message: 1 },
    safetyLevels: { internal_only: 1 },
    linkedSources: [
      {
        sourceType: "message",
        sourceId: "msg-1",
        safetyLevel: "internal_only",
      },
    ],
  },
  diagnostics: {
    latestRunId: "run-1",
    latestArtifactId: "artifact-1",
    latestArtifactType: "understanding_dark_engine_diagnostics",
    processorVersion: "understanding-dark-engine-v1",
    blockedWriteReasons: [],
    warnings: [],
  },
};

const baseInvestigationCandidate: InternalInvestigationReviewCandidate = {
  id: "inv-1",
  title: "Investigation title",
  organizingQuestion: "What pattern is active?",
  summary: "Need more weekend signal",
  status: "open",
  seedType: "pattern",
  visibility: "internal_only",
  candidateLifecycleStatus: "proposed",
  createdAt: "2026-05-15T10:00:00.000Z",
  updatedAt: "2026-05-15T11:00:00.000Z",
  evidence: {
    linkCount: 1,
    sourceTypes: { pattern_claim: 1 },
    safetyLevels: { safe_summary: 1 },
    linkedSources: [
      {
        sourceType: "pattern_claim",
        sourceId: "pc-1",
        safetyLevel: "safe_summary",
      },
    ],
  },
  diagnostics: {
    latestRunId: null,
    latestArtifactId: null,
    latestArtifactType: null,
    processorVersion: null,
    blockedWriteReasons: [],
    warnings: [],
  },
};

const baseFieldworkCandidate: InternalFieldworkReviewCandidate = {
  id: "fw-1",
  prompt: "Watch for Sunday evening tension",
  reason: "Weekend pattern may need more signal",
  status: "assigned",
  visibility: "internal_only",
  candidateLifecycleStatus: "proposed",
  linkedObjectType: "pattern_claim",
  linkedObjectId: "pc-1",
  expiresAt: null,
  createdAt: "2026-05-15T10:00:00.000Z",
  updatedAt: "2026-05-15T11:00:00.000Z",
  evidence: {
    linkCount: 1,
    sourceTypes: { message: 1 },
    safetyLevels: { internal_only: 1 },
    linkedSources: [
      {
        sourceType: "message",
        sourceId: "msg-1",
        safetyLevel: "internal_only",
      },
    ],
  },
  diagnostics: {
    latestRunId: null,
    latestArtifactId: null,
    latestArtifactType: null,
    processorVersion: null,
    blockedWriteReasons: [],
    warnings: [],
  },
};

const baseModelUpdateCandidate: InternalModelUpdateReviewCandidate = {
  id: "mu-1",
  updateType: "conclusion_strengthened",
  userFacingSummary: "Confidence increased on operating logic",
  affectedObjectType: "usermap_conclusion",
  affectedObjectId: "umc-1",
  beforeSummary: "Emerging pattern",
  afterSummary: "Supported pattern",
  confidenceDelta: 0.15,
  visibility: "internal_only",
  isMeaningful: false,
  sourceRunId: "run-1",
  createdAt: "2026-05-15T10:00:00.000Z",
  evidence: {
    linkCount: 1,
    sourceTypes: { message: 1 },
    safetyLevels: { internal_only: 1 },
    linkedSources: [
      {
        sourceType: "message",
        sourceId: "msg-1",
        safetyLevel: "internal_only",
      },
    ],
  },
  diagnostics: {
    latestRunId: "run-1",
    latestArtifactId: "artifact-1",
    latestArtifactType: "understanding_dark_engine_diagnostics",
    processorVersion: "understanding-dark-engine-v1",
    blockedWriteReasons: [],
    warnings: [],
  },
};

describe("InternalUserMapReviewWorkbench", () => {
  it("renders lifecycle status and operator buttons for proposed User Map candidates", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[baseCandidate]}
        investigationCandidates={[]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[]}
      />
    );

    expect(html).toContain("User Map (1)");
    expect(html).toContain("Investigation");
    expect(html).toContain("Needs lifecycle review");
    expect(html).toContain("Showing 1 of 1");
    expect(html).toContain('data-testid="review-filter-bar-usermap"');
    expect(html).toContain('id="review-tab-usermap"');
    expect(html).toContain('aria-controls="review-panel-usermap"');
    expect(html).toContain('id="review-panel-usermap"');
    expect(html).toContain('aria-labelledby="review-tab-usermap"');
    expect(html).toContain("Lifecycle status");
    expect(html).toContain("proposed");
    expect(html).toContain("Evidence / Provenance");
    expect(html).toContain("Linked evidence count");
    expect(html).toContain("message: 1");
    expect(html).toContain("Hold for more evidence");
    expect(html).toContain("Reject");
    expect(html).toContain("Expire");
    expect(html).not.toContain("Promote");
    expect(html).not.toContain("Publish");
    expect(html).not.toContain("quote");
    expect(html).not.toContain("snippet");
    expect(html).toContain('id="review-tab-fieldwork"');
    expect(html).not.toContain("Watch for Sunday evening tension");
  });

  it("renders empty provenance state without crashing", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[
          {
            ...baseCandidate,
            id: "umc-empty",
            evidence: {
              linkCount: 0,
              sourceTypes: {},
              safetyLevels: {},
              linkedSources: [],
            },
            diagnostics: {
              latestRunId: null,
              latestArtifactId: null,
              latestArtifactType: null,
              processorVersion: null,
              blockedWriteReasons: [],
              warnings: [],
            },
          },
        ]}
        investigationCandidates={[]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[]}
      />
    );

    expect(html).toContain("No provenance metadata recorded for this candidate.");
    expect(html).toContain("Hold for more evidence");
  });

  it("renders promote for held candidates and publish for promoted candidates", () => {
    const heldHtml = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[
          {
            ...baseCandidate,
            candidateLifecycleStatus: "held_for_more_evidence",
          },
        ]}
        investigationCandidates={[]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[]}
      />
    );

    expect(heldHtml).toContain("Promote");
    expect(heldHtml).toContain("Reject");
    expect(heldHtml).toContain("Expire");
    expect(heldHtml).not.toContain("Publish");

    const promotedHtml = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[
          {
            ...baseCandidate,
            id: "umc-promoted",
            candidateLifecycleStatus: "promoted",
          },
        ]}
        investigationCandidates={[]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[]}
      />
    );

    expect(promotedHtml).toContain("Publish");
    expect(promotedHtml).toContain("Publish to user-visible surface");
    expect(promotedHtml).toContain("Ready to publish");
    expect(promotedHtml).not.toContain("Hold for more evidence");
    expect(promotedHtml).not.toContain("Reject");
    expect(promotedHtml).not.toContain("Expire");
  });

  it("does not render lifecycle actions for legacy null lifecycle rows", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[
          {
            ...baseCandidate,
            candidateLifecycleStatus: null,
          },
        ]}
        investigationCandidates={[]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[]}
      />
    );

    expect(html).toContain("Not lifecycle-managed (legacy)");
    expect(html).toContain("Lifecycle actions are unavailable");
    expect(html).not.toContain("Hold for more evidence");
    expect(html).not.toContain("Reject");
    expect(html).not.toContain("Expire");
  });

  it("maps Expire to expired lifecycle status for operator pending keys", () => {
    expect(lifecycleActionToStatus("expire")).toBe("expired");

    const pending = startPendingAction(new Set(), "umc-1:lifecycle:expired");
    expect(candidateHasPendingAction(pending, "umc-1")).toBe(true);

    const cleared = endPendingAction(pending, "umc-1:lifecycle:expired");
    expect(candidateHasPendingAction(cleared, "umc-1")).toBe(false);
  });

  it("renders Investigation candidates and actions on the Investigation tab", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[]}
        investigationCandidates={[baseInvestigationCandidate]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[]}
        initialTab="investigation"
      />
    );

    expect(html).toContain('id="review-tab-investigation"');
    expect(html).toContain('aria-controls="review-panel-investigation"');
    expect(html).toContain('id="review-panel-investigation"');
    expect(html).toContain('aria-labelledby="review-tab-investigation"');
    expect(html).toContain("Investigation title");
    expect(html).toContain("What pattern is active?");
    expect(html).toContain("Need more weekend signal");
    expect(html).toContain("Seed type");
    expect(html).toContain("pattern");
    expect(html).toContain("Hold for more evidence");
    expect(html).toContain("Reject");
    expect(html).toContain("Expire");
    expect(html).not.toContain("Candidate title");
    expect(html).not.toContain("Watch for Sunday evening tension");
  });

  it("renders Investigation publish for promoted internal_only open candidates", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[]}
        investigationCandidates={[
          {
            ...baseInvestigationCandidate,
            candidateLifecycleStatus: "promoted",
            status: "open",
          },
        ]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[]}
        initialTab="investigation"
      />
    );

    expect(html).toContain("Publish");
    expect(html).not.toContain("Hold for more evidence");
  });

  it("does not render Investigation publish for promoted non-public statuses", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[]}
        investigationCandidates={[
          {
            ...baseInvestigationCandidate,
            candidateLifecycleStatus: "promoted",
            status: "resolved",
          },
        ]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[]}
        initialTab="investigation"
      />
    );

    expect(html).not.toContain("Publish");
  });

  it("tracks pending actions independently per candidate", () => {
    const pending = startPendingAction(new Set(), "umc-1:lifecycle:rejected");

    expect(candidateHasPendingAction(pending, "umc-1")).toBe(true);
    expect(candidateHasPendingAction(pending, "umc-2")).toBe(false);

    const withSecond = startPendingAction(pending, "inv-2:publish");
    expect(candidateHasPendingAction(withSecond, "umc-1")).toBe(true);
    expect(candidateHasPendingAction(withSecond, "inv-2")).toBe(true);

    const afterFirst = endPendingAction(withSecond, "umc-1:lifecycle:rejected");
    expect(candidateHasPendingAction(afterFirst, "umc-1")).toBe(false);
    expect(candidateHasPendingAction(afterFirst, "inv-2")).toBe(true);
  });

  it("renders Fieldwork candidates and actions on the Fieldwork tab", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[]}
        investigationCandidates={[]}
        fieldworkCandidates={[baseFieldworkCandidate]}
        modelUpdateCandidates={[]}
        initialTab="fieldwork"
      />
    );

    expect(html).toContain('id="review-tab-fieldwork"');
    expect(html).toContain('aria-controls="review-panel-fieldwork"');
    expect(html).toContain('id="review-panel-fieldwork"');
    expect(html).toContain('aria-labelledby="review-tab-fieldwork"');
    expect(html).toContain("Watch for Sunday evening tension");
    expect(html).toContain("Weekend pattern may need more signal");
    expect(html).toContain("Fieldwork status");
    expect(html).toContain("assigned");
    expect(html).toContain("pattern_claim/pc-1");
    expect(html).toContain("Linked evidence count");
    expect(html).toContain("message: 1");
    expect(html).toContain("Hold for more evidence");
    expect(html).toContain("Reject");
    expect(html).toContain("Expire");
    expect(html).not.toContain("Investigation title");
    expect(html).not.toContain("snippet");
    expect(html).not.toContain("quote");
  });

  it("renders Fieldwork publish for promoted internal_only assigned candidates", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[]}
        investigationCandidates={[]}
        fieldworkCandidates={[
          {
            ...baseFieldworkCandidate,
            candidateLifecycleStatus: "promoted",
            status: "assigned",
          },
        ]}
        modelUpdateCandidates={[]}
        initialTab="fieldwork"
      />
    );

    expect(html).toContain("Publish");
    expect(html).not.toContain("Hold for more evidence");
  });

  it("renders Fieldwork publish for promoted internal_only active candidates", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[]}
        investigationCandidates={[]}
        fieldworkCandidates={[
          {
            ...baseFieldworkCandidate,
            candidateLifecycleStatus: "promoted",
            status: "active",
          },
        ]}
        modelUpdateCandidates={[]}
        initialTab="fieldwork"
      />
    );

    expect(html).toContain("Publish");
  });

  it("does not render Fieldwork publish for promoted non-Watch-For-visible statuses", () => {
    for (const status of ["completed", "dismissed", "expired"] as const) {
      const html = renderToStaticMarkup(
        <InternalUserMapReviewWorkbench
          userMapCandidates={[]}
          investigationCandidates={[]}
          fieldworkCandidates={[
            {
              ...baseFieldworkCandidate,
              candidateLifecycleStatus: "promoted",
              status,
            },
          ]}
          modelUpdateCandidates={[]}
          initialTab="fieldwork"
        />
      );

      expect(html).not.toContain("Publish");
    }
  });

  it("renders ModelUpdate tab with correct aria tab and panel linkage", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[]}
        investigationCandidates={[]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[baseModelUpdateCandidate]}
        initialTab="modelupdate"
      />
    );

    expect(html).toContain('id="review-tab-modelupdate"');
    expect(html).toContain('aria-controls="review-panel-modelupdate"');
    expect(html).toContain('id="review-panel-modelupdate"');
    expect(html).toContain('aria-labelledby="review-tab-modelupdate"');
    expect(html).toContain("Confidence increased on operating logic");
    expect(html).toContain("conclusion_strengthened");
    expect(html).toContain("usermap_conclusion/umc-1");
    expect(html).toContain("Emerging pattern");
    expect(html).toContain("Supported pattern");
    expect(html).toContain("0.15");
    expect(html).toContain("internal_only");
    expect(html).toContain("false");
    expect(html).toContain("Evidence / Provenance");
    expect(html).toContain("Linked evidence count");
    expect(html).toContain("message");
    expect(html).toContain("msg-1");
    expect(html).toContain("Publish");
    expect(html).not.toContain("Hold for more evidence");
    expect(html).not.toContain("Reject");
    expect(html).not.toContain("Expire");
    expect(html).not.toContain("Promote");
    expect(html).not.toContain("snippet");
    expect(html).not.toContain("quote");
    expect(html).not.toContain("internalNotes");
    expect(html).not.toContain("RAW MESSAGE BODY");
  });

  it("shows needs-evidence message instead of publish when ModelUpdate has zero evidence links", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[]}
        investigationCandidates={[]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[
          {
            ...baseModelUpdateCandidate,
            id: "mu-no-evidence",
            evidence: {
              linkCount: 0,
              sourceTypes: {},
              safetyLevels: {},
              linkedSources: [],
            },
          },
        ]}
        initialTab="modelupdate"
      />
    );

    expect(html).toContain("Needs linked evidence before publish.");
    expect(html).toContain("Needs linked evidence");
    expect(html).toContain("Publish to What Changed (publish-only");
    expect(html).not.toContain(">Publish<");
  });

  it("keeps UserMap tab working when ModelUpdate candidates are present", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[baseCandidate]}
        investigationCandidates={[]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[baseModelUpdateCandidate]}
      />
    );

    expect(html).toContain("Candidate title");
    expect(html).toContain("Hold for more evidence");
    expect(html).toContain('id="review-panel-usermap"');
    expect(html).not.toContain("Confidence increased on operating logic");
  });

  it("shows tab counts and publish-ready suffix when candidates are ready", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[
          {
            ...baseCandidate,
            id: "umc-promoted",
            candidateLifecycleStatus: "promoted",
          },
        ]}
        investigationCandidates={[]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[baseModelUpdateCandidate]}
      />
    );

    expect(html).toContain("User Map (1) · 1 ready");
    expect(html).toContain("ModelUpdate (1) · 1 ready");
  });

  it("renders family-specific empty states when a tab has no candidates", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[]}
        investigationCandidates={[]}
        fieldworkCandidates={[]}
        modelUpdateCandidates={[]}
        initialTab="fieldwork"
      />
    );

    expect(html).toContain('data-testid="review-empty-fieldwork-none"');
    expect(html).toContain("No Fieldwork candidates");
  });
});
