/**
 * ContradictionNode semantic adjudicator (CEQR-001 + CEQR-003).
 *
 * Model-assisted structured adjudication + deterministic post-validation.
 * CEQR-003 strengthens context/qualifier preservation in the prompt contract
 * and fail-closed internal consistency gates. Returns an inspectable
 * adjudication result only — no persistence, no candidate eligibility
 * decision, no createCandidate field.
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
  notRunObjectivityRefereeResult,
  objectivityRefereeResultToStatus,
  runObjectivityRefereeSafely,
  type ObjectivityReferee,
  type ObjectivityRefereeResult,
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
     * Always null through CEQR-004 / referee dependency gate.
     */
    persistenceDecision: null;
    /** Explicitly never authored by the model as eligibility. */
    createCandidate: undefined;
    /**
     * Full inspectable Objectivity Referee result.
     * ContinuationAllowed never authorises persistence.
     */
    referee: ObjectivityRefereeResult;
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
    "- clear_contradiction: two propositions that cannot both be true under materially matching actor, subject, timeframe, scope, context, and modality — after all material qualifiers are preserved",
    "- plausible_unresolved_tension: genuine pull where both sides may be partially true — NOT a ContradictionNode",
    "- compatible_states: apparent contrast explained by scope/time/actor/modality/coexistence/qualifiers — NOT a ContradictionNode",
    "- insufficient_or_misaligned_context: missing scope, mispairing, unrelated overlap — NOT a ContradictionNode",
    "",
    "CONTROLLING PRINCIPLE — preserve before classifying:",
    "Contradiction classification must compare the propositions the evidence actually supports, including their material qualifiers.",
    "Do not classify a contradiction merely because unqualified summaries sound opposed.",
    "Before normalizing or classifying, preserve: actor; subject; timeframe; context; scope; negation; modality; frequency; condition; exception; uncertainty; intention versus action; partial compliance; quoted or attributed speech; emotional/physiological state versus chosen reasoning or behaviour.",
    "",
    "Qualifier-preservation hard rules:",
    "- Preserve all material qualifications before normalization. Normalized propositions must not silently erase conditions, exceptions, frequencies, time bounds, uncertainty, or partial compliance.",
    "- Distinguish universal, habitual, occasional, and isolated claims (never/always vs usually/sometimes vs once).",
    "- Distinguish desire, intention, obligation, attempt, capacity, action, and outcome (want/should/try ≠ completed behaviour).",
    "- Distinguish present, past, future, and changed-belief claims; do not compare \"used to\" as simultaneous with \"now\".",
    "- Preserve conditions, exceptions, and scope limits (\"when tired\", \"except on special occasions\", \"in meetings\").",
    "- Preserve partial compliance. PARTIAL COMPLIANCE MUST NOT BE classified as clear_contradiction.",
    "  Example: \"I need to review after I read\" vs \"I did review it after every read, but I did not do the question exercises\" → tension/obstacle/compatible, never clear_contradiction of \"did not review\".",
    "- Preserve negation and nested negation. Do not flatten \"I'm not saying I never want help\" into \"I never want help\".",
    "- Preserve attribution and quoted speech. Another person's statement is not the speaker's proposition unless endorsed.",
    "- Avoid upgrading \"usually\" to \"always\"; \"sometimes\" to an unqualified claim; \"right now\" to a permanent trait.",
    "- Avoid upgrading \"want/should/try\" to completed behaviour.",
    "- Avoid reducing partial failure or a single lapse to total non-compliance or rejection of a general tendency.",
    "- Use abstention (classification null + abstentionReason) when context, actor, scope, or attribution cannot be safely preserved.",
    "- In rationale, explain which qualifiers materially affected classification.",
    "- In whatWouldChangeClassification, state what missing information would change the classification.",
    "",
    "Compatibility flags (must be truthful; clear_contradiction forbids all of them being true):",
    "- bothCanSimultaneouslyBeTrue",
    "- changedBeliefOverTime",
    "- intentionVersusOutcome",
    "- goalVersusObstacle",
    "- emotionalOrPhysiologicalVersusReasoningStandard",
    "",
    "Hard instructions:",
    "- Abstention is valid and preferred over weak classification. Set classification to null and provide abstentionReason when unsure.",
    "- When classifying, abstentionReason must be null.",
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
    "- Fill actor, subject, timeframe, modality, qualifications, and contextAndScope with non-blank truthful values for each classified or abstaining structured result.",
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
    "Preserve material qualifiers on both sides before normalizing. Classify only the qualified propositions.",
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
    if (!fields.qualifications.trim()) {
      return `Proposition ${side} qualifications is empty.`;
    }
    return null;
  };

  if (!model.contextAndScope.trim()) {
    return "contextAndScope is empty.";
  }

  return check("A", model.propositionA) ?? check("B", model.propositionB);
}

