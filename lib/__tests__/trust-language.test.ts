/**
 * trust-language.test.ts — P4-10 regression protection
 *
 * Guards the terminology registry and banned-language guardrails.
 * Fails fast if approved terms drift or banned terms are weakened.
 */

import { describe, it, expect } from "vitest";
import {
  PRODUCT_NAME,
  SURFACE_NAMES,
  PATTERN_STATUS_LABELS,
  PATTERN_STRENGTH_LABELS,
  ACTION_TERMS,
  BANNED_TERMS,
  containsBannedTerm,
  findAllBannedTerms,
  isTrustSafe,
} from "../trust-language";
import {
  STRENGTH_LABELS,
  EVIDENCE_LIMITED,
  evidenceScopeLabel,
  EARLY_SIGNAL_QUALIFIER,
  LOW_DATA_BANNER,
  candidateQualifier,
  GATE_CANDIDATE,
  GATE_PAUSED,
  GATE_NOT_ENOUGH_OBSERVATIONS,
  RECEIPT_EMPTY,
  RECEIPT_TOGGLE_OPEN,
  receiptToggleClosed,
  RECEIPT_SESSION_UNKNOWN,
  receiptSessionLabel,
  RECEIPT_VIEW_IN_HISTORY,
  SECTION_EMPTY_PRIMARY,
  SECTION_EMPTY_SECONDARY,
  SCOPE_EMPTY,
  scopeLabel,
  ACTION_SUGGEST_IDLE,
  ACTION_SUGGEST_BUSY,
  REFLECTION_LABEL,
  REFLECTION_PLACEHOLDER,
  CLAIM_CONTROL_PRIMARY,
  CLAIM_CONTROL_CONTEXT,
  CLAIM_CONTROL_REFINEMENT,
  CLAIM_CONTROL_REFINE_PROMPT,
  ACTION_STEP_COMPLETED,
  ACTION_STEP_SKIPPED,
  ACTION_STEP_ABANDONED,
  ACTION_TRY_DIFFERENT,
  ACTION_ILL_TRY_THIS,
  ACTION_NOT_NOW,
  ACTION_DONE,
  ACTION_DIDNT_WORK,
  ACTIVE_STEPS_HEADING,
  ACTIVE_STEPS_SUBHEADING,
  ACTIVE_STEPS_STATUS_PROGRESS,
  ACTIVE_STEPS_STATUS_PENDING,
  ACTIVE_STEPS_FROM_PREFIX,
  RESOLVED_SECTION_HEADING,
  resolvedSectionSummary,
} from "../trust-copy";

// ── P4-01: Terminology registry ───────────────────────────────────────────────

describe("P4-01: PRODUCT_NAME", () => {
  it("is MindLab", () => {
    expect(PRODUCT_NAME).toBe("MindLab");
  });
});

describe("P4-01: SURFACE_NAMES", () => {
  it("contains exactly the visible V1 surface names", () => {
    expect(Object.values(SURFACE_NAMES)).toEqual([
      "Chat",
      "Check-ins",
      "Patterns",
      "History",
      "Actions",
      "Context",
      "Memories",
      "Import",
      "Settings",
    ]);
  });
});

describe("P4-01: PATTERN_STATUS_LABELS", () => {
  it("maps all four statuses", () => {
    expect(PATTERN_STATUS_LABELS.candidate).toBe("Candidate");
    expect(PATTERN_STATUS_LABELS.active).toBe("Active");
    expect(PATTERN_STATUS_LABELS.paused).toBe("Paused");
    expect(PATTERN_STATUS_LABELS.dismissed).toBe("Dismissed");
  });
});

