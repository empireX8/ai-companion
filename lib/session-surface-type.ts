export const SESSION_SURFACE_TYPES = ["journal_chat", "explore_chat"] as const;

export type SessionSurfaceTypeValue = (typeof SESSION_SURFACE_TYPES)[number];

export function isSessionSurfaceType(value: string): value is SessionSurfaceTypeValue {
  return (SESSION_SURFACE_TYPES as readonly string[]).includes(value);
}

export function parseSessionSurfaceTypeQuery(
  value: string | null
): { ok: true; value: SessionSurfaceTypeValue | null } | { ok: false } {
  if (value === null) {
    return { ok: true, value: null };
  }

  const normalized = value.trim();
  if (!normalized || !isSessionSurfaceType(normalized)) {
    return { ok: false };
  }

  return { ok: true, value: normalized };
}

export function parseSessionSurfaceTypeBody(
  value: unknown
): { ok: true; value: SessionSurfaceTypeValue | null } | { ok: false } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return { ok: false };
  }

  const normalized = value.trim();
  if (!normalized || !isSessionSurfaceType(normalized)) {
    return { ok: false };
  }

  return { ok: true, value: normalized };
}
