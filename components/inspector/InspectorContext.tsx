"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  buildInspectorSelection,
  type InspectorSelection,
  type InspectorSourceSurface,
  type SelectObjectInput,
} from "@/lib/inspector-selection";

import { InspectorNavigationSync } from "./InspectorNavigationSync";

export type InspectorTab = "evidence" | "movement";

type InspectorContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  selection: InspectorSelection | null;
  selectObject: (input: SelectObjectInput & { tab?: InspectorTab }) => void;
  clearSelection: () => void;
  openInspector: (tab?: InspectorTab) => void;
};

const InspectorContext = createContext<InspectorContextValue>({
  isOpen: true,
  open: () => {},
  close: () => {},
  toggle: () => {},
  tab: "evidence",
  setTab: () => {},
  selection: null,
  selectObject: () => {},
  clearSelection: () => {},
  openInspector: () => {},
});

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [tab, setTab] = useState<InspectorTab>("evidence");
  const [selection, setSelection] = useState<InspectorSelection | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const clearSelection = useCallback(() => setSelection(null), []);

  const openInspector = useCallback((nextTab?: InspectorTab) => {
    setIsOpen(true);
    if (nextTab) {
      setTab(nextTab);
    }
  }, []);

  const selectObject = useCallback(
    (input: SelectObjectInput & { tab?: InspectorTab }) => {
      const nextSelection = buildInspectorSelection(input);
      if (!nextSelection) {
        return;
      }
      setSelection(nextSelection);
      setIsOpen(true);
      setTab(input.tab ?? (input.objectType === "model_update" ? "movement" : "evidence"));
    },
    []
  );

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      tab,
      setTab,
      selection,
      selectObject,
      clearSelection,
      openInspector,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      tab,
      selection,
      selectObject,
      clearSelection,
      openInspector,
    ]
  );

  return (
    <InspectorContext.Provider value={value}>
      <InspectorNavigationSync />
      {children}
    </InspectorContext.Provider>
  );
}

export function useInspector() {
  return useContext(InspectorContext);
}

export type { InspectorSourceSurface };
