import { describe, expect, it, vi } from "vitest";

import { createUndoManager, type UndoAction } from "../undo-manager";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeAction(
  id: string,
  name: string,
  expiresAt: number
): UndoAction {
  return { id, name, expiresAt, revert: vi.fn().mockResolvedValue(undefined) };
}

// ── addUndoAction — basic registration ────────────────────────────────────────

describe("addUndoAction — registration", () => {
  it("registers a single action", () => {
    const m = createUndoManager(() => 1000);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 11_000));
    expect(m.getActiveUndoActions()).toHaveLength(1);
  });

  it("newest action is first (LIFO order)", () => {
    const m = createUndoManager(() => 1000);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 11_000));
    m.addUndoAction(makeAction("c2", "contradiction.snooze", 12_000));
    const actions = m.getActiveUndoActions();
    expect(actions[0].id).toBe("c2");
    expect(actions[1].id).toBe("c1");
  });

  it("stores the correct expiresAt and name", () => {
    const m = createUndoManager(() => 1000);
    m.addUndoAction(makeAction("c1", "contradiction.snooze", 11_000));
    const [action] = m.getActiveUndoActions();
    expect(action.name).toBe("contradiction.snooze");
    expect(action.expiresAt).toBe(11_000);
  });
});

// ── addUndoAction — deduplication ────────────────────────────────────────────

describe("addUndoAction — deduplication", () => {
  it("replaces existing action with same id + name", () => {
    const m = createUndoManager(() => 1000);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 11_000));
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 12_000));
    const actions = m.getActiveUndoActions();
    expect(actions).toHaveLength(1);
    // New expiry wins
    expect(actions[0].expiresAt).toBe(12_000);
  });

  it("allows same id with different name", () => {
    const m = createUndoManager(() => 1000);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 11_000));
    m.addUndoAction(makeAction("c1", "contradiction.snooze", 12_000));
    expect(m.getActiveUndoActions()).toHaveLength(2);
  });

  it("allows same name with different id", () => {
    const m = createUndoManager(() => 1000);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 11_000));
    m.addUndoAction(makeAction("c2", "contradiction.resolve", 12_000));
    expect(m.getActiveUndoActions()).toHaveLength(2);
  });
});

// ── addUndoAction — max 5 enforcement ────────────────────────────────────────

describe("addUndoAction — max 5 limit", () => {
  it("caps at 5 active actions", () => {
    const m = createUndoManager(() => 1000);
    for (let i = 1; i <= 6; i++) {
      m.addUndoAction(makeAction(`c${i}`, "contradiction.resolve", 11_000 + i));
    }
    expect(m.getActiveUndoActions()).toHaveLength(5);
  });

  it("drops the oldest action when cap exceeded", () => {
    const m = createUndoManager(() => 1000);
    for (let i = 1; i <= 6; i++) {
      m.addUndoAction(makeAction(`c${i}`, "contradiction.resolve", 11_000 + i));
    }
    const ids = m.getActiveUndoActions().map((a) => a.id);
    // c1 was added first → becomes the 6th slot → dropped; c2–c6 remain
    expect(ids).not.toContain("c1");
    expect(ids).toContain("c6");
  });
});

// ── cancelUndo ────────────────────────────────────────────────────────────────

describe("cancelUndo", () => {
  it("removes the action with the given id", () => {
    const m = createUndoManager(() => 1000);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 11_000));
    m.cancelUndo("c1");
    expect(m.getActiveUndoActions()).toHaveLength(0);
  });

  it("does not affect other actions", () => {
    const m = createUndoManager(() => 1000);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 11_000));
    m.addUndoAction(makeAction("c2", "contradiction.snooze", 12_000));
    m.cancelUndo("c1");
    const actions = m.getActiveUndoActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe("c2");
  });

  it("is a no-op for unknown id", () => {
    const m = createUndoManager(() => 1000);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 11_000));
    m.cancelUndo("nonexistent");
    expect(m.getActiveUndoActions()).toHaveLength(1);
  });
});

// ── getActiveUndoActions — expiry ─────────────────────────────────────────────

describe("getActiveUndoActions — expiry", () => {
  it("removes expired actions on get", () => {
    const now = { value: 1_000 };
    const m = createUndoManager(() => now.value);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 5_000));
    now.value = 6_000; // advance past expiry
    expect(m.getActiveUndoActions()).toHaveLength(0);
  });

  it("keeps non-expired actions", () => {
    const now = { value: 1_000 };
    const m = createUndoManager(() => now.value);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 10_000));
    now.value = 5_000; // still before expiry
    expect(m.getActiveUndoActions()).toHaveLength(1);
  });

  it("only removes expired; keeps valid in mixed batch", () => {
    const now = { value: 1_000 };
    const m = createUndoManager(() => now.value);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 3_000)); // expires at 3s
    m.addUndoAction(makeAction("c2", "contradiction.snooze", 15_000)); // expires at 15s
    now.value = 5_000;
    const active = m.getActiveUndoActions();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe("c2");
  });

  it("removes expired actions during addUndoAction", () => {
    const now = { value: 1_000 };
    const m = createUndoManager(() => now.value);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 2_000));
    now.value = 5_000; // c1 is expired
    m.addUndoAction(makeAction("c2", "contradiction.snooze", 15_000));
    // c1 should have been removed when c2 was added
    const active = m.getActiveUndoActions();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe("c2");
  });
});

// ── subscribe ─────────────────────────────────────────────────────────────────

describe("subscribe", () => {
  it("calls listener when an action is added", () => {
    const m = createUndoManager(() => 1000);
    const listener = vi.fn();
    m.subscribe(listener);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 11_000));
    expect(listener).toHaveBeenCalled();
  });

  it("calls listener when an action is cancelled", () => {
    const m = createUndoManager(() => 1000);
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 11_000));
    const listener = vi.fn();
    m.subscribe(listener);
    m.cancelUndo("c1");
    expect(listener).toHaveBeenCalled();
  });

  it("stops calling listener after unsubscribe", () => {
    const m = createUndoManager(() => 1000);
    const listener = vi.fn();
    const unsub = m.subscribe(listener);
    unsub();
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 11_000));
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not call other listeners when one unsubscribes", () => {
    const m = createUndoManager(() => 1000);
    const l1 = vi.fn();
    const l2 = vi.fn();
    const unsub1 = m.subscribe(l1);
    m.subscribe(l2);
    unsub1();
    m.addUndoAction(makeAction("c1", "contradiction.resolve", 11_000));
    expect(l1).not.toHaveBeenCalled();
    expect(l2).toHaveBeenCalled();
  });
});
