import { describe, expect, it } from "vitest";

import {
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV,
  ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV,
  isCanonicalModelAuthorityEnabledForUser,
} from "../canonical-model-authority-flag";

describe("isCanonicalModelAuthorityEnabledForUser", () => {
  const userId = "user_abc123";

  it("defaults to disabled when flag and allowlist are absent", () => {
    expect(isCanonicalModelAuthorityEnabledForUser(userId, {})).toBe(false);
  });

  it("is disabled when flag is not exactly 1", () => {
    const allow = {
      [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV]: userId,
    };
    expect(
      isCanonicalModelAuthorityEnabledForUser(userId, {
        ...allow,
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "true",
      }),
    ).toBe(false);
    expect(
      isCanonicalModelAuthorityEnabledForUser(userId, {
        ...allow,
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "0",
      }),
    ).toBe(false);
    expect(
      isCanonicalModelAuthorityEnabledForUser(userId, {
        ...allow,
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: " 1 ",
      }),
    ).toBe(false);
  });

  it("is disabled when flag is 1 but allowlist is empty or absent", () => {
    expect(
      isCanonicalModelAuthorityEnabledForUser(userId, {
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "1",
      }),
    ).toBe(false);
    expect(
      isCanonicalModelAuthorityEnabledForUser(userId, {
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "1",
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV]: "",
      }),
    ).toBe(false);
    expect(
      isCanonicalModelAuthorityEnabledForUser(userId, {
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "1",
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV]: " ,  , ",
      }),
    ).toBe(false);
  });

  it("trims allowlist entries and ignores empties", () => {
    expect(
      isCanonicalModelAuthorityEnabledForUser(userId, {
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "1",
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV]: ` , ${userId} ,other_user, `,
      }),
    ).toBe(true);
  });

  it("requires exact case-sensitive Clerk ID match", () => {
    const env = {
      [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "1",
      [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV]: userId,
    };
    expect(isCanonicalModelAuthorityEnabledForUser(userId, env)).toBe(true);
    expect(isCanonicalModelAuthorityEnabledForUser("USER_abc123", env)).toBe(
      false,
    );
    expect(isCanonicalModelAuthorityEnabledForUser("user_abc12", env)).toBe(
      false,
    );
    expect(isCanonicalModelAuthorityEnabledForUser("user_abc1234", env)).toBe(
      false,
    );
  });

  it("does not treat wildcard or prefix entries as matches", () => {
    expect(
      isCanonicalModelAuthorityEnabledForUser(userId, {
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "1",
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV]: "user_*",
      }),
    ).toBe(false);
    expect(
      isCanonicalModelAuthorityEnabledForUser(userId, {
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "1",
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV]: "user_",
      }),
    ).toBe(false);
  });

  it("rejects empty userId", () => {
    expect(
      isCanonicalModelAuthorityEnabledForUser("", {
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_ENV]: "1",
        [ORVEK_CANONICAL_MODEL_AUTHORITY_V1_USER_IDS_ENV]: "",
      }),
    ).toBe(false);
  });
});
