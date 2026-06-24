"use client";

import { useInspector } from "@/components/inspector/InspectorContext";
import type { WhatChangedListItem } from "@/lib/public-intelligence-safe-slice";
import {
  toWhatChangedMovementTitle,
  WHAT_CHANGED_INSPECTOR_LABEL,
} from "@/lib/what-changed-surface";

export function WhatChangedInspectorButton({ item }: { item: WhatChangedListItem }) {
  const { selectObject } = useInspector();

  return (
    <button
      type="button"
      onClick={() => {
        selectObject({
          objectType: "model_update",
          objectId: item.id,
          modelUpdateId: item.id,
          title: toWhatChangedMovementTitle(item),
          sourceSurface: "unknown",
          tab: "movement",
        });
      }}
      className="ml-calm mt-3 inline-flex rounded-lg px-3 py-2 text-[12px] font-medium text-cyan hover:bg-white/[0.04]"
    >
      {WHAT_CHANGED_INSPECTOR_LABEL}
    </button>
  );
}
