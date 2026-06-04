import {
  extractStructuredInvestigationCandidateProposal,
  usesInvestigationCandidateSafeWording,
} from "./investigation-candidate-proposal";
import type {
  NoWriteDarkRunSanitizedPacketItem,
  RunNoWriteUnderstandingDarkRunResult,
} from "./dark-run-orchestrator";

type NoWriteDarkRunHarnessFinding = {
  invariant: string;
  message: string;
  itemId?: string;
  sourceType?: string;
  sourceId?: string;
};

export type NoWriteDarkRunEvaluationHarnessResult = {
  passed: boolean;
  failures: NoWriteDarkRunHarnessFinding[];
  warnings: NoWriteDarkRunHarnessFinding[];
  checkedInvariants: string[];
  summary: {
    itemCount: number;
    failureCount: number;
    warningCount: number;
    rawLeakageFailureCount: number;
    sourceSafetyFailureCount: number;
    phaseHCompatibilityWarningCount: number;
  };
};

const INVARIANT_NO_RAW_EVIDENCE_LEAKAGE = "no_raw_evidence_leakage";
const INVARIANT_SOURCE_SAFETY_COMPLIANCE = "source_safety_compliance";
const INVARIANT_PHASE_H_COMPATIBILITY = "phase_h_compatibility";
const INVARIANT_EVALUATION_GATE_QUALITY = "evaluation_gate_quality";
const INVARIANT_NO_WRITE = "no_write_invariant";
const INVARIANT_INVESTIGATION_PROPOSAL_SAFETY =
  "investigation_candidate_proposal_safety";

const RAW_LIKE_KEY_TOKENS = [
  "snippet",
  "quote",
  "note",
  "rawtext",
  "observationtext",
  "journaltext",
  "messagetext",
  "fieldworkobservation",
  "privatetext",
];

