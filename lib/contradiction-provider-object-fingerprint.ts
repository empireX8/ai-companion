/**
 * CEQR-020 — deterministic canonical fingerprint of the adjudicator-facing
 * provider structured object.
 *
 * Authority (documented):
 *   The exact unmodified structured object delivered to
 *   `adjudicateContradiction` as `runnerResult.object` after the provider
 *   adapter’s documented OpenAI-strict envelope unwrap (when applicable).
 *   Flat injected runners pass the object through unchanged.
 *
 * This is NOT the wire HTTP body and NOT a re-wrapped envelope. Callers must
 * not describe a post-domain-binding object as “raw.”
 */

import { createHash } from "crypto";

export type FingerprintRawProviderObjectResult =
  | { ok: true; sha256: string; canonicalJson: string }
  | { ok: false; code: "fingerprint_serialization_failed"; message: string };

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = sortKeysDeep(record[key]);
  }
  return sorted;
}

/**
 * Deterministic canonical JSON with stable recursive key ordering.
 * Fails closed on unsupported values (undefined, bigint, function, symbol).
 */
export function canonicalizeJsonForFingerprint(value: unknown): string {
  if (value === undefined) {
    throw new Error("fingerprint_serialization_failed: value is undefined");
  }
  const seen = new WeakSet<object>();
  const prepare = (v: unknown): unknown => {
    if (v === undefined) {
      throw new Error("fingerprint_serialization_failed: embeds undefined");
    }
    if (typeof v === "bigint" || typeof v === "function" || typeof v === "symbol") {
      throw new Error(
        `fingerprint_serialization_failed: unsupported type ${typeof v}`,
      );
    }
    if (v !== null && typeof v === "object") {
      if (seen.has(v as object)) {
        throw new Error("fingerprint_serialization_failed: cyclic structure");
      }
      seen.add(v as object);
    }
    return v;
  };
  // Walk via JSON.stringify replacer to catch unsupported embeds, then
  // re-serialize with sorted keys for stability.
  JSON.stringify(value, (_k, v) => prepare(v));
  return JSON.stringify(sortKeysDeep(value));
}

/**
 * Stable SHA-256 of the adjudicator-facing structured provider object.
 * Returns a fail-closed error result rather than hashing undefined.
 */
export function fingerprintRawProviderObject(
  raw: unknown,
): FingerprintRawProviderObjectResult {
  try {
    const canonicalJson = canonicalizeJsonForFingerprint(raw);
    const sha256 = createHash("sha256")
      .update(canonicalJson, "utf8")
      .digest("hex");
    return { ok: true, sha256, canonicalJson };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "unknown");
    return {
      ok: false,
      code: "fingerprint_serialization_failed",
      message,
    };
  }
}

/** Hex SHA-256 or null when fingerprinting fails closed. */
export function fingerprintRawProviderObjectSha256OrNull(
  raw: unknown,
): string | null {
  const result = fingerprintRawProviderObject(raw);
  return result.ok ? result.sha256 : null;
}
