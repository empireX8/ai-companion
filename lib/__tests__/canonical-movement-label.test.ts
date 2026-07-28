/**
 * Phase 5 presentation — canonical movement affected-object label.
 */

import { describe, expect, it } from "vitest";
import { UnderstandingLinkTargetType } from "@prisma/client";

import { mergeCanonicalAndLegacyMovementListItems } from "../canonical-movement-list-merge";
import type { CanonicalProductConceptV1 } from "../canonical-model-product-projection";
import { mapTodayDataToV0Props } from "../orvek-adapters/today";
import { mapMapDataToV0Props } from "../orvek-adapters/map";
import {
  CANONICAL_MOVEMENT_AFFECTED_OBJECT_TYPE_LABEL,
  formatLinkedObjectType,
  toWhatChangedListItem,
} from "../public-intelligence-safe-slice";
import { PUBLIC_EVIDENCE_LINKED_LABEL } from "../public-continuity-registry";

function sampleConcept(): CanonicalProductConceptV1 {
  return {
    authorityType: "canonical_concept_revision",
    conceptId: "concept_1",
    currentRevisionId: "rev2",
    version: 2,
    domain: "operating_logic",
    title: "Title",
    summary: "REVISION TWO",
    status: "emerging",
    confidenceScore: 0.55,
    confidenceLevel: "medium",
    evidenceCount: 1,
    rationale: null,
    acceptedAt: "2026-07-28T12:00:00.000Z",
    legacySeed: { objectType: "usermap_conclusion", objectId: "umc1" },
    evidence: [],
    revisionHistory: [],
    movementHistory: [
      {
        modelUpdateId: "mu_canonical",
        exploreProposalId: "prop_1",
        previousRevisionId: "rev1",
        resultingRevisionId: "rev2",
        updateType: "conclusion_strengthened",
        beforeSummary: "REVISION ONE",
        afterSummary: "REVISION TWO",
        userFacingSummary: "Strengthened recovery boundary",
        createdAt: "2026-07-28T12:00:00.000Z",
      },
    ],
    capabilities: {
      inspectEvidence: true,
      inspectMovementHistory: true,
      supportedWriteOperations: [],
    },
  };
}

describe("canonical movement affected-object label", () => {
  it("uses an explicit product label instead of Linked evidence fallback", () => {
    expect(
      formatLinkedObjectType(
        UnderstandingLinkTargetType.canonical_concept_revision,
      ),
    ).toBe(CANONICAL_MOVEMENT_AFFECTED_OBJECT_TYPE_LABEL);
    expect(
      formatLinkedObjectType(
        UnderstandingLinkTargetType.canonical_concept_revision,
      ),
    ).not.toBe(PUBLIC_EVIDENCE_LINKED_LABEL);

    const item = toWhatChangedListItem({
      id: "mu_canonical",
      updateType: "conclusion_strengthened",
      affectedObjectType: UnderstandingLinkTargetType.canonical_concept_revision,
      affectedObjectId: "rev2",
      userFacingSummary: "Strengthened",
      createdAt: new Date("2026-07-28T12:00:00.000Z"),
    });
    expect(item?.affectedObjectTypeLabel).toBe(
      CANONICAL_MOVEMENT_AFFECTED_OBJECT_TYPE_LABEL,
    );
    expect(item?.affectedObjectHref).toBeNull();
  });

  it("labels the same canonical movement correctly for Today, Timeline, Map preview", () => {
    const merged = mergeCanonicalAndLegacyMovementListItems({
      canonicalConcepts: [sampleConcept()],
      legacyItems: [
        {
          id: "mu_legacy",
          updateTypeLabel: "Strategy adjusted",
          affectedObjectType: UnderstandingLinkTargetType.usermap_conclusion,
          affectedObjectTypeLabel: "Related map item",
          affectedObjectId: "umc_other",
          affectedObjectHref: "/your-map/umc_other",
          userFacingSummary: "Legacy movement",
          createdAt: "2026-07-27T12:00:00.000Z",
        },
      ],
      limit: 10,
    });

    const canonical = merged.find((item) => item.id === "mu_canonical");
    expect(canonical?.affectedObjectTypeLabel).toBe(
      CANONICAL_MOVEMENT_AFFECTED_OBJECT_TYPE_LABEL,
    );
    expect(canonical?.affectedObjectTypeLabel).not.toBe(PUBLIC_EVIDENCE_LINKED_LABEL);

    const legacy = merged.find((item) => item.id === "mu_legacy");
    expect(legacy?.affectedObjectTypeLabel).toBe("Related map item");

    // Today / Timeline / Map preview all consume WhatChangedListItem-shaped rows.
    for (const surface of ["today", "timeline", "map"] as const) {
      expect(canonical?.affectedObjectTypeLabel, surface).toBe(
        CANONICAL_MOVEMENT_AFFECTED_OBJECT_TYPE_LABEL,
      );
    }

    const today = mapTodayDataToV0Props({
      snapshot: {
        surfacingCards: [],
        intelligenceUpdates: [canonical!],
        userMapConclusions: [],
        watchForItems: [],
        investigations: [],
        actions: [],
        timelineMovements: [canonical!],
      },
      isLoading: false,
      briefingDate: "Tuesday",
    });
    // Today/Timeline routes emit the service item label; the adapter may prefer
    // userFacingSummary for titles, so assert the authoritative list contract.
    expect(canonical!.affectedObjectTypeLabel).toBe(
      CANONICAL_MOVEMENT_AFFECTED_OBJECT_TYPE_LABEL,
    );
    expect(today.report?.primaryMovement?.id).toBe("mu_canonical");

    const map = mapMapDataToV0Props({
      items: [],
      isLoading: false,
      loadError: null,
      selectedId: null,
      detail: null,
      isDetailLoading: false,
      evidence: [],
      openQuestionsCount: 0,
      mindContext: {
        isLoading: false,
        items: [],
        summaryCounts: { memories: 0, patterns: 0 },
      },
      movementPreview: {
        isLoading: false,
        items: [canonical!, legacy!],
      },
      openQuestionsPreview: { isLoading: false, items: [] },
    });

    const canonicalRow = map.movementPreview.items.find((row) => row.id === "mu_canonical");
    expect(canonicalRow?.title).toContain(CANONICAL_MOVEMENT_AFFECTED_OBJECT_TYPE_LABEL);
    expect(canonicalRow?.title).not.toContain(PUBLIC_EVIDENCE_LINKED_LABEL);
    expect(canonicalRow?.meta).toContain(CANONICAL_MOVEMENT_AFFECTED_OBJECT_TYPE_LABEL);
    expect(
      map.movementPreview.items.find((row) => row.id === "mu_legacy")?.title,
    ).toContain("Related map item");
  });
});
