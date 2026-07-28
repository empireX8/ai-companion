import type { PublicObjectLinkType } from "./public-continuity-registry";
import { PUBLIC_OBJECT_LINK_HREF_PREFIXES } from "./public-continuity-registry";
import type { OrvekObject } from "./orvek-v0/orvek-types";

export const INSPECTOR_SELECTABLE_OBJECT_TYPES = [
  "usermap_conclusion",
  "canonical_concept",
  "model_update",
  "pattern_claim",
  "contradiction_node",
  "context_profile",
  "model_goal",
] as const;

export const INSPECTOR_EMBEDDED_OBJECT_TYPES = [
  "receipt",
  "active_question",
  "investigation",
  "reference_decision",
  "reference_report",
  "unsupported",
] as const;

export type InspectorSelectableObjectType =
  (typeof INSPECTOR_SELECTABLE_OBJECT_TYPES)[number];
export type InspectorSelectionObjectType =
  | InspectorSelectableObjectType
  | (typeof INSPECTOR_EMBEDDED_OBJECT_TYPES)[number];

export type InspectorSourceSurface =
  | "today"
  | "map"
  | "timeline"
  | "explore"
  | "decisions"
  | "unknown";

export type InspectorSelectionAvailability =
  | "live"
  | "reference_fallback"
  | "unsupported"
  | "missing";

export type InspectorSelection = {
  selectedObjectType: InspectorSelectionObjectType;
  selectedObjectId: string;
  selectedModelUpdateId: string | null;
  selectedTitle: string | null;
  sourceSurface: InspectorSourceSurface;
  availability?: InspectorSelectionAvailability;
};

export type SelectObjectInput = {
  objectType: InspectorSelectionObjectType;
  objectId: string;
  modelUpdateId?: string | null;
  title?: string | null;
  sourceSurface?: InspectorSourceSurface;
  availability?: InspectorSelectionAvailability;
};

export function isInspectorSelectableObjectType(
  value: string | null | undefined
): value is InspectorSelectableObjectType {
  return INSPECTOR_SELECTABLE_OBJECT_TYPES.includes(
    value as InspectorSelectableObjectType
  );
}

export function isInspectorSelectionObjectType(
  value: string | null | undefined
): value is InspectorSelectionObjectType {
  return (
    isInspectorSelectableObjectType(value) ||
    INSPECTOR_EMBEDDED_OBJECT_TYPES.includes(
      value as (typeof INSPECTOR_EMBEDDED_OBJECT_TYPES)[number]
    )
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
  if (!objectId || !isInspectorSelectionObjectType(input.objectType)) {
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
    availability: input.availability ?? "live",
  };
}

export function resolveInspectorObjectType(
  object: OrvekObject,
): InspectorSelectionObjectType | null {
  if (isInspectorSelectableObjectType(object.inspectorObjectType)) {
    return object.inspectorObjectType;
  }

  switch (object.type) {
    case "context":
      return "context_profile";
    case "model-goal":
      return "model_goal";
    case "map-object":
      return "usermap_conclusion";
    case "model-update":
      return "model_update";
    case "receipt":
      return "receipt";
    case "active-question":
      return "active_question";
    case "investigation":
      return "investigation";
    case "decision":
      return "reference_decision";
    case "report":
      return "reference_report";
    default:
      return null;
  }
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
): { objectType: InspectorSelectableObjectType; objectId: string } | null {
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

export function buildProductionInspectorBridgeSignature(input: {
  selectedId: string;
  inspectorObjectId?: string;
  objectType?: InspectorSelectionObjectType | "missing" | "unsupported";
  availability?: InspectorSelectionAvailability;
  page: string;
}): string {
  if (!input.objectType) {
    return `${input.selectedId}:missing:${input.page}`;
  }
  if (input.objectType === "unsupported" && !input.availability) {
    return `${input.selectedId}:unsupported:${input.page}`;
  }
  return `${input.selectedId}:${input.inspectorObjectId ?? input.selectedId}:${input.objectType}:${input.availability}:${input.page}`;
}

/** Clear cross-surface inspector selection when navigating away from the owning surface. */
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