describe("P4-01: PATTERN_STRENGTH_LABELS", () => {
  it("is qualitative only — no numeric values", () => {
    for (const label of Object.values(PATTERN_STRENGTH_LABELS)) {
      expect(label).not.toMatch(/\d+/);
      expect(label).not.toMatch(/%/);
    }
  });

  it("contains tentative, developing, established labels", () => {
    expect(PATTERN_STRENGTH_LABELS.tentative).toBe("Tentative signal");
    expect(PATTERN_STRENGTH_LABELS.developing).toBe("Developing pattern");
    expect(PATTERN_STRENGTH_LABELS.established).toBe("Established pattern");
  });
});

describe("P4-01: ACTION_TERMS", () => {
  it("smallExperiment is 'small experiment'", () => {
    expect(ACTION_TERMS.smallExperiment).toBe("small experiment");
  });
  it("nextStep is 'next step'", () => {
    expect(ACTION_TERMS.nextStep).toBe("next step");
  });
});

// ── P4-02: Banned-language registry ──────────────────────────────────────────

describe("P4-02: BANNED_TERMS registry", () => {
  it("is a non-empty array", () => {
    expect(BANNED_TERMS.length).toBeGreaterThan(0);
  });

  it("all terms are non-empty strings", () => {
    for (const term of BANNED_TERMS) {
      expect(typeof term).toBe("string");
      expect(term.length).toBeGreaterThan(0);
    }
  });

  it("contains clinical terms", () => {
    const terms = BANNED_TERMS as readonly string[];
    expect(terms).toContain("diagnos");
    expect(terms).toContain("symptom");
    expect(terms).toContain("therapy");
    expect(terms).toContain("therapeutic");
  });

  it("contains score / rating terms", () => {
    const terms = BANNED_TERMS as readonly string[];
    expect(terms).toContain("confidence score");
    expect(terms).toContain("numeric score");
    expect(terms).toContain("salience score");
  });

  it("contains forecast terms", () => {
    const terms = BANNED_TERMS as readonly string[];
    expect(terms).toContain("save forecast");
    expect(terms).toContain("your forecasts");
    expect(terms).toContain("active forecasts");
  });

  it("contains stale product names", () => {
    const terms = BANNED_TERMS as readonly string[];
    expect(terms).toContain("double app");
    expect(terms).toContain("the double");
  });

  it("contains certainty overclaim terms", () => {
    const terms = BANNED_TERMS as readonly string[];
    expect(terms).toContain("definitively proves");
    expect(terms).toContain("this proves");
  });

  it("contains internal ontology leakage terms", () => {
    const terms = BANNED_TERMS as readonly string[];
    expect(terms).toContain("escalation level");
  });
});

// ── P4-02: Checking utilities ─────────────────────────────────────────────────

describe("P4-02: containsBannedTerm", () => {
  it("returns null for clean text", () => {
    expect(containsBannedTerm("This is a developing pattern.")).toBeNull();
  });

  it("detects a banned term (case-insensitive)", () => {
    expect(containsBannedTerm("Your CONFIDENCE SCORE is high.")).toBe("confidence score");
  });

  it("detects a clinical term", () => {
    expect(containsBannedTerm("We diagnosed a symptom.")).toBeTruthy();
  });

  it("detects stale product name", () => {
    expect(containsBannedTerm("Use the Double App for this.")).toBe("double app");
  });

  it("returns the first match only", () => {
    const result = containsBannedTerm("save forecast and diagnos this");
    expect(result).toBeTruthy();
  });
});

describe("P4-02: findAllBannedTerms", () => {
  it("returns empty array for clean text", () => {
    expect(findAllBannedTerms("Tentative signal, still gathering data.")).toEqual([]);
  });

  it("returns all matching terms", () => {
    const matches = findAllBannedTerms("Confidence score and save forecast in this text.");
    expect(matches).toContain("confidence score");
    expect(matches).toContain("save forecast");
  });
});

describe("P4-02: isTrustSafe", () => {
  it("returns true for clean text", () => {
    expect(isTrustSafe("Developing pattern across 3 sessions.")).toBe(true);
  });

  it("returns false for text with a banned term", () => {
    expect(isTrustSafe("Your salience score is very high.")).toBe(false);
  });
});

