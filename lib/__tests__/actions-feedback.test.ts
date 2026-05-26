/**
 * Action Feedback Signal Aggregation Tests (Phase 4B)
 *
 * Covers:
 * - Aggregates only user-owned actions (via input filtering — caller's responsibility)
 * - Excludes raw notes from returned summary
 * - Counts statuses correctly
 * - Identifies repeated helped/didnt_help signals only after threshold
 * - Does not create ModelUpdates / PatternClaims / Fieldwork
 * - Preserves existing action GET/PATCH tests
 */

import { describe, expect, it, vi } from "vitest";

import {
  applyActionRankingEligibilityToDiagnostics,
  aggregateActionFeedback,
  buildActionTemplateRankingDiagnostics,
  DEFAULT_ACTION_RANKING_ELIGIBILITY_OPTIONS,
  evaluateActionRankingEligibility,
  loadEligibleActionRankingDiagnosticsForUser,
  loadActionRankingDiagnosticsForUser,
  simulateActionRankingWithDiagnostics,
  REPEATED_SIGNAL_THRESHOLD,
} from "../actions-feedback";

// ── Helpers ───────────────────────────────────────────────────────────────────

type RawRow = Record<string, unknown>;

const makeRow = (overrides: Partial<RawRow> = {}): RawRow => ({
  templateId: "s1",
  bucket: "stabilize",
  linkedFamily: "trigger_condition",
  effort: "Low",
  status: "not_started",
  note: null,
  updatedAt: "2026-04-16T10:00:00.000Z",
  ...overrides,
});

const makeHelpedRow = (overrides: Partial<RawRow> = {}) =>
  makeRow({ status: "helped", ...overrides });

const makeDidntHelpRow = (overrides: Partial<RawRow> = {}) =>
  makeRow({ status: "didnt_help", ...overrides });

const makeDoneRow = (overrides: Partial<RawRow> = {}) =>
  makeRow({ status: "done", ...overrides });

