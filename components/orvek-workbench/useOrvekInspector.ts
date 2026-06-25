"use client";

import { usePathname } from "next/navigation";
import { useCallback } from "react";

import { useInspector, type InspectorTab } from "@/components/inspector/InspectorContext";
import {
  resolveInspectorSourceSurfaceFromPathname,
  type InspectorSelectableObjectType,
  type InspectorSourceSurface,
} from "@/lib/inspector-selection";

export type OrvekSelectInput = {
  objectType: InspectorSelectableObjectType;
  objectId: string;
  title: string;
  tab?: InspectorTab;
  modelUpdateId?: string | null;
  sourceSurface?: InspectorSourceSurface;
};

export function useOrvekInspector() {
  const pathname = usePathname();
  const { selectObject, setTab, selection, tab, isOpen, openInspector } = useInspector();

  const select = useCallback(
    (input: OrvekSelectInput) => {
      selectObject({
        objectType: input.objectType,
        objectId: input.objectId,
        title: input.title,
        modelUpdateId: input.modelUpdateId ?? undefined,
        sourceSurface: input.sourceSurface ?? resolveInspectorSourceSurfaceFromPathname(pathname),
        tab: input.tab,
      });
    },
    [pathname, selectObject]
  );

  const setInspectorTab = useCallback(
    (nextTab: InspectorTab) => {
      setTab(nextTab);
      openInspector(nextTab);
    },
    [openInspector, setTab]
  );

  return {
    select,
    setInspectorTab,
    selection,
    tab,
    isOpen,
  };
}