const SANITIZED_ITEM_KEYS = new Set([
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

type NoWriteDarkRunOutputLike = Partial<RunNoWriteUnderstandingDarkRunResult> & {
  packet?: Partial<RunNoWriteUnderstandingDarkRunResult["packet"]> & {
    items?: unknown;
  };
  userMapEvaluation?: Partial<RunNoWriteUnderstandingDarkRunResult["userMapEvaluation"]>;
  diagnostics?: Partial<RunNoWriteUnderstandingDarkRunResult["diagnostics"]>;
  phaseHCompatibility?: Partial<RunNoWriteUnderstandingDarkRunResult["phaseHCompatibility"]>;
};

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function isRawLikeKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (normalized === "containsrawprivatetext") {
    return false;
  }

  return RAW_LIKE_KEY_TOKENS.some((token) => normalized.includes(token));
}

function itemIdOf(item: Partial<NoWriteDarkRunSanitizedPacketItem>): string {
  const sourceType =
    typeof item.sourceType === "string" ? item.sourceType : "unknown_source";
  const sourceId =
    typeof item.sourceId === "string" ? item.sourceId : "unknown_id";
  return `${sourceType}:${sourceId}`;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Pure Phase 2C harness for no-write dark-run output.
 * This helper performs in-memory validation only and has no persistence dependencies.
 */
export function evaluateNoWriteDarkRunOutput(
  output: NoWriteDarkRunOutputLike | null | undefined
): NoWriteDarkRunEvaluationHarnessResult {
  const failures: NoWriteDarkRunHarnessFinding[] = [];
  const warnings: NoWriteDarkRunHarnessFinding[] = [];

  const checkedInvariants = [
    INVARIANT_NO_RAW_EVIDENCE_LEAKAGE,
    INVARIANT_SOURCE_SAFETY_COMPLIANCE,
    INVARIANT_PHASE_H_COMPATIBILITY,
    INVARIANT_EVALUATION_GATE_QUALITY,
    INVARIANT_NO_WRITE,
    INVARIANT_INVESTIGATION_PROPOSAL_SAFETY,
  ];

  const packetItems = asArray(output?.packet?.items) as Array<
    Partial<NoWriteDarkRunSanitizedPacketItem>
  >;

  const pushFailure = (
    finding: Omit<NoWriteDarkRunHarnessFinding, "invariant"> & {
      invariant: string;
    }
  ) => {
    failures.push(finding);
  };

  const pushWarning = (
    finding: Omit<NoWriteDarkRunHarnessFinding, "invariant"> & {
      invariant: string;
    }
  ) => {
    warnings.push(finding);
  };

  for (const item of packetItems) {
    const sourceType =
      typeof item.sourceType === "string" ? item.sourceType : undefined;
    const sourceId = typeof item.sourceId === "string" ? item.sourceId : undefined;
    const itemId = itemIdOf(item);

    const keys = Object.keys(item as Record<string, unknown>);
    for (const key of keys) {
      if (!SANITIZED_ITEM_KEYS.has(key) && isRawLikeKey(key)) {
        pushFailure({
          invariant: INVARIANT_NO_RAW_EVIDENCE_LEAKAGE,
          message: `Sanitized item exposes raw-like field "${key}".`,
          itemId,
          sourceType,
          sourceId,
        });
      }
    }

    if (typeof item.publicSafetyLevel === "string") {
      const level = item.publicSafetyLevel;
      const hasPublicSafeSummary = hasOwn(item as object, "publicSafeSummary");

      if (hasPublicSafeSummary && level !== "safe_summary") {
        pushFailure({
          invariant: INVARIANT_SOURCE_SAFETY_COMPLIANCE,
          message:
            "publicSafeSummary must only appear when publicSafetyLevel is safe_summary.",
          itemId,
          sourceType,
          sourceId,
        });
      }

      if (level === "safe_summary" && !hasPublicSafeSummary) {
        pushFailure({
          invariant: INVARIANT_SOURCE_SAFETY_COMPLIANCE,
          message:
            "safe_summary item is missing publicSafeSummary in sanitized projection.",
          itemId,
          sourceType,
          sourceId,
        });
      }

      if (
        (level === "public_safe_id_only" ||
          level === "internal_only" ||
          level === "not_public_safe") &&
        hasPublicSafeSummary
      ) {
        pushFailure({
          invariant: INVARIANT_SOURCE_SAFETY_COMPLIANCE,
          message: `publicSafetyLevel "${level}" must not expose publicSafeSummary.`,
          itemId,
          sourceType,
          sourceId,
        });
      }
    } else {
      pushFailure({
        invariant: INVARIANT_SOURCE_SAFETY_COMPLIANCE,
        message: "Sanitized item is missing a valid publicSafetyLevel.",
        itemId,
        sourceType,
        sourceId,
      });
    }

    if (item.containsRawPrivateText === true) {
      if (item.publicSafetyLevel !== "internal_only") {
        pushFailure({
          invariant: INVARIANT_SOURCE_SAFETY_COMPLIANCE,
          message:
            "containsRawPrivateText items must be internal_only in sanitized projection.",
          itemId,
          sourceType,
          sourceId,
        });
      }

      for (const key of keys) {
        if (!SANITIZED_ITEM_KEYS.has(key) && isRawLikeKey(key)) {
          pushFailure({
            invariant: INVARIANT_SOURCE_SAFETY_COMPLIANCE,
            message:
              "containsRawPrivateText item exposes raw-like fields in sanitized projection.",
            itemId,
            sourceType,
            sourceId,
          });
          break;
        }
      }
    }
  }

  const hasSurfacedActionEvidence = packetItems.some(
    (item) => item.sourceType === "surfaced_action"
  );
  const phaseHRequired = output?.phaseHCompatibility?.required;
  const phaseHReasons = output?.phaseHCompatibility?.reasons;
  const diagnosticNotes = asArray(output?.diagnostics?.notes).filter(
    (value): value is string => typeof value === "string"
  );

  if (hasSurfacedActionEvidence) {
    if (phaseHRequired !== true) {
      pushFailure({
        invariant: INVARIANT_PHASE_H_COMPATIBILITY,
        message:
          "surfaced_action evidence requires phaseHCompatibility.required to be true.",
      });
    }

    const hasReason =
      Array.isArray(phaseHReasons) &&
      phaseHReasons.includes("surfaced_action_evidence_present");
    if (!hasReason) {
      pushWarning({
        invariant: INVARIANT_PHASE_H_COMPATIBILITY,
        message:
          "surfaced_action evidence is present but Phase H compatibility reason is missing.",
      });
    }

    const hasNote = diagnosticNotes.some((note) =>
      note.includes("phase_h_compatibility_required:surfaced_action_evidence_present")
    );
    if (!hasNote) {
      pushWarning({
        invariant: INVARIANT_PHASE_H_COMPATIBILITY,
        message:
          "surfaced_action evidence is present but diagnostics note for Phase H compatibility is missing.",
      });
    }
  }

  if (!output?.userMapEvaluation) {
    pushFailure({
      invariant: INVARIANT_EVALUATION_GATE_QUALITY,
      message: "Missing userMapEvaluation result.",
    });
  } else {
    const decision = output.userMapEvaluation.decision;
    if (!decision || !["pass", "pass_with_cap", "abstain"].includes(decision)) {
      pushFailure({
        invariant: INVARIANT_EVALUATION_GATE_QUALITY,
        message: "userMapEvaluation.decision is missing or invalid.",
      });
    }

    if (decision === "abstain") {
      const reasons = output.userMapEvaluation.reasons;
      if (!Array.isArray(reasons) || reasons.length === 0) {
        pushFailure({
          invariant: INVARIANT_EVALUATION_GATE_QUALITY,
          message: "Abstained evaluation must include rejection reasons.",
        });
      }
    }
  }

  if (!output?.diagnostics) {
    pushFailure({
      invariant: INVARIANT_EVALUATION_GATE_QUALITY,
      message: "Missing diagnostics summary.",
    });
  }

  if (!output?.packet?.metrics) {
    pushFailure({
      invariant: INVARIANT_EVALUATION_GATE_QUALITY,
      message: "Missing packet metrics.",
    });
  } else if (typeof output.packet.metrics.evidenceCount !== "number") {
    pushFailure({
      invariant: INVARIANT_EVALUATION_GATE_QUALITY,
      message: "packet.metrics.evidenceCount is missing or invalid.",
    });
  }

  if (output?.mode !== "no_write_dark_run") {
    pushFailure({
      invariant: INVARIANT_NO_WRITE,
      message: 'Expected mode "no_write_dark_run".',
    });
  }

  if (
    output?.diagnostics &&
    typeof output.diagnostics.candidatesWritten === "number" &&
    output.diagnostics.candidatesWritten > 0
  ) {
    pushFailure({
      invariant: INVARIANT_NO_WRITE,
      message:
        "No-write invariant violated: diagnostics.candidatesWritten must remain 0.",
    });
  }

  const rawInvestigationProposal = output?.investigationCandidateProposal;
  const isRawInvestigationProposalPresent =
    rawInvestigationProposal !== undefined && rawInvestigationProposal !== null;

  const investigationProposal = isRawInvestigationProposalPresent
    ? extractStructuredInvestigationCandidateProposal(output ?? {})
    : null;

  if (isRawInvestigationProposalPresent && !investigationProposal) {
    pushFailure({
      invariant: INVARIANT_INVESTIGATION_PROPOSAL_SAFETY,
      message:
        "investigationCandidateProposal is present but missing required string fields (title, summary, organizingQuestion).",
    });
  } else if (investigationProposal) {
    if (!usesInvestigationCandidateSafeWording(investigationProposal)) {
      pushFailure({
        invariant: INVARIANT_INVESTIGATION_PROPOSAL_SAFETY,
        message:
          "investigationCandidateProposal must use approved public-safe framing.",
      });
    }

    if (!investigationProposal.organizingQuestion.trim().endsWith("?")) {
      pushFailure({
        invariant: INVARIANT_INVESTIGATION_PROPOSAL_SAFETY,
        message: "investigationCandidateProposal.organizingQuestion must end with ?.",
      });
    }

    const proposalRecord = investigationProposal as Record<string, unknown>;
    for (const key of Object.keys(proposalRecord)) {
      if (isRawLikeKey(key)) {
        pushFailure({
          invariant: INVARIANT_INVESTIGATION_PROPOSAL_SAFETY,
          message: `investigationCandidateProposal exposes raw-like field "${key}".`,
        });
      }
    }

    const serialized = JSON.stringify(investigationProposal);
    if (/\bsnippet\b/i.test(serialized) || /\bquote\b/i.test(serialized)) {
      pushFailure({
        invariant: INVARIANT_INVESTIGATION_PROPOSAL_SAFETY,
        message:
          "investigationCandidateProposal must not include snippet/quote payload keys.",
      });
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    warnings,
    checkedInvariants,
    summary: {
      itemCount: packetItems.length,
      failureCount: failures.length,
      warningCount: warnings.length,
      rawLeakageFailureCount: failures.filter(
        (item) => item.invariant === INVARIANT_NO_RAW_EVIDENCE_LEAKAGE
      ).length,
      sourceSafetyFailureCount: failures.filter(
        (item) => item.invariant === INVARIANT_SOURCE_SAFETY_COMPLIANCE
      ).length,
      phaseHCompatibilityWarningCount: warnings.filter(
        (item) => item.invariant === INVARIANT_PHASE_H_COMPATIBILITY
      ).length,
    },
  };
}
