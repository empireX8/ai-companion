/**
 * Deterministic UserMapConclusion authority-snapshot hashing for
 * Orvek Canonical Model Authority V1.
 */

import { createHash } from "node:crypto";
import type {
  UserMapConclusionStatus,
  UserMapConfidenceLevel,
} from "@prisma/client";

export const CANONICAL_UMC_SNAPSHOT_VERSION = "umc_snap_v1" as const;

export type CanonicalUmcSnapshotInput = {
  id: string;
  title: string;
  summary: string;
  status: UserMapConclusionStatus;
  confidenceScore: number;
  confidenceLevel: UserMapConfidenceLevel;
  updatedAt: Date;
};

const FIELD_SEPARATOR = "\u001f";

export function deriveCanonicalUmcSnapshotHash(
  input: CanonicalUmcSnapshotInput,
): string {
  const payload = [
    CANONICAL_UMC_SNAPSHOT_VERSION,
    input.id,
    input.title,
    input.summary,
    input.status,
    Number(input.confidenceScore).toString(),
    input.confidenceLevel,
    input.updatedAt.toISOString(),
  ].join(FIELD_SEPARATOR);

  const digest = createHash("sha256").update(payload, "utf8").digest("hex");
  return `${CANONICAL_UMC_SNAPSHOT_VERSION}:${digest}`;
}
