export type JournalEntryView = {
  id: string;
  title: string | null;
  body: string;
  authoredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const JOURNAL_TITLE_MAX_LENGTH = 160;
export const JOURNAL_BODY_MAX_LENGTH = 20_000;

export function toJournalPreview(body: string, maxLength = 180): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function toJournalDisplayDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