// ── P4-03: Trust-copy / trust ladder ─────────────────────────────────────────

describe("P4-03: STRENGTH_LABELS", () => {
  it("matches PATTERN_STRENGTH_LABELS", () => {
    expect(STRENGTH_LABELS["tentative"]).toBe(PATTERN_STRENGTH_LABELS.tentative);
    expect(STRENGTH_LABELS["developing"]).toBe(PATTERN_STRENGTH_LABELS.developing);
    expect(STRENGTH_LABELS["established"]).toBe(PATTERN_STRENGTH_LABELS.established);
  });
});

describe("P4-03: EVIDENCE_LIMITED", () => {
  it("contains no numeric score language", () => {
    expect(isTrustSafe(EVIDENCE_LIMITED)).toBe(true);
  });
});

describe("P4-03: evidenceScopeLabel", () => {
  it("formats singular correctly", () => {
    expect(evidenceScopeLabel(1, 1)).toBe("1 observation · 1 session");
  });

  it("formats plural correctly", () => {
    expect(evidenceScopeLabel(3, 2)).toBe("3 observations · 2 sessions");
  });
});

describe("P4-03: EARLY_SIGNAL_QUALIFIER", () => {
  it("is trust-safe", () => {
    expect(isTrustSafe(EARLY_SIGNAL_QUALIFIER)).toBe(true);
  });

  it("does not claim certainty", () => {
    expect(EARLY_SIGNAL_QUALIFIER).not.toMatch(/definitively/i);
    expect(EARLY_SIGNAL_QUALIFIER).not.toMatch(/proves/i);
  });
});

describe("P4-03: LOW_DATA_BANNER", () => {
  it("is trust-safe", () => {
    expect(isTrustSafe(LOW_DATA_BANNER.heading)).toBe(true);
    expect(isTrustSafe(LOW_DATA_BANNER.body)).toBe(true);
  });
});

describe("P4-03: candidateQualifier", () => {
  it("singular form", () => {
    expect(candidateQualifier(1)).toContain("1 early signal");
  });

  it("plural form", () => {
    expect(candidateQualifier(3)).toContain("3 early signals");
    expect(candidateQualifier(3)).toContain("none confirmed");
  });
});

// ── P4-06: Gate copy ──────────────────────────────────────────────────────────

describe("P4-06: gate copy", () => {
  it("GATE_CANDIDATE is trust-safe", () => {
    expect(isTrustSafe(GATE_CANDIDATE)).toBe(true);
  });

  it("GATE_PAUSED is trust-safe", () => {
    expect(isTrustSafe(GATE_PAUSED)).toBe(true);
  });

  it("GATE_NOT_ENOUGH_OBSERVATIONS is trust-safe", () => {
    expect(isTrustSafe(GATE_NOT_ENOUGH_OBSERVATIONS)).toBe(true);
  });
});

// ── P4-04: Receipt copy ───────────────────────────────────────────────────────

describe("P4-04: receipt copy", () => {
  it("RECEIPT_EMPTY is trust-safe", () => {
    expect(isTrustSafe(RECEIPT_EMPTY)).toBe(true);
  });

  it("receiptToggleClosed singular", () => {
    expect(receiptToggleClosed(1)).toBe("Show 1 observation");
  });

  it("receiptToggleClosed plural", () => {
    expect(receiptToggleClosed(4)).toBe("Show 4 observations");
  });

  it("RECEIPT_TOGGLE_OPEN is 'Show less'", () => {
    expect(RECEIPT_TOGGLE_OPEN).toBe("Show less");
  });

  it("RECEIPT_SESSION_UNKNOWN is trust-safe", () => {
    expect(isTrustSafe(RECEIPT_SESSION_UNKNOWN)).toBe(true);
  });

  it("receiptSessionLabel includes suffix", () => {
    expect(receiptSessionLabel("abc123")).toBe("Session abc123");
  });

  it("RECEIPT_VIEW_IN_HISTORY is trust-safe", () => {
    expect(isTrustSafe(RECEIPT_VIEW_IN_HISTORY)).toBe(true);
  });
});