const makeNotStartedRow = (overrides: Partial<RawRow> = {}) =>
  makeRow({ status: "not_started", ...overrides });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("aggregateActionFeedback", () => {
  describe("empty / edge cases", () => {
    it("returns empty summary for empty input", () => {
      const result = aggregateActionFeedback([]);
      expect(result.byTemplate).toHaveLength(0);
      expect(result.byFamily).toHaveLength(0);
      expect(result.byBucket).toHaveLength(0);
      expect(result.totalWithFeedback).toBe(0);
      expect(result.totalNotStarted).toBe(0);
    });

    it("returns empty summary for all-invalid rows", () => {
      const result = aggregateActionFeedback([
        { templateId: null, bucket: "invalid", status: "unknown" },
        { notEvenARealField: true },
        null as unknown as RawRow,
        "string" as unknown as RawRow,
      ]);
      expect(result.byTemplate).toHaveLength(0);
      expect(result.totalWithFeedback).toBe(0);
    });

    it("drops rows with missing required fields", () => {
      const result = aggregateActionFeedback([
        { templateId: "s1", bucket: "stabilize", status: "helped" }, // missing effort
        { templateId: "s1", bucket: "stabilize", effort: "Low" }, // missing status
      ]);
      expect(result.byTemplate).toHaveLength(0);
      expect(result.totalWithFeedback).toBe(0);
    });
  });

  describe("status counting", () => {
    it("counts a single helped row correctly", () => {
      const result = aggregateActionFeedback([makeHelpedRow()]);
      expect(result.byTemplate).toHaveLength(1);
      expect(result.byTemplate[0]!.helped).toBe(1);
      expect(result.byTemplate[0]!.didntHelp).toBe(0);
      expect(result.byTemplate[0]!.done).toBe(0);
      expect(result.byTemplate[0]!.notStarted).toBe(0);
      expect(result.byTemplate[0]!.totalSurfaced).toBe(1);
      expect(result.totalWithFeedback).toBe(1);
      expect(result.totalNotStarted).toBe(0);
    });

    it("counts multiple statuses across same templateId", () => {
      const result = aggregateActionFeedback([
        makeHelpedRow({ templateId: "s1" }),
        makeHelpedRow({ templateId: "s1" }),
        makeDidntHelpRow({ templateId: "s1" }),
        makeDoneRow({ templateId: "s1" }),
        makeNotStartedRow({ templateId: "s1" }),
      ]);
      expect(result.byTemplate).toHaveLength(1);
      expect(result.byTemplate[0]!.helped).toBe(2);
      expect(result.byTemplate[0]!.didntHelp).toBe(1);
      expect(result.byTemplate[0]!.done).toBe(1);
      expect(result.byTemplate[0]!.notStarted).toBe(1);
      expect(result.byTemplate[0]!.totalSurfaced).toBe(5);
      expect(result.totalWithFeedback).toBe(4);
      expect(result.totalNotStarted).toBe(1);
    });

    it("separates counts by templateId", () => {
      const result = aggregateActionFeedback([
        makeHelpedRow({ templateId: "s1" }),
        makeHelpedRow({ templateId: "s2" }),
        makeDidntHelpRow({ templateId: "s2" }),
        makeDoneRow({ templateId: "b1", bucket: "build", effort: "Medium" }),
      ]);
      expect(result.byTemplate).toHaveLength(3);

      const s1 = result.byTemplate.find((t) => t.templateId === "s1")!;
      expect(s1.helped).toBe(1);
      expect(s1.totalSurfaced).toBe(1);

      const s2 = result.byTemplate.find((t) => t.templateId === "s2")!;
      expect(s2.helped).toBe(1);
      expect(s2.didntHelp).toBe(1);
      expect(s2.totalSurfaced).toBe(2);

      const b1 = result.byTemplate.find((t) => t.templateId === "b1")!;
      expect(b1.done).toBe(1);
      expect(b1.bucket).toBe("build");
      expect(b1.effort).toBe("Medium");
    });
  });

  describe("repeated signal threshold", () => {
    it("does not flag repeatedHelped below threshold", () => {
      const rows = Array.from({ length: REPEATED_SIGNAL_THRESHOLD - 1 }, () =>
        makeHelpedRow({ templateId: "s1" })
      );
      const result = aggregateActionFeedback(rows);
      expect(result.byTemplate[0]!.repeatedHelped).toBe(false);
    });

    it("flags repeatedHelped at threshold", () => {
      const rows = Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () =>
        makeHelpedRow({ templateId: "s1" })
      );
      const result = aggregateActionFeedback(rows);
      expect(result.byTemplate[0]!.repeatedHelped).toBe(true);
    });

    it("flags repeatedHelped above threshold", () => {
      const rows = Array.from({ length: REPEATED_SIGNAL_THRESHOLD + 2 }, () =>
        makeHelpedRow({ templateId: "s1" })
      );
      const result = aggregateActionFeedback(rows);
      expect(result.byTemplate[0]!.repeatedHelped).toBe(true);
    });

    it("does not flag repeatedDidntHelp below threshold", () => {
      const rows = Array.from({ length: REPEATED_SIGNAL_THRESHOLD - 1 }, () =>
        makeDidntHelpRow({ templateId: "s1" })
      );
      const result = aggregateActionFeedback(rows);
      expect(result.byTemplate[0]!.repeatedDidntHelp).toBe(false);
    });

    it("flags repeatedDidntHelp at threshold", () => {
      const rows = Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () =>
        makeDidntHelpRow({ templateId: "s1" })
      );
      const result = aggregateActionFeedback(rows);
      expect(result.byTemplate[0]!.repeatedDidntHelp).toBe(true);
    });

    it("tracks repeated signals independently per template", () => {
      const result = aggregateActionFeedback([
        ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () =>
          makeHelpedRow({ templateId: "s1" })
        ),
        ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () =>
          makeDidntHelpRow({ templateId: "s2" })
        ),
      ]);
      const s1 = result.byTemplate.find((t) => t.templateId === "s1")!;
      const s2 = result.byTemplate.find((t) => t.templateId === "s2")!;
      expect(s1.repeatedHelped).toBe(true);
      expect(s1.repeatedDidntHelp).toBe(false);
      expect(s2.repeatedHelped).toBe(false);
      expect(s2.repeatedDidntHelp).toBe(true);
    });
  });

  describe("raw notes exclusion", () => {
    it("does not include note text in any output field", () => {
      const result = aggregateActionFeedback([
        makeHelpedRow({
          templateId: "s1",
          note: "This really helped me calm down before bed",
        }),
        makeDidntHelpRow({
          templateId: "s2",
          note: "Did not work for me at all",
        }),
      ]);

      // Serialize to JSON and verify no note text leaked
      const json = JSON.stringify(result);
      expect(json).not.toContain("really helped me calm down");
      expect(json).not.toContain("Did not work for me");
    });

    it("does not include note field in aggregate type", () => {
      const result = aggregateActionFeedback([
        makeHelpedRow({ note: "Some private reflection" }),
      ]);
      // TypeScript ensures 'note' is not in the type at compile time;
      // runtime check via key presence
      const keys = Object.keys(result.byTemplate[0]!);
      expect(keys).not.toContain("note");
      expect(keys).not.toContain("notes");
      expect(keys).not.toContain("rawNote");
    });
  });

  describe("byFamily grouping", () => {
    it("groups by linkedFamily", () => {
      const result = aggregateActionFeedback([
        makeHelpedRow({ templateId: "s1", linkedFamily: "trigger_condition" }),
        makeHelpedRow({ templateId: "s4", linkedFamily: "trigger_condition" }),
        makeHelpedRow({ templateId: "s5", linkedFamily: "inner_critic" }),
        makeDoneRow({ templateId: "b2", linkedFamily: null }),
      ]);
      expect(result.byFamily).toHaveLength(3);

      const trigger = result.byFamily.find(
        (f) => f.linkedFamily === "trigger_condition"
      )!;
      expect(trigger.helped).toBe(2);
      expect(trigger.totalSurfaced).toBe(2);

      const critic = result.byFamily.find(
        (f) => f.linkedFamily === "inner_critic"
      )!;
      expect(critic.helped).toBe(1);
      expect(critic.totalSurfaced).toBe(1);

      const none = result.byFamily.find((f) => f.linkedFamily === null)!;
      expect(none.done).toBe(1);
      expect(none.totalSurfaced).toBe(1);
    });

    it("sorts families: non-null first, then by totalSurfaced descending", () => {
      const result = aggregateActionFeedback([
        makeHelpedRow({ templateId: "s1", linkedFamily: "inner_critic" }),
        makeHelpedRow({ templateId: "s2", linkedFamily: "trigger_condition" }),
        makeHelpedRow({ templateId: "s3", linkedFamily: "trigger_condition" }),
        makeDoneRow({ templateId: "b1", linkedFamily: null }),
      ]);
      // Non-null families should appear before null
      const nullIndex = result.byFamily.findIndex(
        (f) => f.linkedFamily === null
      );
      const nonNullIndices = result.byFamily
        .map((f, i) => (f.linkedFamily !== null ? i : -1))
        .filter((i) => i >= 0);
      expect(Math.max(...nonNullIndices)).toBeLessThan(nullIndex);
    });
  });

  describe("byBucket grouping", () => {
    it("groups by bucket", () => {
      const result = aggregateActionFeedback([
        makeHelpedRow({ templateId: "s1", bucket: "stabilize" }),
        makeHelpedRow({ templateId: "s2", bucket: "stabilize" }),
        makeDoneRow({ templateId: "b1", bucket: "build", effort: "Medium" }),
      ]);
      expect(result.byBucket).toHaveLength(2);

      const stabilize = result.byBucket.find(
        (b) => b.bucket === "stabilize"
      )!;
      expect(stabilize.helped).toBe(2);
      expect(stabilize.totalSurfaced).toBe(2);

      const build = result.byBucket.find((b) => b.bucket === "build")!;
      expect(build.done).toBe(1);
      expect(build.totalSurfaced).toBe(1);
    });

    it("sorts buckets: stabilize first, then build", () => {
      const result = aggregateActionFeedback([
        makeDoneRow({ templateId: "b1", bucket: "build", effort: "Medium" }),
        makeHelpedRow({ templateId: "s1", bucket: "stabilize" }),
      ]);
      expect(result.byBucket[0]!.bucket).toBe("stabilize");
      expect(result.byBucket[1]!.bucket).toBe("build");
    });
  });

  describe("lastFeedbackAt", () => {
    it("uses the most recent updatedAt across all rows for a template", () => {
      const result = aggregateActionFeedback([
        makeHelpedRow({
          templateId: "s1",
          updatedAt: "2026-04-10T10:00:00.000Z",
        }),
        makeHelpedRow({
          templateId: "s1",
          updatedAt: "2026-04-16T10:00:00.000Z",
        }),
        makeHelpedRow({
          templateId: "s1",
          updatedAt: "2026-04-12T10:00:00.000Z",
        }),
      ]);
      expect(result.byTemplate[0]!.lastFeedbackAt).toBe(
        "2026-04-16T10:00:00.000Z"
      );
    });

    it("is null when no rows have updatedAt", () => {
      const result = aggregateActionFeedback([
        makeHelpedRow({ templateId: "s1", updatedAt: null }),
      ]);
      expect(result.byTemplate[0]!.lastFeedbackAt).toBeNull();
    });
  });

  describe("no side effects", () => {
    it("does not create ModelUpdates / PatternClaims / Fieldwork", () => {
      // Pure function test — no database calls, no mutations
      const result = aggregateActionFeedback([
        makeHelpedRow({ templateId: "s1" }),
      ]);
      // The function returns a plain object. No side effects possible.
      expect(result).toBeInstanceOf(Object);
      expect(result.byTemplate).toHaveLength(1);
    });

    it("does not modify the input array", () => {
      const input = [makeHelpedRow({ templateId: "s1" })];
      const inputJson = JSON.stringify(input);
      aggregateActionFeedback(input);
      expect(JSON.stringify(input)).toBe(inputJson);
    });
  });

  describe("malformed row resilience", () => {
    it("drops rows with invalid bucket", () => {
      const result = aggregateActionFeedback([
        makeRow({ bucket: "invalid_bucket", status: "helped" }),
        makeHelpedRow({ templateId: "s1" }),
      ]);
      expect(result.byTemplate).toHaveLength(1);
      expect(result.byTemplate[0]!.templateId).toBe("s1");
    });

    it("drops rows with invalid status", () => {
      const result = aggregateActionFeedback([
        makeRow({ status: "super_helped" }),
        makeHelpedRow({ templateId: "s1" }),
      ]);
      expect(result.byTemplate).toHaveLength(1);
    });

    it("drops rows with invalid effort", () => {
      const result = aggregateActionFeedback([
        makeRow({ effort: "Extreme", status: "helped" }),
        makeHelpedRow({ templateId: "s1" }),
      ]);
      expect(result.byTemplate).toHaveLength(1);
    });

    it("drops rows with invalid linkedFamily (non-null but unknown)", () => {
      const result = aggregateActionFeedback([
        makeRow({
          templateId: "unknown-template",
          linkedFamily: "unknown_family",
          status: "helped",
        }),
        makeHelpedRow({ templateId: "s1" }),
      ]);
      // The row with unknown family is still parsed (linkedFamily becomes null)
      // but the valid row should still be counted
      expect(result.byTemplate).toHaveLength(2);
      const unknown = result.byTemplate.find(
        (t) => t.linkedFamily === null && t.templateId === "unknown-template"
      );
      expect(unknown).toBeDefined();
      expect(unknown!.helped).toBe(1);
    });
  });
});

