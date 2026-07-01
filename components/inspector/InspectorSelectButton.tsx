"use client";

import { useEffect, type ReactNode } from "react";

import { useInspector } from "@/components/inspector/InspectorContext";
import type { InspectorSourceSurface } from "@/lib/inspector-selection";
import { parseSelectableObjectFromHref } from "@/lib/inspector-selection";

export function MapDetailInspectorSync({
  conclusionId,
  title,
}: {
  conclusionId: string;
  title: string;
}) {
  const { selectObject } = useInspector();

  useEffect(() => {
    selectObject({
      objectType: "usermap_conclusion",
      objectId: conclusionId,
      title,
      sourceSurface: "map",
      tab: "evidence",
    });
  }, [conclusionId, selectObject, title]);

  return null;
}

export function InspectorSelectButton({
  objectType,
  objectId,
  title,
  sourceSurface,
  tab,
  className,
  children,
}: {
  objectType:
    | "usermap_conclusion"
    | "model_update"
    | "pattern_claim"
    | "contradiction_node"
    | "context_profile"
    | "model_goal";
  objectId: string;
  title?: string | null;
  sourceSurface: InspectorSourceSurface;
  tab?: "evidence" | "movement";
  className?: string;
  children: ReactNode;
}) {
  const { selectObject } = useInspector();

  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        selectObject({
          objectType,
          objectId,
          title: title ?? null,
          sourceSurface,
          tab,
        });
      }}
    >
      {children}
    </button>
  );
}

export function InspectorSelectFromHrefButton({
  href,
  title,
  sourceSurface,
  tab,
  className,
  children,
}: {
  href: string | null | undefined;
  title?: string | null;
  sourceSurface: InspectorSourceSurface;
  tab?: "evidence" | "movement";
  className?: string;
  children: ReactNode;
}) {
  const { selectObject } = useInspector();
  const parsed = parseSelectableObjectFromHref(href);

  if (!parsed) {
    return <>{children}</>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        selectObject({
          ...parsed,
          title: title ?? null,
          sourceSurface,
          tab,
        });
      }}
    >
      {children}
    </button>
  );
}
