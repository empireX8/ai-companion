export const DEV_MOBILE_HEADER_NAME = "x-mindlab-dev-mobile";

const DEV_MOBILE_BYPASS_PATH_PREFIXES = [
  "/api/patterns",
  "/api/timeline",
  "/api/check-ins",
  "/api/session",
  "/api/message",
  "/api/journal/entries",
] as const;

const FALSEY_FLAG_VALUES = new Set(["0", "false", "off", "no"]);

export function isDevMobileBypassPathname(pathname: string): boolean {
  return DEV_MOBILE_BYPASS_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function requestHasDevMobileBypassHeader(request: Request): boolean {
  return request.headers.get(DEV_MOBILE_HEADER_NAME)?.trim() === "1";
}

export function isDevMobileBypassRuntimeEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const rawFlag = process.env.ALLOW_DEV_MOBILE_API?.trim().toLowerCase();
  if (!rawFlag) {
    return true;
  }

  return !FALSEY_FLAG_VALUES.has(rawFlag);
}

export function canUseDevMobileBypass(request: Request): boolean {
  return (
    isDevMobileBypassRuntimeEnabled() &&
    requestHasDevMobileBypassHeader(request) &&
    isDevMobileBypassPathname(new URL(request.url).pathname)
  );
}
