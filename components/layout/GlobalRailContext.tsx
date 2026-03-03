"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

// Rail widths (px) — keep in sync with Tailwind classes used in GlobalRail + GlobalRailWrapper.
// Collapsed: w-14  = 56px → ml-14
// Expanded:  w-56  = 224px → ml-56
export const RAIL_W_COLLAPSED = 56;
export const RAIL_W_EXPANDED = 224;

type GlobalRailContextValue = {
  isRailCollapsed: boolean;
  toggleRailCollapsed: () => void;
};

const GlobalRailContext = createContext<GlobalRailContextValue>({
  isRailCollapsed: true,
  toggleRailCollapsed: () => {},
});

export function GlobalRailProvider({ children }: { children: ReactNode }) {
  const [isRailCollapsed, setIsRailCollapsed] = useState(true);
  const toggleRailCollapsed = useCallback(
    () => setIsRailCollapsed((v) => !v),
    []
  );

  return (
    <GlobalRailContext.Provider value={{ isRailCollapsed, toggleRailCollapsed }}>
      {children}
    </GlobalRailContext.Provider>
  );
}

export function useGlobalRail() {
  return useContext(GlobalRailContext);
}
