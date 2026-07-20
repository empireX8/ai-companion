/**
 * ContradictionNode semantic adjudicator (CEQR-001).
 *
 * Model-assisted structured adjudication + deterministic post-validation.
 * Returns an inspectable adjudication result only — no persistence, no
 * candidate eligibility decision, no createCandidate field.
 *
 * Depends on an injectable StructuredModelRunner (provider-agnostic).
 */

import {
  CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
  CONTRADICTION_CLASSIFICATIONS,
  KERNEL_CONTRACT_VERSION,
  KERNEL_FIRST_PROOF_OBJECT,
  NON_CONTRADICTION_NODE_CLASSIFICATIONS,
  type ContradictionClassification,
} from "./orvek-intelligence-kernel/contracts";
import { validateDualSideEvidenceClaims } from "./orvek-intelligence-kernel/evidence-validation";
import type { StructuredModelRunner } from "./orvek-intelligence-kernel/model-runner";
import {
  defaultRefereeStatus,
  type ObjectivityReferee,
  type ObjectivityRefereeEvaluation,
} from "./orvek-intelligence-kernel/objectivity-referee";
import {
  contradictionModelResultSchema,
  parseContradictionModelResult,
  type ContradictionModelResult,
} from "./orvek-intelligence-kernel/structured-output";
import type {
  DeterministicValidationResult,
  KernelAdjudicationResult,
  KernelAuditMetadata,
  KernelSourceUnit,
  RefereeStatus,
} from "./orvek-intelligence-kernel/types";

export {
  CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
  CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
  CONTRADICTION_CLASSIFICATIONS,
  KERNEL_CONTRACT_VERSION,
  KERNEL_FIRST_PROOF_OBJECT,
  NON_CONTRADICTION_NODE_CLASSIFICATIONS,
};
export type { ContradictionClassification, ContradictionModelResult };

export type ContradictionAdjudicationInput = {
  sideA: KernelSourceUnit;
  sideB: KernelSourceUnit;
  /** Injected runner — required; no hard-coded provider. */
  modelRunner: StructuredModelRunner;
  /** Optional; when omitted refereeStatus remains not_run. */
  objectivityReferee?: ObjectivityReferee;
  now?: () => Date;
  abortSignal?: AbortSignal;
};

export type ValidatedContradictionSemantic = ContradictionModelResult & {
  classification: ContradictionClassification;
};

export type ContradictionAdjudicationResult =
  KernelAdjudicationResult<ValidatedContradictionSemantic> & {
    /**
     * Semantic clear_contradiction only — NOT a persistence decision.
     * Always false in CEQR-001 (referee + selection + provenance not wired).
     */
    persistenceDecision: null;
    /** Explicitly never authored by the model as eligibility. */
    createCandidate: undefined;
  };

const SUPPORTED_PROPOSED_OBJECT_TYPES = new Set([
  KERNEL_FIRST_PROOF_OBJECT,
  "contradiction_node",
  "ContradictionNode",
]);

