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
import type { InternalFieldworkReviewCandidate } from "../internal-fieldwork-review-candidates";
import type { InternalInvestigationReviewCandidate } from "../internal-investigation-review-candidates";
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

describe("InternalUserMapReviewWorkbench", () => {
  it("renders lifecycle status and operator buttons for proposed User Map candidates", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[baseCandidate]}
        investigationCandidates={[]}
        fieldworkCandidates={[]}
      />
    );

    expect(html).toContain("User Map");
    expect(html).toContain("Investigation");
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
    expect(html).not.toContain("Promote");
    expect(html).not.toContain("Publish");
    expect(html).not.toContain("quote");
    expect(html).not.toContain("snippet");
    expect(html).toContain('id="review-tab-fieldwork"');
    expect(html).not.toContain("Watch for Sunday evening tension");
    expect(html).not.toContain("ModelUpdate");
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
      />
    );

    expect(heldHtml).toContain("Promote");
    expect(heldHtml).toContain("Reject");
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
      />
    );

    expect(promotedHtml).toContain("Publish");
    expect(promotedHtml).not.toContain("Hold for more evidence");
    expect(promotedHtml).not.toContain("Reject");
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
      />
    );

    expect(html).toContain("Not lifecycle-managed (legacy)");
    expect(html).toContain("Lifecycle actions are unavailable");
    expect(html).not.toContain("Hold for more evidence");
    expect(html).not.toContain("Reject");
  });

  it("renders Investigation candidates and actions on the Investigation tab", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        userMapCandidates={[]}
        investigationCandidates={[baseInvestigationCandidate]}
        fieldworkCandidates={[]}
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
    expect(html).not.toContain("Candidate title");
    expect(html).not.toContain("Watch for Sunday evening tension");
    expect(html).not.toContain("ModelUpdate");
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
    expect(html).not.toContain("Investigation title");
    expect(html).not.toContain("ModelUpdate");
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
          initialTab="fieldwork"
        />
      );

      expect(html).not.toContain("Publish");
    }
  });
});
