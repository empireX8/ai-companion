"use client";

import { useEffect, useMemo, useState } from "react";

import { buildTodayProductionDataApi } from "@/lib/orvek-v0/production/today-api";
import { buildHybridWorkbenchDataApi } from "@/lib/orvek-v0/production/hybrid-workbench-api";
import { createMockOrvekDataApi } from "@/lib/orvek-v0/mock-api";
import {
  fetchTodayReentrySnapshot,
  type TodayReentrySnapshot,
} from "@/lib/today-reentry";

const EMPTY_SNAPSHOT: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

const DISPLAY_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/London",
}).format(new Date());

export function useOrvekHybridWorkbenchDataApi() {
  const baseApi = useMemo(() => createMockOrvekDataApi(), []);
  const [snapshot, setSnapshot] = useState<TodayReentrySnapshot>(EMPTY_SNAPSHOT);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoadingSnapshot(true);
      try {
        const next = await fetchTodayReentrySnapshot();
        if (!cancelled) {
          setSnapshot(next);
        }
      } catch {
        if (!cancelled) {
          setSnapshot(EMPTY_SNAPSHOT);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSnapshot(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    if (isLoadingSnapshot) {
      return baseApi;
    }

    const todayApi = buildTodayProductionDataApi({
      snapshot,
      isLoading: isLoadingSnapshot,
      briefingDate: DISPLAY_DATE,
    });

    return buildHybridWorkbenchDataApi(baseApi, todayApi);
  }, [baseApi, isLoadingSnapshot, snapshot]);
}
