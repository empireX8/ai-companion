import {
  PHASE2_OBJECTIVITY_CONSTANTS,
  type RejectionReasonCode,
} from "./constants";
import type { ModelUpdateDeltaInput, ModelUpdateGateResult } from "./types";

export function evaluateModelUpdateMeaningfulDelta(
  input: ModelUpdateDeltaInput
): ModelUpdateGateResult {
  const reasons: RejectionReasonCode[] = [];

  if (PHASE2_OBJECTIVITY_CONSTANTS.MODEL_UPDATE_BLOCK_SYNTHETIC_DAILY_INSIGHT && input.isSyntheticInsight) {
    reasons.push("SYNTHETIC_INSIGHT_BLOCKED");
    return { isMeaningful: false, reasons };
  }

  const hasConfidenceDelta =
    typeof input.confidenceDelta === "number" &&
    Math.abs(input.confidenceDelta) >=
      PHASE2_OBJECTIVITY_CONSTANTS.MODEL_UPDATE_MIN_CONF_DELTA;

  const hasMovement =
    Boolean(input.isStatusTransition) ||
    Boolean(input.investigationStateMoved) ||
    Boolean(input.actionOutcomeModelImpact) ||
    (input.newLinkCount ?? 0) > 0 ||
    hasConfidenceDelta;

  if (PHASE2_OBJECTIVITY_CONSTANTS.MODEL_UPDATE_REQUIRES_EVIDENCE_LINK && !input.hasEvidenceLink) {
    reasons.push("MISSING_PROVENANCE");
  }

  if (!hasMovement) {
    reasons.push("NO_MEANINGFUL_DELTA");
  }

  return {
    isMeaningful: reasons.length === 0,
    reasons,
  };
}
