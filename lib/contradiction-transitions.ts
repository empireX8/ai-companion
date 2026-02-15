import type { ContradictionStatus } from "@prisma/client";

export type ContradictionAction =
  | "avoid"
  | "surface_ack"
  | "snooze"
  | "explore"
  | "resolve"
  | "accept_tradeoff"
  | "archive_tension"
  | "reopen";

export class ContradictionTransitionError extends Error {
  status: number;
  code: string;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const TERMINAL_STATUSES: ContradictionStatus[] = [
  "resolved",
  "accepted_tradeoff",
  "archived_tension",
];

const isTerminalStatus = (status: ContradictionStatus) => TERMINAL_STATUSES.includes(status);

export function applyContradictionAction(
  currentStatus: ContradictionStatus,
  action: ContradictionAction
): { nextStatus: ContradictionStatus; touches: { snooze?: boolean; avoid?: boolean } } {
  if (action === "avoid") {
    return { nextStatus: currentStatus, touches: { avoid: true } };
  }

  if (action === "surface_ack") {
    return { nextStatus: currentStatus, touches: {} };
  }

  if (action === "reopen") {
    if (!isTerminalStatus(currentStatus)) {
      throw new ContradictionTransitionError(
        "REOPEN_REQUIRES_TERMINAL_STATUS",
        "REOPEN_REQUIRES_TERMINAL_STATUS"
      );
    }

    return { nextStatus: "open", touches: {} };
  }

  if (isTerminalStatus(currentStatus)) {
    throw new ContradictionTransitionError(
      "TERMINAL_STATUS_REQUIRES_REOPEN",
      "TERMINAL_STATUS_REQUIRES_REOPEN"
    );
  }

  switch (action) {
    case "snooze":
      return { nextStatus: "snoozed", touches: { snooze: true } };
    case "explore":
      return { nextStatus: "explored", touches: {} };
    case "resolve":
      return { nextStatus: "resolved", touches: {} };
    case "accept_tradeoff":
      return { nextStatus: "accepted_tradeoff", touches: {} };
    case "archive_tension":
      return { nextStatus: "archived_tension", touches: {} };
    default:
      throw new ContradictionTransitionError("INVALID_ACTION", "INVALID_ACTION");
  }
}
