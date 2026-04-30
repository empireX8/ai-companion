import { auth } from "@clerk/nextjs/server";

import prismadb from "./prismadb";
import { canUseDevMobileBypass } from "./dev-mobile-api";

const DEV_MOBILE_USER_ID_ENV_VAR = "DEV_MOBILE_USER_ID";

async function resolveFallbackDevMobileUserId(): Promise<string | null> {
  const [
    latestSession,
    latestMessage,
    latestJournalEntry,
    latestPatternClaim,
  ] = await Promise.all([
    prismadb.session.findFirst({
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      select: { userId: true },
    }),
    prismadb.message.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { userId: true },
    }),
    prismadb.journalEntry.findFirst({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { userId: true },
    }),
    prismadb.patternClaim.findFirst({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { userId: true },
    }),
  ]);

  return (
    latestSession?.userId ??
    latestMessage?.userId ??
    latestJournalEntry?.userId ??
    latestPatternClaim?.userId ??
    null
  );
}

/**
 * Resolve request user identity with a strict development-only mobile bypass.
 *
 * Priority:
 * 1) Clerk auth userId (normal behavior)
 * 2) Dev-mobile header bypass (non-production only) using:
 *    - DEV_MOBILE_USER_ID env var if present
 *    - latest known local userId fallback from DB
 */
export async function resolveApiUserId(
  request?: Request
): Promise<string | null> {
  const { userId } = await auth();
  if (userId) {
    return userId;
  }

  if (!request || !canUseDevMobileBypass(request)) {
    return null;
  }

  const configuredDevUserId = process.env[DEV_MOBILE_USER_ID_ENV_VAR]?.trim();
  if (configuredDevUserId) {
    return configuredDevUserId;
  }

  return resolveFallbackDevMobileUserId();
}
