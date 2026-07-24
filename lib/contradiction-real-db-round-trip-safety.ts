/**
 * Safety guard for CONTRADICTION-REAL-DB-ROUND-TRIP-PROOF-001.
 *
 * Isolates all real PostgreSQL proof work to companion_contradiction_rt_test.
 * Never falls back to DATABASE_URL. Not imported by production routes or UI.
 *
 * Database identity is derived only from an exact decoded pathname match
 * (`/companion_contradiction_rt_test`). Never from the first path segment alone.
 */

export const CONTRADICTION_REAL_DB_TEST_URL_ENV =
  "CONTRADICTION_REAL_DB_TEST_URL" as const;

export const CONTRADICTION_REAL_DB_TEST_DATABASE =
  "companion_contradiction_rt_test" as const;

export const CONTRADICTION_REAL_DB_TEST_URL_EXPECTED =
  "postgresql://postgres:postgres@127.0.0.1:5432/companion_contradiction_rt_test?schema=public" as const;

const EXPECTED_PATHNAME = `/${CONTRADICTION_REAL_DB_TEST_DATABASE}` as const;
const EXPECTED_PORT = "5432" as const;
const EXPECTED_SCHEMA = "public" as const;

const FORBIDDEN_HOST_PATTERNS = [
  /amazonaws\.com/i,
  /\.rds\./i,
  /neon\.tech/i,
  /supabase\.co/i,
  /railway\.app/i,
  /planetscale\.com/i,
  /cockroachlabs\.cloud/i,
  /\.azure\.com/i,
  /render\.com/i,
  /heroku\.com/i,
  /prod\./i,
  /production/i,
] as const;

const PRIVATE_NETWORK_HOST_PATTERNS = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
] as const;

export type ContradictionRealDbUrlIdentity = {
  protocol: string | null;
  hostname: string | null;
  port: string | null;
  /** Decoded pathname; never truncated to the first segment. */
  pathname: string | null;
  /**
   * Set only when pathname is exactly `/companion_contradiction_rt_test`.
   * Never inferred by taking only the first path segment of a longer path.
   */
  database: string | null;
  schema: string | null;
};

export type ContradictionRealDbSafetyAssessment = {
  allowed: boolean;
  blockers: string[];
  sourceEnvName: typeof CONTRADICTION_REAL_DB_TEST_URL_ENV;
  identity: ContradictionRealDbUrlIdentity;
  normalisedUrl: string | null;
};

function blank(value: string | undefined | null): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function emptyIdentity(): ContradictionRealDbUrlIdentity {
  return {
    protocol: null,
    hostname: null,
    port: null,
    pathname: null,
    database: null,
    schema: null,
  };
}

/**
 * Parse URL identity for the isolated proof guard.
 * Database is assigned only on exact pathname match — never first-segment inference.
 */
export function parseContradictionRealDbUrlIdentity(
  rawUrl: string,
): ContradictionRealDbUrlIdentity {
  try {
    const url = new URL(rawUrl);
    const pathname = decodeURIComponent(url.pathname);
    const database =
      pathname === EXPECTED_PATHNAME ? CONTRADICTION_REAL_DB_TEST_DATABASE : null;
    return {
      protocol: url.protocol.replace(/:$/, ""),
      hostname: url.hostname || null,
      port: url.port || null,
      pathname,
      database,
      schema: url.searchParams.get("schema"),
    };
  } catch {
    return emptyIdentity();
  }
}

/**
 * Assess whether a URL is safe for the isolated contradiction real-DB proof.
 * Callers must pass the value read from CONTRADICTION_REAL_DB_TEST_URL only.
 */
