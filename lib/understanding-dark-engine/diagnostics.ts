import type { RejectionReasonCode } from "./constants";
import type { DarkRunDiagnostics, EvidencePacket } from "./types";

export function createDarkRunDiagnosticsFromPacket(
  packet: EvidencePacket
): DarkRunDiagnostics {
  return {
    packetsAssembled: 1,
    candidatesProposed: 0,
    candidatesWritten: 0,
    abstentions: 0,
    rejectionCountsByReason: {},
    sourceCounts: packet.metrics.sourceCounts,
    sourceDiversity: packet.metrics.sourceDiversity,
    timeSpreadDays: packet.metrics.timeSpreadDays,
    importedVsNative: {
      imported: packet.metrics.importedCount,
      native: packet.metrics.nativeCount,
      mixed: packet.metrics.mixedCount,
      unknown: packet.metrics.unknownOriginCount,
    },
    highEmotionCaps: 0,
    singleEpisodeBlocks: 0,
    nonLinkableContextItems: packet.metrics.nonLinkableContextItems,
    linkIntegrityWarnings: [],
    notes: [],
  };
}

export function incrementRejectionReasonCounts(
  diagnostics: DarkRunDiagnostics,
  reasons: RejectionReasonCode[]
): void {
  for (const reason of reasons) {
    diagnostics.rejectionCountsByReason[reason] =
      (diagnostics.rejectionCountsByReason[reason] ?? 0) + 1;

    if (reason === "SINGLE_EPISODE_SUPPORTED_BLOCK") {
      diagnostics.singleEpisodeBlocks += 1;
    }
  }
}

export function incrementHighEmotionCapForOutcome(
  diagnostics: DarkRunDiagnostics,
  signals: RejectionReasonCode[]
): void {
  const signalSet = new Set(signals);
  if (
    signalSet.has("HIGH_EMOTION_DOMINANCE_CAP") ||
    signalSet.has("HIGH_EMOTION_IDENTITY_BLOCK")
  ) {
    diagnostics.highEmotionCaps += 1;
  }
}

export function addLinkIntegrityWarning(
  diagnostics: DarkRunDiagnostics,
  warning: string
): void {
  if (!diagnostics.linkIntegrityWarnings.includes(warning)) {
    diagnostics.linkIntegrityWarnings.push(warning);
  }
}