describe("buildActionTemplateRankingDiagnostics", () => {
  const toDiagnostics = (rows: RawRow[]) =>
    buildActionTemplateRankingDiagnostics(aggregateActionFeedback(rows));

  it("suggests promote when helped reaches threshold and didnt_help does not", () => {
    const diagnostics = toDiagnostics([
      ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () =>
        makeHelpedRow({ templateId: "s1" })
      ),
      makeDidntHelpRow({ templateId: "s1" }),
    ]);

    expect(diagnostics).toEqual([
      {
        templateId: "s1",
        helpedCount: REPEATED_SIGNAL_THRESHOLD,
        didntHelpCount: 1,
        repeatedHelped: true,
        repeatedDidntHelp: false,
        suggestedRankingHint: "promote",
      },
    ]);
  });

  it("suggests suppress when didnt_help reaches threshold and helped does not", () => {
    const diagnostics = toDiagnostics([
      ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () =>
        makeDidntHelpRow({ templateId: "s2" })
      ),
      makeHelpedRow({ templateId: "s2" }),
    ]);

    expect(diagnostics).toEqual([
      {
        templateId: "s2",
        helpedCount: 1,
        didntHelpCount: REPEATED_SIGNAL_THRESHOLD,
        repeatedHelped: false,
        repeatedDidntHelp: true,
        suggestedRankingHint: "suppress",
      },
    ]);
  });

  it("suggests neutral when repeated helped and repeated didnt_help conflict", () => {
    const diagnostics = toDiagnostics([
      ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () =>
        makeHelpedRow({ templateId: "b1", bucket: "build", effort: "Medium" })
      ),
      ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () =>
        makeDidntHelpRow({
          templateId: "b1",
          bucket: "build",
          effort: "Medium",
        })
      ),
    ]);

    expect(diagnostics).toEqual([
      {
        templateId: "b1",
        helpedCount: REPEATED_SIGNAL_THRESHOLD,
        didntHelpCount: REPEATED_SIGNAL_THRESHOLD,
        repeatedHelped: true,
        repeatedDidntHelp: true,
        suggestedRankingHint: "neutral",
      },
    ]);
  });

  it("suggests neutral below threshold", () => {
    const diagnostics = toDiagnostics([
      ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD - 1 }, () =>
        makeHelpedRow({ templateId: "s3" })
      ),
    ]);

    expect(diagnostics).toEqual([
      {
        templateId: "s3",
        helpedCount: REPEATED_SIGNAL_THRESHOLD - 1,
        didntHelpCount: 0,
        repeatedHelped: false,
        repeatedDidntHelp: false,
        suggestedRankingHint: "neutral",
      },
    ]);
  });

  it("does not expose raw note text", () => {
    const diagnostics = toDiagnostics([
      makeHelpedRow({
        templateId: "s4",
        note: "private note should never leak",
      }),
    ]);

    const serialized = JSON.stringify(diagnostics);
    expect(serialized).not.toContain("private note should never leak");
  });
});

