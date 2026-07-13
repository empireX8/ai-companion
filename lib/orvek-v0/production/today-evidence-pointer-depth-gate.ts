import type { OrvekDataApi } from "../data-provider";
import type { OrvekObject } from "../orvek-types";

import { mergeSurfacedEvidenceDepthObjects } from "../../live-evidence-depth-linkage";
import {
  assessLiveTodayObjectGraphParity,
  withTodayObjectGraphParity,
} from "./today-object-graph-parity";

/**
 * Accepted reference fallback Evidence Pointer receipt ids (product law).
 *
 * These ids exist only in the reference/mock Orvek dataset and must remain
 * available whenever stored depth-safe evidence pointers are unavailable.
 *
 * This is intentionally duplicated here (not imported from UI) so the UI
 * contract can be preserved without editing `components/orvek-v0/pages/today.tsx`.
 */
export const REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS = ["r6", "r5", "r2"] as const;

export type SurfacedEvidenceDepthOverlay = {
  pointerObjects: OrvekObject[];
  linkedObjects: OrvekObject[];
  depthSafePointerIds: string[];
  inspectorDepthListReady: boolean;
};

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

  return {
    ...args.api,
    // Critical: preserve accepted reference fallback rows when stored pointers
    // are not depth-ready. Never substitute thin live receipts.
    todayResurfacedIds: [...REFERENCE_FALLBACK_EVIDENCE_POINTER_IDS],
  };
}

