/**
 * Exact / full frozen-reference → production round-trip seed.
 * Stores CanonicalTodayComposition (+ workbench page rails) and
 * CanonicalModelMovementReport with densograph OrvekObject projections.
 * DEV/TEST ONLY — gated like evidence-depth fixtures.
 */

import type { PrismaClient } from "@prisma/client";

import {
  CANONICAL_TODAY_COMPOSITION_CONTRACT_VERSION,
  type CanonicalTodayCompositionPayload,
  type CanonicalWorkbenchLayoutPayload,
} from "./canonical-today-composition-contract";
import {
  CANONICAL_TODAY_COMPOSITION_SOURCE_EXACT_ROUND_TRIP,
  CANONICAL_TODAY_COMPOSITION_SOURCE_FULL_REFERENCE_ROUND_TRIP,
} from "./canonical-today-composition";
import { CANONICAL_REFERENCE_MAP_HEADER } from "./canonical-reference-map-header";
import { CANONICAL_REFERENCE_MODEL_STATUS_CARD } from "./canonical-reference-model-status-card";
import { buildExactFixtureManifest } from "./exact-fixture-round-trip-manifest";
import {
  assessLiveEvidenceDepthFixtureSafety,
  EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV,
} from "./live-evidence-depth-runtime-fixture";
import type { OrvekObject } from "./orvek-v0/orvek-types";

export { EVIDENCE_DEPTH_FIXTURE_ALLOW_ENV };

export const EXACT_ROUND_TRIP_PREFIX = "dev-exact-rt";
export const EXACT_ROUND_TRIP_MARKER = "devFixture:exact-fixture-round-trip";
export const FULL_REFERENCE_ROUND_TRIP_MARKER =
  "devFixture:full-reference-round-trip";

const token = (userId: string) => userId.trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
export const exactRtId = (userId: string, slot: string) =>
  `${EXACT_ROUND_TRIP_PREFIX}-${token(userId)}-${slot}`;

export type ExactRoundTripSeedResult = {
  userId: string;
  fixtureIdMap: Record<string, string>;
  compositionId: string;
  reportId: string;
  movementIds: string[];
  leadObjectId: string;
  objectCount: number;
  workbenchIncluded: boolean;
  controlledTimestamps: {
    reportGeneratedAt: string;
  };
};

function movementFixtureKey(fixtureMovementId: string): string {
  // Fixture reuses open-question id "aq-1" for a movement card — dedicated production slot.
  return fixtureMovementId === "aq-1" ? "aq-1-movement" : fixtureMovementId;
}

function remapIdList(
  ids: string[] | undefined,
  map: Record<string, string>,
): string[] | undefined {
  if (!ids?.length) return ids;
  return ids.map((rid) => map[rid] ?? rid);
}

function remapObjectGraph(
  obj: OrvekObject,
  map: Record<string, string>,
): OrvekObject {
  const id = map[obj.id];
  if (!id) throw new Error(`Missing production id for fixture ${obj.id}`);
  const affected =
    obj.affectedObject && map[obj.affectedObject]
      ? map[obj.affectedObject]
      : obj.affectedObject;
  return {
    ...obj,
    id,
    receiptIds: remapIdList(obj.receiptIds, map),
    relatedIds: remapIdList(obj.relatedIds, map),
    contextIds: remapIdList(obj.contextIds, map),
    // supporting/conflicting are prose strings in the frozen fixture, not ids.
    supporting: obj.supporting,
    conflicting: obj.conflicting,
    affectedObject: affected,
    canonicalReportId: obj.canonicalReportId
      ? (map[obj.canonicalReportId] ?? obj.canonicalReportId)
      : obj.canonicalReportId,
    inspectorObjectId: obj.inspectorObjectId
      ? (map[obj.inspectorObjectId] ?? obj.inspectorObjectId)
      : obj.inspectorObjectId,
  };
}

