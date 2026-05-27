import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_NO_WRITE_DARK_RUN_COOLDOWN_MS,
  evaluateNoWriteDarkRunTriggerEligibility,
} from "../understanding-dark-engine/no-write-trigger-eligibility";

const NOW = new Date("2026-05-27T12:00:00.000Z");

function withMsOffset(base: Date, deltaMs: number): Date {
  return new Date(base.getTime() + deltaMs);
}

describe("Phase 2F no-write trigger eligibility helper", () => {
  it("marks app_user_message as eligible outside cooldown with newer evidence", () => {
    const result = evaluateNoWriteDarkRunTriggerEligibility({
      userId: "user-1",
      eventType: "app_user_message",
      now: NOW,
      cooldownMs: DEFAULT_NO_WRITE_DARK_RUN_COOLDOWN_MS,
      lastRunAt: withMsOffset(NOW, -60_000),
      lastEvidenceAt: withMsOffset(NOW, -5_000),
      noWriteOnly: true,
    });

    expect(result.eligible).toBe(true);
    expect(result.decision).toBe("eligible");
    expect(result.shouldMarkPending).toBe(false);
    expect(result.cooldownRemainingMs).toBe(0);
    expect(result.noWriteOnly).toBe(true);
  });

  it("marks import_completed as eligible outside cooldown", () => {
    const result = evaluateNoWriteDarkRunTriggerEligibility({
      userId: "user-1",
      eventType: "import_completed",
      now: NOW,
      lastRunAt: withMsOffset(NOW, -31_000),
    });

    expect(result.eligible).toBe(true);
    expect(result.decision).toBe("eligible");
    expect(result.eventType).toBe("import_completed");
    expect(result.noWriteOnly).toBe(true);
  });

  it("allows manual_internal override inside cooldown", () => {
    const result = evaluateNoWriteDarkRunTriggerEligibility({
      userId: "user-1",
      eventType: "manual_internal",
      now: NOW,
      cooldownMs: DEFAULT_NO_WRITE_DARK_RUN_COOLDOWN_MS,
      lastRunAt: withMsOffset(NOW, -5_000),
      allowManualOverride: true,
    });

    expect(result.eligible).toBe(true);
    expect(result.decision).toBe("eligible");
    expect(result.cooldownRemainingMs).toBe(0);
    expect(result.noWriteOnly).toBe(true);
  });

  it("suppresses eligible event during cooldown and marks trailing pending", () => {
    const result = evaluateNoWriteDarkRunTriggerEligibility({
      userId: "user-1",
      eventType: "app_user_message",
      now: NOW,
      cooldownMs: 30_000,
      lastRunAt: withMsOffset(NOW, -5_000),
    });

    expect(result.eligible).toBe(false);
    expect(result.decision).toBe("suppressed_cooldown");
    expect(result.shouldMarkPending).toBe(true);
    expect(result.cooldownRemainingMs).toBe(25_000);
    expect(result.noWriteOnly).toBe(true);
  });

  it("marks trailing pending when inFlight is true for eligible event", () => {
    const result = evaluateNoWriteDarkRunTriggerEligibility({
      userId: "user-1",
      eventType: "import_completed",
      now: NOW,
      inFlight: true,
      lastRunAt: withMsOffset(NOW, -10_000),
      cooldownMs: 30_000,
    });

    expect(result.eligible).toBe(false);
    expect(result.decision).toBe("mark_trailing_pending");
    expect(result.shouldMarkPending).toBe(true);
    expect(result.cooldownRemainingMs).toBe(20_000);
    expect(result.noWriteOnly).toBe(true);
  });

  it("blocks automatic events when there is no new evidence since last run", () => {
    const result = evaluateNoWriteDarkRunTriggerEligibility({
      userId: "user-1",
      eventType: "app_user_message",
      now: NOW,
      lastRunAt: withMsOffset(NOW, -60_000),
      lastEvidenceAt: withMsOffset(NOW, -70_000),
    });

    expect(result.eligible).toBe(false);
    expect(result.decision).toBe("blocked_no_new_evidence");
    expect(result.shouldMarkPending).toBe(false);
    expect(result.noWriteOnly).toBe(true);
  });

  it("allows manual override when evidence is not newer than last run", () => {
    const result = evaluateNoWriteDarkRunTriggerEligibility({
      userId: "user-1",
      eventType: "manual_internal",
      now: NOW,
      allowManualOverride: true,
      lastRunAt: withMsOffset(NOW, -10_000),
      lastEvidenceAt: withMsOffset(NOW, -120_000),
    });

    expect(result.eligible).toBe(true);
    expect(result.decision).toBe("eligible");
    expect(result.noWriteOnly).toBe(true);
  });

  it.each([
    "assistant_message",
    "system_message",
    "action_feedback",
    "fieldwork_completed",
    "model_update_created",
    "pattern_claim_changed",
    "public_route_view",
    "mobile_view",
    "unknown",
    "totally_new_event",
  ])("blocks event type %s", (eventType) => {
    const result = evaluateNoWriteDarkRunTriggerEligibility({
      userId: "user-1",
      eventType,
      now: NOW,
    });

    expect(result.eligible).toBe(false);
    expect(result.decision).toBe("blocked_event_type");
    expect(result.shouldMarkPending).toBe(false);
    expect(result.noWriteOnly).toBe(true);
  });

  it("blocks when userId is missing", () => {
    const result = evaluateNoWriteDarkRunTriggerEligibility({
      userId: "   ",
      eventType: "app_user_message",
      now: NOW,
    });

    expect(result.eligible).toBe(false);
    expect(result.decision).toBe("blocked_missing_user");
    expect(result.noWriteOnly).toBe(true);
  });

  it("blocks when noWriteOnly mode is disabled and still returns noWriteOnly=true", () => {
    const result = evaluateNoWriteDarkRunTriggerEligibility({
      userId: "user-1",
      eventType: "manual_internal",
      now: NOW,
      noWriteOnly: false,
      allowManualOverride: true,
    });

    expect(result.eligible).toBe(false);
    expect(result.decision).toBe("blocked_not_no_write_safe");
    expect(result.noWriteOnly).toBe(true);
  });

  it("does not import orchestrator/evaluator/write modules or DB dependencies", () => {
    const helperPath = fileURLToPath(
      new URL(
        "../understanding-dark-engine/no-write-trigger-eligibility.ts",
        import.meta.url
      )
    );
    const source = readFileSync(helperPath, "utf8");

    expect(source).not.toContain("runNoWriteUnderstandingDarkRun");
    expect(source).not.toContain("evaluateNoWriteDarkRunOutput");
    expect(source).not.toContain("runManualUnderstandingDarkEngineDarkRun");
    expect(source).not.toContain("persistInternalUserMapConclusionCandidate");
    expect(source).not.toContain("createUnderstandingEvidenceLinkForUser");
    expect(source).not.toContain("prismadb");
    expect(source).not.toMatch(/\.(create|update|upsert|delete)\(/);
  });
});
