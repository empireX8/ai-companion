import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_NO_WRITE_DARK_RUN_COOLDOWN_MS,
  evaluateNoWriteDarkRunTriggerEligibility,
} from "../understanding-dark-engine/no-write-trigger-eligibility";
import {
  loadNoWriteDarkRunTriggerRuntimeState,
  resolveCandidateBridgeNoWriteTriggerEligibility,
  UNDERSTANDING_DARK_ENGINE_NO_WRITE_DERIVATION_SCOPE,
  UNDERSTANDING_DARK_ENGINE_NO_WRITE_PROCESSOR_VERSION,
} from "../understanding-dark-engine/no-write-trigger-runtime-state";

const NOW = new Date("2026-06-01T12:00:00.000Z");

function withMsOffset(base: Date, offsetMs: number): Date {
  return new Date(base.getTime() + offsetMs);
}

function createDbMock(options: {
  latestRunCreatedAt?: Date | null;
  inFlight?: boolean;
}) {
  return {
    derivationRun: {
      findFirst: vi.fn(async (args: { where: { status?: { in: string[] } } }) => {
        if (args.where.status) {
          return options.inFlight ? { id: "run-in-flight" } : null;
        }
        return options.latestRunCreatedAt
          ? { createdAt: options.latestRunCreatedAt }
          : null;
      }),
    },
  };
}

describe("no-write trigger runtime state helper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads lastRunAt and inFlight from understanding-dark-engine DerivationRun rows", async () => {
    const db = createDbMock({
      latestRunCreatedAt: withMsOffset(NOW, -120_000),
      inFlight: true,
    });

    const state = await loadNoWriteDarkRunTriggerRuntimeState({
      userId: "user-1",
      db: db as never,
    });

    expect(state.lastRunAt).toEqual(withMsOffset(NOW, -120_000));
    expect(state.inFlight).toBe(true);
    expect(state.lastEvidenceAt).toBeNull();
    expect(db.derivationRun.findFirst).toHaveBeenCalledTimes(2);
    expect(db.derivationRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          scope: UNDERSTANDING_DARK_ENGINE_NO_WRITE_DERIVATION_SCOPE,
          processorVersion: UNDERSTANDING_DARK_ENGINE_NO_WRITE_PROCESSOR_VERSION,
        }),
      })
    );
  });

  it("returns triggerEvidenceAt as lastEvidenceAt only when explicitly provided", async () => {
    const db = createDbMock({ latestRunCreatedAt: null, inFlight: false });
    const triggerEvidenceAt = withMsOffset(NOW, -1_000);

    const state = await loadNoWriteDarkRunTriggerRuntimeState({
      userId: "user-1",
      db: db as never,
      triggerEvidenceAt,
    });

    expect(state.lastEvidenceAt).toEqual(triggerEvidenceAt);
  });

  it("passes loaded runtime values into eligibility evaluation", async () => {
    const db = createDbMock({
      latestRunCreatedAt: withMsOffset(NOW, -5_000),
      inFlight: true,
    });
    const triggerEvidenceAt = NOW;

    const result = await resolveCandidateBridgeNoWriteTriggerEligibility({
      userId: "user-1",
      eventType: "app_user_message",
      now: NOW,
      triggerEvidenceAt,
      db: db as never,
      logTag: "[TEST]",
    });

    expect(result.eligible).toBe(false);
    expect(result.decision).toBe("mark_trailing_pending");
    expect(
      evaluateNoWriteDarkRunTriggerEligibility({
        userId: "user-1",
        eventType: "app_user_message",
        now: NOW,
        lastRunAt: withMsOffset(NOW, -5_000),
        lastEvidenceAt: triggerEvidenceAt,
        inFlight: true,
        noWriteOnly: true,
      })
    ).toEqual(result);
  });

  it("suppresses eligibility on cooldown using loaded lastRunAt", async () => {
    const db = createDbMock({
      latestRunCreatedAt: withMsOffset(NOW, -5_000),
      inFlight: false,
    });

    const result = await resolveCandidateBridgeNoWriteTriggerEligibility({
      userId: "user-1",
      eventType: "import_completed",
      now: NOW,
      triggerEvidenceAt: NOW,
      db: db as never,
      logTag: "[TEST]",
    });

    expect(result.eligible).toBe(false);
    expect(result.decision).toBe("suppressed_cooldown");
    expect(result.cooldownRemainingMs).toBeGreaterThan(0);
    expect(result.cooldownRemainingMs).toBeLessThanOrEqual(
      DEFAULT_NO_WRITE_DARK_RUN_COOLDOWN_MS
    );
  });

  it("fails open when runtime state loading throws", async () => {
    const db = {
      derivationRun: {
        findFirst: vi.fn(async () => {
          throw new Error("db unavailable");
        }),
      },
    };

    const result = await resolveCandidateBridgeNoWriteTriggerEligibility({
      userId: "user-1",
      eventType: "app_user_message",
      now: NOW,
      triggerEvidenceAt: NOW,
      db: db as never,
      logTag: "[TEST]",
    });

    expect(result.eligible).toBe(true);
    expect(result.decision).toBe("eligible");
  });
});