// ── P4-07: Section and scope copy ────────────────────────────────────────────

describe("P4-07: section empty states", () => {
  it("SECTION_EMPTY_PRIMARY is trust-safe", () => {
    expect(isTrustSafe(SECTION_EMPTY_PRIMARY)).toBe(true);
  });

  it("SECTION_EMPTY_SECONDARY is trust-safe", () => {
    expect(isTrustSafe(SECTION_EMPTY_SECONDARY)).toBe(true);
  });
});

describe("P4-07: scope copy", () => {
  it("SCOPE_EMPTY is trust-safe", () => {
    expect(isTrustSafe(SCOPE_EMPTY)).toBe(true);
  });

  it("scopeLabel singular", () => {
    const label = scopeLabel(1, 1);
    expect(label).toContain("1 message");
    expect(label).toContain("1 session");
  });

  it("scopeLabel plural", () => {
    const label = scopeLabel(42, 7);
    expect(label).toContain("42 messages");
    expect(label).toContain("7 sessions");
  });
});

// ── P4-06: Action-layer copy ──────────────────────────────────────────────────

describe("P4-06: action-layer copy", () => {
  it("ACTION_SUGGEST_IDLE uses approved term from ACTION_TERMS", () => {
    expect(ACTION_SUGGEST_IDLE.toLowerCase()).toContain(ACTION_TERMS.smallExperiment);
  });

  it("ACTION_SUGGEST_BUSY is trust-safe", () => {
    expect(isTrustSafe(ACTION_SUGGEST_BUSY)).toBe(true);
  });

  it("REFLECTION_LABEL is trust-safe", () => {
    expect(isTrustSafe(REFLECTION_LABEL)).toBe(true);
  });

  it("REFLECTION_PLACEHOLDER is trust-safe", () => {
    expect(isTrustSafe(REFLECTION_PLACEHOLDER)).toBe(true);
  });
});

// ── Cross-cut: no banned terms in any approved copy ───────────────────────────

describe("P4-10: all approved copy is trust-safe", () => {
  const approvedStrings = [
    PRODUCT_NAME,
    ...Object.values(SURFACE_NAMES),
    ...Object.values(PATTERN_STATUS_LABELS),
    ...Object.values(PATTERN_STRENGTH_LABELS),
    ...Object.values(ACTION_TERMS),
    ...Object.values(STRENGTH_LABELS),
    EVIDENCE_LIMITED,
    EARLY_SIGNAL_QUALIFIER,
    LOW_DATA_BANNER.heading,
    LOW_DATA_BANNER.body,
    GATE_CANDIDATE,
    GATE_PAUSED,
    GATE_NOT_ENOUGH_OBSERVATIONS,
    RECEIPT_EMPTY,
    RECEIPT_TOGGLE_OPEN,
    RECEIPT_SESSION_UNKNOWN,
    RECEIPT_VIEW_IN_HISTORY,
    SECTION_EMPTY_PRIMARY,
    SECTION_EMPTY_SECONDARY,
    SCOPE_EMPTY,
    ACTION_SUGGEST_IDLE,
    ACTION_SUGGEST_BUSY,
    REFLECTION_LABEL,
    REFLECTION_PLACEHOLDER,
  ];

  for (const str of approvedStrings) {
    it(`"${str.slice(0, 40)}..." contains no banned terms`, () => {
      expect(isTrustSafe(str)).toBe(true);
    });
  }
});

// ── P4-10: Rendered surface copy shapes ───────────────────────────────────────
// These tests protect the exact visible strings that appear in real components.
// If copy drifts, these catch it — not just registry shape changes.

