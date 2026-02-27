import { describe, expect, it, vi } from "vitest";

import {
  logMetricEvent,
  logMetricEventSafe,
  sanitizeMetaForStorage,
} from "../metrics";

// ── Mock DB factory ────────────────────────────────────────────────────────────

function makeDb() {
  const create = vi.fn().mockResolvedValue({});
  return { internalMetricEvent: { create }, _create: create };
}

// ── sanitizeMetaForStorage ─────────────────────────────────────────────────────

describe("sanitizeMetaForStorage", () => {
  it("returns null for null input", () => {
    expect(sanitizeMetaForStorage(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(sanitizeMetaForStorage(undefined)).toBeNull();
  });

  it("returns null for array input (not an object)", () => {
    // Type cast needed to test the runtime guard
    expect(sanitizeMetaForStorage(["a", "b"] as unknown as Record<string, unknown>)).toBeNull();
  });

  it("passes through short strings unchanged", () => {
    expect(sanitizeMetaForStorage({ label: "hello" })).toEqual({ label: "hello" });
  });

  it("truncates strings longer than 200 chars to 200", () => {
    const long = "x".repeat(250);
    const result = sanitizeMetaForStorage({ text: long });
    expect(result?.text).toHaveLength(200);
  });

  it("preserves strings of exactly 200 chars", () => {
    const exact = "y".repeat(200);
    const result = sanitizeMetaForStorage({ text: exact });
    expect(result?.text).toHaveLength(200);
  });

  it("caps arrays at 50 items", () => {
    const big = Array.from({ length: 100 }, (_, i) => i);
    const result = sanitizeMetaForStorage({ items: big });
    expect((result?.items as unknown[]).length).toBe(50);
  });

  it("preserves arrays of exactly 50 items", () => {
    const arr = Array.from({ length: 50 }, (_, i) => i);
    const result = sanitizeMetaForStorage({ items: arr });
    expect((result?.items as unknown[]).length).toBe(50);
  });

  it("preserves numbers and booleans", () => {
    const result = sanitizeMetaForStorage({ count: 5, flag: true });
    expect(result?.count).toBe(5);
    expect(result?.flag).toBe(true);
  });

  it("preserves null values", () => {
    const result = sanitizeMetaForStorage({ nothing: null });
    expect(result?.nothing).toBeNull();
  });

  it("returns null when total JSON size exceeds 8 KB even after field truncation", () => {
    const bigMeta: Record<string, unknown> = {};
    for (let i = 0; i < 40; i++) {
      bigMeta[`field_${String(i).padStart(4, "0")}`] = "v".repeat(200);
    }
    expect(sanitizeMetaForStorage(bigMeta)).toBeNull();
  });
});

// ── logMetricEvent — valid input ───────────────────────────────────────────────

describe("logMetricEvent — valid input", () => {
  it("calls db.internalMetricEvent.create with expected data", async () => {
    const { internalMetricEvent, _create } = makeDb();
    const db = { internalMetricEvent };

    await logMetricEvent(db, {
      userId: "u1",
      name: "audit.snapshot.created",
      source: "server",
    });

    expect(_create).toHaveBeenCalledOnce();
    const { data } = _create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.userId).toBe("u1");
    expect(data.name).toBe("audit.snapshot.created");
    expect(data.source).toBe("server");
    expect(data.level).toBe("info");
    expect(data.meta).toBeNull();
    expect(data.value).toBeNull();
    expect(data.sessionId).toBeNull();
    expect(data.route).toBeNull();
  });

  it("passes level, value, route, and sessionId through", async () => {
    const { internalMetricEvent, _create } = makeDb();
    const db = { internalMetricEvent };

    await logMetricEvent(db, {
      userId: "u2",
      name: "test.event",
      level: "warn",
      value: 42,
      meta: { auditId: "abc" },
      source: "client",
      route: "/audit",
      sessionId: "s1",
    });

    const { data } = _create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.level).toBe("warn");
    expect(data.value).toBe(42);
    expect(data.route).toBe("/audit");
    expect(data.sessionId).toBe("s1");
    expect((data.meta as Record<string, unknown>).auditId).toBe("abc");
  });

  it("applies meta sanitization — truncates long strings", async () => {
    const { internalMetricEvent, _create } = makeDb();
    const db = { internalMetricEvent };
    const longStr = "z".repeat(300);

    await logMetricEvent(db, {
      userId: "u3",
      name: "test",
      meta: { text: longStr },
      source: "server",
    });

    const { data } = _create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect((data.meta as Record<string, unknown>).text as string).toHaveLength(200);
  });

  it("applies meta sanitization — caps large arrays", async () => {
    const { internalMetricEvent, _create } = makeDb();
    const db = { internalMetricEvent };
    const big = Array.from({ length: 80 }, (_, i) => i);

    await logMetricEvent(db, {
      userId: "u4",
      name: "test",
      meta: { ids: big },
      source: "server",
    });

    const { data } = _create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(((data.meta as Record<string, unknown>).ids as unknown[]).length).toBe(50);
  });

  it("accepts error level", async () => {
    const { internalMetricEvent, _create } = makeDb();
    const db = { internalMetricEvent };

    await logMetricEvent(db, { userId: "u5", name: "thing.failed", level: "error", source: "server" });

    const { data } = _create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.level).toBe("error");
  });

  it("accepts debug level", async () => {
    const { internalMetricEvent, _create } = makeDb();
    const db = { internalMetricEvent };

    await logMetricEvent(db, { userId: "u6", name: "thing.verbose", level: "debug", source: "server" });

    const { data } = _create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.level).toBe("debug");
  });

  it("drops meta entirely when JSON size exceeds 8 KB", async () => {
    const { internalMetricEvent, _create } = makeDb();
    const db = { internalMetricEvent };

    // Build a meta object whose JSON representation exceeds 8192 bytes after field truncation.
    // Each key is ~10 chars, value is 200 chars (truncation limit), so ~210 bytes each.
    // 40 such fields ≈ 8400 bytes.
    const bigMeta: Record<string, unknown> = {};
    for (let i = 0; i < 40; i++) {
      bigMeta[`field_${String(i).padStart(4, "0")}`] = "v".repeat(200);
    }

    await logMetricEvent(db, { userId: "u7", name: "test.big", meta: bigMeta, source: "server" });

    const { data } = _create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(data.meta).toBeNull();
  });
});

// ── logMetricEventSafe ─────────────────────────────────────────────────────────

describe("logMetricEventSafe", () => {
  it("resolves normally when db succeeds", async () => {
    const { internalMetricEvent, _create } = makeDb();
    const db = { internalMetricEvent };

    await expect(
      logMetricEventSafe(db, { userId: "u1", name: "test", source: "server" })
    ).resolves.toBeUndefined();

    expect(_create).toHaveBeenCalledOnce();
  });

  it("swallows db errors without throwing", async () => {
    const create = vi.fn().mockRejectedValue(new Error("DB connection lost"));
    const db = { internalMetricEvent: { create } };

    await expect(
      logMetricEventSafe(db, { userId: "u1", name: "test", source: "server" })
    ).resolves.toBeUndefined();
  });
});
