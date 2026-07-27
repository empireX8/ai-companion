/**
 * Orvek Canonical Model Authority V1 — feature gate + user allowlist.
 *
 * Default disabled. Activation requires the env flag AND an exact allowlist hit.
 * Empty / absent allowlist activates nobody.
 */

export const ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV =
  "ORVEK_CANONICAL_MODEL_AUTHORITY_V1" as const;

export const ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV =
  "ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS" as const;

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

export function isCanonicalModelAuthorityEnabledForUser(
  userId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (typeof userId !== "string" || userId.length === 0) return false;

  const flag = env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV];
  if (flag !== "1") return false;

  const allowlist = parseAllowlist(
    env[ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV],
  );
  if (allowlist.size === 0) return false;

  return allowlist.has(userId);
}
