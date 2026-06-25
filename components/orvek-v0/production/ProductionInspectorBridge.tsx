"use client";

import { useEffect } from "react";

import { useInspector } from "@/components/inspector/InspectorContext";
import type { InspectorSelectableObjectType } from "@/lib/inspector-selection";
import { useOrvekData } from "@/lib/orvek-v0/data-provider";
import type { OrvekObject } from "@/lib/orvek-v0/orvek-types";

import { useWorkbench } from "../store";

function resolveInspectorType(obj: OrvekObject): InspectorSelectableObjectType | null {
  if (obj.inspectorObjectType) {
    return obj.inspectorObjectType;
  }
  if (obj.type === "map-object") {
    return "usermap_conclusion";
  }
  if (obj.type === "model-update") {
    return "model_update";
  }
  return null;
}

export function ProductionInspectorBridge({ children }: { children: React.ReactNode }) {
  const { selectedId, inspectorTab } = useWorkbench();
  const { getObject } = useOrvekData();
  const { selectObject, setTab, openInspector } = useInspector();

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    const obj = getObject(selectedId);
    if (!obj) {
      return;
    }
    const objectType = resolveInspectorType(obj);
    if (!objectType) {
      return;
    }
    selectObject({
      objectType,
      objectId: obj.inspectorObjectId ?? obj.id,
      title: obj.title,
      modelUpdateId: objectType === "model_update" ? obj.inspectorObjectId ?? obj.id : undefined,
      tab: inspectorTab,
    });
    setTab(inspectorTab);
    openInspector(inspectorTab);
  }, [getObject, inspectorTab, openInspector, selectObject, selectedId, setTab]);

  return children;
}
