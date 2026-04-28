import { describe, expect, it } from "vitest";

import {
  JOURNAL_BODY_MAX_LENGTH,
  JOURNAL_TITLE_MAX_LENGTH,
  toJournalDisplayDate,
  toJournalPreview,
} from "../journal-ui";

describe("journal-ui helpers", () => {
  it("exports UI max lengths aligned with API validation", () => {
    expect(JOURNAL_TITLE_MAX_LENGTH).toBe(160);
    expect(JOURNAL_BODY_MAX_LENGTH).toBe(20_000);
  });

  it("normalizes whitespace and truncates preview", () => {
    const body = "  one\n\n two\t\tthree   ";
    expect(toJournalPreview(body, 12)).toBe("one two thr…");
  });

  it("returns formatted date for valid timestamps", () => {
    const text = toJournalDisplayDate("2026-04-28T10:30:00.000Z");
    expect(text).not.toBe("Unknown date");
    expect(text.length).toBeGreaterThan(0);
  });

  it("returns Unknown date for invalid values", () => {
    expect(toJournalDisplayDate("not-a-date")).toBe("Unknown date");
  });
});
