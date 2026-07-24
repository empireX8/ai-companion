/**
 * CEQR-010 — controlled natural-entry contradiction proof orchestrator.
 *
 * Compatibility wrapper over the production-neutral natural-entry pipeline
 * (`runContradictionNaturalEntry`). Keeps the controlled-proof API and
 * proofVersion identity for existing proofs/tests.
 *
 * Deterministic injected StructuredModelRunner / ObjectivityReferee only.
 * Does NOT wire message-send, import, live providers, or the real account DB
 * by itself. Production message ingestion uses the neutral orchestrator via
 * `runProductionContradictionIngestion`.
 */

import {
  runContradictionNaturalEntry,
  type ContradictionNaturalEntryInput,
  type ContradictionNaturalEntryMessageResolver,
  type ContradictionNaturalEntryOutcome,
  type ContradictionNaturalEntryPresentationStatus,
  type ContradictionNaturalEntryResult,
} from "./contradiction-natural-entry";
import type { ContradictionDualSourcePresentation } from "./contradiction-dual-source-presentation";
import type { ContradictionRepairedPersistenceResult } from "./contradiction-repaired-persistence";
import type { ContradictionSameSessionSelectionResult } from "./contradiction-same-session-selection";

export const CONTRADICTION_CONTROLLED_NATURAL_ENTRY_PROOF_VERSION =
  "contradiction-controlled-natural-entry-proof-v1" as const;

/**
 * Honest terminal outcomes for the controlled proof.
 * Deterministic fixtures are not live AI judgments.
 */
export type ControlledNaturalEntryProofOutcome =
  ContradictionNaturalEntryOutcome;

export type ControlledNaturalEntryProofGateStage =
  ContradictionNaturalEntryResult["gateStoppedAt"] extends infer T
    ? Exclude<T, null>
    : never;

export type ControlledNaturalEntryPresentationStatus =
  ContradictionNaturalEntryPresentationStatus;

export type ControlledNaturalEntryMessageResolver =
  ContradictionNaturalEntryMessageResolver;

/**
 * Public natural-entry boundary: persisted current Message + same-session
 * ReferenceItem rows with authoritative sourceMessage payloads.
 *
 * Does NOT accept preassembled KernelSourceUnit / SideACandidate arrays.
 */
export type ControlledNaturalEntryProofInput = ContradictionNaturalEntryInput;

export type ControlledNaturalEntryProofResult = {
  proofVersion: typeof CONTRADICTION_CONTROLLED_NATURAL_ENTRY_PROOF_VERSION;
  outcome: ControlledNaturalEntryProofOutcome;
  /** True only when ContradictionNode.create ran successfully in this invocation. */
  writeExecuted: boolean;
  /** True only when persistRepairedContradictionCandidate was called. */
  writerInvoked: boolean;
  /**
   * Stage at which a failed/blocked run stopped.
   * Null on successful created/reused outcomes.
   */
  gateStoppedAt: ControlledNaturalEntryProofGateStage | null;
  /** Persistence / selection / lineage / confidence failure only — never presentation. */
  failureCode: string | null;
  failureMessage: string | null;
  selection: ContradictionSameSessionSelectionResult;
  adjudicatorCallCount: number;
  refereeCallCount: number;
  contradictionNodeId: string | null;
  sideASourceSpanId: string | null;
  sideBSourceSpanId: string | null;
  contradictionNodeOutcome: "created" | "reused" | null;
  recommendedStorageConfidence: "low" | "medium" | "high" | null;
  effectiveConfidence: number | null;
  dualSourcePresentation: ContradictionDualSourcePresentation | null;
  presentationStatus: ControlledNaturalEntryPresentationStatus;
  presentationFailureCode: string | null;
  presentationFailureMessage: string | null;
  persistenceResult: ContradictionRepairedPersistenceResult | null;
};

/**
 * Execute the controlled natural-entry contradiction proof chain.
 *
 * Thin compatibility wrapper: delegates to `runContradictionNaturalEntry`
 * and stamps the controlled-proof version identity.
 */
export async function runControlledContradictionNaturalEntryProof(
  input: ControlledNaturalEntryProofInput,
): Promise<ControlledNaturalEntryProofResult> {
  const result = await runContradictionNaturalEntry(input);
  const { pipelineVersion: _pipelineVersion, ...rest } = result;
  void _pipelineVersion;
  return {
    proofVersion: CONTRADICTION_CONTROLLED_NATURAL_ENTRY_PROOF_VERSION,
    ...rest,
  };
}
