/**
 * Phase 6 safety hardening proofs.
 * Tests nonce validation, path containment, exact-disposable-DB guard,
 * runtime capture shared-guard gating, private handoff storage removal,
 * and required-stage fail-closed contract.
 */

import { describe, expect, it } from "vitest";

import {
  isValidCaptureNonce,
  isCanonicalAiRequestCaptureEnabled,
  readCanonicalAiRequestCaptureFile,
  recordCanonicalAiRequestCapture,
  deleteCanonicalAiRequestCaptureFile,
  extractCanonicalAiCaptureNonce,
  enableCanonicalAiRequestCaptureForTests,
  disableCanonicalAiRequestCaptureForTests,
  getCanonicalAiRequestCaptureForTests,
  ORVEK_CANONICAL_AI_CAPTURE_NONCE_HEADER,
} from "../canonical-ai-request-capture";
import { phase6DeterministicReplyAllowed } from "../canonical-phase6-deterministic-reply";
import {
  isPhase6TestSeamActive,
  parseExactDisposableDbUrl,
} from "../canonical-phase6-test-seam-guard";

// ── 1. Nonce validation ──────────────────────────────────────────────────────

describe("capture nonce allowlist", () => {
  it("accepts valid alphanumeric nonces", () => {
    expect(isValidCaptureNonce("abc123")).toBe(true);
    expect(isValidCaptureNonce("phase6_nonce-OK")).toBe(true);
    expect(isValidCaptureNonce("A".repeat(128))).toBe(true);
    expect(isValidCaptureNonce("a")).toBe(true);
  });

  it("rejects path traversal attempts", () => {
    expect(isValidCaptureNonce("../escape")).toBe(false);
    expect(isValidCaptureNonce("../../tmp/x")).toBe(false);
    expect(isValidCaptureNonce("a/b")).toBe(false);
    expect(isValidCaptureNonce("a\\b")).toBe(false);
    expect(isValidCaptureNonce("%2e%2e")).toBe(false);
  });

  it("rejects empty or blank nonces", () => {
    expect(isValidCaptureNonce("")).toBe(false);
    expect(isValidCaptureNonce("   ")).toBe(false);
    expect(isValidCaptureNonce(null)).toBe(false);
    expect(isValidCaptureNonce(undefined)).toBe(false);
    expect(isValidCaptureNonce(42)).toBe(false);
  });

  it("rejects nonces over 128 characters", () => {
    expect(isValidCaptureNonce("a".repeat(129))).toBe(false);
  });
});

// ── 2. No file created / read for invalid nonces ─────────────────────────────

describe("capture file operations reject invalid nonces", () => {
  it("readCanonicalAiRequestCaptureFile returns null for traversal nonce", () => {
    expect(readCanonicalAiRequestCaptureFile("../escape")).toBeNull();
    expect(readCanonicalAiRequestCaptureFile("../../tmp/x")).toBeNull();
    expect(readCanonicalAiRequestCaptureFile("a/b")).toBeNull();
    expect(readCanonicalAiRequestCaptureFile("a\\b")).toBeNull();
    expect(readCanonicalAiRequestCaptureFile("%2e%2e")).toBeNull();
    expect(readCanonicalAiRequestCaptureFile("")).toBeNull();
    expect(readCanonicalAiRequestCaptureFile("a".repeat(129))).toBeNull();
  });

  it("deleteCanonicalAiRequestCaptureFile does not throw for invalid nonces", () => {
    expect(() => deleteCanonicalAiRequestCaptureFile("../escape")).not.toThrow();
    expect(() => deleteCanonicalAiRequestCaptureFile("a/b")).not.toThrow();
    expect(() => deleteCanonicalAiRequestCaptureFile("")).not.toThrow();
  });

  it("recordCanonicalAiRequestCapture ignores invalid correlationId without throwing", () => {
    enableCanonicalAiRequestCaptureForTests();
    try {
      expect(() =>
        recordCanonicalAiRequestCapture({
          conceptIds: ["c1"],
          currentRevisionIds: ["r1"],
          versions: [1],
          summaries: ["s"],
          blockChars: 10,
          correlationId: "../escape",
        }),
      ).not.toThrow();
      expect(readCanonicalAiRequestCaptureFile("../escape")).toBeNull();
      expect(readCanonicalAiRequestCaptureFile("../../tmp/escape")).toBeNull();
    } finally {
      disableCanonicalAiRequestCaptureForTests();
    }
  });
});

