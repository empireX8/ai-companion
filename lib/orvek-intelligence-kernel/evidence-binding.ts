/**
 * CEQR-020 — bind provider boundary-index selections to domain evidence claims.
 *
 * Separated from evidence-validation.ts to avoid a circular import with
 * lexical-boundary-catalog.ts.
 */

import {
  bindExactEvidenceClaimFromOffsets,
  buildEvidenceSideBindDiagnostic,
  type BindDualSideEvidenceClaimsResult,
  type BindEvidenceClaimResult,
  type EvidenceOffsetPair,
  type EvidenceSideBindDiagnostic,
} from "./evidence-validation";
import {
  resolveBoundaryIndexSelection,
  type LexicalBoundaryEntry,
} from "./lexical-boundary-catalog";
import type { EvidenceSpanSelection } from "./structured-output";
import type { KernelSourceUnit } from "./types";

/**
 * Bind from CEQR-020 boundary-index transport selection.
 * Resolves indices via the code-owned catalog, then binds offsets.
 *
 * Category-B resolve failures (equal/reversed/lexical) preserve resolved
 * offsets for sanitized diagnostics even though binding fails.
 *
 * When `catalog` is provided it must be the exact prevalidated catalog used
 * in the prompt so prompt and binding share one index authority.
 */
export function bindExactEvidenceClaimFromBoundarySelection(
  source: KernelSourceUnit,
  selection: EvidenceSpanSelection,
  catalog?: readonly LexicalBoundaryEntry[],
): {
  bind: BindEvidenceClaimResult;
  resolved: EvidenceOffsetPair | null;
} {
  const resolved = resolveBoundaryIndexSelection(
    source.sourceText,
    selection,
    catalog,
  );
  if (!resolved.ok) {
    const resolvedOffsets: EvidenceOffsetPair | null =
      resolved.resolveKind === "resolved_invalid_span"
        ? {
            startOffset: resolved.startOffset,
            endOffset: resolved.endOffset,
          }
        : null;
    return {
      bind: {
        ok: false,
        code: resolved.code,
        message: resolved.message,
      },
      resolved: resolvedOffsets,
    };
  }

  const bind = bindExactEvidenceClaimFromOffsets(source, {
    startOffset: resolved.startOffset,
    endOffset: resolved.endOffset,
  });
  return {
    bind,
    resolved: {
      startOffset: resolved.startOffset,
      endOffset: resolved.endOffset,
    },
  };
}

/**
 * Bind ordered Side A / Side B claims from authoritative units + boundary indices.
 * Side ordering is fixed by argument position; sides cannot be swapped by the model.
 * Both sides are always evaluated so diagnostics can identify A, B, or both.
 */
export function bindDualSideEvidenceClaims(args: {
  selectionA: EvidenceSpanSelection;
  selectionB: EvidenceSpanSelection;
  sourceA: KernelSourceUnit;
  sourceB: KernelSourceUnit;
  /** Exact prevalidated Side A catalog from the prompt (optional for fixtures). */
  catalogA?: readonly LexicalBoundaryEntry[];
  /** Exact prevalidated Side B catalog from the prompt (optional for fixtures). */
  catalogB?: readonly LexicalBoundaryEntry[];
}): BindDualSideEvidenceClaimsResult {
  const aAttempt = bindExactEvidenceClaimFromBoundarySelection(
    args.sourceA,
    args.selectionA,
    args.catalogA,
  );
  const bAttempt = bindExactEvidenceClaimFromBoundarySelection(
    args.sourceB,
    args.selectionB,
    args.catalogB,
  );

  const sideDiagnostics: [
    EvidenceSideBindDiagnostic,
    EvidenceSideBindDiagnostic,
  ] = [
    buildEvidenceSideBindDiagnostic({
      side: "A",
      source: args.sourceA,
      selection: args.selectionA,
      bind: aAttempt.bind,
      resolved: aAttempt.resolved,
    }),
    buildEvidenceSideBindDiagnostic({
      side: "B",
      source: args.sourceB,
      selection: args.selectionB,
      bind: bAttempt.bind,
      resolved: bAttempt.resolved,
    }),
  ];

  const sideErrors: string[] = [];
  if (!aAttempt.bind.ok) {
    sideErrors.push(`Side A: ${aAttempt.bind.message}`);
  }
  if (!bAttempt.bind.ok) {
    sideErrors.push(`Side B: ${bAttempt.bind.message}`);
  }

  if (!aAttempt.bind.ok) {
    return {
      ok: false,
      code: aAttempt.bind.code,
      message: aAttempt.bind.message,
      sideDiagnostics,
      sideErrors,
    };
  }
  if (!bAttempt.bind.ok) {
    return {
      ok: false,
      code: bAttempt.bind.code,
      message: bAttempt.bind.message,
      sideDiagnostics,
      sideErrors,
    };
  }

  return {
    ok: true,
    claimA: aAttempt.bind.claim,
    claimB: bAttempt.bind.claim,
    sideDiagnostics,
  };
}