export function assessContradictionRealDbTestUrlSafety(args: {
  url: string | undefined;
  /** Must be CONTRADICTION_REAL_DB_TEST_URL — refuses any other claimed source. */
  sourceEnvName: string;
  /** Optional: refuse if this equals the normal app DATABASE_URL. */
  appDatabaseUrl?: string | undefined;
}): ContradictionRealDbSafetyAssessment {
  const blockers: string[] = [];
  const sourceEnvName = CONTRADICTION_REAL_DB_TEST_URL_ENV;

  if (args.sourceEnvName !== CONTRADICTION_REAL_DB_TEST_URL_ENV) {
    blockers.push(
      `URL source must be ${CONTRADICTION_REAL_DB_TEST_URL_ENV}, got ${args.sourceEnvName}`,
    );
  }

  if (blank(args.url)) {
    blockers.push(`${CONTRADICTION_REAL_DB_TEST_URL_ENV} is blank or missing`);
    return {
      allowed: false,
      blockers,
      sourceEnvName,
      identity: emptyIdentity(),
      normalisedUrl: null,
    };
  }

  const raw = args.url!.trim();
  const identity = parseContradictionRealDbUrlIdentity(raw);

  if (
    !identity.protocol ||
    !identity.hostname ||
    identity.pathname === null ||
    identity.pathname === ""
  ) {
    blockers.push("URL is malformed and could not be parsed");
  }

  if (
    identity.protocol !== "postgresql" &&
    identity.protocol !== "postgres"
  ) {
    blockers.push(
      `protocol must be postgresql or postgres (got ${identity.protocol ?? "null"})`,
    );
  }

  if (
    identity.hostname !== "127.0.0.1" &&
    identity.hostname !== "localhost"
  ) {
    blockers.push(
      `hostname must be exactly localhost or 127.0.0.1 (got ${identity.hostname ?? "null"})`,
    );
  }

  if (identity.port !== EXPECTED_PORT) {
    blockers.push(
      `port must be exactly ${EXPECTED_PORT} (got ${identity.port ?? "null"})`,
    );
  }

  if (identity.pathname !== EXPECTED_PATHNAME) {
    blockers.push(
      `decoded pathname must be exactly ${EXPECTED_PATHNAME} with no extra path segment (got ${identity.pathname ?? "null"})`,
    );
  }

  if (identity.database !== CONTRADICTION_REAL_DB_TEST_DATABASE) {
    blockers.push(
      `database identity must be exactly ${CONTRADICTION_REAL_DB_TEST_DATABASE} (got ${identity.database ?? "null"})`,
    );
  }

  if (identity.schema !== EXPECTED_SCHEMA) {
    blockers.push(
      `schema query parameter must be exactly ${EXPECTED_SCHEMA} (got ${identity.schema ?? "null"})`,
    );
  }

  // Explicit refusals for known unsafe database names (pathname may already block).
  if (
    identity.pathname === "/companion" ||
    identity.pathname === "/postgres"
  ) {
    blockers.push(
      `refuses non-isolated database pathname ${identity.pathname}`,
    );
  }

  for (const pattern of FORBIDDEN_HOST_PATTERNS) {
    if (identity.hostname && pattern.test(identity.hostname)) {
      blockers.push(`refuses cloud/production host pattern ${pattern}`);
    }
  }

  for (const pattern of PRIVATE_NETWORK_HOST_PATTERNS) {
    if (identity.hostname && pattern.test(identity.hostname)) {
      blockers.push(`refuses private-network host ${identity.hostname}`);
    }
  }

  if (
    typeof args.appDatabaseUrl === "string" &&
    args.appDatabaseUrl.trim().length > 0 &&
    args.appDatabaseUrl.trim() === raw
  ) {
    blockers.push(
      "refuses using the normal app DATABASE_URL value for the isolated proof",
    );
  }

  return {
    allowed: blockers.length === 0,
    blockers: Array.from(new Set(blockers)),
    sourceEnvName,
    identity,
    normalisedUrl: blockers.length === 0 ? raw : null,
  };
}

export function assertContradictionRealDbTestUrl(
  url: string | undefined,
  appDatabaseUrl?: string | undefined,
): string {
  const assessment = assessContradictionRealDbTestUrlSafety({
    url,
    sourceEnvName: CONTRADICTION_REAL_DB_TEST_URL_ENV,
    appDatabaseUrl,
  });
  if (!assessment.allowed || !assessment.normalisedUrl) {
    throw new Error(
      [
        "REFUSED: contradiction real-DB proof blocked by safety guard.",
        `Required env: ${CONTRADICTION_REAL_DB_TEST_URL_ENV}`,
        `Expected identity: local PostgreSQL / ${CONTRADICTION_REAL_DB_TEST_DATABASE}`,
        `Blockers: ${assessment.blockers.join("; ")}`,
      ].join("\n"),
    );
  }
  return assessment.normalisedUrl;
}

/**
 * Refuse destructive SQL/CLI commands unless the target database identity is
 * exactly the isolated proof database.
 */
export function assertDestructiveTargetIsIsolatedTestDb(args: {
  databaseName: string | undefined;
  operation: string;
}): void {
  if (args.databaseName !== CONTRADICTION_REAL_DB_TEST_DATABASE) {
    throw new Error(
      `REFUSED destructive operation "${args.operation}": database must be exactly ${CONTRADICTION_REAL_DB_TEST_DATABASE} (got ${args.databaseName ?? "null"})`,
    );
  }
}
