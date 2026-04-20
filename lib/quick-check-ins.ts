import { z } from "zod";

export const QUICK_CHECK_IN_STATE_TAGS = [
  "overloaded",
  "stressed",
  "flat",
  "stable",
  "energized",
] as const;

export type QuickCheckInStateTag = (typeof QUICK_CHECK_IN_STATE_TAGS)[number];

export const QUICK_CHECK_IN_EVENT_TAGS = [
  "sleep_disrupted",
  "conflict",
  "pressure",
  "isolated",
  "social",
  "productive",
  "recovery",
  "paid",
] as const;

export type QuickCheckInEventTag = (typeof QUICK_CHECK_IN_EVENT_TAGS)[number];

export const QUICK_CHECK_IN_NOTE_MAX_LENGTH = 160;
export const QUICK_CHECK_IN_LIST_LIMIT = 20;

export const QUICK_CHECK_IN_STATE_LABELS: Record<QuickCheckInStateTag, string> = {
  overloaded: "Overloaded",
  stressed: "Stressed",
  flat: "Flat",
  stable: "Stable",
  energized: "Energized",
};

export const QUICK_CHECK_IN_EVENT_LABELS: Record<QuickCheckInEventTag, string> = {
  sleep_disrupted: "Sleep disrupted",
  conflict: "Conflict",
  pressure: "Pressure",
  isolated: "Isolated",
  social: "Social",
  productive: "Productive",
  recovery: "Recovery",
  paid: "Paid",
};

const QUICK_CHECK_IN_STATE_TAG_SET = new Set<string>(QUICK_CHECK_IN_STATE_TAGS);
const QUICK_CHECK_IN_EVENT_TAG_SET = new Set<string>(QUICK_CHECK_IN_EVENT_TAGS);

export type QuickCheckInView = {
  id: string;
  stateTag: QuickCheckInStateTag | null;
  eventTags: QuickCheckInEventTag[];
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type QuickCheckInRecord = {
  id: string;
  stateTag: string | null;
  eventTags: string[];
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function isQuickCheckInStateTag(value: unknown): value is QuickCheckInStateTag {
  return typeof value === "string" && QUICK_CHECK_IN_STATE_TAG_SET.has(value);
}

export function normalizeQuickCheckInEventTags(tags: readonly string[]): QuickCheckInEventTag[] {
  const selected = new Set<QuickCheckInEventTag>();

  for (const tag of tags) {
    if (QUICK_CHECK_IN_EVENT_TAG_SET.has(tag)) {
      selected.add(tag as QuickCheckInEventTag);
    }
  }

  return QUICK_CHECK_IN_EVENT_TAGS.filter((tag) => selected.has(tag));
}

export function toQuickCheckInView(checkIn: QuickCheckInRecord): QuickCheckInView {
  return {
    id: checkIn.id,
    stateTag: isQuickCheckInStateTag(checkIn.stateTag) ? checkIn.stateTag : null,
    eventTags: normalizeQuickCheckInEventTags(checkIn.eventTags),
    note: checkIn.note?.trim() ? checkIn.note.trim() : null,
    createdAt: checkIn.createdAt.toISOString(),
    updatedAt: checkIn.updatedAt.toISOString(),
  };
}

export function formatQuickCheckInTimestamp(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

const quickCheckInStateTagSchema = z
  .union([z.enum(QUICK_CHECK_IN_STATE_TAGS), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));

const quickCheckInEventTagsSchema = z
  .union([z.array(z.enum(QUICK_CHECK_IN_EVENT_TAGS)), z.null(), z.undefined()])
  .transform((value) => normalizeQuickCheckInEventTags(value ?? []));

const quickCheckInNoteSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .refine((value) => value.length <= QUICK_CHECK_IN_NOTE_MAX_LENGTH, {
    message: `Note must be ${QUICK_CHECK_IN_NOTE_MAX_LENGTH} characters or fewer.`,
  })
  .transform((value) => (value.length > 0 ? value : null));

export const createQuickCheckInSchema = z
  .object({
    stateTag: quickCheckInStateTagSchema,
    eventTags: quickCheckInEventTagsSchema,
    note: quickCheckInNoteSchema,
  })
  .superRefine((value, ctx) => {
    if (value.stateTag || value.eventTags.length > 0 || value.note) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["stateTag"],
      message: "Add a state, event tag, or note.",
    });
  });

export type CreateQuickCheckInInput = z.infer<typeof createQuickCheckInSchema>;
