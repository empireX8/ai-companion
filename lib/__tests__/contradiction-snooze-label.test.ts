import { describe, expect, it } from "vitest";

import { getSnoozedLabel } from "../contradiction-snooze-label";

describe("getSnoozedLabel", () => {
  const now = new Date("2026-02-24T12:00:00Z");

  it("returns null for null input", () => {
    expect(getSnoozedLabel(null, now)).toBeNull();
  });

  it("returns null for an invalid date string", () => {
    expect(getSnoozedLabel("not-a-date", now)).toBeNull();
    expect(getSnoozedLabel("", now)).toBeNull();
  });

  it("returns null for a past date (expired snooze — on-read expiry handles it)", () => {
    expect(getSnoozedLabel("2026-02-20T00:00:00Z", now)).toBeNull();
    expect(getSnoozedLabel("2026-02-24T11:59:59Z", now)).toBeNull(); // 1 second before now
  });

  it("returns null for a date equal to now", () => {
    expect(getSnoozedLabel(now.toISOString(), now)).toBeNull();
  });

  it("returns 'snoozed (indefinite)' for the sentinel year 2099", () => {
    expect(getSnoozedLabel("2099-12-31T23:59:59.000Z", now)).toBe("snoozed (indefinite)");
  });

  it("returns 'snoozed (indefinite)' for any year >= 2099", () => {
    expect(getSnoozedLabel("2150-01-01T00:00:00Z", now)).toBe("snoozed (indefinite)");
    expect(getSnoozedLabel("2999-12-31T23:59:59Z", now)).toBe("snoozed (indefinite)");
  });

  it("returns a day-count label for a future date below the indefinite threshold", () => {
    const threeDaysLater = new Date("2026-02-27T12:00:00Z"); // exactly 3 days after now
    const result = getSnoozedLabel(threeDaysLater.toISOString(), now);
    expect(result).toBe("snoozed ~3d (until 2026-02-27)");
  });

  it("rounds up partial days", () => {
    // 1 millisecond after now → rounds up to 1 day
    const almostNow = new Date(now.getTime() + 1);
    const result = getSnoozedLabel(almostNow.toISOString(), now);
    expect(result).toBe("snoozed ~1d (until 2026-02-24)");
  });

  it("includes the ISO date slice in the label", () => {
    const result = getSnoozedLabel("2026-03-07T23:59:59.000Z", now);
    expect(result).toContain("until 2026-03-07");
  });
});
