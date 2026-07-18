/**
 * Load / apply Canonical Today Composition + Model Movement Report (server).
 */

import type { PrismaClient } from "@prisma/client";

import {
  CANONICAL_TODAY_COMPOSITION_CONTRACT_VERSION,
  isCanonicalTodayCompositionPayload,
  reportRecordToOrvekObject,
  type CanonicalModelMovementReportRecord,
  type CanonicalModelMovementReportSection,
  type CanonicalTodayCompositionPayload,
} from "./canonical-today-composition-contract";
import type { V0TodayViewProps } from "./orvek-adapters/types";
import { TODAY_CHANGES_VIEW_ALL_HREF, TODAY_REPORT_FULL_DEFERRED_COPY, TODAY_REPORT_FULL_LABEL } from "./today-intelligence-updates";
import type { OrvekObject } from "./orvek-v0/orvek-types";

export const CANONICAL_TODAY_COMPOSITION_SOURCE_EXACT_ROUND_TRIP =
  "exact_round_trip_seed";

export const CANONICAL_TODAY_COMPOSITION_SOURCE_FULL_REFERENCE_ROUND_TRIP =
  "full_reference_round_trip_seed";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asSections(value: unknown): CanonicalModelMovementReportSection[] {
  if (!Array.isArray(value)) return [];
  const out: CanonicalModelMovementReportSection[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.heading !== "string") continue;
    out.push({
      id: r.id,
      heading: r.heading,
      body: typeof r.body === "string" ? r.body : "",
    });
  }
  return out;
}

export async function loadCanonicalTodayCompositionForUser(
  db: PrismaClient,
  userId: string,
): Promise<CanonicalTodayCompositionPayload | null> {
  const row = await db.canonicalTodayComposition.findUnique({
    where: { userId },
  });
  if (!row) return null;
  if (!isCanonicalTodayCompositionPayload(row.payload)) return null;
  return row.payload;
}

export async function loadCanonicalModelMovementReportForUser(
  db: PrismaClient,
  userId: string,
  reportId?: string | null,
): Promise<CanonicalModelMovementReportRecord | null> {
  const row = reportId
    ? await db.canonicalModelMovementReport.findFirst({
        where: { id: reportId, userId },
      })
    : await db.canonicalModelMovementReport.findFirst({
        where: { userId },
        orderBy: { generatedAt: "desc" },
      });
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    reportType: row.reportType,
    title: row.title,
    status: row.status,
    meta: row.meta,
    period: row.period,
    sections: asSections(row.sectionsJson),
    relatedMovementIds: asStringArray(row.relatedMovementIds),
    relatedReceiptIds: asStringArray(row.relatedReceiptIds),
    generatedAt: row.generatedAt.toISOString(),
  };
}

export type CanonicalWorkbenchBundle = {
  composition: CanonicalTodayCompositionPayload;
  report: CanonicalModelMovementReportRecord | null;
};

export async function loadCanonicalWorkbenchBundle(
  db: PrismaClient,
  userId: string,
): Promise<CanonicalWorkbenchBundle | null> {
  const composition = await loadCanonicalTodayCompositionForUser(db, userId);
  if (!composition) return null;
  const report = await loadCanonicalModelMovementReportForUser(
    db,
    userId,
    composition.reportId,
  );
  return { composition, report };
}

function nowIcon(
  kicker: string,
): V0TodayViewProps["nowRows"][number]["icon"] {
  const key = kicker.toLowerCase();
  if (key.includes("field")) return "fieldwork";
  if (key.includes("outcome") || key.includes("decision")) return "decision";
  if (key.includes("question")) return "question";
  if (key.includes("movement") || key.includes("change")) return "movement";
  return "watch";
}

/**
 * Build V0 Today props from an explicit composition + optional first-class report.
 * Does not call pickTodayHeroItem.
 */
