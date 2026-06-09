import { createHash } from "node:crypto";

import {
  CandidateLifecycleStatus,
  type FieldworkAssignmentVisibility,
  type InvestigationVisibility,
  type ModelUpdateVisibility,
  type UnderstandingLinkTargetType,
  type UserMapConclusionArea,
} from "@prisma/client";

export type CandidateLifecycleDiagnosticsFamily =
  | "UserMapConclusion"
  | "Investigation"
  | "FieldworkAssignment"
  | "ModelUpdate";

const STALE_ELIGIBLE_LIFECYCLE_STATUSES = new Set<CandidateLifecycleStatus>([
  CandidateLifecycleStatus.proposed,
  CandidateLifecycleStatus.held_for_more_evidence,
]);

const MS_PER_DAY = 86_400_000;

export type UserMapConclusionDiagnosticRow = {
  id: string;
  userId: string;
  area: UserMapConclusionArea | string;
  title: string;
  summary: string;
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  supersededById: string | null;
  updatedAt: Date | string;
  createdAt?: Date | string;
};

export type InvestigationDiagnosticRow = {
  id: string;
  userId: string;
  title: string;
  organizingQuestion: string;
  visibility: InvestigationVisibility | string;
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  updatedAt: Date | string;
  createdAt?: Date | string;
};

export type FieldworkAssignmentDiagnosticRow = {
  id: string;
  userId: string;
  prompt: string;
  reason: string;
  visibility: FieldworkAssignmentVisibility | string;
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  linkedObjectType: UnderstandingLinkTargetType | string;
  linkedObjectId: string;
  expiresAt?: Date | string | null;
  updatedAt: Date | string;
  createdAt?: Date | string;
};

export type ModelUpdateDiagnosticRow = {
  id: string;
  userId: string;
  visibility: ModelUpdateVisibility | string;
  userFacingSummary: string;
  affectedObjectType: UnderstandingLinkTargetType | string;
  affectedObjectId: string;
  createdAt?: Date | string;
};

export type StaleCandidateDiagnostic = {
  id: string;
  lifecycleStatus: CandidateLifecycleStatus;
  ageDays: number;
  updatedAt: string;
  createdAt?: string;
};

export type DuplicateClusterDiagnostic = {
  fingerprint: string;
  candidateIds: string[];
  lifecycleStatuses: Array<CandidateLifecycleStatus | null>;
};

export type FamilyCandidateLifecycleDiagnostics = {
  family: CandidateLifecycleDiagnosticsFamily;
  totalCount: number;
  staleCount: number;
  duplicateClusterCount: number;
  staleCandidates: StaleCandidateDiagnostic[];
  duplicateClusters: DuplicateClusterDiagnostic[];
};

export type CandidateLifecycleDiagnosticsReport = {
  userId: string;
  staleAfterDays: number;
  cutoffDate: string;
  generatedAt: string;
  families: FamilyCandidateLifecycleDiagnostics[];
};

export type ComputeCandidateLifecycleDiagnosticsInput = {
  userId: string;
  staleAfterDays?: number;
  cutoffDate?: Date;
  now?: Date;
  userMapConclusions: UserMapConclusionDiagnosticRow[];
  investigations: InvestigationDiagnosticRow[];
  fieldworkAssignments: FieldworkAssignmentDiagnosticRow[];
  modelUpdates: ModelUpdateDiagnosticRow[];
};

export type CandidateLifecycleDiagnosticsCliArgs = {
  userId: string;
  staleAfterDays: number;
};

export type ParseCandidateLifecycleDiagnosticsCliResult =
  | { ok: true; args: CandidateLifecycleDiagnosticsCliArgs }
  | { ok: false; message: string };

