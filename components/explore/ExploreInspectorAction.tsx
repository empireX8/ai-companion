"use client";

import { useInspector } from "@/components/inspector/InspectorContext";
import type { InspectorSelectableObjectType } from "@/lib/inspector-selection";
import {
  EXPLORE_EVIDENCE_INSPECTOR_LABEL,
  EXPLORE_MOVEMENT_INSPECTOR_LABEL,
} from "@/lib/explore-surface";

export function ExploreInspectorAction({
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
      ? EXPLORE_MOVEMENT_INSPECTOR_LABEL
      : EXPLORE_EVIDENCE_INSPECTOR_LABEL;

  return (
    <button
      type="button"
      onClick={() => {
        selectObject({
          objectType,
          objectId,
          modelUpdateId: modelUpdateId ?? null,
          title,
          sourceSurface: "explore",
          tab,
        });
      }}
      className="ml-calm mt-2 inline-flex rounded-lg px-3 py-1.5 text-[11px] font-medium text-cyan hover:bg-white/[0.04]"
    >
      {label}
    </button>
  );
}
