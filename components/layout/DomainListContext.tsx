"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type DomainListContextValue = {
  panelRef: React.RefObject<HTMLDivElement | null>;
  isCollapsed: boolean;
  toggleCollapsed: () => void;
};

const DomainListContext = createContext<DomainListContextValue>({
  panelRef: { current: null },
  isCollapsed: false,
  toggleCollapsed: () => {},
});

export function DomainListProvider({ children }: { children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const toggleCollapsed = useCallback(() => setIsCollapsed((v) => !v), []);

  return (
    <DomainListContext.Provider value={{ panelRef, isCollapsed, toggleCollapsed }}>
      {children}
    </DomainListContext.Provider>
  );
}

export function useDomainListPanel() {
  return useContext(DomainListContext);
}