export function normalizeForCandidateDedupe(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toIso(value: Date | string | null | undefined): string | undefined {
  if (value == null) {
    return undefined;
  }
  return toDate(value).toISOString();
}

function fingerprintFromParts(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

function ageDaysBetween(updatedAt: Date, now: Date): number {
  return Math.floor((now.getTime() - updatedAt.getTime()) / MS_PER_DAY);
}

export function resolveStaleCutoffDate(input: {
  now: Date;
  staleAfterDays?: number;
  cutoffDate?: Date;
}): Date {
  if (input.cutoffDate) {
    return input.cutoffDate;
  }

  if (typeof input.staleAfterDays !== "number" || input.staleAfterDays < 0) {
    throw new Error("staleAfterDays or cutoffDate is required.");
  }

  const cutoff = new Date(input.now);
  cutoff.setTime(cutoff.getTime() - input.staleAfterDays * MS_PER_DAY);
  return cutoff;
}

export function isStaleEligibleLifecycleStatus(
  status: CandidateLifecycleStatus | null | undefined
): status is CandidateLifecycleStatus {
  return (
    status !== null &&
    status !== undefined &&
    STALE_ELIGIBLE_LIFECYCLE_STATUSES.has(status)
  );
}

export function isStaleCandidate(input: {
  candidateLifecycleStatus: CandidateLifecycleStatus | null;
  updatedAt: Date | string;
  cutoffDate: Date;
}): boolean {
  if (!isStaleEligibleLifecycleStatus(input.candidateLifecycleStatus)) {
    return false;
  }

  return toDate(input.updatedAt).getTime() < input.cutoffDate.getTime();
}

function buildStaleCandidateDiagnostic(input: {
  id: string;
  lifecycleStatus: CandidateLifecycleStatus;
  updatedAt: Date | string;
  createdAt?: Date | string;
  now: Date;
}): StaleCandidateDiagnostic {
  const updatedAtDate = toDate(input.updatedAt);
  return {
    id: input.id,
    lifecycleStatus: input.lifecycleStatus,
    ageDays: ageDaysBetween(updatedAtDate, input.now),
    updatedAt: updatedAtDate.toISOString(),
    ...(input.createdAt ? { createdAt: toIso(input.createdAt) } : {}),
  };
}

function clusterDuplicates<T>(args: {
  rows: T[];
  fingerprintFor: (row: T) => string;
  idFor: (row: T) => string;
  lifecycleStatusFor: (row: T) => CandidateLifecycleStatus | null;
}): DuplicateClusterDiagnostic[] {
  const grouped = new Map<string, T[]>();

  for (const row of args.rows) {
    const fingerprint = args.fingerprintFor(row);
    const bucket = grouped.get(fingerprint) ?? [];
    bucket.push(row);
    grouped.set(fingerprint, bucket);
  }

  return [...grouped.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([fingerprint, rows]) => ({
      fingerprint,
      candidateIds: rows.map((row) => args.idFor(row)),
      lifecycleStatuses: rows.map((row) => args.lifecycleStatusFor(row)),
    }))
    .sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));
}

function userMapDuplicateFingerprint(row: UserMapConclusionDiagnosticRow): string {
  return fingerprintFromParts([
    row.userId,
    String(row.area),
    normalizeForCandidateDedupe(row.title),
    normalizeForCandidateDedupe(row.summary),
  ]);
}

function investigationDuplicateFingerprint(row: InvestigationDiagnosticRow): string {
  return fingerprintFromParts([
    row.userId,
    String(row.visibility),
    String(row.candidateLifecycleStatus ?? "null"),
    normalizeForCandidateDedupe(row.title),
    normalizeForCandidateDedupe(row.organizingQuestion),
  ]);
}

function fieldworkDuplicateFingerprint(row: FieldworkAssignmentDiagnosticRow): string {
  return fingerprintFromParts([
    row.userId,
    String(row.visibility),
    String(row.candidateLifecycleStatus ?? "null"),
    normalizeForCandidateDedupe(row.prompt),
    normalizeForCandidateDedupe(row.reason),
    String(row.linkedObjectType),
    normalizeForCandidateDedupe(row.linkedObjectId),
  ]);
}

function modelUpdateDuplicateFingerprint(row: ModelUpdateDiagnosticRow): string {
  return fingerprintFromParts([
    row.userId,
    String(row.visibility),
    normalizeForCandidateDedupe(row.userFacingSummary),
    String(row.affectedObjectType),
    normalizeForCandidateDedupe(row.affectedObjectId),
  ]);
}

function buildFamilyDiagnostics<T>(args: {
  family: CandidateLifecycleDiagnosticsFamily;
  rows: T[];
  staleEnabled: boolean;
  cutoffDate: Date;
  now: Date;
  staleFor: (row: T) => StaleCandidateDiagnostic | null;
  duplicateRows: T[];
  fingerprintFor: (row: T) => string;
  idFor: (row: T) => string;
  lifecycleStatusFor: (row: T) => CandidateLifecycleStatus | null;
}): FamilyCandidateLifecycleDiagnostics {
  const staleCandidates = args.staleEnabled
    ? args.rows
        .map((row) => args.staleFor(row))
        .filter((row): row is StaleCandidateDiagnostic => Boolean(row))
        .sort((left, right) => right.ageDays - left.ageDays)
    : [];

  const duplicateClusters = clusterDuplicates({
    rows: args.duplicateRows,
    fingerprintFor: args.fingerprintFor,
    idFor: args.idFor,
    lifecycleStatusFor: args.lifecycleStatusFor,
  });

  return {
    family: args.family,
    totalCount: args.rows.length,
    staleCount: staleCandidates.length,
    duplicateClusterCount: duplicateClusters.length,
    staleCandidates,
    duplicateClusters,
  };
}

