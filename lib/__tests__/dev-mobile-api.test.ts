import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEV_MOBILE_HEADER_NAME,
  canUseDevMobileBypass,
  isDevMobileBypassPathname,
} from "../dev-mobile-api";

function createRequest(pathname: string, withHeader = true): Request {
  return new Request(`http://localhost${pathname}`, {
    headers: withHeader ? { [DEV_MOBILE_HEADER_NAME]: "1" } : undefined,
  });
}

describe("dev-mobile API bypass", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_MOBILE_API", "1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("includes /api/check-ins in the bypass allowlist", () => {
    expect(isDevMobileBypassPathname("/api/check-ins")).toBe(true);
    expect(isDevMobileBypassPathname("/api/check-ins/any-child")).toBe(true);
  });

  it("allows /api/check-ins only when dev header is present", () => {
    expect(canUseDevMobileBypass(createRequest("/api/check-ins", true))).toBe(
      true
    );
    expect(
      canUseDevMobileBypass(createRequest("/api/check-ins", false))
    ).toBe(false);
  });

  it("does not broadly allow unknown /api paths", () => {
    expect(canUseDevMobileBypass(createRequest("/api/unknown", true))).toBe(
      false
    );
    expect(
      canUseDevMobileBypass(createRequest("/api/check-ins-extra", true))
    ).toBe(false);
  });

  it("does not allow bypass in production even when header is present", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_MOBILE_API", "1");

    expect(canUseDevMobileBypass(createRequest("/api/check-ins", true))).toBe(
      false
    );
  });
});
