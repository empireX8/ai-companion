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
import { resolveInspectorTabForInput } from "@/lib/inspector-navigation-state";

import { InspectorNavigationSync } from "./InspectorNavigationSync";

export type InspectorTab = "evidence" | "movement";

type InspectorHistoryEntry = {
  selection: InspectorSelection;
  tab: InspectorTab;
  trailLabel: string | null;
};

type InspectorContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  selection: InspectorSelection | null;
  selectObject: (input: SelectObjectInput & { tab?: InspectorTab }) => void;
  pushObject: (
    input: SelectObjectInput & { tab?: InspectorTab; trailLabel?: string | null }
  ) => void;
  clearSelection: () => void;
  openInspector: (tab?: InspectorTab) => void;
  canGoBack: boolean;
  backTarget: InspectorHistoryEntry | null;
  goBack: () => void;
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
  pushObject: () => {},
  clearSelection: () => {},
  openInspector: () => {},
  canGoBack: false,
  backTarget: null,
  goBack: () => {},
});

export function InspectorProvider({
  children,
  syncNavigation = true,
}: {
  children: ReactNode;
  syncNavigation?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [tab, setTab] = useState<InspectorTab>("evidence");
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const [history, setHistory] = useState<InspectorHistoryEntry[]>([]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setHistory([]);
  }, []);

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
      setHistory([]);
      setSelection(nextSelection);
      setIsOpen(true);
      setTab(resolveInspectorTabForInput(input));
    },
    []
  );

  const pushObject = useCallback(
    (input: SelectObjectInput & { tab?: InspectorTab; trailLabel?: string | null }) => {
      const nextSelection = buildInspectorSelection(input);
      if (!nextSelection) {
        return;
      }

      setHistory((prev) => {
        if (!selection) {
          return prev;
        }

        return [
          ...prev,
          {
            selection,
            tab,
            trailLabel: input.trailLabel?.trim() || null,
          },
        ];
      });
      setSelection(nextSelection);
      setIsOpen(true);
      setTab(resolveInspectorTabForInput(input));
    },
    [selection, tab]
  );

  const goBack = useCallback(() => {
    setHistory((prev) => {
      const nextEntry = prev[prev.length - 1] ?? null;
      if (!nextEntry) {
        return prev;
      }

      setSelection(nextEntry.selection);
      setTab(nextEntry.tab);
      setIsOpen(true);
      return prev.slice(0, -1);
    });
  }, []);

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
      pushObject,
      clearSelection,
      openInspector,
      canGoBack: history.length > 0,
      backTarget: history[history.length - 1] ?? null,
      goBack,
    }),
    [
      isOpen,
      open,
      close,
      toggle,
      tab,
      selection,
      selectObject,
      pushObject,
      clearSelection,
      openInspector,
      history,
      goBack,
    ]
  );

  return (
    <InspectorContext.Provider value={value}>
      {syncNavigation ? <InspectorNavigationSync /> : null}
      {children}
    </InspectorContext.Provider>
  );
}

export function useInspector() {
  return useContext(InspectorContext);
}

export type { InspectorSourceSurface };
