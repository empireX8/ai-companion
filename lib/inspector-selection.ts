import type { PublicObjectLinkType } from "./public-continuity-registry";
import { PUBLIC_OBJECT_LINK_HREF_PREFIXES } from "./public-continuity-registry";

export const INSPECTOR_SELECTABLE_OBJECT_TYPES = [
  "usermap_conclusion",
  "model_update",
  "pattern_claim",
  "contradiction_node",
  "context_profile",
] as const;

export type InspectorSelectableObjectType =
  (typeof INSPECTOR_SELECTABLE_OBJECT_TYPES)[number];

export type InspectorSourceSurface =
  | "today"
  | "map"
  | "timeline"
  | "explore"
  | "decisions"
  | "unknown";

export type InspectorSelection = {
  selectedObjectType: InspectorSelectableObjectType;
  selectedObjectId: string;
  selectedModelUpdateId: string | null;
  selectedTitle: string | null;
  sourceSurface: InspectorSourceSurface;
};

export type SelectObjectInput = {
  objectType: InspectorSelectableObjectType;
  objectId: string;
  modelUpdateId?: string | null;
  title?: string | null;
  sourceSurface?: InspectorSourceSurface;
};

export function isInspectorSelectableObjectType(
  value: string | null | undefined
): value is InspectorSelectableObjectType {
  return INSPECTOR_SELECTABLE_OBJECT_TYPES.includes(
    value as InspectorSelectableObjectType
  );
}

export function normalizeInspectorObjectId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildInspectorSelection(input: SelectObjectInput): InspectorSelection | null {
  const objectId = normalizeInspectorObjectId(input.objectId);
  if (!objectId || !isInspectorSelectableObjectType(input.objectType)) {
    return null;
  }

  const modelUpdateId =
    input.objectType === "model_update"
      ? normalizeInspectorObjectId(input.modelUpdateId ?? input.objectId)
      : normalizeInspectorObjectId(input.modelUpdateId ?? null);

  return {
    selectedObjectType: input.objectType,
    selectedObjectId: objectId,
    selectedModelUpdateId: modelUpdateId,
    selectedTitle: input.title?.trim() ? input.title.trim() : null,
    sourceSurface: input.sourceSurface ?? "unknown",
  };
}

const HREF_PREFIX_TO_TYPE = Object.entries(PUBLIC_OBJECT_LINK_HREF_PREFIXES).reduce(
  (acc, [type, prefix]) => {
    acc[prefix] = type as PublicObjectLinkType;
    return acc;
  },
  {} as Record<string, PublicObjectLinkType>
);

/** Map a public detail href to a selectable inspector object when supported. */
export function parseSelectableObjectFromHref(
  href: string | null | undefined
): Pick<SelectObjectInput, "objectType" | "objectId"> | null {
  if (!href) {
    return null;
  }

  let pathname = href;
  try {
    pathname = new URL(href, "http://mindlab.local").pathname;
  } catch {
    // keep raw path
  }

  for (const [prefix, type] of Object.entries(HREF_PREFIX_TO_TYPE)) {
    if (!pathname.startsWith(`${prefix}/`)) {
      continue;
    }
    const objectId = normalizeInspectorObjectId(pathname.slice(prefix.length + 1).split("/")[0]);
    if (!objectId) {
      return null;
    }
    if (!isInspectorSelectableObjectType(type)) {
      return null;
    }
    return { objectType: type, objectId };
  }

  if (pathname.startsWith("/what-changed")) {
    return null;
  }

  return null;
}

export function resolveActiveModelUpdateId(
  selection: InspectorSelection | null
): string | null {
  if (!selection) {
    return null;
  }
  if (selection.selectedModelUpdateId) {
    return selection.selectedModelUpdateId;
  }
  if (selection.selectedObjectType === "model_update") {
    return selection.selectedObjectId;
  }
  return null;
}

/** Map the current pathname to the inspector source surface that owns in-context selection. */
export function resolveInspectorSourceSurfaceFromPathname(
  pathname: string
): InspectorSourceSurface | "unknown" {
  if (pathname === "/") {
    return "today";
  }
  if (pathname.startsWith("/your-map")) {
    return "map";
  }
  if (pathname.startsWith("/timeline")) {
    return "timeline";
  }
  if (pathname.startsWith("/explore")) {
    return "explore";
  }
  if (pathname.startsWith("/actions")) {
    return "decisions";
  }
  return "unknown";
}

export function shouldClearInspectorSelectionOnNavigation(input: {
  pathname: string;
  selection: InspectorSelection | null;
}): boolean {
  if (!input.selection) {
    return false;
  }

  const currentSurface = resolveInspectorSourceSurfaceFromPathname(input.pathname);
  if (currentSurface !== "unknown" && currentSurface === input.selection.sourceSurface) {
    return false;
  }

  return true;
}
