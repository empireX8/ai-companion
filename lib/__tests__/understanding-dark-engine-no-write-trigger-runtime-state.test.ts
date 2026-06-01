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
  latestRun?: { createdAt: Date; windowEnd: Date | null } | null;
  inFlight?: boolean;
}) {
  return {
    derivationRun: {
      findFirst: vi.fn(async (args: { where: { status?: { in: string[] } } }) => {
        if (args.where.status) {
          return options.inFlight ? { id: "run-in-flight" } : null;
        }
        return options.latestRun ?? null;
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

  it("loads lastRunAt from DerivationRun.createdAt and cutoff from windowEnd", async () => {
    const createdAt = withMsOffset(NOW, -120_000);
    const windowEnd = withMsOffset(NOW, -180_000);
    const db = createDbMock({
      latestRun: { createdAt, windowEnd },
      inFlight: true,
    });

    const state = await loadNoWriteDarkRunTriggerRuntimeState({
      userId: "user-1",
      db: db as never,
    });

    expect(state.lastRunAt).toEqual(createdAt);
    expect(state.lastEvidenceCutoffAt).toEqual(windowEnd);
    expect(state.inFlight).toBe(true);
    expect(state.triggerEvidenceAt).toBeNull();
    expect(db.derivationRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          scope: UNDERSTANDING_DARK_ENGINE_NO_WRITE_DERIVATION_SCOPE,
          processorVersion: UNDERSTANDING_DARK_ENGINE_NO_WRITE_PROCESSOR_VERSION,
        }),
        select: { createdAt: true, windowEnd: true },
      })
    );
  });

  it("falls back evidence cutoff to createdAt when windowEnd is absent", async () => {
    const createdAt = withMsOffset(NOW, -90_000);
    const db = createDbMock({
      latestRun: { createdAt, windowEnd: null },
      inFlight: false,
    });

    const state = await loadNoWriteDarkRunTriggerRuntimeState({
      userId: "user-1",
      db: db as never,
    });

    expect(state.lastRunAt).toEqual(createdAt);
    expect(state.lastEvidenceCutoffAt).toEqual(createdAt);
  });

  it("passes createdAt as lastRunAt and windowEnd as lastEvidenceCutoffAt to eligibility", async () => {
    const createdAt = withMsOffset(NOW, -5_000);
    const windowEnd = withMsOffset(NOW, -8_000);
    const triggerEvidenceAt = NOW;
    const db = createDbMock({
      latestRun: { createdAt, windowEnd },
      inFlight: true,
    });

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
        lastRunAt: createdAt,
        lastEvidenceCutoffAt: windowEnd,
        lastEvidenceAt: triggerEvidenceAt,
        inFlight: true,
        noWriteOnly: true,
      })
    ).toEqual(result);
  });

  it("does not block no-new-evidence when trigger is after windowEnd but before createdAt", async () => {
    const windowEnd = withMsOffset(NOW, -20_000);
    const createdAt = withMsOffset(NOW, -5_000);
    const triggerEvidenceAt = withMsOffset(NOW, -10_000);
    const db = createDbMock({
      latestRun: { createdAt, windowEnd },
      inFlight: false,
    });

    const result = await resolveCandidateBridgeNoWriteTriggerEligibility({
      userId: "user-1",
      eventType: "app_user_message",
      now: NOW,
      triggerEvidenceAt,
      db: db as never,
      logTag: "[TEST]",
    });

    expect(result.eligible).toBe(false);
    expect(result.decision).toBe("suppressed_cooldown");
    expect(result.decision).not.toBe("blocked_no_new_evidence");
  });

  it("suppresses eligibility on cooldown using createdAt rather than windowEnd", async () => {
    const createdAt = withMsOffset(NOW, -5_000);
    const windowEnd = withMsOffset(NOW, -120_000);
    const db = createDbMock({
      latestRun: { createdAt, windowEnd },
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

  it("blocks no-new-evidence when trigger evidence is not newer than windowEnd", async () => {
    const windowEnd = withMsOffset(NOW, -2_000);
    const createdAt = withMsOffset(NOW, -1_000);
    const triggerEvidenceAt = withMsOffset(NOW, -3_000);
    const db = createDbMock({
      latestRun: { createdAt, windowEnd },
      inFlight: false,
    });

    const result = await resolveCandidateBridgeNoWriteTriggerEligibility({
      userId: "user-1",
      eventType: "app_user_message",
      now: NOW,
      triggerEvidenceAt,
      db: db as never,
      logTag: "[TEST]",
    });

    expect(result.eligible).toBe(false);
    expect(result.decision).toBe("blocked_no_new_evidence");
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
