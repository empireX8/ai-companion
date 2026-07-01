import { describe, expect, it } from "vitest";

import {
  buildMindContextDisplayItems,
  hasMindContextContent,
  isQualityMindContextStatement,
  MIND_CONTEXT_EMPTY_PRIMARY,
  MIND_CONTEXT_EMPTY_SECONDARY,
  MIND_CONTEXT_REFERENCE_ENDPOINT,
  MIND_CONTEXT_SECTION_INTRO,
  summarizeMindContextEvidence,
  toMindContextPatternItems,
} from "../mind-context-surface";
import type { PatternsResponse } from "../patterns-api";

describe("mind-context-surface", () => {
  it("filters low-quality memory statements", () => {
    expect(isQualityMindContextStatement("short")).toBe(false);
    expect(isQualityMindContextStatement("Error: undefined is not a function")).toBe(false);
    expect(
      isQualityMindContextStatement(
        "I prefer to work in focused blocks before meetings when energy is highest."
      )
    ).toBe(true);
  });

  it("builds display items only from real memory and active pattern data", () => {
    const items = buildMindContextDisplayItems({
      memories: [
        {
          id: "ref-1",
          statement: "I prefer quiet mornings for deep work before meetings.",
          type: "preference",
          status: "active",
          createdAt: "2026-06-20T10:00:00.000Z",
          updatedAt: "2026-06-21T10:00:00.000Z",
        },
      ],
      activePatterns: [
        {
          id: "pc-1",
          summary: "I overcommit before deadlines",
          status: "active",
          strengthLevel: "developing",
          evidenceCount: 3,
          sectionLabel: "Repetitive Loops",
          updatedAt: "2026-06-22T10:00:00.000Z",
        },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items.find((item) => item.kind === "memory")?.detailHref).toBe("/references/ref-1");
    expect(items.find((item) => item.kind === "pattern")?.inspectorObjectId).toBe("pc-1");
    expect(items.find((item) => item.kind === "pattern")?.evidenceCount).toBe(3);
  });

  it("excludes non-active patterns from mind context", () => {
    const patterns: PatternsResponse = {
      sections: [
        {
          familyKey: "repetitive_loop",
          sectionLabel: "Repetitive Loops",
          description: "Loops",
          claims: [
            {
              id: "pc-active",
              patternType: "repetitive_loop",
              summary: "Active pattern",
              status: "active",
              strengthLevel: "developing",
              evidenceCount: 2,
              sessionCount: 2,
              journalEvidenceCount: 1,
              journalEntrySpread: 1,
              journalDaySpread: 1,
              supportContainerSpread: 2,
              createdAt: "2026-06-01T10:00:00.000Z",
              updatedAt: "2026-06-02T10:00:00.000Z",
              receipts: [],
              action: null,
            },
            {
              id: "pc-candidate",
              patternType: "repetitive_loop",
              summary: "Candidate pattern",
              status: "candidate",
              strengthLevel: "tentative",
              evidenceCount: 1,
              sessionCount: 1,
              journalEvidenceCount: 0,
              journalEntrySpread: 0,
              journalDaySpread: 0,
              supportContainerSpread: 1,
              createdAt: "2026-06-01T10:00:00.000Z",
              updatedAt: "2026-06-02T10:00:00.000Z",
              receipts: [],
              action: null,
            },
          ],
        },
      ],
      scopeMessageCount: 10,
      scopeSessionCount: 2,
    };

    const activePatterns = toMindContextPatternItems(patterns);
    expect(activePatterns).toHaveLength(1);
    expect(activePatterns[0]?.id).toBe("pc-active");
  });

  it("reports empty mind context honestly", () => {
    expect(hasMindContextContent({ memories: [], activePatterns: [] })).toBe(false);
    expect(MIND_CONTEXT_EMPTY_PRIMARY).toContain("has not confirmed enough stable");
    expect(MIND_CONTEXT_EMPTY_SECONDARY).toContain("Capture Life Data");
    expect(MIND_CONTEXT_SECTION_INTRO).toContain("model read");
    expect(MIND_CONTEXT_SECTION_INTRO).toContain("final verdict");
  });

  it("uses public-safe endpoints only", () => {
    expect(MIND_CONTEXT_REFERENCE_ENDPOINT).toBe("/api/reference/list?status=active&limit=50");
  });

  it("summarizes evidence shape and correction handoff for context reads", () => {
    const patternEvidence = summarizeMindContextEvidence({
      id: "pattern-pc-1",
      kind: "pattern",
      title: "I overcommit before deadlines",
      categoryLabel: "Pattern",
      statusLabel: "Active",
      evidenceCount: 2,
      updatedAt: "2026-06-24T10:00:00.000Z",
      detailHref: "/patterns/pc-1",
      inspectorObjectId: "pc-1",
    });
    const memoryEvidence = summarizeMindContextEvidence({
      id: "memory-ref-1",
      kind: "memory",
      title: "I prefer quiet mornings for deep work.",
      categoryLabel: "Preference",
      statusLabel: "Active",
      evidenceCount: null,
      updatedAt: "2026-06-24T10:00:00.000Z",
      detailHref: "/references/ref-1",
      inspectorObjectId: null,
    });

    expect(patternEvidence.evidenceSummary).toBe("2 linked receipts");
    expect(patternEvidence.confidenceLabel).toBe("Supported by linked receipts");
    expect(patternEvidence.uncertaintyLabel).toBeNull();
    expect(patternEvidence.correctionPrompt).toContain("Correct this context read.");
    expect(patternEvidence.correctionPrompt).toContain("Linked path: /patterns/pc-1");
    expect(patternEvidence.correctionPrompt).toContain(
      "User correction is first-class evidence"
    );

    expect(memoryEvidence.evidenceSummary).toBe("Linked memory record");
    expect(memoryEvidence.confidenceLabel).toBe("Record-backed");
    expect(memoryEvidence.uncertaintyLabel).toBeNull();
    expect(memoryEvidence.correctionPrompt).toContain("Linked path: /references/ref-1");
  });

  it("summarizes weak and missing evidence for pattern reads without overclaiming", () => {
    const thinEvidence = summarizeMindContextEvidence({
      id: "pattern-pc-2",
      kind: "pattern",
      title: "I overcommit before deadlines.",
      categoryLabel: "Pattern",
      statusLabel: "Active",
      evidenceCount: 1,
      updatedAt: "2026-06-24T11:00:00.000Z",
      detailHref: "/patterns/pc-2",
      inspectorObjectId: "pc-2",
    });
    const missingEvidence = summarizeMindContextEvidence({
      id: "pattern-pc-3",
      kind: "pattern",
      title: "I reopen the same scope loop.",
      categoryLabel: "Pattern",
      statusLabel: "Active",
      evidenceCount: 0,
      updatedAt: "2026-06-24T12:00:00.000Z",
      detailHref: "/patterns/pc-3",
      inspectorObjectId: "pc-3",
    });

    expect(thinEvidence.evidenceSummary).toBe("1 linked receipt");
    expect(thinEvidence.confidenceLabel).toBe("Thin support");
    expect(thinEvidence.uncertaintyLabel).toBe(
      "Support is thin; review before treating this as settled."
    );
    expect(thinEvidence.correctionPrompt).toContain("User correction is first-class evidence");

    expect(missingEvidence.evidenceSummary).toBe("No linked receipts surfaced yet");
    expect(missingEvidence.confidenceLabel).toBe("Provisional");
    expect(missingEvidence.uncertaintyLabel).toBe(
      "Evidence is thin or unavailable in this projection."
    );
    expect(missingEvidence.correctionPrompt).toContain("Linked path: /patterns/pc-3");
  });
});
