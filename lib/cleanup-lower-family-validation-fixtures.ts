import type { PrismaClient } from "@prisma/client";

import { DEV_FIXTURE_MARKER } from "./seed-lower-family-validation-fixtures";

export const KNOWN_FIXTURE_INVESTIGATION_IDS = [
  "cmq7xttgo0000qlwzet7g6j5f",
] as const;

export const KNOWN_FIXTURE_FIELDWORK_IDS = [
  "cmq7xttjg0003qlwzk3qmbq5j",
] as const;

export const KNOWN_FIXTURE_MODEL_UPDATE_IDS = [
  "cmq7xttlh0006qlwzprysfdlu",
  "cmq7y0mq30000ql7yb85mq9q8",
  "cmq7yc1nj0000qlau293mb1cz",
] as const;

export const PROTECTED_NON_FIXTURE_IDS = [
  "cmq6frqdx0000ql8h6nkavzue",
] as const;

export type FixtureRowClassification =
  | "fixture_validation_row"
  | "side_effect_model_update"
  | "fixture_model_update"
  | "fixture_evidence_link"
  | "protected_real_intelligence"
  | "unknown_do_not_touch";

export type FixtureInvestigationRow = {
  model: "Investigation";
  id: string;
  userId: string;
  title: string;
  status: string;
  visibility: string;
  candidateLifecycleStatus: string | null;
  classification: "fixture_validation_row";
  proposedAction: "delete";
};

export type FixtureFieldworkRow = {
  model: "FieldworkAssignment";
  id: string;
  userId: string;
  prompt: string;
  reason: string;
  status: string;
  visibility: string;
  candidateLifecycleStatus: string | null;
  classification: "fixture_validation_row";
  proposedAction: "delete";
};

export type FixtureModelUpdateRow = {
  model: "ModelUpdate";
  id: string;
  userId: string;
  userFacingSummary: string;
  updateType: string;
  visibility: string;
  isMeaningful: boolean;
  affectedObjectType: string;
  affectedObjectId: string;
  classification: "fixture_model_update" | "side_effect_model_update";
  proposedAction: "delete";
};

export type FixtureEvidenceLinkRow = {
  model: "UnderstandingEvidenceLink";
  id: string;
  targetType: string;
  targetId: string;
  sourceType: string;
  sourceId: string;
  role: string;
  classification: "fixture_evidence_link";
  proposedAction: "delete";
};

export type ProtectedRowSnapshot = {
  model: "UserMapConclusion";
  id: string;
  userId: string;
  title: string;
  visibility: string;
  classification: "protected_real_intelligence";
  proposedAction: "preserve";
};

export type CleanupLowerFamilyValidationFixturesCliArgs = {
  execute: boolean;
};

export type CleanupLowerFamilyValidationFixturesReport = {
  dryRun: boolean;
  executeMode: boolean;
  environmentGuardPassed: boolean;
  fixtureMarker: typeof DEV_FIXTURE_MARKER;
  protectedIds: readonly string[];
  investigations: FixtureInvestigationRow[];
  fieldworkAssignments: FixtureFieldworkRow[];
  modelUpdates: FixtureModelUpdateRow[];
  evidenceLinks: FixtureEvidenceLinkRow[];
  protectedRows: ProtectedRowSnapshot[];
  unknownRows: Array<{ model: string; id: string; reason: string }>;
  proposedDeletes: {
    investigations: number;
    fieldworkAssignments: number;
    modelUpdates: number;
    evidenceLinks: number;
  };
  writesPerformed: boolean;
  diagnosticMessage: string;
};

export type ParseCleanupLowerFamilyValidationFixturesCliResult =
  | { ok: true; args: CleanupLowerFamilyValidationFixturesCliArgs }
  | { ok: false; message: string };

function assertNonProductionEnvironment(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing cleanup: NODE_ENV=production. This script is dev-only."
    );
  }
}

function containsFixtureMarker(...values: Array<string | null | undefined>): boolean {
  return values.some((value) => value?.includes(DEV_FIXTURE_MARKER) ?? false);
}

function isKnownFixtureInvestigationId(id: string): boolean {
  return (KNOWN_FIXTURE_INVESTIGATION_IDS as readonly string[]).includes(id);
}

