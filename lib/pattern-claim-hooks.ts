/**
 * Pattern Claim Event Hooks (P3-10)
 *
 * Non-interruptive pub/sub bus for pattern claim availability events.
 *
 * Downstream surfaces (UI refresh, notification layer, analytics) can register
 * listeners that fire when a new candidate is created or a claim goes active.
 *
 * Rules:
 *  - Listeners are fire-and-forget: errors are logged and swallowed.
 *  - Hooks never delay or interrupt the detection pipeline.
 *  - Listeners are called after the atomic detection operation completes —
 *    never inside a DB transaction.
 *  - The bus does NOT interrupt chat. It is for observation only.
 */

import type { PatternTypeValue } from "./pattern-claim-boundary";

// ── Event types ───────────────────────────────────────────────────────────────

export type PatternClaimEventType = "candidate_available" | "claim_active";

export type PatternClaimEvent = {
  type: PatternClaimEventType;
  claimId: string;
  userId: string;
  patternType: PatternTypeValue;
};

export type PatternClaimListener = (
  event: PatternClaimEvent
) => void | Promise<void>;

// ── Event bus ─────────────────────────────────────────────────────────────────

class PatternClaimEventBus {
  private listeners: PatternClaimListener[] = [];

  /**
   * Register a listener. Returns an unsubscribe function.
   */
  on(listener: PatternClaimListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Emit an event to all registered listeners.
   * Non-blocking: each listener is scheduled as a microtask and errors are
   * logged but never re-thrown.
   */
  emit(event: PatternClaimEvent): void {
    for (const listener of this.listeners) {
      try {
        void Promise.resolve(listener(event)).catch((err) => {
          console.error("[PatternClaimHooks] listener error:", err);
        });
      } catch (err) {
        console.error("[PatternClaimHooks] listener error:", err);
      }
    }
  }

  /** For testing: reset all registered listeners. */
  _reset(): void {
    this.listeners = [];
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const patternClaimHooks = new PatternClaimEventBus();