// ── 2b. Runtime capture requires shared guard ────────────────────────────────

describe("runtime capture requires shared exact-environment guard", () => {
  it("ORVEK_CANONICAL_AI_REQUEST_CAPTURE=1 alone → nonce ignored, no capture, no file", () => {
    disableCanonicalAiRequestCaptureForTests();
    const aloneEnv = {
      ORVEK_CANONICAL_AI_REQUEST_CAPTURE: "1",
    };
    expect(isCanonicalAiRequestCaptureEnabled(aloneEnv)).toBe(false);
    expect(isPhase6TestSeamActive(aloneEnv)).toBe(false);

    const req = new Request("http://localhost/api/message", {
      headers: { [ORVEK_CANONICAL_AI_CAPTURE_NONCE_HEADER]: "alone_nonce_abc" },
    });
    expect(extractCanonicalAiCaptureNonce(req, aloneEnv)).toBeNull();

    recordCanonicalAiRequestCapture(
      {
        conceptIds: ["c1"],
        currentRevisionIds: ["r1"],
        versions: [1],
        summaries: ["secret"],
        blockChars: 10,
        correlationId: "alone_nonce_abc",
      },
      aloneEnv,
    );
    expect(getCanonicalAiRequestCaptureForTests()).toBeNull();
    expect(readCanonicalAiRequestCaptureFile("alone_nonce_abc")).toBeNull();
  });
});

// ── 3. Exact-disposable-DB guard (parsed URL identity) ───────────────────────

const DISPOSABLE = "postgresql://user@127.0.0.1:5432/companion_canonical_authority_test";

type TestEnv = Record<string, string | undefined>;

const VALID_ENV: TestEnv = {
  PHASE6_MANAGE_SERVER: "1",
  ORVEK_CANONICAL_AI_REQUEST_CAPTURE: "1",
  ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY: "1",
  DATABASE_URL: DISPOSABLE,
  CANONICAL_AUTHORITY_DB_TEST_URL: DISPOSABLE,
};

describe("parseExactDisposableDbUrl", () => {
  it("accepts exact local disposable URL", () => {
    expect(parseExactDisposableDbUrl(DISPOSABLE)).toEqual({
      hostname: "127.0.0.1",
      port: "5432",
      database: "companion_canonical_authority_test",
    });
    expect(
      parseExactDisposableDbUrl(
        "postgres://user@localhost:5432/companion_canonical_authority_test",
      ),
    ).toEqual({
      hostname: "localhost",
      port: "5432",
      database: "companion_canonical_authority_test",
    });
  });

  it("rejects alternate database suffix", () => {
    expect(
      parseExactDisposableDbUrl(
        "postgresql://user@127.0.0.1:5432/companion_canonical_authority_test_evil",
      ),
    ).toBeNull();
  });

  it("rejects remote host even with matching db name", () => {
    expect(
      parseExactDisposableDbUrl(
        "postgresql://user@remote.example.com:5432/companion_canonical_authority_test",
      ),
    ).toBeNull();
  });

  it("rejects wrong port", () => {
    expect(
      parseExactDisposableDbUrl(
        "postgresql://user@127.0.0.1:5433/companion_canonical_authority_test",
      ),
    ).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(parseExactDisposableDbUrl("not-a-url")).toBeNull();
    expect(parseExactDisposableDbUrl("")).toBeNull();
    expect(parseExactDisposableDbUrl(undefined)).toBeNull();
  });
});

