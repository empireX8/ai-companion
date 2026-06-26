"use client";

import { useEffect, useMemo, useState } from "react";

import { TodayPage } from "@/components/orvek-v0/pages/today";
import { OrvekV0PageShell } from "@/components/orvek-v0/production/OrvekV0PageShell";
import { buildTodayProductionDataApi } from "@/lib/orvek-v0/production/today-api";
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

export function OrvekTodayPage() {
  const [snapshot, setSnapshot] = useState<TodayReentrySnapshot>(EMPTY_SNAPSHOT);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoadingSnapshot(true);
      try {
        const next = await fetchTodayReentrySnapshot();
        if (!cancelled) setSnapshot(next);
      } catch {
        if (!cancelled) setSnapshot(EMPTY_SNAPSHOT);
      } finally {
        if (!cancelled) setIsLoadingSnapshot(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dataApi = useMemo(
    () =>
      buildTodayProductionDataApi({
        snapshot,
        isLoading: isLoadingSnapshot,
        briefingDate: DISPLAY_DATE,
      }),
    [snapshot, isLoadingSnapshot]
  );

  return (
    <OrvekV0PageShell data={dataApi}>
      <TodayPage />
    </OrvekV0PageShell>
  );
}