export function buildV0TodayPropsFromCanonicalComposition(
  composition: CanonicalTodayCompositionPayload,
  report: CanonicalModelMovementReportRecord | null,
): V0TodayViewProps {
  const reportTitle = report?.title?.trim() || "";
  const reportMeta = report?.meta?.trim() || "";
  const reportId = report?.id ?? composition.reportId;

  return {
    briefingDate: composition.briefingLine,
    briefingTitle: composition.briefingTitle,
    briefingMeta: composition.briefingMeta,
    isLoading: false,
    loadingCopy: "",
    heroEmptyCopy: "",
    hero: {
      kicker: composition.leadKicker,
      title: composition.leadTitle,
      summary: composition.leadNarrative,
      whyItMatters: composition.leadNarrative,
      whatChanged: composition.leadWhatChanged,
      linkedReceipts: "—",
      lastEvidence: composition.leadLastEvidence,
      primaryAction: {
        kind: "inspect",
        selectionId: composition.leadObjectId,
        inspectSelectId: composition.leadObjectId,
        inspectorTab: "evidence",
      },
      showSeeWhyMoved: composition.movements.length > 0,
      inspectSelectId: composition.leadObjectId,
      movementId: composition.movements[0]?.id ?? null,
      selectionId: composition.leadObjectId,
      inspectorTab: "evidence",
    },
    primaryActions: composition.primaryActions.map((a) => ({
      label: a.label,
      href: "#",
      primary: a.primary,
      selectionId: a.destinationId ?? composition.leadObjectId,
      inspectSelectId: a.destinationId ?? composition.leadObjectId,
      reportId: a.reportId ?? reportId,
    })),
    nowRows: composition.nowRows.map((row) => ({
      id: row.id,
      kicker: row.kicker,
      icon: nowIcon(row.kicker),
      title: row.title,
      status: row.status,
      href: null,
      hasSelection: true,
      selectionId: row.destinationId,
      inspectSelectId: row.destinationId,
      inspectorTab: "evidence" as const,
    })),
    nowEmptyCopy: "",
    movements: composition.movements
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((m) => ({
        id: m.id,
        previous: m.previous,
        updated: m.updated,
        evidence: m.explanation,
      })),
    movementEmptyCopy: "",
    priorReadEmptyCopy: "",
    report: reportTitle
      ? {
          title: reportTitle,
          meta: reportMeta,
          href: TODAY_CHANGES_VIEW_ALL_HREF,
          reportId,
          fullReportLabel: TODAY_REPORT_FULL_LABEL,
          fullReportAvailable: true,
          fullReportDeferredCopy: TODAY_REPORT_FULL_DEFERRED_COPY,
          primaryMovement: composition.movements[0]
            ? {
                id: composition.movements[0].id,
                inspectSelectId: composition.movements[0].id,
                summary: composition.movements[0].updated,
                evidence: composition.movements[0].explanation,
                selectionId: composition.movements[0].destinationId,
                movementId: composition.movements[0].id,
                inspectorTab: "movement",
              }
            : null,
        }
      : null,
    receipts: [],
    checkIns: [],
  };
}

export function collectCompositionObjects(
  composition: CanonicalTodayCompositionPayload,
  report: CanonicalModelMovementReportRecord | null,
): Record<string, OrvekObject> {
  const objects: Record<string, OrvekObject> = {};
  for (const obj of composition.objects ?? []) {
    if (obj?.id) objects[obj.id] = obj;
  }
  if (report) {
    objects[report.id] = reportRecordToOrvekObject(report);
  }
  for (const m of composition.movements) {
    if (objects[m.id]) continue;
    objects[m.id] = {
      id: m.id,
      type: "model-update",
      title: m.updated,
      summary: m.explanation,
      before: m.previous,
      after: m.updated,
      movementRationale: m.explanation,
      receiptIds: m.receiptIds,
      evidenceCount: m.receiptCount,
      tags: ["Model update"],
      inspectorObjectType: "model_update",
      inspectorObjectId: m.id,
    };
  }
  return objects;
}

export function assertCompositionContractVersion(
  payload: CanonicalTodayCompositionPayload,
): void {
  if (payload.contractVersion !== CANONICAL_TODAY_COMPOSITION_CONTRACT_VERSION) {
    throw new Error(
      `Unsupported CanonicalTodayComposition version: ${payload.contractVersion}`,
    );
  }
}
