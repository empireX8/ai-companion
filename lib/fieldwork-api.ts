import type { FieldworkStatus } from "@prisma/client";

export type FieldworkAssignmentPatch = {
  status?: FieldworkStatus;
  observationNote?: string | null;
  observationOutcome?: string | null;
  completedAt?: string | null;
};

export type FieldworkAssignmentView = {
  id: string;
  status: FieldworkStatus;
  observationNote: string | null;
  observationOutcome: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export async function updateFieldworkAssignment(
  id: string,
  patch: FieldworkAssignmentPatch
): Promise<FieldworkAssignmentView | null> {
  try {
    const response = await fetch(`/api/fieldwork/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { item?: FieldworkAssignmentView };
    return payload.item ?? null;
  } catch {
    return null;
  }
}
