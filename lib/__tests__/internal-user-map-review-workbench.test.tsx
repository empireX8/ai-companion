import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import { InternalUserMapReviewWorkbench } from "../../app/(root)/(routes)/internal/user-map/review/_components/InternalUserMapReviewWorkbench";
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

describe("InternalUserMapReviewWorkbench", () => {
  it("renders lifecycle status and operator buttons for proposed candidates", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench candidates={[baseCandidate]} />
    );

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
  });

  it("renders empty provenance state without crashing", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        candidates={[
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
      />
    );

    expect(html).toContain("No provenance metadata recorded for this candidate.");
    expect(html).toContain("Hold for more evidence");
  });

  it("renders promote for held candidates and publish for promoted candidates", () => {
    const heldHtml = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        candidates={[
          {
            ...baseCandidate,
            candidateLifecycleStatus: "held_for_more_evidence",
          },
        ]}
      />
    );

    expect(heldHtml).toContain("Promote");
    expect(heldHtml).toContain("Reject");
    expect(heldHtml).not.toContain("Publish");

    const promotedHtml = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        candidates={[
          {
            ...baseCandidate,
            id: "umc-promoted",
            candidateLifecycleStatus: "promoted",
          },
        ]}
      />
    );

    expect(promotedHtml).toContain("Publish");
    expect(promotedHtml).not.toContain("Hold for more evidence");
    expect(promotedHtml).not.toContain("Reject");
  });

  it("does not render lifecycle actions for legacy null lifecycle rows", () => {
    const html = renderToStaticMarkup(
      <InternalUserMapReviewWorkbench
        candidates={[
          {
            ...baseCandidate,
            candidateLifecycleStatus: null,
          },
        ]}
      />
    );

    expect(html).toContain("Not lifecycle-managed (legacy)");
    expect(html).toContain("Lifecycle actions are unavailable");
    expect(html).not.toContain("Hold for more evidence");
    expect(html).not.toContain("Reject");
  });
});