function isKnownFixtureFieldworkId(id: string): boolean {
  return (KNOWN_FIXTURE_FIELDWORK_IDS as readonly string[]).includes(id);
}

function isKnownFixtureModelUpdateId(id: string): boolean {
  return (KNOWN_FIXTURE_MODEL_UPDATE_IDS as readonly string[]).includes(id);
}

function isProtectedId(id: string): boolean {
  return (PROTECTED_NON_FIXTURE_IDS as readonly string[]).includes(id);
}

export function parseCleanupLowerFamilyValidationFixturesCliArgs(
  argv: string[]
): ParseCleanupLowerFamilyValidationFixturesCliResult {
  let execute = false;

  for (const arg of argv) {
    if (arg === "--execute") {
      execute = true;
      continue;
    }

    return { ok: false, message: `Unknown argument: ${arg}` };
  }

  return { ok: true, args: { execute } };
}

export async function discoverLowerFamilyValidationFixtures(args: {
  db: PrismaClient;
}): Promise<
  Pick<
    CleanupLowerFamilyValidationFixturesReport,
    | "investigations"
    | "fieldworkAssignments"
    | "modelUpdates"
    | "evidenceLinks"
    | "protectedRows"
    | "unknownRows"
    | "proposedDeletes"
  >
> {
  const investigationsRaw = await args.db.investigation.findMany({
    where: {
      OR: [
        { id: { in: [...KNOWN_FIXTURE_INVESTIGATION_IDS] } },
        { title: { contains: DEV_FIXTURE_MARKER } },
        { organizingQuestion: { contains: DEV_FIXTURE_MARKER } },
      ],
    },
    select: {
      id: true,
      userId: true,
      title: true,
      status: true,
      visibility: true,
      candidateLifecycleStatus: true,
      organizingQuestion: true,
    },
  });

  const fieldworkRaw = await args.db.fieldworkAssignment.findMany({
    where: {
      OR: [
        { id: { in: [...KNOWN_FIXTURE_FIELDWORK_IDS] } },
        { prompt: { contains: DEV_FIXTURE_MARKER } },
        { reason: { contains: DEV_FIXTURE_MARKER } },
      ],
    },
    select: {
      id: true,
      userId: true,
      prompt: true,
      reason: true,
      status: true,
      visibility: true,
      candidateLifecycleStatus: true,
    },
  });

  const modelUpdatesRaw = await args.db.modelUpdate.findMany({
    where: {
      OR: [
        { id: { in: [...KNOWN_FIXTURE_MODEL_UPDATE_IDS] } },
        { userFacingSummary: { contains: DEV_FIXTURE_MARKER } },
        { internalNotes: { contains: DEV_FIXTURE_MARKER } },
        {
          affectedObjectId: {
            in: [
              ...KNOWN_FIXTURE_INVESTIGATION_IDS,
              ...KNOWN_FIXTURE_FIELDWORK_IDS,
            ],
          },
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      userFacingSummary: true,
      updateType: true,
      visibility: true,
      isMeaningful: true,
      affectedObjectType: true,
      affectedObjectId: true,
      internalNotes: true,
    },
  });

  const investigations: FixtureInvestigationRow[] = [];
  const unknownRows: Array<{ model: string; id: string; reason: string }> = [];

  for (const row of investigationsRaw) {
    if (isProtectedId(row.id)) {
      unknownRows.push({
        model: "Investigation",
        id: row.id,
        reason: "Protected non-fixture ID matched discovery query.",
      });
      continue;
    }

    if (
      !isKnownFixtureInvestigationId(row.id) &&
      !containsFixtureMarker(row.title, row.organizingQuestion)
    ) {
      unknownRows.push({
        model: "Investigation",
        id: row.id,
        reason: "Missing fixture marker and unknown ID.",
      });
      continue;
    }

    investigations.push({
      model: "Investigation",
      id: row.id,
      userId: row.userId,
      title: row.title,
      status: row.status,
      visibility: row.visibility,
      candidateLifecycleStatus: row.candidateLifecycleStatus,
      classification: "fixture_validation_row",
      proposedAction: "delete",
    });
  }

  const fieldworkAssignments: FixtureFieldworkRow[] = [];
  for (const row of fieldworkRaw) {
    if (isProtectedId(row.id)) {
      unknownRows.push({
        model: "FieldworkAssignment",
        id: row.id,
        reason: "Protected non-fixture ID matched discovery query.",
      });
      continue;
    }

    if (
      !isKnownFixtureFieldworkId(row.id) &&
      !containsFixtureMarker(row.prompt, row.reason)
    ) {
      unknownRows.push({
        model: "FieldworkAssignment",
        id: row.id,
        reason: "Missing fixture marker and unknown ID.",
      });
      continue;
    }

    fieldworkAssignments.push({
      model: "FieldworkAssignment",
      id: row.id,
      userId: row.userId,
      prompt: row.prompt,
      reason: row.reason,
      status: row.status,
      visibility: row.visibility,
      candidateLifecycleStatus: row.candidateLifecycleStatus,
      classification: "fixture_validation_row",
      proposedAction: "delete",
    });
  }

  const modelUpdates: FixtureModelUpdateRow[] = [];
  for (const row of modelUpdatesRaw) {
    if (isProtectedId(row.id)) {
      unknownRows.push({
        model: "ModelUpdate",
        id: row.id,
        reason: "Protected non-fixture ID matched discovery query.",
      });
      continue;
    }

    const hasMarker = containsFixtureMarker(
      row.userFacingSummary,
      row.internalNotes
    );
    const isKnown = isKnownFixtureModelUpdateId(row.id);
    const isSideEffect =
      row.updateType === "investigation_opened" ||
      row.updateType === "fieldwork_assigned";
    const referencesFixtureParent =
      isKnownFixtureInvestigationId(row.affectedObjectId) ||
      isKnownFixtureFieldworkId(row.affectedObjectId);

    if (!isKnown && !hasMarker && !(isSideEffect && referencesFixtureParent)) {
      unknownRows.push({
        model: "ModelUpdate",
        id: row.id,
        reason: "Missing fixture marker, unknown ID, and no fixture parent link.",
      });
      continue;
    }

    modelUpdates.push({
      model: "ModelUpdate",
      id: row.id,
      userId: row.userId,
      userFacingSummary: row.userFacingSummary,
      updateType: row.updateType,
      visibility: row.visibility,
      isMeaningful: row.isMeaningful,
      affectedObjectType: row.affectedObjectType,
      affectedObjectId: row.affectedObjectId,
      classification: isSideEffect ? "side_effect_model_update" : "fixture_model_update",
      proposedAction: "delete",
    });
  }

  const fixtureTargetIds = [
    ...investigations.map((row) => row.id),
    ...fieldworkAssignments.map((row) => row.id),
    ...modelUpdates.map((row) => row.id),
  ];

  const evidenceLinksRaw = await args.db.understandingEvidenceLink.findMany({
    where: { targetId: { in: fixtureTargetIds } },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      sourceType: true,
      sourceId: true,
      role: true,
    },
  });

  const evidenceLinks: FixtureEvidenceLinkRow[] = evidenceLinksRaw.map((row) => ({
    model: "UnderstandingEvidenceLink",
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    role: row.role,
    classification: "fixture_evidence_link",
    proposedAction: "delete",
  }));

  const protectedRowsRaw = await args.db.userMapConclusion.findMany({
    where: { id: { in: [...PROTECTED_NON_FIXTURE_IDS] } },
    select: {
      id: true,
      userId: true,
      title: true,
      visibility: true,
    },
  });

  const protectedRows: ProtectedRowSnapshot[] = protectedRowsRaw.map((row) => ({
    model: "UserMapConclusion",
    id: row.id,
    userId: row.userId,
    title: row.title,
    visibility: row.visibility,
    classification: "protected_real_intelligence",
    proposedAction: "preserve",
  }));

  return {
    investigations,
    fieldworkAssignments,
    modelUpdates,
    evidenceLinks,
    protectedRows,
    unknownRows,
    proposedDeletes: {
      investigations: investigations.length,
      fieldworkAssignments: fieldworkAssignments.length,
      modelUpdates: modelUpdates.length,
      evidenceLinks: evidenceLinks.length,
    },
  };
}

export async function runCleanupLowerFamilyValidationFixtures(args: {
  execute: boolean;
  db: PrismaClient;
}): Promise<CleanupLowerFamilyValidationFixturesReport> {
  assertNonProductionEnvironment();

  const discovered = await discoverLowerFamilyValidationFixtures({ db: args.db });
  const totalFixtureRows =
    discovered.proposedDeletes.investigations +
    discovered.proposedDeletes.fieldworkAssignments +
    discovered.proposedDeletes.modelUpdates +
    discovered.proposedDeletes.evidenceLinks;

  if (totalFixtureRows === 0) {
    return {
      dryRun: !args.execute,
      executeMode: args.execute,
      environmentGuardPassed: true,
      fixtureMarker: DEV_FIXTURE_MARKER,
      protectedIds: PROTECTED_NON_FIXTURE_IDS,
      ...discovered,
      writesPerformed: false,
      diagnosticMessage:
        "No dev fixture rows matched marker/known-ID guards. Cleanup refused.",
    };
  }

  if (discovered.unknownRows.length > 0) {
    return {
      dryRun: !args.execute,
      executeMode: args.execute,
      environmentGuardPassed: true,
      fixtureMarker: DEV_FIXTURE_MARKER,
      protectedIds: PROTECTED_NON_FIXTURE_IDS,
      ...discovered,
      writesPerformed: false,
      diagnosticMessage:
        "Cleanup refused: discovery found rows that did not pass fixture guards.",
    };
  }

  if (!args.execute) {
    return {
      dryRun: true,
      executeMode: false,
      environmentGuardPassed: true,
      fixtureMarker: DEV_FIXTURE_MARKER,
      protectedIds: PROTECTED_NON_FIXTURE_IDS,
      ...discovered,
      writesPerformed: false,
      diagnosticMessage:
        "Dry-run only. Re-run with --execute to delete confirmed dev fixture rows.",
    };
  }

  const investigationIds = discovered.investigations.map((row) => row.id);
  const fieldworkIds = discovered.fieldworkAssignments.map((row) => row.id);
  const modelUpdateIds = discovered.modelUpdates.map((row) => row.id);
  const evidenceLinkIds = discovered.evidenceLinks.map((row) => row.id);
  const allTargetIds = [...investigationIds, ...fieldworkIds, ...modelUpdateIds];

  for (const protectedId of PROTECTED_NON_FIXTURE_IDS) {
    if (
      investigationIds.includes(protectedId) ||
      fieldworkIds.includes(protectedId) ||
      modelUpdateIds.includes(protectedId) ||
      evidenceLinkIds.includes(protectedId)
    ) {
      throw new Error(
        `Refusing cleanup: protected non-fixture ID ${protectedId} is in delete set.`
      );
    }
  }

  await args.db.$transaction(async (tx) => {
    if (evidenceLinkIds.length > 0) {
      await tx.understandingEvidenceLink.deleteMany({
        where: { id: { in: evidenceLinkIds } },
      });
    }

    if (modelUpdateIds.length > 0) {
      await tx.modelUpdate.deleteMany({
        where: { id: { in: modelUpdateIds } },
      });
    }

    if (investigationIds.length > 0) {
      await tx.investigation.deleteMany({
        where: { id: { in: investigationIds } },
      });
    }

    if (fieldworkIds.length > 0) {
      await tx.fieldworkAssignment.deleteMany({
        where: { id: { in: fieldworkIds } },
      });
    }

    if (allTargetIds.length > 0) {
      const leftoverLinks = await tx.understandingEvidenceLink.count({
        where: { targetId: { in: allTargetIds } },
      });
      if (leftoverLinks > 0) {
        throw new Error(
          `Fixture evidence links remain after cleanup (${leftoverLinks}).`
        );
      }
    }
  });

  return {
    dryRun: false,
    executeMode: true,
    environmentGuardPassed: true,
    fixtureMarker: DEV_FIXTURE_MARKER,
    protectedIds: PROTECTED_NON_FIXTURE_IDS,
    ...discovered,
    writesPerformed: true,
    diagnosticMessage:
      "Confirmed dev fixture rows deleted. Protected non-fixture intelligence preserved.",
  };
}
