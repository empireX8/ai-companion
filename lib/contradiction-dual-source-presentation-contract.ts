/**
 * CEQR-008 / CEQR-009 — client-safe dual-source presentation contract + copy.
 *
 * Safe for client components and client-facing API type modules.
 *
 * Must NOT import Node crypto, dual-side lineage hashing, Prisma / prismadb,
 * or repaired persistence writers.
 */

export type ContradictionSourceSideRole = "A" | "B";

export type ContradictionSourceUnavailableReason =
  | "legacy_lineage_not_recorded"
  | "partial_lineage"
  | "span_not_found"
  | "span_wrong_user"
  | "message_not_found"
  | "message_wrong_user"
  | "invalid_offsets"
  | "content_hash_mismatch";

export type ContradictionSourceSidePresentation =
  | {
      side: ContradictionSourceSideRole;
      availability: "available";
      spanId: string;
      messageId: string;
      sessionId: string | null;
      sessionOrigin: "APP" | "IMPORTED_ARCHIVE" | null;
      sessionLabel: string | null;
      exactQuote: string;
      charStart: number;
      charEnd: number;
      integrityVerified: true;
      /**
       * Conversation/source timestamp for display.
       * Prefer Message.createdAt; EvidenceSpan.createdAt is recording metadata only.
       */
      recordedAt: string | null;
    }
  | {
      side: ContradictionSourceSideRole;
      availability: "unavailable";
      reason: ContradictionSourceUnavailableReason;
      integrityVerified: false;
    };

export type ContradictionDualSourceLineageState =
  | "complete_verified"
  | "legacy_unavailable"
  | "partial_unavailable"
  | "integrity_unavailable";

export type ContradictionDualSourcePresentation = {
  lineageState: ContradictionDualSourceLineageState;
  sideA: ContradictionSourceSidePresentation;
  sideB: ContradictionSourceSidePresentation;
};

/** Surface context for legacy/partial copy wording. */
export type DualSourceCopySurface = "candidate" | "generic";

/**
 * Calm user-facing copy for lineage notices. Never exposes IDs/hashes/enums.
 * Use `surface: "candidate"` only on the candidate review page.
 */
export function dualSourceLineageNoticeCopy(
  presentation: ContradictionDualSourcePresentation,
  surface: DualSourceCopySurface = "generic",
): string | null {
  switch (presentation.lineageState) {
    case "legacy_unavailable":
      return surface === "candidate"
        ? "Exact source excerpts were not recorded for this legacy candidate."
        : "Exact source excerpts were not recorded for this legacy contradiction.";
    case "partial_unavailable":
      return "One or both exact source excerpts were not recorded for this tension.";
    case "integrity_unavailable":
      return "Exact source excerpts could not be verified for this tension.";
    case "complete_verified":
      return null;
  }
}

export function dualSourceSideUnavailableCopy(
  reason: ContradictionSourceUnavailableReason,
  surface: DualSourceCopySurface = "generic",
): string {
  switch (reason) {
    case "legacy_lineage_not_recorded":
      return surface === "candidate"
        ? "Exact source excerpts were not recorded for this legacy candidate."
        : "Exact source excerpts were not recorded for this legacy contradiction.";
    case "partial_lineage":
      return "Exact source is unavailable for this side.";
    case "span_not_found":
    case "span_wrong_user":
    case "message_not_found":
    case "message_wrong_user":
    case "invalid_offsets":
    case "content_hash_mismatch":
      return "Exact source is unavailable for this side.";
  }
}

export function dualSourceSessionOriginCopy(
  origin: "APP" | "IMPORTED_ARCHIVE" | null,
): string | null {
  if (origin === "IMPORTED_ARCHIVE") return "Imported conversation";
  if (origin === "APP") return "App conversation";
  return null;
}
