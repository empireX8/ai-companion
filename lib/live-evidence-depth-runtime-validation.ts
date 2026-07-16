/**
 * Validation-only composition helpers for the live evidence depth pipeline.
 *
 * Used by runtime validation tests to chain authoring → publish → read → Today gate
 * without changing production routes or UI behavior.
 */

import type { OrvekDataApi } from "./orvek-v0/data-provider";
import { EMPTY_ORVEK_DATA_API } from "./orvek-v0/empty-api";
import { withTodayAdapterHonesty } from "./orvek-v0/production/today-adapter-honesty";
import {
  applySurfacedEvidenceDepthGate,
  type SurfacedEvidenceDepthOverlay,
} from "./orvek-v0/production/today-evidence-pointer-depth-gate";
import {
  readSurfacedEvidencePointersForUser,
  type SurfacedEvidenceDepthGraphResult,
  type SurfacedEvidenceDepthLinkageDeps,
  type SurfacedEvidencePointerRecord,
  type UnderstandingEvidenceLinkRow,
} from "./live-evidence-depth-linkage";

export type EvidenceDepthRuntimeGateResult = {
  readGraph: SurfacedEvidenceDepthGraphResult;
  gatedApi: OrvekDataApi;
  overlay: SurfacedEvidenceDepthOverlay | null;
};

/** Mirrors `/api/today/evidence-pointers` service path (auth excluded). */
export async function fetchEvidencePointersGraphService(args: {
  userId: string;
  deps: SurfacedEvidenceDepthLinkageDeps;
}): Promise<SurfacedEvidenceDepthGraphResult> {
  return readSurfacedEvidencePointersForUser({ userId: args.userId }, args.deps);
}

export function buildSurfacedEvidenceDepthOverlayFromGraph(
  graph: SurfacedEvidenceDepthGraphResult,
): SurfacedEvidenceDepthOverlay | null {
  if (!graph.inspectorDepthListReady || graph.depthSafePointerIds.length === 0) {
    return null;
  }

  return {
    pointerObjects: graph.pointerObjects,
    linkedObjects: graph.linkedObjects,
    depthSafePointerIds: graph.depthSafePointerIds,
    inspectorDepthListReady: true,
  };
}

/** Mirrors hybrid workbench Today gate application after evidence-pointers fetch. */
export function applyTodayEvidenceDepthGateFromReadGraph(args: {
  readGraph: SurfacedEvidenceDepthGraphResult;
  baseApi?: OrvekDataApi;
}): EvidenceDepthRuntimeGateResult {
  const baseApi =
    args.baseApi ??
    withTodayAdapterHonesty({
      ...EMPTY_ORVEK_DATA_API,
      todayResurfacedIds: ["receipt-0-thin-live"],
    });

  const overlay = buildSurfacedEvidenceDepthOverlayFromGraph(args.readGraph);
  const gatedApi = applySurfacedEvidenceDepthGate({ api: baseApi, overlay });

  return {
    readGraph: args.readGraph,
    gatedApi,
    overlay,
  };
}

export function buildLinkageDepsFromStoredState(args: {
  pointers: SurfacedEvidencePointerRecord[];
  linkRows: UnderstandingEvidenceLinkRow[];
  checkPublicTargetEligibility?: SurfacedEvidenceDepthLinkageDeps["checkPublicTargetEligibility"];
  hydrateLinkedTargetObject: SurfacedEvidenceDepthLinkageDeps["hydrateLinkedTargetObject"];
}): SurfacedEvidenceDepthLinkageDeps {
  return {
    listSurfacedEvidencePointers: async ({ userId }) =>
      args.pointers.filter((pointer) => pointer.userId === userId),
    listUnderstandingEvidenceLinksForSources: async ({ userId, sources }) =>
      args.linkRows.filter(
        (row) =>
          sources.some(
            (source) => source.sourceType === row.sourceType && source.sourceId === row.sourceId,
          ) &&
          args.pointers.some(
            (pointer) =>
              pointer.userId === userId &&
              pointer.sourceObjectType === row.sourceType &&
              pointer.sourceObjectId === row.sourceId,
          ),
      ),
    checkPublicTargetEligibility:
      args.checkPublicTargetEligibility ??
      (async () => true),
    hydrateLinkedTargetObject: args.hydrateLinkedTargetObject,
  };
}

export function pointerRecordsFromMaterializedRows(
  rows: Iterable<{
    id: string;
    userId: string;
    sourceObjectType: string;
    sourceObjectId: string;
    sourceText: string;
    sourceOrigin: string;
    whyItMatters: string;
    whyResurfaced: string | null;
    surfacedAt: Date;
    publicEligible: boolean;
    status: string;
    libraryReceiptId?: string | null;
    detailHref?: string | null;
  }>,
): SurfacedEvidencePointerRecord[] {
  return [...rows].map((row) => ({
    id: row.id,
    userId: row.userId,
    sourceObjectType: row.sourceObjectType as SurfacedEvidencePointerRecord["sourceObjectType"],
    sourceObjectId: row.sourceObjectId,
    sourceText: row.sourceText,
    sourceOrigin: row.sourceOrigin,
    whyItMatters: row.whyItMatters,
    whyResurfaced: row.whyResurfaced,
    surfacedAt: row.surfacedAt,
    publicEligible: row.publicEligible,
    status: row.status as SurfacedEvidencePointerRecord["status"],
    libraryReceiptId: row.libraryReceiptId ?? null,
    detailHref: row.detailHref ?? null,
  }));
}

export function linkRowsFromStoredUel(
  rows: Array<{
    sourceType: string;
    sourceId: string;
    targetType: string;
    targetId: string;
    role: string;
    summary: string | null;
    meta: unknown;
  }>,
): UnderstandingEvidenceLinkRow[] {
  return rows.map((row) => ({
    sourceType: row.sourceType as UnderstandingEvidenceLinkRow["sourceType"],
    sourceId: row.sourceId,
    targetType: row.targetType as UnderstandingEvidenceLinkRow["targetType"],
    targetId: row.targetId,
    role: row.role as UnderstandingEvidenceLinkRow["role"],
    summary: row.summary,
    meta: row.meta,
  }));
}
