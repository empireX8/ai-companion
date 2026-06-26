"use client";

import { createContext, useContext, type ReactNode } from "react";

export type OrvekPageHandlers = {
  today?: {
    onHeroInspect?: () => void;
    onHeroSeeWhy?: () => void;
    onNowRowSelect?: (rowId: string) => void;
    onMovementSeeWhy?: (movementId: string) => void;
    capture?: Record<string, unknown>;
  };
  explore?: {
    onTabChange?: (tab: string) => void;
    onDraftChange?: (value: string) => void;
    onSend?: () => void;
    onQuickPrompt?: (prompt: string) => void;
    onOpenInspector?: () => void;
    onComposerFocus?: () => void;
  };
  decisions?: {
    draft?: string;
    fieldworkActionId?: string | null;
    onTabChange?: (tab: string) => void;
    onDraftChange?: (value: string) => void;
    onSend?: () => void;
    onDecisionSelect?: (id: string) => void;
  };
  timeline?: {
    onFilterChange?: (filter: string) => void;
    onQueryChange?: (query: string) => void;
    onRowSelect?: (id: string) => void;
  };
  whatChanged?: {
    onMovementSelect?: (id: string, title: string) => void;
  };
  map?: {
    onOpenItem: (id: string) => void;
  };
};

const OrvekPageHandlersContext = createContext<OrvekPageHandlers>({});

export function OrvekPageHandlersProvider({
  value,
  children,
}: {
  value: OrvekPageHandlers;
  children: ReactNode;
}) {
  return (
    <OrvekPageHandlersContext.Provider value={value}>
      {children}
    </OrvekPageHandlersContext.Provider>
  );
}

export function useOrvekPageHandlers(): OrvekPageHandlers {
  return useContext(OrvekPageHandlersContext);
}
