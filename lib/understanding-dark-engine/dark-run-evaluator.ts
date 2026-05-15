import {
  addLinkIntegrityWarning,
  createDarkRunDiagnosticsFromPacket,
  incrementHighEmotionCapForOutcome,
  incrementRejectionReasonCounts,
} from "./diagnostics";
import { evaluateModelUpdateObjectivityGates, evaluateUserMapConclusionObjectivityGates } from "./objectivity-gates";
import type {
  EvidencePacket,
  GateEvaluationResult,
  GateEvaluationTarget,
  ModelUpdateDeltaInput,
  ModelUpdateGateResult,
} from "./types";

export type DarkRunUserMapEvaluation = {
  result: GateEvaluationResult;
  diagnostics: ReturnType<typeof createDarkRunDiagnosticsFromPacket>;
};

export type DarkRunModelUpdateEvaluation = {
  result: ModelUpdateGateResult;
  diagnostics: ReturnType<typeof createDarkRunDiagnosticsFromPacket>;
};

export function evaluateDarkRunUserMapCandidate(args: {
  packet: EvidencePacket;
  target: GateEvaluationTarget;
}): DarkRunUserMapEvaluation {
  const diagnostics = createDarkRunDiagnosticsFromPacket(args.packet);
  diagnostics.candidatesProposed += 1;

  const result = evaluateUserMapConclusionObjectivityGates({
    packet: args.packet,
    target: args.target,
  });

  if (result.decision === "abstain") {
    diagnostics.abstentions += 1;
    incrementRejectionReasonCounts(diagnostics, result.reasons);
  }

  incrementHighEmotionCapForOutcome(diagnostics, [
    ...new Set([...result.reasons, ...result.warnings]),
  ]);

  if (args.packet.metrics.nonLinkableContextItems > 0) {
    addLinkIntegrityWarning(
      diagnostics,
      "Packet contains non-linkable context inputs; persistence requires additional linkable evidence."
    );
  }

  return {
    result,
    diagnostics,
  };
}

export function evaluateDarkRunModelUpdateCandidate(args: {
  packet: EvidencePacket;
  delta: ModelUpdateDeltaInput;
}): DarkRunModelUpdateEvaluation {
  const diagnostics = createDarkRunDiagnosticsFromPacket(args.packet);
  diagnostics.candidatesProposed += 1;

  const result = evaluateModelUpdateObjectivityGates({
    packet: args.packet,
    delta: args.delta,
  });

  if (!result.isMeaningful) {
    diagnostics.abstentions += 1;
    incrementRejectionReasonCounts(diagnostics, result.reasons);
  }

  return {
    result,
    diagnostics,
  };
}