export function computeCandidateLifecycleDiagnostics(
  input: ComputeCandidateLifecycleDiagnosticsInput
): CandidateLifecycleDiagnosticsReport {
  const now = input.now ?? new Date();
  const cutoffDate = resolveStaleCutoffDate({
    now,
    staleAfterDays: input.staleAfterDays,
    cutoffDate: input.cutoffDate,
  });
  const staleAfterDays =
    input.staleAfterDays ??
    Math.floor((now.getTime() - cutoffDate.getTime()) / MS_PER_DAY);

  const userMapRows = input.userMapConclusions.filter((row) => row.userId === input.userId);
  const investigationRows = input.investigations.filter((row) => row.userId === input.userId);
  const fieldworkRows = input.fieldworkAssignments.filter((row) => row.userId === input.userId);
  const modelUpdateRows = input.modelUpdates.filter((row) => row.userId === input.userId);

  const userMapDuplicateRows = userMapRows.filter((row) => row.supersededById === null);

  const families: FamilyCandidateLifecycleDiagnostics[] = [
    buildFamilyDiagnostics({
      family: "UserMapConclusion",
      rows: userMapRows,
      staleEnabled: true,
      cutoffDate,
      now,
      staleFor: (row) => {
        if (!isStaleCandidate({
          candidateLifecycleStatus: row.candidateLifecycleStatus,
          updatedAt: row.updatedAt,
          cutoffDate,
        })) {
          return null;
        }
        return buildStaleCandidateDiagnostic({
          id: row.id,
          lifecycleStatus: row.candidateLifecycleStatus!,
          updatedAt: row.updatedAt,
          createdAt: row.createdAt,
          now,
        });
      },
      duplicateRows: userMapDuplicateRows,
      fingerprintFor: userMapDuplicateFingerprint,
      idFor: (row) => row.id,
      lifecycleStatusFor: (row) => row.candidateLifecycleStatus,
    }),
    buildFamilyDiagnostics({
      family: "Investigation",
      rows: investigationRows,
      staleEnabled: true,
      cutoffDate,
      now,
      staleFor: (row) => {
        if (!isStaleCandidate({
          candidateLifecycleStatus: row.candidateLifecycleStatus,
          updatedAt: row.updatedAt,
          cutoffDate,
        })) {
          return null;
        }
        return buildStaleCandidateDiagnostic({
          id: row.id,
          lifecycleStatus: row.candidateLifecycleStatus!,
          updatedAt: row.updatedAt,
          createdAt: row.createdAt,
          now,
        });
      },
      duplicateRows: investigationRows,
      fingerprintFor: investigationDuplicateFingerprint,
      idFor: (row) => row.id,
      lifecycleStatusFor: (row) => row.candidateLifecycleStatus,
    }),
    buildFamilyDiagnostics({
      family: "FieldworkAssignment",
      rows: fieldworkRows,
      staleEnabled: true,
      cutoffDate,
      now,
      staleFor: (row) => {
        if (!isStaleCandidate({
          candidateLifecycleStatus: row.candidateLifecycleStatus,
          updatedAt: row.updatedAt,
          cutoffDate,
        })) {
          return null;
        }
        return buildStaleCandidateDiagnostic({
          id: row.id,
          lifecycleStatus: row.candidateLifecycleStatus!,
          updatedAt: row.updatedAt,
          createdAt: row.createdAt,
          now,
        });
      },
      duplicateRows: fieldworkRows,
      fingerprintFor: fieldworkDuplicateFingerprint,
      idFor: (row) => row.id,
      lifecycleStatusFor: (row) => row.candidateLifecycleStatus,
    }),
    buildFamilyDiagnostics({
      family: "ModelUpdate",
      rows: modelUpdateRows,
      staleEnabled: false,
      cutoffDate,
      now,
      staleFor: () => null,
      duplicateRows: modelUpdateRows,
      fingerprintFor: modelUpdateDuplicateFingerprint,
      idFor: (row) => row.id,
      lifecycleStatusFor: () => null,
    }),
  ];

  return {
    userId: input.userId,
    staleAfterDays,
    cutoffDate: cutoffDate.toISOString(),
    generatedAt: now.toISOString(),
    families,
  };
}

export function parseCandidateLifecycleDiagnosticsCliArgs(
  argv: string[]
): ParseCandidateLifecycleDiagnosticsCliResult {
  let userId: string | undefined;
  let staleAfterDays: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;

    if (arg === "--user-id" && argv[index + 1]) {
      userId = argv[index + 1]!.trim();
      index += 1;
      continue;
    }

    if (arg === "--stale-after-days" && argv[index + 1]) {
      const parsed = Number(argv[index + 1]);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return {
          ok: false,
          message: "--stale-after-days must be a non-negative number.",
        };
      }
      staleAfterDays = parsed;
      index += 1;
    }
  }

  if (!userId) {
    return { ok: false, message: "Missing required --user-id argument." };
  }

  if (staleAfterDays === undefined) {
    return {
      ok: false,
      message: "Missing required --stale-after-days argument.",
    };
  }

  return {
    ok: true,
    args: {
      userId,
      staleAfterDays,
    },
  };
}