describe("Phase 6 test seam guard — exact disposable DB required", () => {
  it("approves valid disposable-DB environment", () => {
    expect(isPhase6TestSeamActive(VALID_ENV)).toBe(true);
  });

  it("rejects generic localhost companion DB", () => {
    expect(
      isPhase6TestSeamActive({
        ...VALID_ENV,
        DATABASE_URL: "postgresql://user@127.0.0.1:5432/companion",
        CANONICAL_AUTHORITY_DB_TEST_URL: "postgresql://user@127.0.0.1:5432/companion",
      }),
    ).toBe(false);
  });

  it("rejects companion-db variant", () => {
    expect(
      isPhase6TestSeamActive({
        ...VALID_ENV,
        DATABASE_URL: "postgresql://localhost:5432/companion-db",
        CANONICAL_AUTHORITY_DB_TEST_URL: "postgresql://localhost:5432/companion-db",
      }),
    ).toBe(false);
  });

  it("rejects evil suffix that would pass substring matching", () => {
    expect(
      isPhase6TestSeamActive({
        ...VALID_ENV,
        DATABASE_URL:
          "postgresql://user@127.0.0.1:5432/companion_canonical_authority_test_evil",
        CANONICAL_AUTHORITY_DB_TEST_URL:
          "postgresql://user@127.0.0.1:5432/companion_canonical_authority_test_evil",
      }),
    ).toBe(false);
  });

  it("rejects remote host with matching database name", () => {
    expect(
      isPhase6TestSeamActive({
        ...VALID_ENV,
        DATABASE_URL:
          "postgresql://user@remote.example.com:5432/companion_canonical_authority_test",
        CANONICAL_AUTHORITY_DB_TEST_URL:
          "postgresql://user@remote.example.com:5432/companion_canonical_authority_test",
      }),
    ).toBe(false);
  });

  it("rejects different hosts", () => {
    expect(
      isPhase6TestSeamActive({
        ...VALID_ENV,
        DATABASE_URL: "postgresql://user@127.0.0.1:5432/companion_canonical_authority_test",
        CANONICAL_AUTHORITY_DB_TEST_URL:
          "postgresql://user@localhost:5432/companion_canonical_authority_test",
      }),
    ).toBe(false);
  });

  it("rejects different ports", () => {
    expect(
      isPhase6TestSeamActive({
        ...VALID_ENV,
        DATABASE_URL: "postgresql://user@127.0.0.1:5432/companion_canonical_authority_test",
        CANONICAL_AUTHORITY_DB_TEST_URL:
          "postgresql://user@127.0.0.1:5433/companion_canonical_authority_test",
      }),
    ).toBe(false);
  });

  it("rejects different database names", () => {
    expect(
      isPhase6TestSeamActive({
        ...VALID_ENV,
        DATABASE_URL: "postgresql://localhost:5432/companion_canonical_authority_test",
        CANONICAL_AUTHORITY_DB_TEST_URL: "postgresql://localhost:5432/companion",
      }),
    ).toBe(false);
  });

  it("rejects when PHASE6_MANAGE_SERVER is absent", () => {
    const env: TestEnv = { ...VALID_ENV, PHASE6_MANAGE_SERVER: undefined };
    expect(isPhase6TestSeamActive(env)).toBe(false);
  });

  it("rejects when ORVEK_CANONICAL_AI_REQUEST_CAPTURE is absent", () => {
    const env: TestEnv = { ...VALID_ENV, ORVEK_CANONICAL_AI_REQUEST_CAPTURE: undefined };
    expect(isPhase6TestSeamActive(env)).toBe(false);
  });

  it("rejects when ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY is absent", () => {
    const env: TestEnv = { ...VALID_ENV, ORVEK_CANONICAL_PHASE6_DETERMINISTIC_REPLY: undefined };
    expect(isPhase6TestSeamActive(env)).toBe(false);
  });

  it("rejects production AWS RDS URL", () => {
    expect(
      isPhase6TestSeamActive({
        ...VALID_ENV,
        DATABASE_URL:
          "postgresql://user:pass@mydb.cluster-abc.us-east-1.rds.amazonaws.com:5432/companion_canonical_authority_test",
        CANONICAL_AUTHORITY_DB_TEST_URL: DISPOSABLE,
      }),
    ).toBe(false);
  });
});

