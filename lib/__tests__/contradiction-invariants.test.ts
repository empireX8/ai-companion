import { describe, expect, it } from "vitest";

import {
  applyContradictionAction,
  ContradictionTransitionError,
} from "../contradiction-transitions";

// ── Error shape ───────────────────────────────────────────────────────────────

describe("ContradictionTransitionError shape", () => {
  it("has a code property on every thrown error", () => {
    const cases: Array<[Parameters<typeof applyContradictionAction>]> = [
      [["open", "reopen"]],
      [["resolved", "snooze"]],
      [["archived_tension", "resolve"]],
      [["open", "unsnooze"]],
      [["snoozed", "reopen"]],
    ];

    for (const [[status, action]] of cases) {
      try {
        applyContradictionAction(status, action);
        expect.fail(`expected throw for ${status} + ${action}`);
      } catch (err) {
        expect(err).toBeInstanceOf(ContradictionTransitionError);
        expect(typeof (err as ContradictionTransitionError).code).toBe("string");
        expect((err as ContradictionTransitionError).code.length).toBeGreaterThan(0);
      }
    }
  });
});

// ── Illegal reopen (undo invariant) ───────────────────────────────────────────

describe("reopen invariant — undo safety", () => {
  it("rejects reopen from open status (item already re-opened by another action)", () => {
    expect(() => applyContradictionAction("open", "reopen")).toThrow(
      ContradictionTransitionError
    );
  });

  it("rejects reopen from snoozed status", () => {
    expect(() => applyContradictionAction("snoozed", "reopen")).toThrow(
      ContradictionTransitionError
    );
  });

  it("rejects reopen from explored status", () => {
    expect(() => applyContradictionAction("explored", "reopen")).toThrow(
      ContradictionTransitionError
    );
  });

  it("allows reopen from every terminal status", () => {
    const terminals = ["resolved", "accepted_tradeoff", "archived_tension"] as const;
    for (const status of terminals) {
      expect(() => applyContradictionAction(status, "reopen")).not.toThrow();
    }
  });

  it("reopen from terminal produces open status", () => {
    expect(applyContradictionAction("resolved", "reopen").nextStatus).toBe("open");
    expect(applyContradictionAction("accepted_tradeoff", "reopen").nextStatus).toBe("open");
    expect(applyContradictionAction("archived_tension", "reopen").nextStatus).toBe("open");
  });

  it("thrown reopen error has code REOPEN_REQUIRES_TERMINAL_STATUS", () => {
    try {
      applyContradictionAction("open", "reopen");
      expect.fail("expected throw");
    } catch (err) {
      expect((err as ContradictionTransitionError).code).toBe(
        "REOPEN_REQUIRES_TERMINAL_STATUS"
      );
    }
  });
});

// ── Terminal status lock-out ───────────────────────────────────────────────────

describe("terminal status lock-out invariant", () => {
  const TERMINAL = ["resolved", "accepted_tradeoff", "archived_tension"] as const;
  const BLOCKED_ACTIONS = ["snooze", "explore", "resolve", "accept_tradeoff", "archive_tension"] as const;

  for (const status of TERMINAL) {
    for (const action of BLOCKED_ACTIONS) {
      it(`blocks ${action} from ${status}`, () => {
        expect(() => applyContradictionAction(status, action)).toThrow(
          ContradictionTransitionError
        );
      });
    }
  }

  it("thrown error has code TERMINAL_STATUS_REQUIRES_REOPEN", () => {
    try {
      applyContradictionAction("resolved", "snooze");
      expect.fail("expected throw");
    } catch (err) {
      expect((err as ContradictionTransitionError).code).toBe(
        "TERMINAL_STATUS_REQUIRES_REOPEN"
      );
    }
  });
});

// ── Unsnooze invariant ────────────────────────────────────────────────────────

describe("unsnooze invariant", () => {
  it("only succeeds from snoozed status", () => {
    expect(() => applyContradictionAction("snoozed", "unsnooze")).not.toThrow();
  });

  it("rejects unsnooze from open", () => {
    expect(() => applyContradictionAction("open", "unsnooze")).toThrow(
      ContradictionTransitionError
    );
  });

  it("rejects unsnooze from resolved (terminal)", () => {
    expect(() => applyContradictionAction("resolved", "unsnooze")).toThrow(
      ContradictionTransitionError
    );
  });

  it("thrown error has code UNSNOOZE_REQUIRES_SNOOZED_STATUS", () => {
    try {
      applyContradictionAction("open", "unsnooze");
      expect.fail("expected throw");
    } catch (err) {
      expect((err as ContradictionTransitionError).code).toBe(
        "UNSNOOZE_REQUIRES_SNOOZED_STATUS"
      );
    }
  });
});