/**
 * Fail-closed internal consistency gates (CEQR-003).
 * Rejects inconsistent structured output; never silently reclassifies.
 * Does not decide semantic contradiction from keywords.
 */
export function collectSemanticConsistencyErrors(
  model: ContradictionModelResult,
): string[] {
  const errors: string[] = [];
  const abstentionText =
    typeof model.abstentionReason === "string"
      ? model.abstentionReason.trim()
      : "";
  const hasAffirmativeAbstention = abstentionText.length > 0;
  const hasClassification = model.classification !== null;

  // F. An abstaining result cannot also assert a non-null classification.
  // G. A classified result cannot carry an affirmative abstention reason.
  if (hasClassification && hasAffirmativeAbstention) {
    errors.push(
      "internal_inconsistency: non-null classification cannot coexist with affirmative abstentionReason.",
    );
  }

  if (model.classification === "clear_contradiction") {
    // A–E: clear_contradiction cannot coexist with compatibility flags.
    if (model.bothCanSimultaneouslyBeTrue) {
      errors.push(
        "internal_inconsistency: clear_contradiction cannot coexist with bothCanSimultaneouslyBeTrue: true.",
      );
    }
    if (model.changedBeliefOverTime) {
      errors.push(
        "internal_inconsistency: clear_contradiction cannot coexist with changedBeliefOverTime: true.",
      );
    }
    if (model.intentionVersusOutcome) {
      errors.push(
        "internal_inconsistency: clear_contradiction cannot coexist with intentionVersusOutcome: true.",
      );
    }
    if (model.goalVersusObstacle) {
      errors.push(
        "internal_inconsistency: clear_contradiction cannot coexist with goalVersusObstacle: true.",
      );
    }
    if (model.emotionalOrPhysiologicalVersusReasoningStandard) {
      errors.push(
        "internal_inconsistency: clear_contradiction cannot coexist with emotionalOrPhysiologicalVersusReasoningStandard: true.",
      );
    }
  }

  return errors;
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
  referee?: ObjectivityRefereeResult;
  audit: KernelAuditMetadata;
  abstentionReason: string | null;
  errorCode: ContradictionAdjudicationResult["errorCode"];
  errorMessage: string | null;
}): ContradictionAdjudicationResult {
  return {
    ...args,
    referee: args.referee ?? notRunObjectivityRefereeResult(),
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

  errors.push(...collectSemanticConsistencyErrors(model));

  const spanResult = validateDualSideEvidenceClaims({
    claimA: model.evidenceClaimA,
    claimB: model.evidenceClaimB,
    sourceA: input.sideA,
    sourceB: input.sideB,
  });
  if (!spanResult.ok) {
    errors.push(`${spanResult.code}: ${spanResult.message}`);
  }

  const isAbstaining = model.classification === null;

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

  // Objectivity Referee runs only after deterministic validation succeeds.
  // It evaluates a proposed ContradictionNode only for Class A semantics —
  // it must never upgrade Class B/C/D into CN eligibility.
  let referee = notRunObjectivityRefereeResult();
  let refereeStatus: RefereeStatus = defaultRefereeStatus();

  if (
    input.objectivityReferee &&
    semantic.classification === "clear_contradiction"
  ) {
    referee = await runObjectivityRefereeSafely({
      referee: input.objectivityReferee,
      input: {
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
      },
    });
    refereeStatus = objectivityRefereeResultToStatus(referee);
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
    referee,
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
