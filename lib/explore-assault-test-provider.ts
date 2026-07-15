/**
 * Local/test-only deterministic Explore reply provider.
 *
 * Impossible to enable in production:
 * - requires ORVEK_EXPLORE_ASSAULT_DETERMINISTIC_REPLY=1
 * - requires local DATABASE_URL (companion / localhost)
 * - refuses NODE_ENV=production
 */

export const EXPLORE_ASSAULT_DETERMINISTIC_REPLY_ENV =
  "ORVEK_EXPLORE_ASSAULT_DETERMINISTIC_REPLY";

export const EXPLORE_ASSAULT_DETERMINISTIC_REPLY_TEXT = [
  "VERIFIED: Stored evidence shows you keep working past the stop point.",
  "INFERRED: Evening energy drops after meetings when no stop point is named.",
].join(" ");

const LOCAL_DATABASE_URL_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/i,
  /0\.0\.0\.0/i,
  /companion-db/i,
  /@postgres:/i,
] as const;

const PRODUCTION_DATABASE_URL_PATTERNS = [
  /amazonaws\.com/i,
  /\.rds\./i,
  /neon\.tech/i,
  /supabase\.co/i,
  /railway\.app/i,
  /planetscale\.com/i,
  /prod\./i,
  /production/i,
] as const;

export function exploreAssaultDeterministicReplyAllowed(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (env.NODE_ENV === "production") return false;
  if (env[EXPLORE_ASSAULT_DETERMINISTIC_REPLY_ENV] !== "1") return false;
  const databaseUrl = env.DATABASE_URL ?? "";
  if (!databaseUrl.trim()) return false;
  if (PRODUCTION_DATABASE_URL_PATTERNS.some((pattern) => pattern.test(databaseUrl))) {
    return false;
  }
  return LOCAL_DATABASE_URL_PATTERNS.some((pattern) => pattern.test(databaseUrl));
}

export function buildExploreAssaultDeterministicReply(userMessage: string): string {
  const trimmed = userMessage.trim();
  return `${EXPLORE_ASSAULT_DETERMINISTIC_REPLY_TEXT} (re: ${trimmed.slice(0, 80)})`;
}