function buildWorkbenchLayout(args: {
  userId: string;
  map: Record<string, string>;
}): CanonicalWorkbenchLayoutPayload {
  const manifest = buildExactFixtureManifest();
  const map = args.map;
  const remap = (fixtureId: string) => {
    const id = map[fixtureId];
    if (!id) throw new Error(`Missing production id for fixture ${fixtureId}`);
    return id;
  };

  return {
    mapCategories: manifest.mapCategories.map((cat) => ({
      id: cat.id,
      label: cat.label,
      ids: cat.ids.map(remap),
    })),
    mapDefaultSelectedId: remap(manifest.mapDefaultSelectedId),
    timelineGroups: manifest.timelineGroups.map((g) => ({
      heading: g.heading,
      ids: g.ids.map(remap),
    })),
    timelineFilters: [...manifest.timelineFilters],
    decisionListGroups: manifest.decisionListGroups.map((g) => ({
      heading: g.heading,
      ids: g.ids.map(remap),
      ...(g.tone ? { tone: g.tone } : {}),
    })),
    decisionsDefaultId: remap(manifest.decisionsDefaultId),
    exploreGroundingIds: manifest.exploreGroundingIds.map(remap),
    exploreMovement: manifest.exploreMovement.map((entry) => ({
      id: exactRtId(args.userId, `explore-move-${entry.id}`),
      kind: entry.kind,
      text: entry.text,
      ...(entry.linkId ? { linkId: remap(entry.linkId) } : {}),
    })),
    exploreQuestionIds: manifest.exploreQuestionIds.map(remap),
    exploreInvestigationIds: manifest.exploreInvestigationIds.map(remap),
    exploreFieldworkIds: manifest.exploreFieldworkIds.map(remap),
    exploreLiveDetectionCopy:
      "Orvek is reading the model · 1 receipt extracted · 1 question detected",
    mapHeader: { ...CANONICAL_REFERENCE_MAP_HEADER },
    modelStatusCard: { ...CANONICAL_REFERENCE_MODEL_STATUS_CARD },
    importReview: {
      sourceObjectId: remap("imp-1"),
      candidates: [
        {
          id: exactRtId(args.userId, "import-cand-ic1"),
          raw: "I keep reopening the design instead of shipping it.",
          proposed: "Repeated loop: reopening before shipping",
          type: "map-object" as const,
          confidence: "high" as const,
        },
        {
          id: exactRtId(args.userId, "import-cand-ic2"),
          raw: "I want to see everything expressed before I commit.",
          proposed: "Belief: completeness precedes commitment",
          type: "context" as const,
          confidence: "high" as const,
        },
        {
          id: exactRtId(args.userId, "import-cand-ic3"),
          raw: "Maybe a small public test would help.",
          proposed: "Open question: would a narrow public test break the loop?",
          type: "active-question" as const,
          confidence: "medium" as const,
        },
        {
          id: exactRtId(args.userId, "import-cand-ic4"),
          raw: "Colours aren't the point right now.",
          proposed: "Receipt only — no model change",
          type: "receipt" as const,
          confidence: "low" as const,
        },
      ],
    },
  };
}

/**
 * Build composition payload from the exact fixture manifest using production IDs.
 * When `includeWorkbench` is true, embeds full Map/Timeline/Decisions/Explore rails.
 */
