"use client";

import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";

type TopBarSlotContextValue = {
  slotRef: RefObject<HTMLDivElement | null>;
};

const TopBarSlotContext = createContext<TopBarSlotContextValue | null>(null);

export function TopBarSlotProvider({ children }: { children: ReactNode }) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  return (
    <TopBarSlotContext.Provider value={{ slotRef }}>
      {children}
    </TopBarSlotContext.Provider>
  );
}

export function useTopBarSlot() {
  const ctx = useContext(TopBarSlotContext);
  if (!ctx) throw new Error("useTopBarSlot must be used within TopBarSlotProvider");
  return ctx;
}
