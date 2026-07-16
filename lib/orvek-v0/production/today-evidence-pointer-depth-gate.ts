import type { OrvekDataApi } from "../data-provider";
import type { OrvekObject } from "../orvek-types";

import { mergeSurfacedEvidenceDepthObjects } from "../../live-evidence-depth-linkage";
import {
  assessLiveTodayObjectGraphParity,
  withTodayObjectGraphParity,
} from "./today-object-graph-parity";

export type SurfacedEvidenceDepthOverlay = {
  pointerObjects: OrvekObject[];
  linkedObjects: OrvekObject[];
  depthSafePointerIds: string[];
  inspectorDepthListReady: boolean;
};

/**
 * Reference-only receipt ids preserved for explicit sample surfaces and test
 * fixtures. Production must not silently substitute them.
 */
export const REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS = ["r6", "r5", "r2"] as const;

/** Explicit live-object metadata for depth-overlay objects merged after parity assessment. */
export type SurfacedEvidenceDepthProvenance = {
  depthSafePointerIds: string[];
  linkedObjectIds: string[];
};

export function buildSurfacedEvidenceDepthProvenance(
  overlay: SurfacedEvidenceDepthOverlay,
): SurfacedEvidenceDepthProvenance {
  return {
    depthSafePointerIds: [...overlay.depthSafePointerIds],
    linkedObjectIds: overlay.linkedObjects.map((object) => object.id),
  };
}

/**
 * Depth-gated override for Today resurfaced evidence pointers.
 *
 * - Never surface thin live Today receipts as evidence pointers.
 * - Only surface stored depth-safe pointers when overlay is explicitly ready.
 * - Register pointer/linked objects in provider lookup only under the same gate.
 *
 * This does NOT touch UI components; it only shapes the data API.
 */
export function applySurfacedEvidenceDepthGate(args: {
  api: OrvekDataApi;
  overlay: SurfacedEvidenceDepthOverlay | null;
}): OrvekDataApi {
  if (args.overlay?.inspectorDepthListReady && args.overlay.depthSafePointerIds.length > 0) {
    const merged = mergeSurfacedEvidenceDepthObjects(args.api, {
      pointerObjects: args.overlay.pointerObjects,
      linkedObjects: args.overlay.linkedObjects,
      depthSafePointerIds: args.overlay.depthSafePointerIds,
      rejectedPointers: [],
      inspectorDepthListReady: true,
    });
    const gatedApi: OrvekDataApi = {
      ...merged,
      todayResurfacedIds: args.overlay.depthSafePointerIds,
      surfacedEvidenceDepthProvenance: buildSurfacedEvidenceDepthProvenance(args.overlay),
    };
    return withTodayObjectGraphParity(
      gatedApi,
      assessLiveTodayObjectGraphParity(gatedApi),
    );
  }

  return withTodayObjectGraphParity(
    args.api,
    assessLiveTodayObjectGraphParity(args.api),
  );
}
