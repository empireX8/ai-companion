/**
 * Test-only capture seam for Phase 6 AI request-path proofs.
 * Never logs private summaries in normal runtime.
 * Cross-process: optional file persistence under os.tmpdir when capture is enabled.
 *
 * Runtime capture requires the shared Phase 6 test seam guard.
 * ORVEK_CANONICAL_AI_REQUEST_CAPTURE=1 alone never enables capture.
 * enableCanonicalAiRequestCaptureForTests() is for isolated unit tests only.
 */

import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { isPhase6TestSeamActive } from "./canonical-phase6-test-seam-guard";

export const ORVEK_CANONICAL_AI_REQUEST_CAPTURE_ENV =
  "ORVEK_CANONICAL_AI_REQUEST_CAPTURE" as const;

export const ORVEK_CANONICAL_AI_CAPTURE_NONCE_HEADER =
  "x-orvek-canonical-ai-capture-nonce" as const;

/** Allowlist: alphanumeric + hyphen/underscore, 1–128 chars. */
const NONCE_RE = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidCaptureNonce(nonce: unknown): nonce is string {
  return typeof nonce === "string" && NONCE_RE.test(nonce);
}

export type CanonicalAiRequestCaptureV1 = {
  conceptIds: string[];
  currentRevisionIds: string[];
  versions: number[];
  summaries: string[];
  blockChars: number;
  assembledBeforeReferenceMemory: true;
  /** Correlates this capture to one browser POST /api/message. */
  correlationId: string | null;
  /** True when canonical block was placed before reference memory / contradictions / transcript. */
  canonicalBlockBeforeReferenceMemory: true;
  canonicalBlockBeforeContradictions: true;
  canonicalBlockBeforeTranscript: true;
};

/** In-process override for isolated unit tests only — never set by env alone. */
let captureEnabledForTests = false;
let lastCapture: CanonicalAiRequestCaptureV1 | null = null;

function captureDir(): string {
  return join(tmpdir(), "orvek-canonical-ai-capture");
}

/**
 * Resolve and verify path stays inside captureDir.
 * Returns null if nonce is invalid or the resolved path escapes the directory.
 */
function safeCaptureFilePath(nonce: string): string | null {
  if (!isValidCaptureNonce(nonce)) return null;
  const dir = resolve(captureDir());
  const candidate = resolve(dir, `${nonce}.json`);
  // Must stay inside captureDir — reject any traversal.
  if (!candidate.startsWith(dir + "/") && candidate !== dir) return null;
  return candidate;
}

export function enableCanonicalAiRequestCaptureForTests(): void {
  captureEnabledForTests = true;
  lastCapture = null;
}

export function disableCanonicalAiRequestCaptureForTests(): void {
  captureEnabledForTests = false;
  lastCapture = null;
}

/**
 * Runtime capture is active only when the shared Phase 6 seam guard passes,
 * or when the explicit in-process unit-test override is set.
 * ORVEK_CANONICAL_AI_REQUEST_CAPTURE=1 alone is never sufficient.
 */
export function isCanonicalAiRequestCaptureEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return captureEnabledForTests || isPhase6TestSeamActive(env);
}

export function recordCanonicalAiRequestCapture(
  capture: Omit<
    CanonicalAiRequestCaptureV1,
    | "assembledBeforeReferenceMemory"
    | "canonicalBlockBeforeReferenceMemory"
    | "canonicalBlockBeforeContradictions"
    | "canonicalBlockBeforeTranscript"
  > & {
    assembledBeforeReferenceMemory?: true;
    correlationId?: string | null;
  },
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): void {
  if (!isCanonicalAiRequestCaptureEnabled(env)) return;
  const full: CanonicalAiRequestCaptureV1 = {
    conceptIds: capture.conceptIds,
    currentRevisionIds: capture.currentRevisionIds,
    versions: capture.versions,
    summaries: capture.summaries,
    blockChars: capture.blockChars,
    assembledBeforeReferenceMemory: true,
    correlationId: capture.correlationId ?? null,
    canonicalBlockBeforeReferenceMemory: true,
    canonicalBlockBeforeContradictions: true,
    canonicalBlockBeforeTranscript: true,
  };
  lastCapture = full;
  const nonce = full.correlationId ?? null;
  if (!isValidCaptureNonce(nonce)) return;
  const filePath = safeCaptureFilePath(nonce);
  if (!filePath) return;
  try {
    mkdirSync(captureDir(), { recursive: true, mode: 0o700 });
    writeFileSync(filePath, JSON.stringify(full), { encoding: "utf8", mode: 0o600 });
  } catch {
    // Capture file write must never break the chat path.
  }
}

export function getCanonicalAiRequestCaptureForTests(): CanonicalAiRequestCaptureV1 | null {
  return lastCapture;
}

export function readCanonicalAiRequestCaptureFile(
  correlationId: string,
): CanonicalAiRequestCaptureV1 | null {
  if (!isValidCaptureNonce(correlationId)) return null;
  const filePath = safeCaptureFilePath(correlationId);
  if (!filePath) return null;
  try {
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw) as CanonicalAiRequestCaptureV1;
  } catch {
    return null;
  }
}

/**
 * Delete the capture file for the given nonce immediately after assertion.
 * Safe: validates nonce and path before deleting; never removes arbitrary paths.
 */
export function deleteCanonicalAiRequestCaptureFile(
  correlationId: string,
): void {
  if (!isValidCaptureNonce(correlationId)) return;
  const filePath = safeCaptureFilePath(correlationId);
  if (!filePath) return;
  try {
    rmSync(filePath, { force: true });
  } catch {
    // Best-effort deletion; must not throw.
  }
}

export function extractCanonicalAiCaptureNonce(
  req: Request,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string | null {
  // Fail closed: nonce header is ignored unless the shared runtime guard (or unit override) is active.
  if (!isCanonicalAiRequestCaptureEnabled(env)) return null;
  const header = req.headers.get(ORVEK_CANONICAL_AI_CAPTURE_NONCE_HEADER);
  if (typeof header !== "string") return null;
  const trimmed = header.trim();
  if (!isValidCaptureNonce(trimmed)) return null;
  return trimmed;
}
