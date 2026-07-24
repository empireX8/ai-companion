import { describe, expect, it } from "vitest";

import {
  createBrowserAuditClerkRuntimeError,
  resolveBrowserAuditCleanupUserId,
} from "../contradiction-final-production-audit-runtime";

describe("contradiction final production audit runtime helpers", () => {
  it("prefers the seeded fixture user id when fixture rows were fully assigned", () => {
    expect(
      resolveBrowserAuditCleanupUserId({
        fixture: { ids: { userId: "fixture-user" } },
        primaryAuth: { userId: "primary-user" },
      }),
    ).toBe("fixture-user");
  });

  it("falls back to the primary auth user id when seeding failed before fixture assignment", () => {
    expect(
      resolveBrowserAuditCleanupUserId({
        fixture: null,
        primaryAuth: { userId: "primary-user" },
      }),
    ).toBe("primary-user");
  });

  it("returns null when no cleanup target was ever created", () => {
    expect(
      resolveBrowserAuditCleanupUserId({
        fixture: null,
        primaryAuth: null,
      }),
    ).toBeNull();
  });

  it("uses coarse Clerk runtime errors without propagating SDK payloads", () => {
    expect(
      createBrowserAuditClerkRuntimeError("testing_token_refresh").message,
    ).toBe("BLOCKED_AUTHENTICATED_BROWSER_RUNTIME:testing_token_refresh");
    expect(
      createBrowserAuditClerkRuntimeError("testing_user_create").message,
    ).toBe("BLOCKED_AUTHENTICATED_BROWSER_RUNTIME:testing_user_create");
    expect(
      createBrowserAuditClerkRuntimeError("testing_user_delete").message,
    ).toBe("BLOCKED_AUTHENTICATED_BROWSER_RUNTIME:testing_user_delete");
  });
});
