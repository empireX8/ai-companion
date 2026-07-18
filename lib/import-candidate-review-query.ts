/**
 * Production query for genuine pending import-derived candidates.
 *
 * Provenance rule: a candidate is import-derived only when its sourceSession
 * has origin=IMPORTED_ARCHIVE. No title-based guessing.
 *
 * Source tables: ReferenceItem, ContradictionNode.
 * PatternClaims are never listed here (already materialised / out of review queue).
 */

import type { PrismaClient } from "@prisma/client";

import prismadb from "./prismadb";

export const IMPORT_CANDIDATE_SOURCE_TABLES = [
  "ReferenceItem",
  "ContradictionNode",
] as const;

export type ImportCandidateSourceTable =
  (typeof IMPORT_CANDIDATE_SOURCE_TABLES)[number];

export type ImportCandidateKey =
  | { sourceTable: "ReferenceItem"; id: string }
  | { sourceTable: "ContradictionNode"; id: string };

export type PendingImportCandidate = {
  id: string;
  sourceTable: ImportCandidateSourceTable;
  candidateType: string;
  title: string;
  claimOrSummary: string;
  confidence: "low" | "medium" | "high";
  status: string;
  sourceImportBatchId: string | null;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  evidenceExcerpt: string | null;
  createdAt: Date;
  provenance: "import_derived_session";
  /** Encoded key used by review APIs: `reference_item:<id>` | `contradiction_node:<id>` */
  reviewKey: string;
};

export type PendingImportCandidatePage = {
  candidates: PendingImportCandidate[];
  totalPendingCount: number;
  limit: number;
  offset: number;
  /** Completed upload session ids for this user (batch identity when schema has no per-candidate FK). */
  sourceImportBatchIds: string[];
  sourceTables: ImportCandidateSourceTable[];
};

export const DEFAULT_IMPORT_CANDIDATE_PAGE_LIMIT = 50;
export const MAX_IMPORT_CANDIDATE_PAGE_LIMIT = 100;

export function encodeImportCandidateReviewKey(key: ImportCandidateKey): string {
  if (key.sourceTable === "ReferenceItem") {
    return `reference_item:${key.id}`;
  }
  return `contradiction_node:${key.id}`;
}

export function parseImportCandidateReviewKey(
  raw: string,
): ImportCandidateKey | null {
  const trimmed = raw.trim();
  const refPrefix = "reference_item:";
  const contraPrefix = "contradiction_node:";
  if (trimmed.startsWith(refPrefix)) {
    const id = trimmed.slice(refPrefix.length).trim();
    return id ? { sourceTable: "ReferenceItem", id } : null;
  }
  if (trimmed.startsWith(contraPrefix)) {
    const id = trimmed.slice(contraPrefix.length).trim();
    return id ? { sourceTable: "ContradictionNode", id } : null;
  }
  return null;
}

function clampLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) {
    return DEFAULT_IMPORT_CANDIDATE_PAGE_LIMIT;
  }
  return Math.min(
    MAX_IMPORT_CANDIDATE_PAGE_LIMIT,
    Math.max(1, Math.floor(limit)),
  );
}

function clampOffset(offset: number | undefined): number {
  if (offset == null || !Number.isFinite(offset) || offset < 0) {
    return 0;
  }
  return Math.floor(offset);
}

/**
 * List pending import-derived candidates for one authenticated user.
 * Stable order: createdAt ASC, then sourceTable, then id.
 */