export function buildExactRoundTripCompositionPayload(args: {
  userId: string;
  fixtureIdMap: Record<string, string>;
  reportId: string;
  includeWorkbench?: boolean;
}): CanonicalTodayCompositionPayload {
  const manifest = buildExactFixtureManifest();
  const today = manifest.today;
  const map = args.fixtureIdMap;

  const remap = (fixtureId: string) => {
    const id = map[fixtureId];
    if (!id) throw new Error(`Missing production id for fixture ${fixtureId}`);
    return id;
  };

  const objects: OrvekObject[] = manifest.objects.map((obj) =>
    remapObjectGraph(obj, map),
  );

  // Dedicated movement projection for aq-1 Today movement card.
  const aq1 = objects.find((o) => o.id === remap("aq-1"));
  if (aq1 && map["aq-1-movement"]) {
    objects.push({
      ...aq1,
      id: map["aq-1-movement"]!,
      type: "model-update",
      title: today.movements.find((m) => m.id === "aq-1")?.updated ?? aq1.title,
      before: today.movements.find((m) => m.id === "aq-1")?.previous,
      after: today.movements.find((m) => m.id === "aq-1")?.updated,
      movementRationale: today.movements.find((m) => m.id === "aq-1")?.evidence,
      tags: ["Model update", "Active question movement"],
      inspectorObjectType: "model_update",
      inspectorObjectId: map["aq-1-movement"],
    });
  }

  // Ensure weekly report production id projects as report type for overlays.
  const reportProdId = args.reportId;
  const reportIdx = objects.findIndex((o) => o.id === reportProdId);
  if (reportIdx >= 0) {
    objects[reportIdx] = {
      ...objects[reportIdx]!,
      type: "report",
      title: today.reportTitle,
      reportSummary: today.reportMeta,
      reportType: objects[reportIdx]!.reportType ?? "Weekly Report",
      reportProvenance: "reference_sample",
      canonicalReportId: reportProdId,
    };
  }

  const leadId = remap(today.leadId);
  const leadIdx = objects.findIndex((o) => o.id === leadId);
  if (leadIdx >= 0) {
    objects[leadIdx] = {
      ...objects[leadIdx]!,
      summary: today.leadNarrative,
      evidenceCount: objects[leadIdx]!.evidenceCount ?? 6,
    };
  }

  const movements = today.movements.map((m, rank) => {
    const id = remap(movementFixtureKey(m.id));
    return {
      id,
      previous: m.previous,
      updated: m.updated,
      explanation: m.evidence,
      receiptIds: [remap("r6"), remap("r5"), remap("r2")],
      receiptCount: m.id === "mu-1" ? 6 : 3,
      actionLabel: "See why",
      destinationId: id,
      destinationType: "model_update" as const,
      rank,
      affectedObjectId: leadId,
      affectedObjectType: "decision",
    };
  });

  const workbench = args.includeWorkbench
    ? buildWorkbenchLayout({ userId: args.userId, map })
    : undefined;

  return {
    contractVersion: CANONICAL_TODAY_COMPOSITION_CONTRACT_VERSION,
    briefingLine: today.briefingLine,
    briefingTitle: today.briefingTitle,
    briefingMeta: today.briefingMeta,
    leadObjectId: leadId,
    leadObjectType: "decision",
    leadTitle:
      objects.find((o) => o.id === leadId)?.title ??
      "Use v0 architecture prototype before final design",
    leadNarrative: today.leadNarrative,
    leadWhatChanged: today.leadWhatChanged,
    leadLastEvidence: today.leadLastEvidence,
    leadKicker: today.leadKicker,
    nowRows: today.nowRows.map((row) => ({
      id: remap(row.id),
      kicker: row.kicker,
      title: row.title,
      status: row.status,
      destinationId: remap(row.id),
      destinationType: row.kicker,
    })),
    resurfacedObjectIds: today.resurfacedIds.map(remap),
    movements,
    reportId: args.reportId,
    primaryActions: today.primaryActions.map((a) => ({
      label: a.label,
      primary: a.primary,
      destinationId: leadId,
      reportId: args.reportId,
    })),
    objects,
    fixtureIdMap: map,
    ...(workbench ? { workbench } : {}),
  };
}

export function buildExactFixtureIdMap(userId: string): Record<string, string> {
  const manifest = buildExactFixtureManifest();
  const map: Record<string, string> = {};
  for (const obj of manifest.objects) {
    map[obj.id] = exactRtId(userId, `obj-${obj.id}`);
  }
  map["aq-1-movement"] = exactRtId(userId, "obj-aq-1-movement");
  map["rep-weekly"] = exactRtId(userId, "report-weekly");
  return map;
}

