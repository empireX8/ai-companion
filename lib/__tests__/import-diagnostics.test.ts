import { describe, expect, it } from "vitest";

import {
  IMPORT_DIAGNOSTICS_RESULT_ERRORS_PREFIX,
  combineResultErrorsWithDiagnostics,
  createEmptyImportRunDiagnostics,
  incrementReasonCodeCount,
  pushDiagnosticSample,
  splitResultErrorsAndDiagnostics,
  toTopReasonCounts,
} from "../import-diagnostics";

describe("import diagnostics helpers", () => {
  it("round-trips diagnostics through resultErrors metadata", () => {
    const diagnostics = createEmptyImportRunDiagnostics();
    diagnostics.importedConversationCount = 2;
    diagnostics.referenceCandidatesAccepted = 3;
    incrementReasonCodeCount(diagnostics, "accepted_reference_candidate", 3);

    const stored = combineResultErrorsWithDiagnostics(["conversation 2: skipped"], diagnostics);
    expect(stored.some((value) => value.startsWith(IMPORT_DIAGNOSTICS_RESULT_ERRORS_PREFIX))).toBe(true);

    const parsed = splitResultErrorsAndDiagnostics(stored);
    expect(parsed.errors).toEqual(["conversation 2: skipped"]);
    expect(parsed.diagnostics?.importedConversationCount).toBe(2);
    expect(parsed.diagnostics?.referenceCandidatesAccepted).toBe(3);
    expect(parsed.diagnostics?.reasonCodeCounts.accepted_reference_candidate).toBe(3);
  });

  it("keeps malformed diagnostics payloads as plain errors", () => {
    const malformed = `${IMPORT_DIAGNOSTICS_RESULT_ERRORS_PREFIX}{not-json`;
    const parsed = splitResultErrorsAndDiagnostics(["warn", malformed]);

    expect(parsed.diagnostics).toBeNull();
    expect(parsed.errors).toEqual(["warn", malformed]);
  });

  it("caps samples deterministically and truncates long snippets", () => {
    const diagnostics = createEmptyImportRunDiagnostics();
    for (let index = 0; index < 8; index += 1) {
      pushDiagnosticSample(diagnostics, "rejected", {
        reason: "too_short",
        snippet: `Sample ${index} ${"x".repeat(300)}`,
        messageId: `m_${index}`,
      });
    }

    expect(diagnostics.samples.rejected).toHaveLength(6);
    expect(diagnostics.samples.rejected[0]?.messageId).toBe("m_0");
    expect((diagnostics.samples.rejected[0]?.snippet.length ?? 0) <= 140).toBe(true);
  });

  it("returns stable top rejection reasons sorted by count then reason", () => {
    const top = toTopReasonCounts(
      {
        b_reason: 4,
        c_reason: 2,
        a_reason: 4,
      },
      2
    );
    expect(top).toEqual([
      { reason: "a_reason", count: 4 },
      { reason: "b_reason", count: 4 },
    ]);
  });
});