describe("phase6DeterministicReplyAllowed delegates to seam guard", () => {
  it("approves valid environment", () => {
    expect(phase6DeterministicReplyAllowed(VALID_ENV)).toBe(true);
  });

  it("rejects generic localhost DB", () => {
    expect(
      phase6DeterministicReplyAllowed({
        ...VALID_ENV,
        DATABASE_URL: "postgresql://localhost:5432/companion",
        CANONICAL_AUTHORITY_DB_TEST_URL: "postgresql://localhost:5432/companion",
      }),
    ).toBe(false);
  });

  it("rejects missing PHASE6_MANAGE_SERVER", () => {
    const env: TestEnv = { ...VALID_ENV, PHASE6_MANAGE_SERVER: undefined };
    expect(phase6DeterministicReplyAllowed(env)).toBe(false);
  });
});

// ── 4. Handoff module has no browser-storage API ─────────────────────────────

describe("correction handoff — no browser-storage API in module", () => {
  it("handoff module itself contains no browser-storage implementation", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(__dirname, "../canonical-correction-handoff.ts"),
      "utf8",
    );
    expect(src).not.toContain("window");
    expect(src).not.toContain("sessionStorage");
    expect(src).not.toContain("localStorage");
    expect(src).not.toContain("CANONICAL_CORRECTION_HANDOFF_STORAGE_KEY");
    expect(src).not.toContain("CANONICAL_CORRECTION_HANDOFF_EVENT");
    expect(src).not.toContain("storeCanonicalCorrectionHandoff");
    expect(src).not.toContain("readCanonicalCorrectionHandoff");
    expect(src).not.toContain("clearCanonicalCorrectionHandoff");
  });
});

// ── 5. Required-stage fail-closed + failure-path capture cleanup ─────────────

describe("Phase 6 Playwright suite required-stage fail-closed", () => {
  it("afterAll throws when any required stage is missing", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(
        __dirname,
        "../../scripts/orvek-canonical-model-authority-phase6.playwright.ts",
      ),
      "utf8",
    );
    expect(src).toMatch(/missing\.length > 0[\s\S]{1,200}throw new Error/);
    const afterAllIdx = src.indexOf("test.afterAll");
    const afterAllBlock = src.slice(afterAllIdx, afterAllIdx + 4000);
    expect(afterAllBlock).toContain("throw new Error");
    expect(afterAllBlock).toContain("cleanupAllPendingCaptureFiles");
  });

  it("capture nonces are tracked and deleted in finally / afterAll", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(
        __dirname,
        "../../scripts/orvek-canonical-model-authority-phase6.playwright.ts",
      ),
      "utf8",
    );
    expect(src).toContain("pendingCaptureNonces");
    expect(src).toContain("trackCaptureNonce");
    expect(src).toContain("deleteTrackedCaptureNonce");
    expect(src).toContain("cleanupAllPendingCaptureFiles");
    expect(src).not.toContain("rmSync(captureDir");
    expect(src).not.toContain('rmSync(tmpdir()');
  });

  it("no SKIP-producing conditional success paths exist for required stages", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(
        __dirname,
        "../../scripts/orvek-canonical-model-authority-phase6.playwright.ts",
      ),
      "utf8",
    );
    expect(src).not.toContain("Fallback: inject handoff");
    expect(src).not.toContain('stages["H_map_propose_store"] = "FAIL"');
  });
});