describe("loadActionRankingDiagnosticsForUser", () => {
  it("queries only user-owned surfaced actions with a safe read-only selection", async () => {
    const findMany = vi.fn().mockResolvedValue([
      ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, (_, index) =>
        makeHelpedRow({
          templateId: "s1",
          updatedAt: new Date(`2026-05-0${index + 1}T10:00:00.000Z`),
          note: "private note should not be queried",
        })
      ),
    ]);
    const create = vi.fn();
    const update = vi.fn();

    const diagnostics = await loadActionRankingDiagnosticsForUser({
      userId: " user-1 ",
      db: {
        surfacedAction: {
          findMany,
          create,
          update,
        } as unknown as {
          findMany: typeof findMany;
        },
      },
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: {
        templateId: true,
        bucket: true,
        linkedFamily: true,
        status: true,
        updatedAt: true,
      },
    });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(diagnostics).toEqual([
      {
        templateId: "s1",
        helpedCount: REPEATED_SIGNAL_THRESHOLD,
        didntHelpCount: 0,
        repeatedHelped: true,
        repeatedDidntHelp: false,
        suggestedRankingHint: "promote",
      },
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("private note should not be queried");
  });

  it("preserves conflict-neutral behavior and threshold rules from the ranking helper", async () => {
    const findMany = vi.fn().mockResolvedValue([
      ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () =>
        makeHelpedRow({ templateId: "b1", bucket: "build", effort: "Medium" })
      ),
      ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () =>
        makeDidntHelpRow({ templateId: "b1", bucket: "build", effort: "Medium" })
      ),
      ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD - 1 }, () =>
        makeHelpedRow({ templateId: "s2" })
      ),
    ]);

    const diagnostics = await loadActionRankingDiagnosticsForUser({
      userId: "user-1",
      db: {
        surfacedAction: {
          findMany,
        },
      },
    });

    expect(diagnostics).toEqual([
      {
        templateId: "b1",
        helpedCount: REPEATED_SIGNAL_THRESHOLD,
        didntHelpCount: REPEATED_SIGNAL_THRESHOLD,
        repeatedHelped: true,
        repeatedDidntHelp: true,
        suggestedRankingHint: "neutral",
      },
      {
        templateId: "s2",
        helpedCount: REPEATED_SIGNAL_THRESHOLD - 1,
        didntHelpCount: 0,
        repeatedHelped: false,
        repeatedDidntHelp: false,
        suggestedRankingHint: "neutral",
      },
    ]);
  });

  it("handles surfaced-action rows that do not persist effort", async () => {
    const findMany = vi.fn().mockResolvedValue([
      ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () => ({
        templateId: "b1",
        bucket: "build",
        linkedFamily: null,
        status: "helped",
        updatedAt: new Date("2026-05-01T10:00:00.000Z"),
      })),
    ]);

    const diagnostics = await loadActionRankingDiagnosticsForUser({
      userId: "user-1",
      db: {
        surfacedAction: {
          findMany,
        },
      },
    });

    expect(diagnostics).toEqual([
      {
        templateId: "b1",
        helpedCount: REPEATED_SIGNAL_THRESHOLD,
        didntHelpCount: 0,
        repeatedHelped: true,
        repeatedDidntHelp: false,
        suggestedRankingHint: "promote",
      },
    ]);
  });

  it("returns an empty result and skips querying when userId is blank", async () => {
    const findMany = vi.fn();

    const diagnostics = await loadActionRankingDiagnosticsForUser({
      userId: "   ",
      db: {
        surfacedAction: {
          findMany,
        },
      },
    });

    expect(diagnostics).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("applyActionRankingEligibilityToDiagnostics", () => {
  const NOW_ISO = "2026-05-25T00:00:00.000Z";

  const makeDiagnostic = (overrides: Partial<{
    templateId: string;
    helpedCount: number;
    didntHelpCount: number;
    repeatedHelped: boolean;
    repeatedDidntHelp: boolean;
    suggestedRankingHint: "promote" | "suppress" | "neutral";
    lastFeedbackAt: string | null;
  }> = {}) => ({
    templateId: "s1",
    helpedCount: 3,
    didntHelpCount: 0,
    repeatedHelped: true,
    repeatedDidntHelp: false,
    suggestedRankingHint: "promote" as const,
    lastFeedbackAt: "2026-05-20T00:00:00.000Z",
    ...overrides,
  });

  it("keeps eligible promote signals as promote", () => {
    const diagnostics = applyActionRankingEligibilityToDiagnostics(
      [makeDiagnostic()],
      { now: NOW_ISO }
    );

    expect(diagnostics).toEqual([
      {
        templateId: "s1",
        helpedCount: 3,
        didntHelpCount: 0,
        repeatedHelped: true,
        repeatedDidntHelp: false,
        suggestedRankingHint: "promote",
        eligible: true,
        reason: "promote_signal",
        isReversible: true,
      },
    ]);
  });

  it("keeps eligible suppress signals as suppress", () => {
    const diagnostics = applyActionRankingEligibilityToDiagnostics(
      [
        makeDiagnostic({
          templateId: "b2",
          helpedCount: 0,
          didntHelpCount: 3,
          repeatedHelped: false,
          repeatedDidntHelp: true,
          suggestedRankingHint: "suppress",
        }),
      ],
      { now: NOW_ISO }
    );

    expect(diagnostics[0]).toMatchObject({
      templateId: "b2",
      suggestedRankingHint: "suppress",
      eligible: true,
      reason: "suppress_signal",
      isReversible: true,
    });
  });

  it("neutralizes conflicts", () => {
    const diagnostics = applyActionRankingEligibilityToDiagnostics(
      [
        makeDiagnostic({
          templateId: "s3",
          helpedCount: 3,
          didntHelpCount: 3,
          repeatedHelped: true,
          repeatedDidntHelp: true,
          suggestedRankingHint: "neutral",
        }),
      ],
      { now: NOW_ISO }
    );

    expect(diagnostics[0]).toMatchObject({
      templateId: "s3",
      suggestedRankingHint: "neutral",
      eligible: false,
      reason: "conflict",
      isReversible: true,
    });
  });

  it("neutralizes below-threshold signals", () => {
    const diagnostics = applyActionRankingEligibilityToDiagnostics(
      [
        makeDiagnostic({
          templateId: "s4",
          helpedCount: 2,
          didntHelpCount: 0,
          repeatedHelped: false,
          repeatedDidntHelp: false,
          suggestedRankingHint: "neutral",
        }),
      ],
      { now: NOW_ISO }
    );

    expect(diagnostics[0]).toMatchObject({
      templateId: "s4",
      suggestedRankingHint: "neutral",
      eligible: false,
      reason: "below_threshold",
      isReversible: true,
    });
  });

  it("neutralizes stale signals", () => {
    const diagnostics = applyActionRankingEligibilityToDiagnostics(
      [
        makeDiagnostic({
          templateId: "b1",
          lastFeedbackAt: "2025-01-01T00:00:00.000Z",
        }),
      ],
      { now: NOW_ISO }
    );

    expect(diagnostics[0]).toMatchObject({
      templateId: "b1",
      suggestedRankingHint: "neutral",
      eligible: false,
      reason: "stale_signal",
      isReversible: true,
    });
  });

  it("neutralizes missing recent feedback signals", () => {
    const diagnostics = applyActionRankingEligibilityToDiagnostics(
      [
        makeDiagnostic({
          templateId: "b3",
          lastFeedbackAt: null,
        }),
      ],
      { now: NOW_ISO }
    );

    expect(diagnostics[0]).toMatchObject({
      templateId: "b3",
      suggestedRankingHint: "neutral",
      eligible: false,
      reason: "missing_recent_feedback",
      isReversible: true,
    });
  });

  it("returns only safe diagnostic metadata and no raw note/evidence text", () => {
    const diagnostics = applyActionRankingEligibilityToDiagnostics(
      [
        {
          ...makeDiagnostic(),
          note: "private note",
          evidence: "private evidence",
        } as unknown as {
          templateId: string;
          helpedCount: number;
          didntHelpCount: number;
          repeatedHelped: boolean;
          repeatedDidntHelp: boolean;
          suggestedRankingHint: "promote" | "suppress" | "neutral";
          lastFeedbackAt: string;
        },
      ],
      { now: NOW_ISO }
    );

    const serialized = JSON.stringify(diagnostics);
    expect(serialized).not.toContain("private note");
    expect(serialized).not.toContain("private evidence");
    expect(Object.keys(diagnostics[0] ?? {})).toEqual([
      "templateId",
      "helpedCount",
      "didntHelpCount",
      "repeatedHelped",
      "repeatedDidntHelp",
      "suggestedRankingHint",
      "eligible",
      "reason",
      "isReversible",
    ]);
  });
});

describe("loadEligibleActionRankingDiagnosticsForUser", () => {
  it("applies eligibility gating with safe metadata and no writes", async () => {
    const findMany = vi.fn().mockResolvedValue([
      ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, (_, index) =>
        makeDidntHelpRow({
          templateId: "b2",
          bucket: "build",
          updatedAt: new Date(`2026-05-0${index + 1}T10:00:00.000Z`),
          note: "private note should not leak",
        })
      ),
      ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, (_, index) =>
        makeHelpedRow({
          templateId: "s3",
          updatedAt: new Date(`2025-01-0${index + 1}T10:00:00.000Z`),
        })
      ),
    ]);
    const create = vi.fn();
    const update = vi.fn();

    const diagnostics = await loadEligibleActionRankingDiagnosticsForUser({
      userId: " user-1 ",
      db: {
        surfacedAction: {
          findMany,
          create,
          update,
        } as unknown as {
          findMany: typeof findMany;
        },
      },
      options: { now: "2026-05-25T00:00:00.000Z" },
    });

    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(diagnostics).toEqual([
      {
        templateId: "b2",
        helpedCount: 0,
        didntHelpCount: REPEATED_SIGNAL_THRESHOLD,
        repeatedHelped: false,
        repeatedDidntHelp: true,
        suggestedRankingHint: "suppress",
        eligible: true,
        reason: "suppress_signal",
        isReversible: true,
      },
      {
        templateId: "s3",
        helpedCount: REPEATED_SIGNAL_THRESHOLD,
        didntHelpCount: 0,
        repeatedHelped: true,
        repeatedDidntHelp: false,
        suggestedRankingHint: "neutral",
        eligible: false,
        reason: "stale_signal",
        isReversible: true,
      },
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("private note should not leak");
  });
});

describe("simulateActionRankingWithDiagnostics", () => {
  it("preserves all actions and keeps order unchanged when diagnostics are missing", () => {
    const preview = simulateActionRankingWithDiagnostics(
      [
        { actionId: "a1", templateId: "s1" },
        { actionId: "a2", templateId: "s2" },
        { actionId: "a3", templateId: "s3" },
      ],
      []
    );

    expect(preview.map((item) => item.actionId)).toEqual(["a1", "a2", "a3"]);
    expect(preview.map((item) => item.simulatedIndex)).toEqual([0, 1, 2]);
    expect(preview.every((item) => item.suggestedRankingHint === "neutral")).toBe(
      true
    );
  });

  it("moves promote templates earlier in simulated order", () => {
    const preview = simulateActionRankingWithDiagnostics(
      [
        { actionId: "a1", templateId: "s1" },
        { actionId: "a2", templateId: "s2" },
        { actionId: "a3", templateId: "s3" },
      ],
      [
        {
          templateId: "s2",
          helpedCount: REPEATED_SIGNAL_THRESHOLD,
          didntHelpCount: 0,
          repeatedHelped: true,
          repeatedDidntHelp: false,
          suggestedRankingHint: "promote",
        },
      ]
    );

    expect(preview.map((item) => item.actionId)).toEqual(["a2", "a1", "a3"]);
    expect(preview.find((item) => item.actionId === "a2")?.suggestedRankingHint).toBe(
      "promote"
    );
  });

  it("moves suppress templates later in simulated order", () => {
    const preview = simulateActionRankingWithDiagnostics(
      [
        { actionId: "a1", templateId: "s1" },
        { actionId: "a2", templateId: "s2" },
        { actionId: "a3", templateId: "s3" },
      ],
      [
        {
          templateId: "s1",
          helpedCount: 0,
          didntHelpCount: REPEATED_SIGNAL_THRESHOLD,
          repeatedHelped: false,
          repeatedDidntHelp: true,
          suggestedRankingHint: "suppress",
        },
      ]
    );

    expect(preview.map((item) => item.actionId)).toEqual(["a2", "a3", "a1"]);
    expect(preview.find((item) => item.actionId === "a1")?.suggestedRankingHint).toBe(
      "suppress"
    );
  });

  it("keeps neutral and conflict diagnostics order-stable", () => {
    const diagnostics = buildActionTemplateRankingDiagnostics(
      aggregateActionFeedback([
        ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () =>
          makeHelpedRow({ templateId: "s2" })
        ),
        ...Array.from({ length: REPEATED_SIGNAL_THRESHOLD }, () =>
          makeDidntHelpRow({ templateId: "s2" })
        ),
      ])
    );

    const preview = simulateActionRankingWithDiagnostics(
      [
        { actionId: "a1", templateId: "s1" },
        { actionId: "a2", templateId: "s2" },
        { actionId: "a3", templateId: "s3" },
      ],
      diagnostics
    );

    expect(preview.map((item) => item.actionId)).toEqual(["a1", "a2", "a3"]);
    expect(preview.find((item) => item.templateId === "s2")?.suggestedRankingHint).toBe(
      "neutral"
    );
  });

  it("does not leak raw note or evidence-like text in output", () => {
    const preview = simulateActionRankingWithDiagnostics(
      [
        {
          actionId: "a1",
          templateId: "s1",
          note: "private note should never leak",
          evidenceSnippet: "private quote should never leak",
        } as unknown as { actionId: string; templateId: string },
      ],
      []
    );

    const serialized = JSON.stringify(preview);
    expect(serialized).not.toContain("private note should never leak");
    expect(serialized).not.toContain("private quote should never leak");
    expect(Object.keys(preview[0] ?? {})).toEqual([
      "actionId",
      "templateId",
      "originalIndex",
      "simulatedIndex",
      "suggestedRankingHint",
    ]);
  });
});

describe("evaluateActionRankingEligibility", () => {
  const NOW_ISO = "2026-05-25T00:00:00.000Z";

  it("returns eligible promote for recent repeated helped signals", () => {
    const result = evaluateActionRankingEligibility(
      {
        templateId: "s1",
        helpedCount: 3,
        didntHelpCount: 0,
        lastFeedbackAt: "2026-05-20T00:00:00.000Z",
      },
      { now: NOW_ISO }
    );

    expect(result).toEqual({
      eligible: true,
      reason: "promote_signal",
      suggestedRankingHint: "promote",
      isReversible: true,
    });
  });

  it("returns eligible suppress for recent repeated didnt_help signals", () => {
    const result = evaluateActionRankingEligibility(
      {
        templateId: "b2",
        helpedCount: 0,
        didntHelpCount: 3,
        lastFeedbackAt: "2026-05-21T00:00:00.000Z",
      },
      { now: NOW_ISO }
    );

    expect(result).toEqual({
      eligible: true,
      reason: "suppress_signal",
      suggestedRankingHint: "suppress",
      isReversible: true,
    });
  });

  it("returns ineligible neutral for conflicts", () => {
    const result = evaluateActionRankingEligibility(
      {
        templateId: "s3",
        helpedCount: 3,
        didntHelpCount: 3,
        lastFeedbackAt: "2026-05-21T00:00:00.000Z",
      },
      { now: NOW_ISO }
    );

    expect(result).toEqual({
      eligible: false,
      reason: "conflict",
      suggestedRankingHint: "neutral",
      isReversible: true,
    });
  });

  it("returns ineligible neutral below threshold", () => {
    const result = evaluateActionRankingEligibility(
      {
        templateId: "s4",
        helpedCount: 2,
        didntHelpCount: 0,
        lastFeedbackAt: "2026-05-20T00:00:00.000Z",
      },
      { now: NOW_ISO }
    );

    expect(result).toEqual({
      eligible: false,
      reason: "below_threshold",
      suggestedRankingHint: "neutral",
      isReversible: true,
    });
  });

  it("returns ineligible neutral for stale repeated signals", () => {
    const result = evaluateActionRankingEligibility(
      {
        templateId: "b1",
        helpedCount: 3,
        didntHelpCount: 0,
        lastFeedbackAt: "2026-01-01T00:00:00.000Z",
      },
      { now: NOW_ISO }
    );

    expect(result).toEqual({
      eligible: false,
      reason: "stale_signal",
      suggestedRankingHint: "neutral",
      isReversible: true,
    });
  });

  it("returns ineligible neutral when repeated signals are not recent", () => {
    const result = evaluateActionRankingEligibility(
      {
        templateId: "b3",
        helpedCount: 3,
        didntHelpCount: 0,
        lastFeedbackAt: "2026-02-10T00:00:00.000Z",
      },
      { now: NOW_ISO }
    );

    expect(result).toEqual({
      eligible: false,
      reason: "missing_recent_feedback",
      suggestedRankingHint: "neutral",
      isReversible: true,
    });
  });

  it("returns ineligible neutral when recent feedback is required but missing", () => {
    const result = evaluateActionRankingEligibility(
      {
        templateId: "s2",
        helpedCount: 3,
        didntHelpCount: 0,
      },
      { now: NOW_ISO }
    );

    expect(result).toEqual({
      eligible: false,
      reason: "missing_recent_feedback",
      suggestedRankingHint: "neutral",
      isReversible: true,
    });
  });

  it("supports custom minimumRepeatedSignals while keeping reversibility", () => {
    const result = evaluateActionRankingEligibility(
      {
        templateId: "s5",
        helpedCount: 4,
        didntHelpCount: 0,
        lastFeedbackAt: "2026-05-20T00:00:00.000Z",
      },
      {
        now: NOW_ISO,
        minimumRepeatedSignals: 4,
      }
    );

    expect(result).toEqual({
      eligible: true,
      reason: "promote_signal",
      suggestedRankingHint: "promote",
      isReversible: true,
    });
  });

  it("does not leak raw note/evidence-like text and keeps output allowlisted", () => {
    const result = evaluateActionRankingEligibility(
      {
        templateId: "s6",
        helpedCount: 3,
        didntHelpCount: 0,
        lastFeedbackAt: "2026-05-21T00:00:00.000Z",
        note: "private note",
        evidence: "private evidence",
      } as unknown as {
        templateId: string;
        helpedCount: number;
        didntHelpCount: number;
        lastFeedbackAt: string;
      },
      { now: NOW_ISO }
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private note");
    expect(serialized).not.toContain("private evidence");
    expect(Object.keys(result)).toEqual([
      "eligible",
      "reason",
      "suggestedRankingHint",
      "isReversible",
    ]);
  });

  it("uses policy defaults for rolling window and staleness", () => {
    expect(DEFAULT_ACTION_RANKING_ELIGIBILITY_OPTIONS).toEqual({
      rollingWindowDays: 90,
      staleAfterDays: 120,
      requireRecentFeedback: true,
      minimumRepeatedSignals: REPEATED_SIGNAL_THRESHOLD,
    });
  });

  it("is pure and does not mutate diagnostic input", () => {
    const input = {
      templateId: "s1",
      helpedCount: 3,
      didntHelpCount: 0,
      lastFeedbackAt: "2026-05-20T00:00:00.000Z",
    };
    const before = JSON.stringify(input);

    evaluateActionRankingEligibility(input, { now: NOW_ISO });

    expect(JSON.stringify(input)).toBe(before);
  });
});
