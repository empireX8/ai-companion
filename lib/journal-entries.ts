import { z } from "zod";

export const JOURNAL_ENTRY_TITLE_MAX_LENGTH = 160;
export const JOURNAL_ENTRY_BODY_MAX_LENGTH = 20_000;
export const JOURNAL_ENTRY_LIST_DEFAULT_LIMIT = 30;
export const JOURNAL_ENTRY_LIST_MAX_LIMIT = 100;

const journalEntryTitleSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .refine((value) => value.length <= JOURNAL_ENTRY_TITLE_MAX_LENGTH, {
    message: `Title must be ${JOURNAL_ENTRY_TITLE_MAX_LENGTH} characters or fewer.`,
  })
  .transform((value) => (value.length > 0 ? value : null));

const journalEntryBodySchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, {
    message: "Body is required.",
  })
  .refine((value) => value.length <= JOURNAL_ENTRY_BODY_MAX_LENGTH, {
    message: `Body must be ${JOURNAL_ENTRY_BODY_MAX_LENGTH} characters or fewer.`,
  });

const journalEntryAuthoredAtSchema = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      if (!Number.isNaN(value.getTime())) {
        return value;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid authoredAt value.",
      });
      return z.NEVER;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid authoredAt value.",
      });
      return z.NEVER;
    }

    return parsed;
  });

export const createJournalEntrySchema = z.object({
  title: journalEntryTitleSchema,
  body: journalEntryBodySchema,
  authoredAt: journalEntryAuthoredAtSchema,
});

export const updateJournalEntrySchema = createJournalEntrySchema;

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;

type JournalEntryRecord = {
  id: string;
  title: string | null;
  body: string;
  authoredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type JournalEntryView = {
  id: string;
  title: string | null;
  body: string;
  authoredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toJournalEntryView(entry: JournalEntryRecord): JournalEntryView {
  return {
    id: entry.id,
    title: entry.title,
    body: entry.body,
    authoredAt: entry.authoredAt ? entry.authoredAt.toISOString() : null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function parseJournalEntryListLimit(
  value: string | null
): { ok: true; value: number } | { ok: false } {
  if (value === null) {
    return { ok: true, value: JOURNAL_ENTRY_LIST_DEFAULT_LIMIT };
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > JOURNAL_ENTRY_LIST_MAX_LIMIT) {
    return { ok: false };
  }

  return { ok: true, value: parsed };
}
