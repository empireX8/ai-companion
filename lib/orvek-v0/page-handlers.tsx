"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { V0DecisionsViewHandlers } from "@/components/orvek-v0/pages/decisions";
import type { V0ExploreViewHandlers } from "@/components/orvek-v0/pages/explore";
import type { V0TimelineViewHandlers } from "@/components/orvek-v0/pages/timeline";
import type {
  V0TodayCaptureProps,
  V0TodayViewHandlers,
} from "@/components/orvek-v0/pages/today";
import type { V0WhatChangedViewHandlers } from "@/components/orvek-v0/pages/what-changed";

export type OrvekPageHandlers = {
  today?: V0TodayViewHandlers & { capture: V0TodayCaptureProps };
  explore?: V0ExploreViewHandlers;
  decisions?: V0DecisionsViewHandlers & {
    draft: string;
    fieldworkActionId: string | null;
  };
  timeline?: V0TimelineViewHandlers;
  whatChanged?: V0WhatChangedViewHandlers;
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
