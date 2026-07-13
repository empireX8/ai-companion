"use client";

import { useCallback } from "react";

import { useInspector, type InspectorTab } from "@/components/inspector/InspectorContext";

import { useOptionalWorkbench } from "./store";

/** Keeps workbench and InspectorContext tabs aligned when a workbench store is present. */
export function useProductionInspectorTab() {
  const { tab, setTab: setContextTab } = useInspector();
  const workbench = useOptionalWorkbench();

  const setTab = useCallback(
    (next: InspectorTab) => {
      setContextTab(next);
      workbench?.setInspectorTab(next);
    },
    [setContextTab, workbench],
  );

  return { tab, setTab };
}
