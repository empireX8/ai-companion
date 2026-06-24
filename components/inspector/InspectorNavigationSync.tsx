"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import { shouldClearInspectorSelectionOnNavigation } from "@/lib/inspector-selection";

import { useInspector } from "./InspectorContext";

/**
 * Clears cross-surface inspector selection when navigating away from the
 * surface that created it. Runs in layout effect so surface pages can
 * re-sync selection in a subsequent passive effect on the same navigation.
 */
export function InspectorNavigationSync() {
  const pathname = usePathname();
  const { selection, clearSelection, setTab } = useInspector();

  useLayoutEffect(() => {
    if (
      !shouldClearInspectorSelectionOnNavigation({
        pathname,
        selection,
      })
    ) {
      return;
    }

    clearSelection();
    setTab("evidence");
  }, [pathname, selection, clearSelection, setTab]);

  return null;
}
