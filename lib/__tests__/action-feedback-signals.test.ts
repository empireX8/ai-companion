import { describe, expect, it } from "vitest";

import {
  buildPolicyFeedbackSignalsReadModel,
  normalizeCompletedFieldworkFeedbackSignals,
  normalizeSurfacedActionFeedbackSignals,
} from "../action-feedback-signals";

type RawRow = Record<string, unknown>;

const makeSurfacedActionRow = (overrides: Partial<RawRow> = {}): RawRow => ({
  id: "sa-1",
  templateId: "s1",
  bucket: "stabilize",
  linkedFamily: "trigger_condition",
  status: "helped",
  surfacedAt: "2026-05-20T10:00:00.000Z",
  updatedAt: "2026-05-21T10:00:00.000Z",
  note: "private action note",
  evidence: "private evidence text",
  receiptText: "private receipt text",
  ...overrides,
});

const makeFieldworkRow = (overrides: Partial<RawRow> = {}): RawRow => ({
  id: "fw-1",
  status: "completed",
  linkedObjectType: "surfaced_action",
  linkedObjectId: "sa-1",
  observationOutcome: "worked better in the afternoon",
  observationNote: "private observation note",
  completedAt: "2026-05-22T10:00:00.000Z",
  updatedAt: "2026-05-22T10:30:00.000Z",
  createdAt: "2026-05-20T09:00:00.000Z",
  evidence: "private evidence text",
  receiptText: "private receipt text",
  ...overrides,
});

describe("normalizeSurfacedActionFeedbackSignals", () => {
  it("normalizes surfaced-action rows into safe feedback signals", () => {
    const signals = normalizeSurfacedActionFeedbackSignals([
      makeSurfacedActionRow({
        id: "sa-10",
        templateId: "b2",
        bucket: "build",
        linkedFamily: null,
        status: "didnt_help",
      }),
    ]);

    expect(signals).toEqual([
      {
        sourceType: "surfaced_action",
        sourceId: "sa-10",
        actionId: "sa-10",
        templateId: "b2",
        bucket: "build",
        linkedFamily: null,
        statusOrOutcomeCategory: "action_didnt_help",
        timestamp: "2026-05-21T10:00:00.000Z",
      },
    ]);
  });

  it("maps all action statuses to safe status categories", () => {
    const signals = normalizeSurfacedActionFeedbackSignals([
      makeSurfacedActionRow({ id: "sa-1", status: "helped" }),
      makeSurfacedActionRow({ id: "sa-2", status: "didnt_help" }),
      makeSurfacedActionRow({ id: "sa-3", status: "done" }),
      makeSurfacedActionRow({ id: "sa-4", status: "not_started" }),
    ]);

    expect(signals.map((signal) => signal.statusOrOutcomeCategory)).toEqual([
      "action_helped",
      "action_didnt_help",
      "action_done",
      "action_not_started",
    ]);
  });

  it("drops malformed surfaced-action rows safely", () => {
    const signals = normalizeSurfacedActionFeedbackSignals([
      makeSurfacedActionRow(),
      makeSurfacedActionRow({ id: "" }),
      makeSurfacedActionRow({ status: "unknown_status" }),
      makeSurfacedActionRow({ bucket: "unknown_bucket" }),
      makeSurfacedActionRow({ templateId: "" }),
      makeSurfacedActionRow({ updatedAt: "invalid-date", surfacedAt: null }),
    ]);

    expect(signals).toHaveLength(1);
    expect(signals[0]?.sourceId).toBe("sa-1");
  });

  it("excludes raw action notes/evidence/receipts from output", () => {
    const signals = normalizeSurfacedActionFeedbackSignals([makeSurfacedActionRow()]);
    const serialized = JSON.stringify(signals);

    expect(serialized).not.toContain("private action note");
    expect(serialized).not.toContain("private evidence text");
    expect(serialized).not.toContain("private receipt text");
    expect(Object.keys(signals[0] ?? {})).toEqual([
      "sourceType",
      "sourceId",
      "actionId",
      "templateId",
      "bucket",
      "linkedFamily",
      "statusOrOutcomeCategory",
      "timestamp",
    ]);
  });
});