export function buildContradictionAdjudicationPrompt(
  sideA: KernelSourceUnit,
  sideB: KernelSourceUnit,
): { system: string; prompt: string } {
  const system = [
    "You are the ContradictionNode semantic adjudicator for the Orvek Intelligence Kernel.",
    "Your job is structured semantic classification of two bounded source units (Side A and Side B).",
    "You determine what the evidence may mean. You do not persist objects. You do not decide candidate creation.",
    "",
    "Classification taxonomy:",
    "- clear_contradiction: two propositions that cannot both be true at the same time under the same actor, timeframe, and modality",
    "- plausible_unresolved_tension: genuine pull where both sides may be partially true — NOT a ContradictionNode",
    "- compatible_states: apparent contrast explained by scope/time/actor/modality/coexistence — NOT a ContradictionNode",
    "- insufficient_or_misaligned_context: missing scope, mispairing, unrelated overlap — NOT a ContradictionNode",
    "",
    "Hard instructions:",
    "- Abstention is valid and preferred over weak classification. Set classification to null and provide abstentionReason when unsure.",
    "- Class B (plausible_unresolved_tension) is not a ContradictionNode.",
    "- Class C (compatible_states) is not a ContradictionNode.",
    "- Class D (insufficient_or_misaligned_context) is not a ContradictionNode.",
    "- Changed belief over time is not automatically a simultaneous contradiction.",
    "- Goal plus obstacle is not automatically a contradiction.",
    "- Intention plus incomplete outcome is not automatically a contradiction.",
    "- An emotional or physiological response can coexist with a reasoning standard.",
    "- Rhetorical \"but I\" language is not proof of contradiction.",
    "- Token overlap is not proof of contradiction.",
    "- Different subjects, actors, scopes or sessions must not be forced together.",
    "- Candidate volume must never be preserved by lowering the meaning standard.",
    "",
    "Evidence claims:",
    "- For each proposition provide sourceId, exactQuote, startOffset, endOffset.",
    "- Offsets are zero-based, start inclusive, end exclusive, measured against the exact supplied source text.",
    "- Quotes must be exact substrings of the supplied source text at those offsets.",
    "",
    `Prompt version: ${CONTRADICTION_ADJUDICATION_PROMPT_VERSION}`,
    `Schema version: ${CONTRADICTION_ADJUDICATION_SCHEMA_VERSION}`,
  ].join("\n");

  const prompt = [
    "Adjudicate the following Side A and Side B source units.",
    "",
    `Side A sourceId: ${sideA.sourceId}`,
    `Side A sessionId: ${sideA.sessionId}`,
    `Side A messageId: ${sideA.messageId ?? "null"}`,
    `Side A label: ${sideA.label}`,
    `Side A role/type: ${sideA.sourceRole}${sideA.sourceType ? ` / ${sideA.sourceType}` : ""}`,
    `Side A sourceText: ${JSON.stringify(sideA.sourceText)}`,
    "",
    `Side B sourceId: ${sideB.sourceId}`,
    `Side B sessionId: ${sideB.sessionId}`,
    `Side B messageId: ${sideB.messageId ?? "null"}`,
    `Side B label: ${sideB.label}`,
    `Side B role/type: ${sideB.sourceRole}${sideB.sourceType ? ` / ${sideB.sourceType}` : ""}`,
    `Side B sourceText: ${JSON.stringify(sideB.sourceText)}`,
  ].join("\n");

  return { system, prompt };
}

function requiredPropositionPresent(
  model: ContradictionModelResult,
): string | null {
  const check = (
    side: "A" | "B",
    fields: ContradictionModelResult["propositionA"],
  ): string | null => {
    if (!fields.normalizedProposition.trim()) {
      return `Proposition ${side} normalizedProposition is empty.`;
    }
    if (!fields.actor.trim()) return `Proposition ${side} actor is empty.`;
    if (!fields.subject.trim()) return `Proposition ${side} subject is empty.`;
    if (!fields.timeframe.trim()) {
      return `Proposition ${side} timeframe is empty.`;
    }
    if (!fields.modality.trim()) {
      return `Proposition ${side} modality is empty.`;
    }
    return null;
  };

  return check("A", model.propositionA) ?? check("B", model.propositionB);
}

function buildAudit(args: {
  now: Date;
  sourceIds: string[];
  providerId: string | null;
  modelId: string | null;
  parseValidationOutcome: KernelAuditMetadata["parseValidationOutcome"];
  semanticClassification: string | null;
  abstentionOrErrorCode: KernelAuditMetadata["abstentionOrErrorCode"];
  refereeStatus: RefereeStatus;
}): KernelAuditMetadata {
  return {
    processorVersion: KERNEL_CONTRACT_VERSION,
    kernelContractVersion: KERNEL_CONTRACT_VERSION,
    schemaVersion: CONTRADICTION_ADJUDICATION_SCHEMA_VERSION,
    promptVersion: CONTRADICTION_ADJUDICATION_PROMPT_VERSION,
    providerId: args.providerId,
    modelId: args.modelId,
    sourceIds: args.sourceIds,
    executedAt: args.now.toISOString(),
    parseValidationOutcome: args.parseValidationOutcome,
    semanticClassification: args.semanticClassification,
    abstentionOrErrorCode: args.abstentionOrErrorCode,
    refereeStatus: args.refereeStatus,
  };
}