describe("PatternClaimCard — scope line / early signal language", () => {
  it("EVIDENCE_LIMITED is exact expected copy", () => {
    expect(EVIDENCE_LIMITED).toBe("Based on limited history");
  });

  it("evidenceScopeLabel(1, 1) is singular/singular", () => {
    expect(evidenceScopeLabel(1, 1)).toBe("1 observation · 1 session");
  });

  it("evidenceScopeLabel(3, 2) is plural/plural", () => {
    expect(evidenceScopeLabel(3, 2)).toBe("3 observations · 2 sessions");
  });

  it("evidenceScopeLabel(1, 2) is singular obs / plural sessions", () => {
    expect(evidenceScopeLabel(1, 2)).toBe("1 observation · 2 sessions");
  });

  it("evidenceScopeLabel(2, 1) is plural obs / singular session", () => {
    expect(evidenceScopeLabel(2, 1)).toBe("2 observations · 1 session");
  });

  it("EARLY_SIGNAL_QUALIFIER is exact expected copy", () => {
    expect(EARLY_SIGNAL_QUALIFIER).toBe(
      "This is an early signal, not a settled pattern."
    );
  });
});

describe("PatternClaimControls — correction/refinement labels", () => {
  it("primary feedback has exactly 2 entries", () => {
    expect(CLAIM_CONTROL_PRIMARY.length).toBe(2);
  });

  it("first primary is 'Looks right' (positive)", () => {
    expect(CLAIM_CONTROL_PRIMARY[0].label).toBe("Looks right");
    expect(CLAIM_CONTROL_PRIMARY[0].variant).toBe("positive");
  });

  it("second primary is 'Not quite' (negative)", () => {
    expect(CLAIM_CONTROL_PRIMARY[1].label).toBe("Not quite");
    expect(CLAIM_CONTROL_PRIMARY[1].variant).toBe("negative");
  });

  it("context actions has exactly 2 entries", () => {
    expect(CLAIM_CONTROL_CONTEXT.length).toBe(2);
  });

  it("context actions are 'Add context' and 'Pause this claim'", () => {
    expect(CLAIM_CONTROL_CONTEXT[0].label).toBe("Add context");
    expect(CLAIM_CONTROL_CONTEXT[1].label).toBe("Pause this claim");
  });

  it("refinement actions has exactly 3 entries", () => {
    expect(CLAIM_CONTROL_REFINEMENT.length).toBe(3);
  });

  it("refinement action labels are exact expected copy", () => {
    expect(CLAIM_CONTROL_REFINEMENT[0].label).toBe("Wrong condition");
    expect(CLAIM_CONTROL_REFINEMENT[1].label).toBe("Wrong outcome");
    expect(CLAIM_CONTROL_REFINEMENT[2].label).toBe("Missing context");
  });

  it("refine prompt is exact expected copy", () => {
    expect(CLAIM_CONTROL_REFINE_PROMPT).toBe("What's off?");
  });

  it("all control labels are trust-safe", () => {
    const allLabels = [
      ...CLAIM_CONTROL_PRIMARY.map((a) => a.label),
      ...CLAIM_CONTROL_CONTEXT.map((a) => a.label),
      ...CLAIM_CONTROL_REFINEMENT.map((a) => a.label),
      CLAIM_CONTROL_REFINE_PROMPT,
    ];
    for (const label of allLabels) {
      expect(isTrustSafe(label)).toBe(true);
    }
  });
});

