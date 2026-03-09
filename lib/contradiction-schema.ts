import { z } from "zod";

import {
  CONTRADICTION_CONFIDENCE,
  CONTRADICTION_STATUS,
  CONTRADICTION_TYPES,
  PROBE_RUNGS,
} from "./contradiction-enums";

const isoDateString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid ISO date string",
});

const optionalTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, { message: "Cannot be empty" })
  .optional();

export const contradictionEvidenceSchema = z.object({
  sessionId: optionalTrimmedString,
  messageId: optionalTrimmedString,
  quote: z.string().trim().optional(),
});

export const createContradictionSchema = z.object({
  title: z.string().trim().min(1),
  sideA: z.string().trim().min(1),
  sideB: z.string().trim().min(1),
  type: z.enum(CONTRADICTION_TYPES),
  confidence: z.enum(CONTRADICTION_CONFIDENCE).default("low"),
  sourceSessionId: optionalTrimmedString,
  sourceMessageId: optionalTrimmedString,
  evidence: z.array(contradictionEvidenceSchema).optional(),
  rung: z.enum(PROBE_RUNGS).optional(),
  snoozedUntil: isoDateString.optional(),
});

export const patchContradictionSchema = z.object({
  action: z
    .enum([
      "avoid",
      "surface_ack",
      "snooze",
      "unsnooze",
      "explore",
      "resolve",
      "accept_tradeoff",
      "archive_tension",
      "reopen",
      "confirm_candidate",
    ])
    .optional(),
  status: z.enum(CONTRADICTION_STATUS).optional(),
  rung: z.enum(PROBE_RUNGS).nullable().optional(),
  weightDelta: z.number().min(-10).max(10).optional(),
  snoozedUntil: isoDateString.nullable().optional(),
  touch: z.boolean().optional(),
  addEvidence: z.array(contradictionEvidenceSchema).optional(),
  title: z.string().trim().min(1).optional(),
  sideA: z.string().trim().min(1).optional(),
  sideB: z.string().trim().min(1).optional(),
  type: z.enum(CONTRADICTION_TYPES).optional(),
  confidence: z.enum(CONTRADICTION_CONFIDENCE).optional(),
});
