"use client";

import { useInspector } from "@/components/inspector/InspectorContext";
import type { InspectorSelectableObjectType } from "@/lib/inspector-selection";
import {
  TIMELINE_INSPECTOR_LABEL,
  TIMELINE_MOVEMENT_INSPECTOR_LABEL,
} from "@/lib/timeline-semantic-layers";

export function TimelineInspectorAction({
  objectType,
  objectId,
  title,
  modelUpdateId,
  tab,
}: {
  objectType: InspectorSelectableObjectType;
  objectId: string;
  title: string;
  modelUpdateId?: string | null;
  tab: "movement" | "evidence";
}) {
  const { selectObject } = useInspector();
  const label =
    objectType === "model_update"
      ? TIMELINE_MOVEMENT_INSPECTOR_LABEL
      : TIMELINE_INSPECTOR_LABEL;

  return (
    <button
      type="button"
      onClick={() => {
        selectObject({
          objectType,
          objectId,
          modelUpdateId: modelUpdateId ?? null,
          title,
          sourceSurface: "timeline",
          tab,
        });
      }}
      className="ml-calm mt-2 inline-flex rounded-lg px-3 py-1.5 text-[11px] font-medium text-cyan hover:bg-white/[0.04]"
    >
      {label}
    </button>
  );
}
