"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import type { V0DecisionsViewProps } from "@/lib/orvek-adapters/decisions";
import type { V0ExploreViewProps } from "@/lib/orvek-adapters/explore";
import type { V0WhatChangedViewProps } from "@/lib/orvek-adapters/what-changed";
import type { V0TimelineViewProps } from "@/lib/orvek-adapters/timeline";
import type { V0TodayViewProps } from "@/lib/orvek-adapters/types";

import type { OrvekObject } from "./orvek-types";
import {
  getObject as getZipObject,
  getObjects as getZipObjects,
  type ExploreMovement,
} from "./orvek-data";
import type { OrvekDisplayContract } from "./display-contract";

export type OrvekDecisionsHeaderStats = {
  outcomesDue: number;
  reviewed: number;
};

export type OrvekTodayCopy = {
  briefingLine?: string;
  briefingTitle?: string;
  briefingMeta?: string;
};

export type OrvekMapCategory = {
  id: string;
  label: string;
  ids: string[];
};

export type OrvekTimelineGroup = {
  heading: string;
  ids: string[];
};

export type OrvekDecisionListGroup = {
  heading: string;
  ids: string[];
  tone?: "action";
};

export type OrvekExploreMessage = {
  id: string;
  role: "user" | "orvek";
  content: string;
};

export type OrvekMapHeader = {
  confidenceLabel: string;
  receiptsLabel: string;
  openQuestionsLabel: string;
};

export type OrvekDataApi = {
  getObject: (id: string | null | undefined) => OrvekObject | undefined;
  getObjects: (ids: string[] | undefined) => OrvekObject[];
  exploreGrounding: string[];
  exploreMovement: ExploreMovement[];
  mapCategories: OrvekMapCategory[];
  timelineGroups: OrvekTimelineGroup[];
  timelineFilters: string[];
  decisionListGroups: OrvekDecisionListGroup[];
  /** Production Explore chat; empty in mock reference unless overridden. */
  exploreMessages?: OrvekExploreMessage[];
  exploreLiveDetectionCopy?: string;
  /** Honest empty copy keyed by slot id. */
  emptyCopyBySlot?: Record<string, string>;
  /** Page bodies — v0 view props from adapters (production) or reference builders (dev). */
  today?: V0TodayViewProps;
  explore?: V0ExploreViewProps;
  decisions?: V0DecisionsViewProps;
  timeline?: V0TimelineViewProps;
  whatChanged?: V0WhatChangedViewProps;
  mapHeader?: OrvekMapHeader | null;
  mapSelectedId?: string | null;
  /** Production map fetch / ontology presence — omit on reference mock. */
  mapIsLoading?: boolean;
  mapLoadError?: string | null;
  mapHasContent?: boolean;
  todayIsLoading?: boolean;
  timelineIsLoading?: boolean;
  todayCopy?: OrvekTodayCopy;
  /** Production resurfaced receipt ids; omit on reference mock to use zip defaults. */
  todayResurfacedIds?: string[];
  /** When set, v0 pages use production data only — no zip mock fallbacks. */
  displayContract?: OrvekDisplayContract;
  exploreQuestionIds?: string[];
  exploreInvestigationIds?: string[];
  exploreIsLoading?: boolean;
  decisionsHeaderStats?: OrvekDecisionsHeaderStats;
  decisionsSelectedId?: string | null;
  decisionsIsLoading?: boolean;
};

const OrvekDataContext = createContext<OrvekDataApi | null>(null);

export function OrvekDataProvider({
  value,
  children,
}: {
  value: OrvekDataApi;
  children: ReactNode;
}) {
  const memo = useMemo(() => value, [value]);
  return <OrvekDataContext.Provider value={memo}>{children}</OrvekDataContext.Provider>;
}

export function useOptionalOrvekData(): OrvekDataApi | null {
  return useContext(OrvekDataContext);
}

export function useOrvekData(): OrvekDataApi {
  const ctx = useOptionalOrvekData();
  if (!ctx) {
    throw new Error("useOrvekData must be used within OrvekDataProvider");
  }
  return ctx;
}

export function useOrvekObject(id: string | null | undefined): OrvekObject | undefined {
  const { getObject } = useOrvekData();
  return getObject(id);
}

export function resolveOrvekObjectFromGraph(
  data: OrvekDataApi | null,
  id: string | null | undefined,
): OrvekObject | undefined {
  if (!id) {
    return undefined;
  }

  return data?.getObject(id) ?? getZipObject(id);
}

export function resolveOrvekObjectsFromGraph(
  data: OrvekDataApi | null,
  ids: string[] | undefined,
): OrvekObject[] {
  const resolved: OrvekObject[] = [];

  for (const id of ids ?? []) {
    if (!id) {
      continue;
    }

    const object = resolveOrvekObjectFromGraph(data, id);
    if (object) {
      resolved.push(object);
    }
  }

  return resolved;
}

export function useOrvekObjectGraph(): {
  getObject: (id: string | null | undefined) => OrvekObject | undefined;
  getObjects: (ids: string[] | undefined) => OrvekObject[];
} {
  const data = useOrvekData();

  return useMemo(
    () => ({
      getObject: (id) => resolveOrvekObjectFromGraph(data, id),
      getObjects: (ids) => resolveOrvekObjectsFromGraph(data, ids),
    }),
    [data],
  );
}
