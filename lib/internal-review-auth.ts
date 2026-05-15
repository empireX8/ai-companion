const INTERNAL_USER_MAP_REVIEWER_IDS_ENV = "INTERNAL_USER_MAP_REVIEWER_IDS";

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set<string>();
  }

  const ids = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return new Set(ids);
}

export function isInternalUserMapReviewer(
  userId: string | null | undefined,
  allowlistRaw: string | undefined = process.env[INTERNAL_USER_MAP_REVIEWER_IDS_ENV]
): boolean {
  if (!userId) {
    return false;
  }

  const allowlist = parseAllowlist(allowlistRaw);
  if (allowlist.size === 0) {
    return false;
  }

  return allowlist.has(userId);
}