async function seedRoundTripCore(args: {
  userId: string;
  db: PrismaClient;
  now?: Date;
  includeWorkbench: boolean;
  source: string;
}): Promise<ExactRoundTripSeedResult> {
  const assessment = assessLiveEvidenceDepthFixtureSafety(process.env);
  if (!assessment.allowed) {
    throw new Error(
      `Exact round-trip seed blocked: ${assessment.blockers.join(", ")}`,
    );
  }

  const now = args.now ?? new Date("2026-07-14T12:00:00.000Z");
  const fixtureIdMap = buildExactFixtureIdMap(args.userId);
  const reportId = fixtureIdMap["rep-weekly"]!;
  const compositionId = exactRtId(args.userId, "today-composition");

  const reportObj = buildExactFixtureManifest().objects.find(
    (o) => o.id === "rep-weekly",
  );
  const sections = [
    {
      id: "sec-summary",
      heading: "Summary",
      body: reportObj?.summary ?? reportObj?.reportSummary ?? "",
    },
    {
      id: "sec-period",
      heading: "Period",
      body: reportObj?.period ?? "This week",
    },
  ];

  await args.db.canonicalModelMovementReport.upsert({
    where: { id: reportId },
    create: {
      id: reportId,
      userId: args.userId,
      reportType: reportObj?.reportType ?? "Weekly Report",
      title: "Weekly Model Movement report",
      status: "Ready",
      meta: "Ready · 3 loops, 2 decisions, 1 context update",
      period: reportObj?.period ?? "This week",
      sectionsJson: sections,
      relatedMovementIds: [
        fixtureIdMap["mu-1"]!,
        fixtureIdMap["mu-2"]!,
        fixtureIdMap["aq-1-movement"]!,
      ],
      relatedReceiptIds: [
        fixtureIdMap["r6"]!,
        fixtureIdMap["r5"]!,
        fixtureIdMap["r2"]!,
      ],
      generatedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      reportType: reportObj?.reportType ?? "Weekly Report",
      title: "Weekly Model Movement report",
      status: "Ready",
      meta: "Ready · 3 loops, 2 decisions, 1 context update",
      period: reportObj?.period ?? "This week",
      sectionsJson: sections,
      relatedMovementIds: [
        fixtureIdMap["mu-1"]!,
        fixtureIdMap["mu-2"]!,
        fixtureIdMap["aq-1-movement"]!,
      ],
      relatedReceiptIds: [
        fixtureIdMap["r6"]!,
        fixtureIdMap["r5"]!,
        fixtureIdMap["r2"]!,
      ],
      generatedAt: now,
      updatedAt: now,
    },
  });

  const payload = buildExactRoundTripCompositionPayload({
    userId: args.userId,
    fixtureIdMap,
    reportId,
    includeWorkbench: args.includeWorkbench,
  });

  await args.db.canonicalTodayComposition.upsert({
    where: { userId: args.userId },
    create: {
      id: compositionId,
      userId: args.userId,
      payload: payload as object,
      source: args.source,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      payload: payload as object,
      source: args.source,
      updatedAt: now,
    },
  });

  return {
    userId: args.userId,
    fixtureIdMap,
    compositionId,
    reportId,
    movementIds: payload.movements.map((m) => m.id),
    leadObjectId: payload.leadObjectId,
    objectCount: payload.objects?.length ?? 0,
    workbenchIncluded: Boolean(payload.workbench),
    controlledTimestamps: {
      reportGeneratedAt: now.toISOString(),
    },
  };
}

/** Today-only exact round-trip (legacy). */
export async function seedExactFixtureRoundTrip(args: {
  userId: string;
  db: PrismaClient;
  now?: Date;
}): Promise<ExactRoundTripSeedResult> {
  return seedRoundTripCore({
    ...args,
    includeWorkbench: false,
    source: CANONICAL_TODAY_COMPOSITION_SOURCE_EXACT_ROUND_TRIP,
  });
}

/** Full frozen-reference model → production persistence for one Clerk user. */
export async function seedFullReferenceRoundTrip(args: {
  userId: string;
  db: PrismaClient;
  now?: Date;
}): Promise<ExactRoundTripSeedResult> {
  return seedRoundTripCore({
    ...args,
    includeWorkbench: true,
    source: CANONICAL_TODAY_COMPOSITION_SOURCE_FULL_REFERENCE_ROUND_TRIP,
  });
}

export async function cleanupExactFixtureRoundTrip(args: {
  userId: string;
  db: PrismaClient;
}): Promise<{ deletedCompositions: number; deletedReports: number }> {
  const deletedReports = (
    await args.db.canonicalModelMovementReport.deleteMany({
      where: {
        userId: args.userId,
        id: { startsWith: `${EXACT_ROUND_TRIP_PREFIX}-` },
      },
    })
  ).count;
  const deletedCompositions = (
    await args.db.canonicalTodayComposition.deleteMany({
      where: { userId: args.userId },
    })
  ).count;
  return { deletedCompositions, deletedReports };
}

export const cleanupFullReferenceRoundTrip = cleanupExactFixtureRoundTrip;
