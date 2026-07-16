"use client";

import { useEffect, useRef } from "react";

import { useInspector } from "@/components/inspector/InspectorContext";
import {
  resolveInspectorObjectType,
  buildProductionInspectorBridgeSignature,
} from "@/lib/inspector-selection";
import { resolveBridgedInspectorTab, shouldSyncWorkbenchTabToInspector } from "@/lib/inspector-tab-contract";
import {
  resolveOrvekObjectProvenance,
  useOrvekData,
} from "@/lib/orvek-v0/data-provider";

import { useWorkbench } from "../store";

export function ProductionInspectorBridge({ children }: { children: React.ReactNode }) {
  const { page, selectedId, inspectorTab, inspectorTabExplicit, setInspectorTab } = useWorkbench();
  const data = useOrvekData();
  const { selectObject, clearSelection, setTab } = useInspector();
  const lastBridgeSignature = useRef<string | null>(null);
  const previousSelectedId = useRef<string | null>(null);

  useEffect(() => {
    if (shouldSyncWorkbenchTabToInspector({
      previousSelectedId: previousSelectedId.current,
      nextSelectedId: selectedId,
    })) {
      setTab(inspectorTab);
    }
    previousSelectedId.current = selectedId;
  }, [inspectorTab, selectedId, setTab]);

  useEffect(() => {
    if (!selectedId) {
      if (lastBridgeSignature.current !== "none") {
        lastBridgeSignature.current = "none";
        clearSelection();
      }
      return;
    }
    const obj = data.getObject(selectedId);
    if (!obj) {
      const signature = buildProductionInspectorBridgeSignature({
        selectedId,
        page,
      });
      if (lastBridgeSignature.current === signature) {
        return;
      }
      lastBridgeSignature.current = signature;
      selectObject({
        objectType: "unsupported",
        objectId: selectedId,
        title: `Unavailable selection · ${selectedId}`,
        tab: inspectorTab,
        availability: "missing",
        sourceSurface: page,
      });
      return;
    }
    const objectType = resolveInspectorObjectType(obj);
    if (!objectType) {
      const signature = buildProductionInspectorBridgeSignature({
        selectedId,
        objectType: "unsupported",
        page,
      });
      if (lastBridgeSignature.current === signature) {
        return;
      }
      lastBridgeSignature.current = signature;
      selectObject({
        objectType: "unsupported",
        objectId: selectedId,
        title: obj.title,
        tab: inspectorTab,
        availability: "unsupported",
        sourceSurface: page,
      });
      return;
    }
    const provenance = resolveOrvekObjectProvenance(data, obj);
    const availability =
      objectType === "reference_report"
        ? provenance === "live"
          ? "unsupported"
          : "reference_fallback"
        : objectType === "reference_decision"
          ? provenance === "live"
            ? "live"
            : "reference_fallback"
          : provenance;
    const inspectorObjectId = obj.inspectorObjectId ?? obj.id;
    const signature = buildProductionInspectorBridgeSignature({
      selectedId,
      inspectorObjectId,
      objectType,
      availability,
      page,
    });
    if (lastBridgeSignature.current === signature) {
      return;
    }
    lastBridgeSignature.current = signature;
    const bridgedTab = resolveBridgedInspectorTab({
      objectType,
      workbenchTab: inspectorTab,
      explicitWorkbenchTab: inspectorTabExplicit,
    });
    if (bridgedTab !== inspectorTab) {
      setInspectorTab(bridgedTab);
    }
    selectObject({
      objectType,
      objectId: inspectorObjectId,
      title: obj.title,
      modelUpdateId: objectType === "model_update" ? inspectorObjectId : undefined,
      tab: bridgedTab,
      availability,
      sourceSurface: page,
    });
  }, [
    clearSelection,
    data,
    inspectorTab,
    inspectorTabExplicit,
    page,
    selectObject,
    selectedId,
    setInspectorTab,
  ]);

  return children;
}
