import type { FieldworkStatus } from "@prisma/client";

/** Fieldwork statuses eligible for Watch For public surfaces and internal publish. */
export const WATCH_FOR_VISIBLE_FIELDWORK_STATUSES: FieldworkStatus[] = [
  "assigned",
  "active",
];

export function isFieldworkStatusPublishable(status: FieldworkStatus): boolean {
  return WATCH_FOR_VISIBLE_FIELDWORK_STATUSES.includes(status);
}