describe("PatternActionControls — action state labels", () => {
  it("ACTION_STEP_COMPLETED is exact expected copy", () => {
    expect(ACTION_STEP_COMPLETED).toBe("Step completed.");
  });

  it("ACTION_STEP_SKIPPED is exact expected copy", () => {
    expect(ACTION_STEP_SKIPPED).toBe("Skipped.");
  });

  it("ACTION_STEP_ABANDONED contains 'noted'", () => {
    expect(ACTION_STEP_ABANDONED).toContain("noted");
  });

  it("ACTION_TRY_DIFFERENT is exact expected copy", () => {
    expect(ACTION_TRY_DIFFERENT).toBe("Try a different step");
  });

  it("ACTION_ILL_TRY_THIS contains 'try this'", () => {
    expect(ACTION_ILL_TRY_THIS.toLowerCase()).toContain("try this");
  });

  it("ACTION_NOT_NOW is exact expected copy", () => {
    expect(ACTION_NOT_NOW).toBe("Not now");
  });

  it("ACTION_DONE is exact expected copy", () => {
    expect(ACTION_DONE).toBe("Done");
  });

  it("ACTION_DIDNT_WORK contains 'work'", () => {
    expect(ACTION_DIDNT_WORK.toLowerCase()).toContain("work");
  });

  it("all action labels are trust-safe", () => {
    const labels = [
      ACTION_STEP_COMPLETED, ACTION_STEP_SKIPPED, ACTION_STEP_ABANDONED,
      ACTION_TRY_DIFFERENT, ACTION_ILL_TRY_THIS, ACTION_NOT_NOW,
      ACTION_DONE, ACTION_DIDNT_WORK,
    ];
    for (const label of labels) {
      expect(isTrustSafe(label)).toBe(true);
    }
  });
});

describe("ActiveStepsSection — visible surface copy", () => {
  it("ACTIVE_STEPS_HEADING is 'Active Steps'", () => {
    expect(ACTIVE_STEPS_HEADING).toBe("Active Steps");
  });

  it("ACTIVE_STEPS_SUBHEADING mentions 'small experiments'", () => {
    expect(ACTIVE_STEPS_SUBHEADING.toLowerCase()).toContain("small experiment");
  });

  it("ACTIVE_STEPS_STATUS_PROGRESS is 'In progress'", () => {
    expect(ACTIVE_STEPS_STATUS_PROGRESS).toBe("In progress");
  });

  it("ACTIVE_STEPS_STATUS_PENDING is 'Pending'", () => {
    expect(ACTIVE_STEPS_STATUS_PENDING).toBe("Pending");
  });

  it("ACTIVE_STEPS_FROM_PREFIX is 'From:'", () => {
    expect(ACTIVE_STEPS_FROM_PREFIX).toBe("From:");
  });

  it("all active steps copy is trust-safe", () => {
    const labels = [
      ACTIVE_STEPS_HEADING, ACTIVE_STEPS_SUBHEADING,
      ACTIVE_STEPS_STATUS_PROGRESS, ACTIVE_STEPS_STATUS_PENDING,
      ACTIVE_STEPS_FROM_PREFIX,
    ];
    for (const label of labels) {
      expect(isTrustSafe(label)).toBe(true);
    }
  });
});

describe("ResolvedClaimsSection — visible surface copy", () => {
  it("RESOLVED_SECTION_HEADING is 'Resolved & Archived'", () => {
    expect(RESOLVED_SECTION_HEADING).toBe("Resolved & Archived");
  });

  it("resolvedSectionSummary with paused only", () => {
    expect(resolvedSectionSummary(3, 0)).toBe("3 paused");
  });

  it("resolvedSectionSummary with dismissed only", () => {
    expect(resolvedSectionSummary(0, 2)).toBe("2 dismissed");
  });

  it("resolvedSectionSummary with both", () => {
    expect(resolvedSectionSummary(1, 1)).toBe("1 paused, 1 dismissed");
  });

  it("resolvedSectionSummary with neither returns empty string", () => {
    expect(resolvedSectionSummary(0, 0)).toBe("");
  });

  it("RESOLVED_SECTION_HEADING is trust-safe", () => {
    expect(isTrustSafe(RESOLVED_SECTION_HEADING)).toBe(true);
  });
});
