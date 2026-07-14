import type { ActionStatus } from "./actions-api";
import type { OrvekObject } from "./orvek-v0/orvek-types";

export const DURABLE_CORRECTION_CHIP_LABELS = [
  "Confirm",
  "This is wrong",
  "Missing context",
  "Only true in this situation",
  "Used to be true",
  "Do not use this assumption",
] as const;

export type DurableCorrectionChipLabel = (typeof DURABLE_CORRECTION_CHIP_LABELS)[number];

export type DurableWriteError = {
  ok: false;
  status: number;
  error: string;
};

export type UserMapCorrectionWriteResult = {
  ok: true;
  id: string;
  summary: string;
  lastUserCorrectionLabel: string;
  lastUserCorrectionAt: string;
  correctionCount: number;
};

export type DecisionOutcomeWriteResult = {
  ok: true;
  id: string;
  status: ActionStatus;
  note: string | null;
  updatedAt: string;
};

export type FieldworkCheckInWriteResult = {
  ok: true;
  id: string;
  observationNote: string;
  observationOutcome: string | null;
  status: string;
  completedAt: string | null;
  updatedAt: string;
};

export type CorrectionWriteTarget = {
  kind: "usermap_conclusion";
  conclusionId: string;
  originalSummary: string;
  correctionCount: number;
};

export function isDurableWriteError(
  result: { ok?: boolean; error?: string }
): result is DurableWriteError {
  return result.ok === false;
}

export function resolveCorrectionWriteTarget(
  object: OrvekObject
): CorrectionWriteTarget | null {
  if (object.inspectorObjectType === "usermap_conclusion" && object.inspectorObjectId) {
    return {
      kind: "usermap_conclusion",
      conclusionId: object.inspectorObjectId,
      originalSummary: object.summary ?? object.title,
      correctionCount: object.correctionCount ?? 0,
    };
  }

  if (object.type === "map-object" && object.inspectorObjectId) {
    return {
      kind: "usermap_conclusion",
      conclusionId: object.inspectorObjectId,
      originalSummary: object.summary ?? object.title,
      correctionCount: object.correctionCount ?? 0,
    };
  }

  if (object.type === "map-object") {
    const conclusionId = object.id.startsWith("conclusion-")
      ? object.id.slice("conclusion-".length)
      : object.id;
    return {
      kind: "usermap_conclusion",
      conclusionId,
      originalSummary: object.summary ?? object.title,
      correctionCount: object.correctionCount ?? 0,
    };
  }

  return null;
}

export async function applyUserMapCorrection(args: {
  conclusionId: string;
  label: DurableCorrectionChipLabel | string;
  originalSummary: string;
  correctionCount: number;
}): Promise<UserMapCorrectionWriteResult | DurableWriteError> {
  const trimmedLabel = args.label.trim();
  if (!trimmedLabel) {
    return { ok: false, status: 400, error: "Correction label is required" };
  }

  try {
    const response = await fetch(
      `/api/user-map/conclusions/${encodeURIComponent(args.conclusionId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastUserCorrectionLabel: trimmedLabel,
          lastUserCorrectionAt: new Date().toISOString(),
          correctionCount: args.correctionCount + 1,
        }),
      }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        status: response.status,
        error: payload.message ?? "Correction could not be saved",
      };
    }

    const payload = (await response.json()) as {
      item?: {
        id?: string;
        summary?: string;
        lastUserCorrectionLabel?: string | null;
        lastUserCorrectionAt?: string | null;
        correctionCount?: number;
      };
    };

    const item = payload.item;
    if (!item?.id || !item.lastUserCorrectionLabel || !item.lastUserCorrectionAt) {
      return { ok: false, status: 500, error: "Correction response was incomplete" };
    }

    return {
      ok: true,
      id: item.id,
      summary: item.summary ?? args.originalSummary,
      lastUserCorrectionLabel: item.lastUserCorrectionLabel,
      lastUserCorrectionAt: item.lastUserCorrectionAt,
      correctionCount: item.correctionCount ?? args.correctionCount + 1,
    };
  } catch {
    return { ok: false, status: 0, error: "Correction request failed" };
  }
}

export async function submitDecisionOutcome(args: {
  actionId: string;
  note: string;
  status?: Extract<ActionStatus, "helped" | "didnt_help">;
}): Promise<DecisionOutcomeWriteResult | DurableWriteError> {
  const trimmedNote = args.note.trim();
  if (!trimmedNote) {
    return { ok: false, status: 400, error: "Outcome note is required" };
  }

  const status = args.status ?? "helped";

  try {
    const response = await fetch(`/api/actions/${encodeURIComponent(args.actionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note: trimmedNote }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        status: response.status,
        error: payload.error ?? "Outcome could not be saved",
      };
    }

    const payload = (await response.json()) as {
      id?: string;
      status?: ActionStatus;
      note?: string | null;
      updatedAt?: string;
    };

    if (!payload.id || !payload.status || !payload.updatedAt) {
      return { ok: false, status: 500, error: "Outcome response was incomplete" };
    }

    return {
      ok: true,
      id: payload.id,
      status: payload.status,
      note: payload.note ?? trimmedNote,
      updatedAt: payload.updatedAt,
    };
  } catch {
    return { ok: false, status: 0, error: "Outcome request failed" };
  }
}

export async function submitFieldworkCheckIn(args: {
  fieldworkId: string;
  observationNote: string;
  observationOutcome?: string | null;
}): Promise<FieldworkCheckInWriteResult | DurableWriteError> {
  const trimmedNote = args.observationNote.trim();
  if (!trimmedNote) {
    return { ok: false, status: 400, error: "Check-in observation is required" };
  }

  try {
    const response = await fetch(`/api/fieldwork/${encodeURIComponent(args.fieldworkId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // Keep Watch For visibility (`assigned`/`active` only). Completing would
      // drop the parent from Explore Fieldwork Bridge on refresh.
      body: JSON.stringify({
        status: "active",
        observationNote: trimmedNote,
        observationOutcome: args.observationOutcome ?? null,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        status: response.status,
        error: payload.message ?? "Check-in could not be saved",
      };
    }

    const payload = (await response.json()) as {
      item?: {
        id?: string;
        observationNote?: string | null;
        observationOutcome?: string | null;
        status?: string;
        completedAt?: string | null;
        updatedAt?: string;
      };
    };

    const item = payload.item;
    if (!item?.id || !item.observationNote || !item.updatedAt) {
      return { ok: false, status: 500, error: "Check-in response was incomplete" };
    }

    return {
      ok: true,
      id: item.id,
      observationNote: item.observationNote,
      observationOutcome: item.observationOutcome ?? null,
      status: item.status ?? "active",
      completedAt: item.completedAt ?? null,
      updatedAt: item.updatedAt,
    };
  } catch {
    return { ok: false, status: 0, error: "Check-in request failed" };
  }
}
