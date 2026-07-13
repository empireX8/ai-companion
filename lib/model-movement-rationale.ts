/**
 * Movement rationale encoding — distinct from userFacingSummary (movement copy)
 * and from evidence pointer surfacing rationale.
 *
 * Stored durably in ModelUpdate.internalNotes using a fixed prefix so no schema
 * migration is required for this assault slice.
 */

export const MOVEMENT_RATIONALE_INTERNAL_NOTES_PREFIX = "movementRationale::";

/** Semicolon only splits rationale from following internal-note markers — not rationale body text. */
const INTERNAL_NOTES_MARKER_BOUNDARY =
  /;(?=(?:candidateLane:|processorVersion:|devFixture:|[a-zA-Z][a-zA-Z0-9_]*:))/;

export type MovementRationaleAssessmentBlocker =
  | "missing_rationale"
  | "rationale_equals_movement_summary"
  | "rationale_equals_evidence_text";

export type MovementRationaleAssessment = {
  recorded: boolean;
  blockers: MovementRationaleAssessmentBlocker[];
};

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function rationaleSliceFromInternalNotes(
  internalNotes: string,
): { prefixIndex: number; rationale: string } | null {
  const prefixIndex = internalNotes.indexOf(MOVEMENT_RATIONALE_INTERNAL_NOTES_PREFIX);
  if (prefixIndex === -1) {
    return null;
  }

  const afterPrefix = internalNotes.slice(
    prefixIndex + MOVEMENT_RATIONALE_INTERNAL_NOTES_PREFIX.length,
  );
  const markerMatch = afterPrefix.match(INTERNAL_NOTES_MARKER_BOUNDARY);
  const rationale = markerMatch
    ? afterPrefix.slice(0, markerMatch.index)
    : afterPrefix;

  return { prefixIndex, rationale };
}

export function encodeMovementRationaleInInternalNotes(
  internalNotes: string | null | undefined,
  rationale: string,
): string {
  const trimmed = rationale.trim();
  const withoutExisting = stripMovementRationaleFromInternalNotes(internalNotes);
  const encoded = `${MOVEMENT_RATIONALE_INTERNAL_NOTES_PREFIX}${trimmed}`;
  if (!withoutExisting) {
    return encoded;
  }
  return `${encoded};${withoutExisting}`;
}

export function stripMovementRationaleFromInternalNotes(
  internalNotes: string | null | undefined,
): string | null {
  if (!hasText(internalNotes)) {
    return null;
  }

  const slice = rationaleSliceFromInternalNotes(internalNotes);
  if (!slice) {
    return internalNotes.trim();
  }

  const before = internalNotes.slice(0, slice.prefixIndex).trim();
  const afterPrefixStart =
    slice.prefixIndex + MOVEMENT_RATIONALE_INTERNAL_NOTES_PREFIX.length;
  const afterPrefix = internalNotes.slice(afterPrefixStart);
  const markerMatch = afterPrefix.match(INTERNAL_NOTES_MARKER_BOUNDARY);
  const after = markerMatch
    ? afterPrefix.slice(markerMatch.index! + 1).trim()
    : "";

  const parts = [before, after].map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(";") : null;
}

export function decodeMovementRationaleFromInternalNotes(
  internalNotes: string | null | undefined,
): string | null {
  if (!hasText(internalNotes)) {
    return null;
  }

  const slice = rationaleSliceFromInternalNotes(internalNotes);
  if (!slice) {
    // Backward compatibility: legacy semicolon-split encoding (rationale had no semicolons).
    for (const part of internalNotes.split(";")) {
      const trimmed = part.trim();
      if (trimmed.startsWith(MOVEMENT_RATIONALE_INTERNAL_NOTES_PREFIX)) {
        const rationale = trimmed
          .slice(MOVEMENT_RATIONALE_INTERNAL_NOTES_PREFIX.length)
          .trim();
        return rationale || null;
      }
    }
    return null;
  }

  const rationale = slice.rationale.trim();
  return rationale || null;
}

export function assessMovementRationale(args: {
  rationale: string | null | undefined;
  movementSummary: string | null | undefined;
  evidenceTexts?: string[];
}): MovementRationaleAssessment {
  const blockers: MovementRationaleAssessmentBlocker[] = [];

  if (!hasText(args.rationale)) {
    blockers.push("missing_rationale");
  } else if (
    hasText(args.movementSummary) &&
    args.rationale.trim() === args.movementSummary.trim()
  ) {
    blockers.push("rationale_equals_movement_summary");
  } else {
    const evidenceTexts = (args.evidenceTexts ?? []).map((text) => text.trim()).filter(Boolean);
    if (evidenceTexts.some((text) => text === args.rationale!.trim())) {
      blockers.push("rationale_equals_evidence_text");
    }
  }

  return {
    recorded: blockers.length === 0,
    blockers,
  };
}
