import { auth } from "@clerk/nextjs/server";

import { isInternalUserMapReviewer } from "../../../../../lib/internal-review-auth";
import { errorResponse } from "../../../../../lib/understanding-engine-api";
import { evaluateNoWriteDarkRunOutput } from "../../../../../lib/understanding-dark-engine/dark-run-evaluation-harness";
import {
  runNoWriteUnderstandingDarkRun,
  type NoWriteDarkRunSanitizedPacketItem,
  type RunNoWriteUnderstandingDarkRunResult,
} from "../../../../../lib/understanding-dark-engine/dark-run-orchestrator";

export const dynamic = "force-dynamic";

const NO_STORE_HEADER_VALUE = "no-store";

const ALLOWED_PACKET_ITEM_KEYS = new Set([
  "sourceType",
  "sourceId",
  "timestamp",
  "authoredAt",
  "role",
  "weightClass",
  "sourceFamily",
  "publicSafetyLevel",
  "publicSafeSummary",
  "containsRawPrivateText",
  "provenanceRefs",
  "qualityFlags",
  "linkable",
  "ownershipResolvable",
  "highEmotionSignal",
  "origin",
  "episodeKey",
]);

function withNoStore(response: Response): Response {
  response.headers.set("Cache-Control", NO_STORE_HEADER_VALUE);
  return response;
}

function noStoreJson(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": NO_STORE_HEADER_VALUE,
    },
  });
}

function sanitizePacketItemForResponse(
  item: NoWriteDarkRunSanitizedPacketItem
): NoWriteDarkRunSanitizedPacketItem {
  const sanitized: NoWriteDarkRunSanitizedPacketItem = {
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    timestamp: item.timestamp,
    authoredAt: item.authoredAt,
    role: item.role,
    weightClass: item.weightClass,
    sourceFamily: item.sourceFamily,
    publicSafetyLevel: item.publicSafetyLevel,
    containsRawPrivateText: item.containsRawPrivateText,
    provenanceRefs: item.provenanceRefs,
    qualityFlags: item.qualityFlags,
    linkable: item.linkable,
    ownershipResolvable: item.ownershipResolvable,
    highEmotionSignal: item.highEmotionSignal,
    origin: item.origin,
    episodeKey: item.episodeKey,
  };

  if (
    item.publicSafetyLevel === "safe_summary" &&
    Object.prototype.hasOwnProperty.call(item, "publicSafeSummary")
  ) {
    sanitized.publicSafeSummary = item.publicSafeSummary ?? null;
  }

  return sanitized;
}

function filterUnknownPacketItemKeys(
  item: Record<string, unknown>
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (ALLOWED_PACKET_ITEM_KEYS.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

function sanitizeDiagnosticsForResponse(
  diagnostics: RunNoWriteUnderstandingDarkRunResult["diagnostics"]
) {
  return {
    packetsAssembled: diagnostics.packetsAssembled,
    candidatesProposed: diagnostics.candidatesProposed,
    candidatesWritten: diagnostics.candidatesWritten,
    abstentions: diagnostics.abstentions,
    rejectionCountsByReason: diagnostics.rejectionCountsByReason,
    sourceCounts: diagnostics.sourceCounts,
    sourceDiversity: diagnostics.sourceDiversity,
    timeSpreadDays: diagnostics.timeSpreadDays,
    importedVsNative: diagnostics.importedVsNative,
    highEmotionCaps: diagnostics.highEmotionCaps,
    singleEpisodeBlocks: diagnostics.singleEpisodeBlocks,
    nonLinkableContextItems: diagnostics.nonLinkableContextItems,
    linkIntegrityWarnings: diagnostics.linkIntegrityWarnings,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return withNoStore(errorResponse(401, "Unauthorized", "UNAUTHORIZED"));
  }

  if (!isInternalUserMapReviewer(userId)) {
    return withNoStore(errorResponse(403, "Forbidden", "FORBIDDEN"));
  }

  try {
    const output = await runNoWriteUnderstandingDarkRun({ userId });
    const harness = evaluateNoWriteDarkRunOutput(output);

    const basePayload = {
      mode: output.mode,
      harness: {
        passed: harness.passed,
        failures: harness.failures,
        warnings: harness.warnings,
        checkedInvariants: harness.checkedInvariants,
        summary: harness.summary,
      },
      packet: {
        metrics: output.packet.metrics,
      },
      userMapEvaluation: output.userMapEvaluation,
      diagnostics: sanitizeDiagnosticsForResponse(output.diagnostics),
      phaseHCompatibility: output.phaseHCompatibility,
    };

    if (!harness.passed) {
      return noStoreJson(basePayload);
    }

    const sanitizedPacketItems = output.packet.items.map((item) =>
      filterUnknownPacketItemKeys(sanitizePacketItemForResponse(item))
    );

    const successPayload = {
      ...basePayload,
      sanitizedPacketItems,
    };

    return noStoreJson(successPayload);
  } catch (error) {
    console.error("[INTERNAL_NO_WRITE_DARK_RUN_GET_ERROR]", error);
    return withNoStore(errorResponse(500, "Internal Error", "INTERNAL_ERROR"));
  }
}