describe("normalizeCompletedFieldworkFeedbackSignals", () => {
  it("normalizes completed surfaced_action-linked fieldwork rows to safe signals", () => {
    const signals = normalizeCompletedFieldworkFeedbackSignals([
      makeFieldworkRow({
        id: "fw-10",
        linkedObjectId: "sa-10",
        observationOutcome: "clear outcome",
      }),
    ]);

    expect(signals).toEqual([
      {
        sourceType: "fieldwork_assignment",
        sourceId: "fw-10",
        actionId: "sa-10",
        statusOrOutcomeCategory: "fieldwork_completed_with_outcome",
        timestamp: "2026-05-22T10:00:00.000Z",
        linkedObjectType: "surfaced_action",
        linkedObjectId: "sa-10",
      },
    ]);
  });

  it("normalizes completed fieldwork with note-only observation as note-only category", () => {
    const signals = normalizeCompletedFieldworkFeedbackSignals([
      makeFieldworkRow({
        observationOutcome: null,
        observationNote: "private note only",
      }),
    ]);

    expect(signals[0]?.statusOrOutcomeCategory).toBe(
      "fieldwork_completed_note_only"
    );
  });

  it("safely excludes incomplete fieldwork rows", () => {
    const signals = normalizeCompletedFieldworkFeedbackSignals([
      makeFieldworkRow({ id: "fw-assigned", status: "assigned" }),
      makeFieldworkRow({ id: "fw-active", status: "active" }),
      makeFieldworkRow({ id: "fw-dismissed", status: "dismissed" }),
      makeFieldworkRow({ id: "fw-expired", status: "expired" }),
    ]);

    expect(signals).toEqual([]);
  });

  it("excludes completed fieldwork not linked to surfaced_action", () => {
    const signals = normalizeCompletedFieldworkFeedbackSignals([
      makeFieldworkRow({
        linkedObjectType: "investigation",
        linkedObjectId: "inv-1",
      }),
    ]);

    expect(signals).toEqual([]);
  });

  it("drops malformed completed fieldwork rows safely", () => {
    const signals = normalizeCompletedFieldworkFeedbackSignals([
      makeFieldworkRow(),
      makeFieldworkRow({ id: "" }),
      makeFieldworkRow({ linkedObjectId: "" }),
      makeFieldworkRow({
        completedAt: "invalid-date",
        updatedAt: "invalid-date",
        createdAt: "invalid-date",
      }),
      makeFieldworkRow({ observationOutcome: null, observationNote: null }),
    ]);

    expect(signals).toHaveLength(1);
    expect(signals[0]?.sourceId).toBe("fw-1");
  });

  it("excludes raw observation notes/evidence/receipts from output", () => {
    const signals = normalizeCompletedFieldworkFeedbackSignals([makeFieldworkRow()]);
    const serialized = JSON.stringify(signals);

    expect(serialized).not.toContain("private observation note");
    expect(serialized).not.toContain("private evidence text");
    expect(serialized).not.toContain("private receipt text");
    expect(Object.keys(signals[0] ?? {})).toEqual([
      "sourceType",
      "sourceId",
      "actionId",
      "statusOrOutcomeCategory",
      "timestamp",
      "linkedObjectType",
      "linkedObjectId",
    ]);
  });
});

describe("buildPolicyFeedbackSignalsReadModel", () => {
  it("combines normalized action + fieldwork signals and preserves source IDs", () => {
    const signals = buildPolicyFeedbackSignalsReadModel({
      surfacedActionRows: [
        makeSurfacedActionRow({
          id: "sa-action-1",
          templateId: "s3",
          bucket: "stabilize",
          status: "helped",
        }),
      ],
      fieldworkAssignmentRows: [
        makeFieldworkRow({
          id: "fw-fieldwork-1",
          linkedObjectId: "sa-action-1",
          observationOutcome: "worked",
        }),
      ],
    });

    expect(signals).toEqual([
      expect.objectContaining({
        sourceType: "surfaced_action",
        sourceId: "sa-action-1",
      }),
      expect.objectContaining({
        sourceType: "fieldwork_assignment",
        sourceId: "fw-fieldwork-1",
        linkedObjectId: "sa-action-1",
      }),
    ]);
  });

  it("does not mutate input rows", () => {
    const surfacedActionRows = [makeSurfacedActionRow()];
    const fieldworkAssignmentRows = [makeFieldworkRow()];
    const before = JSON.stringify({
      surfacedActionRows,
      fieldworkAssignmentRows,
    });

    buildPolicyFeedbackSignalsReadModel({
      surfacedActionRows,
      fieldworkAssignmentRows,
    });

    expect(
      JSON.stringify({
        surfacedActionRows,
        fieldworkAssignmentRows,
      })
    ).toBe(before);
  });
});
