import {
  FieldworkStatus,
  UnderstandingLinkTargetType,
} from "@prisma/client";

import type { SurfacedActionView } from "./actions-api";

type ActionForFieldworkBridge = Pick<
  SurfacedActionView,
  "id" | "title" | "whySuggested"
>;

export type FieldworkDraftFromAction = {
  prompt: string;
  reason: string;
  status: "assigned";
  linkedObjectType: "surfaced_action";
  linkedObjectId: string;
};

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function canBuildFieldworkFromAction(
  action: ActionForFieldworkBridge | null | undefined
): action is ActionForFieldworkBridge {
  if (!action || typeof action !== "object") {
    return false;
  }

  return Boolean(
    toNonEmptyString(action.id) &&
      toNonEmptyString(action.title) &&
      toNonEmptyString(action.whySuggested)
  );
}

export function buildFieldworkDraftFromAction(
  action: ActionForFieldworkBridge | null | undefined
): FieldworkDraftFromAction | null {
  if (!canBuildFieldworkFromAction(action)) {
    return null;
  }

  const linkedObjectId = toNonEmptyString(action.id)!;
  const prompt = toNonEmptyString(action.title)!;
  const reason = toNonEmptyString(action.whySuggested)!;

  return {
    prompt,
    reason,
    status: FieldworkStatus.assigned,
    linkedObjectType: UnderstandingLinkTargetType.surfaced_action,
    linkedObjectId,
  };
}
