export type BrowserAuditFixtureLike =
  | {
      ids?: {
        userId?: string | null;
      } | null;
    }
  | null
  | undefined;

export type BrowserAuditAuthLike =
  | {
      userId?: string | null;
    }
  | null
  | undefined;

export type BrowserAuditClerkRuntimeFailure =
  | "testing_token_refresh"
  | "testing_user_create"
  | "testing_user_delete";

export function resolveBrowserAuditCleanupUserId(args: {
  fixture: BrowserAuditFixtureLike;
  primaryAuth: BrowserAuditAuthLike;
}): string | null {
  return args.fixture?.ids?.userId ?? args.primaryAuth?.userId ?? null;
}

export function createBrowserAuditClerkRuntimeError(
  stage: BrowserAuditClerkRuntimeFailure,
): Error {
  return new Error(`BLOCKED_AUTHENTICATED_BROWSER_RUNTIME:${stage}`);
}
