/**
 * Derivation Layer
 *
 * Deterministic, versioned scaffolding for tracking processing runs,
 * evidence spans, and candidate artifacts.
 *
 * Hard rules:
 *  - DerivationRuns are immutable after completion.
 *  - DerivationArtifacts are immutable except for status transitions.
 *  - EvidenceSpan creation is idempotent.
 *  - Promotion enforces one-artifact-per-entity uniqueness.
 */

import { createHash } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import prismadb from "./prismadb";

// ── Allowed types per scope ───────────────────────────────────────────────────

export const ALLOWED_ARTIFACT_TYPES_BY_SCOPE: Record<string, string[]> = {
  import: ["reference_candidate", "contradiction_candidate", "pattern_signal"],
  native: [
    "reference_candidate",
    "contradiction_candidate",
    "pattern_signal",
    "drift_event",
    "salience_snapshot",
    "escalation_event",
    "projection_snapshot",
    "cognitive_load_metric",
  ],
  manual: [
    "reference_candidate",
    "contradiction_candidate",
    "pattern_signal",
    "drift_event",
    "salience_snapshot",
    "escalation_event",
    "projection_snapshot",
    "cognitive_load_metric",
  ],
};

// ── Errors ────────────────────────────────────────────────────────────────────

export class DerivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DerivationError";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Deterministic hash of a sorted set of message IDs.
 * Identical inputs always produce the same hash, enabling replay detection.
 */
export function computeMessageSetHash(messageIds: string[]): string {
  const sorted = [...messageIds].sort();
  return createHash("sha256").update(sorted.join("\n")).digest("hex");
}

export function assertAllowedType(scope: string, type: string): void {
  const allowed = ALLOWED_ARTIFACT_TYPES_BY_SCOPE[scope];
  if (!allowed) {
    throw new DerivationError(`Unknown scope: "${scope}"`);
  }
  if (!allowed.includes(type)) {
    throw new DerivationError(
      `Artifact type "${type}" is not allowed for scope "${scope}". Allowed: ${allowed.join(", ")}`
    );
  }
}

// ── Batch metadata ────────────────────────────────────────────────────────────

export type DerivationBatchMeta = {
  messageCount?: number;
  sessionCount?: number;
  windowStart?: Date;
  windowEnd?: Date;
};

// ── Run lifecycle ─────────────────────────────────────────────────────────────

export async function createDerivationRun(
  {
    userId,
    scope,
    processorVersion,
    messageIds,
    batchMeta,
  }: {
    userId: string;
    scope: string;
    processorVersion: string;
    messageIds: string[];
    batchMeta?: DerivationBatchMeta;
  },
  db: PrismaClient = prismadb
) {
  const inputMessageSetHash = computeMessageSetHash(messageIds);

  return db.derivationRun.create({
    data: {
      userId,
      scope,
      processorVersion,
      inputMessageSetHash,
      status: "created",
      messageCount: batchMeta?.messageCount ?? null,
      sessionCount: batchMeta?.sessionCount ?? null,
      windowStart: batchMeta?.windowStart ?? null,
      windowEnd: batchMeta?.windowEnd ?? null,
    },
  });
}

export async function startDerivationRun(
  runId: string,
  db: PrismaClient = prismadb
) {
  const run = await db.derivationRun.findFirst({ where: { id: runId } });
  if (!run) {
    throw new DerivationError(`DerivationRun not found: ${runId}`);
  }
  if (run.status !== "created") {
    throw new DerivationError(
      `DerivationRun ${runId} cannot be started from status "${run.status}".`
    );
  }
  return db.derivationRun.update({
    where: { id: runId },
    data: { status: "running" },
  });
}

export async function completeDerivationRun(
  runId: string,
  db: PrismaClient = prismadb
) {
  const run = await db.derivationRun.findFirst({ where: { id: runId } });
  if (!run) {
    throw new DerivationError(`DerivationRun not found: ${runId}`);
  }
  if (run.status === "completed") {
    throw new DerivationError(
      `DerivationRun ${runId} is already completed and cannot be modified.`
    );
  }
  return db.derivationRun.update({
    where: { id: runId },
    data: { status: "completed" },
  });
}