export async function listPendingImportCandidates(args: {
  userId: string;
  limit?: number;
  offset?: number;
  db?: PrismaClient;
}): Promise<PendingImportCandidatePage> {
  const db = args.db ?? prismadb;
  const userId = args.userId;
  const limit = clampLimit(args.limit);
  const offset = clampOffset(args.offset);

  const [refs, contras, uploadBatches] = await Promise.all([
    db.referenceItem.findMany({
      where: {
        userId,
        status: "candidate",
        sourceSession: { origin: "IMPORTED_ARCHIVE" },
      },
      select: {
        id: true,
        type: true,
        statement: true,
        confidence: true,
        status: true,
        sourceSessionId: true,
        sourceMessageId: true,
        createdAt: true,
        sourceMessage: { select: { content: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    db.contradictionNode.findMany({
      where: {
        userId,
        status: "candidate",
        sourceSession: { origin: "IMPORTED_ARCHIVE" },
      },
      select: {
        id: true,
        type: true,
        title: true,
        sideA: true,
        sideB: true,
        confidence: true,
        status: true,
        sourceSessionId: true,
        sourceMessageId: true,
        createdAt: true,
        sourceMessage: { select: { content: true } },
        evidence: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { quote: true },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    db.importUploadSession.findMany({
      where: { userId, status: "complete" },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const sourceImportBatchIds = uploadBatches.map((b) => b.id);
  /** Schema has no candidate→upload FK; attach latest completed batch when exactly one, else null. */
  const soleBatchId =
    sourceImportBatchIds.length === 1 ? sourceImportBatchIds[0]! : null;

  const mapped: PendingImportCandidate[] = [
    ...refs.map((row) => {
      const key: ImportCandidateKey = {
        sourceTable: "ReferenceItem",
        id: row.id,
      };
      const excerpt =
        row.sourceMessage?.content?.trim().slice(0, 280) ||
        row.statement.trim().slice(0, 280) ||
        null;
      return {
        id: row.id,
        sourceTable: "ReferenceItem" as const,
        candidateType: row.type,
        title: row.statement.trim(),
        claimOrSummary: row.statement.trim(),
        confidence: row.confidence,
        status: row.status,
        sourceImportBatchId: soleBatchId,
        sourceSessionId: row.sourceSessionId,
        sourceMessageId: row.sourceMessageId,
        evidenceExcerpt: excerpt,
        createdAt: row.createdAt,
        provenance: "import_derived_session" as const,
        reviewKey: encodeImportCandidateReviewKey(key),
      };
    }),
    ...contras.map((row) => {
      const key: ImportCandidateKey = {
        sourceTable: "ContradictionNode",
        id: row.id,
      };
      const excerpt =
        row.evidence[0]?.quote?.trim() ||
        row.sourceMessage?.content?.trim().slice(0, 280) ||
        row.sideA.trim().slice(0, 280) ||
        null;
      return {
        id: row.id,
        sourceTable: "ContradictionNode" as const,
        candidateType: row.type,
        title: row.title.trim(),
        claimOrSummary: `${row.sideA.trim()} ↔ ${row.sideB.trim()}`,
        confidence: row.confidence,
        status: row.status,
        sourceImportBatchId: soleBatchId,
        sourceSessionId: row.sourceSessionId,
        sourceMessageId: row.sourceMessageId,
        evidenceExcerpt: excerpt,
        createdAt: row.createdAt,
        provenance: "import_derived_session" as const,
        reviewKey: encodeImportCandidateReviewKey(key),
      };
    }),
  ];

  mapped.sort((a, b) => {
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    if (t !== 0) return t;
    const tableCmp = a.sourceTable.localeCompare(b.sourceTable);
    if (tableCmp !== 0) return tableCmp;
    return a.id.localeCompare(b.id);
  });

  const totalPendingCount = mapped.length;
  const candidates = mapped.slice(offset, offset + limit);

  return {
    candidates,
    totalPendingCount,
    limit,
    offset,
    sourceImportBatchIds,
    sourceTables: [...IMPORT_CANDIDATE_SOURCE_TABLES],
  };
}

export async function countPendingImportCandidates(args: {
  userId: string;
  db?: PrismaClient;
}): Promise<number> {
  const page = await listPendingImportCandidates({
    userId: args.userId,
    limit: 1,
    offset: 0,
    db: args.db,
  });
  return page.totalPendingCount;
}
