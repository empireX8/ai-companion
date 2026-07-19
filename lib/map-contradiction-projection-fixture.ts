/**
 * Dev/test-only non-persistent fixture for Wave 1.1 presentation/selection proof.
 * Does not write Kay DB, accept candidates, or leak into root/live production data.
 *
 * Initial selection is a harmless claim — not the contradiction — so human click
 * can prove conflict-row → contradiction_node Inspector selection.
 */

import type { MapMapDataInput } from "./orvek-adapters/map";
import type { MapOpenContradictionItem } from "./map-open-contradictions";
import { mapContradictionObjectId } from "./map-open-contradictions";
import { buildMapProductionDataApi } from "./orvek-v0/production/map-api";
import type { OrvekDataApi } from "./orvek-v0/data-provider";
import type { UserMapConclusionPublicApiListItem } from "./public-intelligence-safe-slice";

export const MAP_CONTRADICTION_PROJECTION_FIXTURE_RAW_ID =
  "dev-fixture-open-contradiction-001";

export const MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAW_ID =
  "dev-fixture-claim-001";

export const MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAIL_ID = `conclusion-${MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAW_ID}`;

export const MAP_CONTRADICTION_PROJECTION_FIXTURE_CONTRADICTION_RAIL_ID =
  mapContradictionObjectId(MAP_CONTRADICTION_PROJECTION_FIXTURE_RAW_ID);

export const MAP_CONTRADICTION_PROJECTION_FIXTURE_ITEM: MapOpenContradictionItem = {
  id: MAP_CONTRADICTION_PROJECTION_FIXTURE_RAW_ID,
  title: "Fixture open contradiction (dev only)",
  sideA: "Prefer speed when shipping understanding surfaces",
  sideB: "Prefer careful evidence gates before surfacing claims",
  status: "open",
  confidence: "medium",
  evidenceCount: 1,
  lastTouchedAt: "2026-07-19T12:00:00.000Z",
  sessionOrigin: null,
};

export const MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM: UserMapConclusionPublicApiListItem =
  {
    id: MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAW_ID,
    title: "Fixture claim (dev only)",
    summary: "Harmless initial selection so click can prove contradiction selection.",
    area: "operating_logic",
    status: "supported",
    confidenceLevel: "medium",
    evidenceCount: 0,
    updatedAt: "2026-07-19T12:00:00.000Z",
  };

export function createMapContradictionProjectionFixtureInput(): MapMapDataInput {
  return {
    items: [MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM],
    openContradictions: [MAP_CONTRADICTION_PROJECTION_FIXTURE_ITEM],
    isLoading: false,
    loadError: null,
    // Initial selection is the claim — not the contradiction.
    selectedId: MAP_CONTRADICTION_PROJECTION_FIXTURE_CLAIM_RAW_ID,
    detail: null,
    isDetailLoading: false,
    evidence: [],
    openQuestionsCount: 0,
    mindContext: {
      isLoading: false,
      items: [],
      summaryCounts: { memories: 0, patterns: 0 },
    },
    movementPreview: { isLoading: false, items: [] },
    openQuestionsPreview: { isLoading: false, items: [] },
  };
}

export function createMapContradictionProjectionMapApi(): OrvekDataApi {
  return buildMapProductionDataApi(createMapContradictionProjectionFixtureInput());
}