function envelope(args: {
  outcome: ContradictionAdjudicationResult["outcome"];
  semantic: ValidatedContradictionSemantic | null;
  validation: DeterministicValidationResult;
  refereeStatus: RefereeStatus;
  audit: KernelAuditMetadata;
  abstentionReason: string | null;
  errorCode: ContradictionAdjudicationResult["errorCode"];
  errorMessage: string | null;
}): ContradictionAdjudicationResult {
  return {
    ...args,
    persistenceDecision: null,
    createCandidate: undefined,
  };
}

/**
 * Run model-assisted contradiction adjudication with deterministic validation.
 * Fail closed. No deterministic semantic fallback. No persistence.
 */
export async function adjudicateContradiction(
  input: ContradictionAdjudicationInput,
): Promise<ContradictionAdjudicationResult> {
  const now = (input.now ?? (() => new Date()))();
  const sourceIds = [input.sideA.sourceId, input.sideB.sourceId];
  const { system, prompt } = buildContradictionAdjudicationPrompt(
    input.sideA,
    input.sideB,
  );

  const runnerResult = await input.modelRunner.runStructured({
    schema: contradictionModelResultSchema,
    system,
    prompt,
    schemaName: "ContradictionAdjudication",
    schemaDescription:
      "Structured semantic adjudication for ContradictionNode (first Orvek kernel proof object).",
    abortSignal: input.abortSignal,
  });

  if (!runnerResult.ok) {
    const code =
      runnerResult.errorCode === "model_timeout"
        ? "model_timeout"
        : "model_execution_failed";
    return envelope({
      outcome: "model_failed",
      semantic: null,
      validation: { status: "not_run", errors: [], warnings: [] },
      refereeStatus: defaultRefereeStatus(),
      audit: buildAudit({
        now,
        sourceIds,
        providerId: runnerResult.providerId,
        modelId: runnerResult.modelId,
        parseValidationOutcome: "model_failed",
        semanticClassification: null,
        abstentionOrErrorCode: code,
        refereeStatus: defaultRefereeStatus(),
      }),
      abstentionReason: null,
      errorCode: code,
      errorMessage: runnerResult.message,
    });
  }

  const parsed = parseContradictionModelResult(runnerResult.object);
  if (!parsed.success) {
    return envelope({
      outcome: "validation_failed",
      semantic: null,
      validation: {
        status: "invalid",
        errors: [`schema_parse_failed: ${parsed.error}`],
        warnings: [],
      },
      refereeStatus: defaultRefereeStatus(),
      audit: buildAudit({
        now,
        sourceIds,
        providerId: runnerResult.providerId,
        modelId: runnerResult.modelId,
        parseValidationOutcome: "invalid",
        semanticClassification: null,
        abstentionOrErrorCode: "schema_parse_failed",
        refereeStatus: defaultRefereeStatus(),
      }),
      abstentionReason: null,
      errorCode: "schema_parse_failed",
      errorMessage: parsed.error,
    });
  }

  const model = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (
    model.proposedObjectType != null &&
    model.proposedObjectType.trim() !== "" &&
    !SUPPORTED_PROPOSED_OBJECT_TYPES.has(model.proposedObjectType)
  ) {
    errors.push(
      `Unsupported proposed object type: ${model.proposedObjectType}`,
    );
  }

  if (
    model.classification !== null &&
    !(CONTRADICTION_CLASSIFICATIONS as readonly string[]).includes(
      model.classification,
    )
  ) {
    errors.push(`Invalid classification: ${String(model.classification)}`);
  }

  if (
    typeof model.confidence !== "number" ||
    model.confidence < 0 ||
    model.confidence > 1 ||
    Number.isNaN(model.confidence)
  ) {
    errors.push(`Confidence out of range: ${String(model.confidence)}`);
  }

  const propErr = requiredPropositionPresent(model);
  if (propErr) errors.push(propErr);

  const spanResult = validateDualSideEvidenceClaims({
    claimA: model.evidenceClaimA,
    claimB: model.evidenceClaimB,
    sourceA: input.sideA,
    sourceB: input.sideB,
  });
  if (!spanResult.ok) {
    errors.push(`${spanResult.code}: ${spanResult.message}`);
  }

  const isAbstaining =
    model.classification === null ||
    (typeof model.abstentionReason === "string" &&
      model.abstentionReason.trim().length > 0 &&
      model.classification === null);

  if (model.classification === "clear_contradiction") {
    if (!spanResult.ok) {
      errors.push(
        "clear_contradiction requires two valid exact evidence spans.",
      );
    }
  }

  if (errors.length > 0) {
    const validation: DeterministicValidationResult = {
      status: "invalid",
      errors,
      warnings,
    };
    return envelope({
      outcome: "validation_failed",
      semantic: null,
      validation,
      refereeStatus: defaultRefereeStatus(),
      audit: buildAudit({
        now,
        sourceIds,
        providerId: runnerResult.providerId,
        modelId: runnerResult.modelId,
        parseValidationOutcome: "invalid",
        semanticClassification: model.classification,
        abstentionOrErrorCode: "validation_failed",
        refereeStatus: defaultRefereeStatus(),
      }),
      abstentionReason: null,
      errorCode: "validation_failed",
      errorMessage: errors.join(" | "),
    });
  }

  if (isAbstaining || model.classification === null) {
    const validation: DeterministicValidationResult = {
      status: "valid",
      errors: [],
      warnings,
    };
    return envelope({
      outcome: "abstained",
      semantic: null,
      validation,
      refereeStatus: defaultRefereeStatus(),
      audit: buildAudit({
        now,
        sourceIds,
        providerId: runnerResult.providerId,
        modelId: runnerResult.modelId,
        parseValidationOutcome: "valid",
        semanticClassification: null,
        abstentionOrErrorCode: "model_abstained",
        refereeStatus: defaultRefereeStatus(),
      }),
      abstentionReason:
        model.abstentionReason?.trim() ||
        "Model abstained from classification.",
      errorCode: "model_abstained",
      errorMessage: null,
    });
  }

  const semantic: ValidatedContradictionSemantic = {
    ...model,
    classification: model.classification,
  };

  let refereeStatus: RefereeStatus = defaultRefereeStatus();
  let refereeEvaluation: ObjectivityRefereeEvaluation | null = null;

  if (input.objectivityReferee) {
    refereeEvaluation = await input.objectivityReferee.evaluate({
      proposedObjectType: KERNEL_FIRST_PROOF_OBJECT,
      validatedSemanticResult: semantic,
      evidenceSummary: `${input.sideA.label} ↔ ${input.sideB.label}`,
      confidence: semantic.confidence,
      alternativeInterpretation: semantic.alternativeInterpretation,
      qualificationContext: [
        semantic.propositionA.qualifications,
        semantic.propositionB.qualifications,
        semantic.contextAndScope,
      ].join(" | "),
      validationWarnings: warnings,
    });
    refereeStatus = refereeEvaluation.outcome;
  }

  const validation: DeterministicValidationResult = {
    status: "valid",
    errors: [],
    warnings,
  };

  return envelope({
    outcome: "semantic_accepted",
    semantic,
    validation,
    refereeStatus,
    audit: buildAudit({
      now,
      sourceIds,
      providerId: runnerResult.providerId,
      modelId: runnerResult.modelId,
      parseValidationOutcome: "valid",
      semanticClassification: semantic.classification,
      abstentionOrErrorCode: null,
      refereeStatus,
    }),
    abstentionReason: null,
    errorCode: null,
    errorMessage: null,
  });
}

/**
 * Helper: Class A semantic result is never sufficient alone for persistence
 * in CEQR-001 (referee not run / selection / provenance incomplete).
 */
export function isPersistenceEligibleInCeqr001(
  result: ContradictionAdjudicationResult,
): false {
  void result;
  return false;
}

export function classificationAllowsContradictionNodeSemantics(
  classification: ContradictionClassification,
): boolean {
  return classification === "clear_contradiction";
}

export function classificationIsNonContradictionNode(
  classification: ContradictionClassification,
): boolean {
  return (
    NON_CONTRADICTION_NODE_CLASSIFICATIONS as readonly ContradictionClassification[]
  ).includes(classification);
}
