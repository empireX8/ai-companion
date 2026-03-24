/**
 * Pattern Claim Hooks tests (P3-10)
 */

import { describe, expect, it } from "vitest";

import { patternClaimHooks, type PatternClaimEvent } from "../pattern-claim-hooks";

describe("patternClaimHooks", () => {
  it("registered listener receives emitted event", async () => {
    patternClaimHooks._reset();
    const received: PatternClaimEvent[] = [];

    patternClaimHooks.on((event) => { received.push(event); });

    patternClaimHooks.emit({
      type: "candidate_available",
      claimId: "c1",
      userId: "u1",
      patternType: "trigger_condition",
    });

    // Listeners are async (Promise.resolve), flush microtasks
    await Promise.resolve();

    expect(received).toHaveLength(1);
    expect(received[0]!.type).toBe("candidate_available");
    expect(received[0]!.claimId).toBe("c1");
  });

  it("unsubscribe stops receiving events", async () => {
    patternClaimHooks._reset();
    const received: PatternClaimEvent[] = [];
    const unsub = patternClaimHooks.on((e) => { received.push(e); });

    patternClaimHooks.emit({
      type: "candidate_available",
      claimId: "c1",
      userId: "u1",
      patternType: "inner_critic",
    });
    await Promise.resolve();
    expect(received).toHaveLength(1);

    unsub();

    patternClaimHooks.emit({
      type: "claim_active",
      claimId: "c2",
      userId: "u1",
      patternType: "inner_critic",
    });
    await Promise.resolve();
    // Should not receive the second event
    expect(received).toHaveLength(1);
  });

  it("multiple listeners all receive the same event", async () => {
    patternClaimHooks._reset();
    const log1: string[] = [];
    const log2: string[] = [];

    patternClaimHooks.on((e) => { log1.push(e.claimId); });
    patternClaimHooks.on((e) => { log2.push(e.claimId); });

    patternClaimHooks.emit({
      type: "claim_active",
      claimId: "cX",
      userId: "u1",
      patternType: "repetitive_loop",
    });
    await Promise.resolve();

    expect(log1).toEqual(["cX"]);
    expect(log2).toEqual(["cX"]);
  });

  it("listener error does not prevent other listeners from receiving event", async () => {
    patternClaimHooks._reset();
    const received: string[] = [];

    patternClaimHooks.on(() => {
      throw new Error("boom");
    });
    patternClaimHooks.on((e) => { received.push(e.claimId); });

    // Should not throw
    expect(() =>
      patternClaimHooks.emit({
        type: "candidate_available",
        claimId: "cY",
        userId: "u1",
        patternType: "recovery_stabilizer",
      })
    ).not.toThrow();

    await Promise.resolve();
    expect(received).toEqual(["cY"]);
  });

  it("emit is non-blocking — does not await listeners", () => {
    patternClaimHooks._reset();
    let called = false;

    patternClaimHooks.on(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      called = true;
    });

    patternClaimHooks.emit({
      type: "candidate_available",
      claimId: "c1",
      userId: "u1",
      patternType: "contradiction_drift",
    });

    // Synchronously after emit: listener has not completed yet
    expect(called).toBe(false);
  });

  it("_reset clears all listeners", async () => {
    patternClaimHooks._reset();
    const received: PatternClaimEvent[] = [];
    patternClaimHooks.on((e) => { received.push(e); });

    patternClaimHooks._reset();

    patternClaimHooks.emit({
      type: "claim_active",
      claimId: "c1",
      userId: "u1",
      patternType: "inner_critic",
    });
    await Promise.resolve();
    expect(received).toHaveLength(0);
  });
});
