import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  mapExploreDataToV0Props,
  V0_EXPLORE_GROUNDING_EMPTY_CHIPS,
} from "../orvek-adapters/explore";
import {
  mapMapDataToV0Props,
  V0_MAP_CORRECTION_CHIP_LABELS,
  V0_MAP_ONTOLOGY_RAIL_LABELS,
} from "../orvek-adapters/map";
import {
  mapDecisionsDataToV0Props,
  V0_DECISIONS_OPTIONS_EMPTY_COPY,
} from "../orvek-adapters/decisions";
import {
  mapTimelineDataToV0Props,
  V0_TIMELINE_PRIOR_READ_UNAVAILABLE_COPY,
} from "../orvek-adapters/timeline";
import type { SurfacedActionView } from "../actions-api";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("orvek structural fidelity", () => {
  it("map adapter exposes v0 ontology rails and correction chips", () => {
    const view = mapMapDataToV0Props({
      items: [
        {
          id: "c-1",
          title: "Evening stress loop",
          area: "operating_logic",
          status: "supported",
          confidenceLevel: "medium",
          evidenceCount: 3,
          summary: "Summary",
          updatedAt: "2026-06-24T10:00:00.000Z",
        },
      ],
      isLoading: false,
      loadError: null,
      selectedId: "c-1",
      detail: null,
      isDetailLoading: false,
      evidence: [],
      openQuestionsCount: 0,
      mindContext: { isLoading: false, items: [], summaryCounts: { memories: 0, patterns: 0 } },
      movementPreview: { isLoading: false, items: [] },
      openQuestionsPreview: { isLoading: false, items: [] },
    });

    expect(view.ontologyGroups.map((group) => group.label)).toContain(
      V0_MAP_ONTOLOGY_RAIL_LABELS.claims
    );
    expect(view.correctionChipLabels).toEqual(V0_MAP_CORRECTION_CHIP_LABELS);
    expect(view.evidence.conflictingEmptyCopy).toContain("No conflicting signal");
    expect(view.showSecondaryPanels).toBe(true);
  });

  it("map view keeps correction chips, evidence grid, and ontology rails in source", () => {
    const source = readSource("components/orvek-workbench/views/V0MapView.tsx");
    expect(source).toContain('data-testid="orvek-map-correction-chips"');
    expect(source).toContain('data-testid="orvek-map-supporting-conflicting-grid"');
    expect(source).toContain('data-testid="orvek-map-ontology-rails"');
    expect(source).toContain('data-testid="orvek-map-selected-workspace"');
    expect(source).toContain("SecondaryPreviewPanels");
  });

  it("explore adapter keeps grounding chips and separate tab shells", () => {
    const props = mapExploreDataToV0Props({
      activeTab: "investigations",
      hasActionHandoffRequest: false,
      handoffContext: null,
      isLoadingHandoff: false,
      handoffError: null,
      messages: [],
      composerDraft: "",
      isBooting: false,
      isSending: false,
      errorMessage: null,
    });

    expect(props.groundingChips).toHaveLength(V0_EXPLORE_GROUNDING_EMPTY_CHIPS.length);
    expect(props.groundingChips.every((chip) => chip.disabled)).toBe(true);
    expect(props.liveDetectionCopy).toContain("No live model signal");
    expect(props.investigations.emptyListCopy).toContain("No investigation");
  });

  it("explore view renders full tab shells and draft/published strips", () => {
    const source = readSource("components/orvek-workbench/views/V0ExploreView.tsx");
    expect(source).toContain('data-testid="orvek-explore-investigations-tab"');
    expect(source).toContain('data-testid="orvek-explore-questions-tab"');
    expect(source).toContain('data-testid="orvek-explore-fieldwork-tab"');
    expect(source).toContain('data-testid="orvek-explore-grounding-row"');
    expect(source).toContain('data-testid="orvek-explore-live-detection"');
    expect(source).toContain("ExploreConversationReviewStrip");
    expect(source).toContain("ExploreModelMovementStrip");
  });

  it("decisions adapter keeps honest empty option/projection slots", () => {
    const action: SurfacedActionView = {
      id: "a-1",
      title: "Pause commitments",
      whySuggested: "Pattern supports a boundary.",
      bucket: "stabilize",
      effort: "Low",
      linkedFamily: null,
      linkedFamilyLabel: null,
      linkedClaimId: null,
      linkedClaimSummary: null,
      linkedGoalId: null,
      linkedGoalStatement: null,
      linkedSourceLabel: "Pattern",
      status: "not_started",
      note: null,
      surfacedAt: "2026-06-20T10:00:00.000Z",
      updatedAt: "2026-06-20T10:00:00.000Z",
    };

    const view = mapDecisionsDataToV0Props({
      tab: "stabilize",
      list: [action],
      selectedDecisionId: "a-1",
      isLoading: false,
      errorMessage: null,
      createErrorByActionId: {},
    });

    expect(view.decision?.optionsEmptyCopy).toBe(V0_DECISIONS_OPTIONS_EMPTY_COPY);
    expect(view.sidebarGroups.map((group) => group.heading)).toEqual([
      "Active",
      "Chosen",
      "Outcome due",
      "Reviewed",
    ]);
    expect(JSON.stringify(view)).not.toMatch(/optionLabel|pros|cons/);
  });

  it("decisions view keeps options/projection/outcome panels", () => {
    const source = readSource("components/orvek-workbench/views/V0DecisionsView.tsx");
    expect(source).toContain('testId="orvek-decisions-options-panel"');
    expect(source).toContain('testId="orvek-decisions-projection-panel"');
    expect(source).toContain('data-testid="orvek-decisions-outcome-panel"');
  });

  it("timeline adapter exposes before/after geometry fields for movement rows", () => {
    const props = mapTimelineDataToV0Props({
      timelineEntries: [],
      modelLayers: [
        {
          id: "mu-1",
          updateTypeLabel: "Pattern shift",
          affectedObjectTypeLabel: "Pattern",
          userFacingSummary: "Updated summary",
          createdAt: "2026-06-24T11:00:00.000Z",
          affectedObjectType: "pattern_claim",
          affectedObjectId: "pc-1",
          affectedObjectHref: "/patterns/pc-1",
        },
      ],
      semanticFilter: "all",
      searchQuery: "",
      isLoadingActivity: false,
      isLoadingModelLayers: false,
      isLoadingSemantic: false,
      activityError: null,
      modelLayerError: null,
      selectedObjectId: null,
      now: new Date("2026-06-24T12:00:00.000Z"),
    });

    const row = props.groups.flatMap((group) => group.rows)[0];
    expect(row?.showBeforeAfterBlock).toBe(true);
    expect(row?.beforeSummary).toBeNull();
    expect(row?.afterSummary).toBe("Updated summary");
    expect(row?.priorReadUnavailableCopy).toBe(V0_TIMELINE_PRIOR_READ_UNAVAILABLE_COPY);
    expect(props.emptyStreamHeading).toBe("Earlier");
  });

  it("timeline view renders before/after block and empty stream geometry", () => {
    const source = readSource("components/orvek-workbench/views/V0TimelineView.tsx");
    expect(source).toContain('data-testid="orvek-timeline-before-after-block"');
    expect(source).toContain('data-testid="orvek-timeline-empty-stream"');
  });
});