export async function failDerivationRun(
  runId: string,
  db: PrismaClient = prismadb
) {
  return db.derivationRun.update({
    where: { id: runId },
    data: { status: "failed" },
  });
}

// ── Evidence spans ────────────────────────────────────────────────────────────

/**
 * Idempotent — if a span with the same (messageId, charStart, charEnd,
 * contentHash) already exists, return its id without creating a duplicate.
 */
export async function ensureEvidenceSpan(
  {
    userId,
    messageId,
    charStart,
    charEnd,
    contentHash,
  }: {
    userId: string;
    messageId: string;
    charStart: number;
    charEnd: number;
    contentHash: string;
  },
  db: PrismaClient = prismadb
): Promise<string> {
  const existing = await db.evidenceSpan.findUnique({
    where: {
      messageId_charStart_charEnd_contentHash: {
        messageId,
        charStart,
        charEnd,
        contentHash,
      },
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await db.evidenceSpan.create({
    data: { userId, messageId, charStart, charEnd, contentHash },
    select: { id: true },
  });
  return created.id;
}

// ── Artifacts ─────────────────────────────────────────────────────────────────

export async function createDerivationArtifact(
  {
    userId,
    runId,
    type,
    payload,
    spanIds = [],
    confidenceScore,
    temporalStart,
    temporalEnd,
  }: {
    userId: string;
    runId: string;
    type: string;
    payload: Record<string, unknown>;
    spanIds?: string[];
    confidenceScore?: number;
    temporalStart?: Date;
    temporalEnd?: Date;
  },
  db: PrismaClient = prismadb
): Promise<string> {
  // Guard: cannot add artifacts to a completed run
  const run = await db.derivationRun.findFirst({
    where: { id: runId },
    select: { status: true, scope: true },
  });
  if (!run) {
    throw new DerivationError(`DerivationRun not found: ${runId}`);
  }
  if (run.status === "completed") {
    throw new DerivationError(
      `Cannot add artifact to completed DerivationRun ${runId}.`
    );
  }

  assertAllowedType(run.scope, type);

  const artifact = await db.derivationArtifact.create({
    data: {
      userId,
      runId,
      type,
      status: "candidate",
      payload: payload as Prisma.InputJsonValue,
      confidenceScore: confidenceScore ?? null,
      temporalStart: temporalStart ?? null,
      temporalEnd: temporalEnd ?? null,
      ...(spanIds.length > 0
        ? {
            evidenceLinks: {
              create: spanIds.map((spanId) => ({ spanId })),
            },
          }
        : {}),
    },
    select: { id: true },
  });

  return artifact.id;
}

export async function promoteArtifact(
  {
    artifactId,
    entityType,
    entityId,
  }: {
    artifactId: string;
    entityType: string;
    entityId: string;
  },
  db: PrismaClient = prismadb
): Promise<void> {
  const artifact = await db.derivationArtifact.findFirst({
    where: { id: artifactId },
    select: { status: true },
  });
  if (!artifact) {
    throw new DerivationError(`DerivationArtifact not found: ${artifactId}`);
  }
  if (artifact.status !== "candidate") {
    throw new DerivationError(
      `Cannot promote artifact ${artifactId}: status is "${artifact.status}", expected "candidate".`
    );
  }

  const existingLink = await db.artifactPromotionLink.findUnique({
    where: { entityType_entityId: { entityType, entityId } },
    select: { artifactId: true },
  });
  if (existingLink) {
    throw new DerivationError(
      `Entity ${entityType}:${entityId} is already linked to artifact ${existingLink.artifactId}.`
    );
  }

  await db.$transaction([
    db.artifactPromotionLink.create({
      data: { artifactId, entityType, entityId },
    }),
    db.derivationArtifact.update({
      where: { id: artifactId },
      data: { status: "promoted" },
    }),
  ]);
}

export async function rejectArtifact(
  artifactId: string,
  db: PrismaClient = prismadb
): Promise<void> {
  const artifact = await db.derivationArtifact.findFirst({
    where: { id: artifactId },
    select: { status: true },
  });
  if (!artifact) {
    throw new DerivationError(`DerivationArtifact not found: ${artifactId}`);
  }
  await db.derivationArtifact.update({
    where: { id: artifactId },
    data: { status: "rejected" },
  });
}
