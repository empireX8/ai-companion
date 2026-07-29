/**
 * Shared guard for all Phase 6 test-only server seams.
 *
 * ALL of the following must be true:
 *   PHASE6_MANAGE_SERVER=1
 *   ORVEK_CANONICAL_AI_REQUEST_CAPTURE=1
 *   ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY=1
 *   DATABASE_URL parses to the exact disposable local test database
 *   CANONICAL_AUTHORITY_DB_TEST_URL parses to the same host, port and database
 *
 * Generic localhost/dev DB URLs, companion-db, alternate suffixes, remote hosts,
 * or mismatched URL pairs are rejected.
 */

const REQUIRED_DB_NAME = "companion_canonical_authority_test" as const;
const REQUIRED_PORT = "5432" as const;
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost"]);
const ALLOWED_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

export type ParsedDisposableDbIdentity = {
  hostname: string;
  port: string;
  database: string;
};

/**
 * Parse and validate a disposable Phase 6 database URL.
 * Returns null when the URL is malformed or does not match the exact identity.
 */
export function parseExactDisposableDbUrl(
  url: string | undefined,
): ParsedDisposableDbIdentity | null {
  if (!url?.trim()) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return null;
  const port = parsed.port || REQUIRED_PORT;
  if (port !== REQUIRED_PORT) return null;
  // Pathname must be exactly /companion_canonical_authority_test (no suffix).
  if (parsed.pathname !== `/${REQUIRED_DB_NAME}`) return null;
  return {
    hostname: parsed.hostname,
    port,
    database: REQUIRED_DB_NAME,
  };
}

function sameDbIdentity(
  a: ParsedDisposableDbIdentity,
  b: ParsedDisposableDbIdentity,
): boolean {
  return (
    a.hostname === b.hostname &&
    a.port === b.port &&
    a.database === b.database
  );
}

/**
 * Returns true only when all Phase 6 seam preconditions are satisfied.
 * Safe to call on every request; returns false by default.
 */
export function isPhase6TestSeamActive(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  if (env.PHASE6_MANAGE_SERVER !== "1") return false;
  if (env.ORVEK_CANONICAL_AI_REQUEST_CAPTURE !== "1") return false;
  if (env.ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY !== "1") return false;

  const dbIdentity = parseExactDisposableDbUrl(env.DATABASE_URL);
  const testDbIdentity = parseExactDisposableDbUrl(
    env.CANONICAL_AUTHORITY_DB_TEST_URL,
  );
  if (!dbIdentity || !testDbIdentity) return false;
  return sameDbIdentity(dbIdentity, testDbIdentity);
}
