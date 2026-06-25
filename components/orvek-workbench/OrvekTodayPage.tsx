"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Mic } from "lucide-react";

import { TodayPage } from "@/components/orvek-v0/pages/today";
import { OrvekV0PageShell } from "@/components/orvek-v0/production/OrvekV0PageShell";
import { VoiceWaveform } from "@/components/VoiceWaveform";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { EMPTY_ORVEK_DATA_API } from "@/lib/orvek-v0/empty-api";
import { OrvekDataProvider } from "@/lib/orvek-v0/data-provider";
import { OrvekPageHandlersProvider } from "@/lib/orvek-v0/page-handlers";
import { mapTodayDataToV0Props } from "@/lib/orvek-adapters/today";
import {
  buildTodayAttentionRows,
  buildTodayFieldworkRows,
  buildTodayOpenLoopRows,
  fetchTodayReentrySnapshot,
  pickTodayHeroItem,
  type TodayReentrySnapshot,
  type TodaySelectableTarget,
} from "@/lib/today-reentry";
import type { TodayIntelligenceUpdateItem } from "@/lib/today-intelligence-updates";

import { useOrvekInspector } from "./useOrvekInspector";

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

function applySelection(
  select: ReturnType<typeof useOrvekInspector>["select"],
  setInspectorTab: ReturnType<typeof useOrvekInspector>["setInspectorTab"],
  target: TodaySelectableTarget | null,
  tab: "evidence" | "movement" = "evidence"
) {
  if (!target) return;
  select({
    objectType: target.objectType,
    objectId: target.objectId,
    title: target.title,
    modelUpdateId: target.modelUpdateId,
    tab: target.tab ?? tab,
  });
  setInspectorTab(target.tab ?? tab);
}

export function OrvekTodayPage() {
  const router = useRouter();
  const { select, setInspectorTab } = useOrvekInspector();
  const [snapshot, setSnapshot] = useState<TodayReentrySnapshot>(EMPTY_SNAPSHOT);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [captureText, setCaptureText] = useState("");
  const voice = useVoiceInput();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingSnapshot(true);
      try {
        const next = await fetchTodayReentrySnapshot();
        if (!cancelled) setSnapshot(next);
      } catch {
        if (!cancelled) setSnapshot(EMPTY_SNAPSHOT);
      } finally {
        if (!cancelled) setIsLoadingSnapshot(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = useMemo(
    () =>
      mapTodayDataToV0Props({
        snapshot,
        isLoading: isLoadingSnapshot,
        briefingDate: DISPLAY_DATE,
      }),
    [snapshot, isLoadingSnapshot]
  );

  const hero = useMemo(() => pickTodayHeroItem(snapshot), [snapshot]);
  const trimmedCaptureText = captureText.trim();

  const dataApi = useMemo(
    () => ({
      ...EMPTY_ORVEK_DATA_API,
      today,
    }),
    [today]
  );

  function seeWhyMovement(item: TodayIntelligenceUpdateItem) {
    select({
      objectType: "model_update",
      objectId: item.id,
      title: `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`,
      modelUpdateId: item.id,
      tab: "movement",
    });
    setInspectorTab("movement");
  }

  function handleSaveCapture() {
    if (!trimmedCaptureText) return;
    try {
      window.sessionStorage.setItem("mindlabs:today-capture-handoff", trimmedCaptureText);
    } catch {
      // ignore
    }
    router.push("/journal-chat");
  }

  function resolveNowRowSelection(rowId: string) {
    const all = [
      ...buildTodayAttentionRows(snapshot, hero),
      ...buildTodayFieldworkRows(snapshot, hero),
      ...buildTodayOpenLoopRows(snapshot),
    ];
    return all.find((row) => row.id === rowId)?.selection ?? null;
  }

  const pageHandlers = useMemo(
    () => ({
      today: {
        onHeroInspect: () => {
          if (hero?.selection) {
            applySelection(select, setInspectorTab, hero.selection);
          } else if (hero?.href) {
            router.push(hero.href);
          }
        },
        onHeroSeeWhy: () => {
          if (hero?.selection) {
            applySelection(select, setInspectorTab, hero.selection, "movement");
            return;
          }
          if (hero?.movement) {
            seeWhyMovement(hero.movement);
          }
        },
        onNowRowSelect: (rowId: string) => {
          const selection = resolveNowRowSelection(rowId);
          if (selection) {
            applySelection(select, setInspectorTab, selection);
          }
        },
        onMovementSeeWhy: (movementId: string) => {
          const item = snapshot.intelligenceUpdates.find((entry) => entry.id === movementId);
          if (item) {
            seeWhyMovement(item);
          }
        },
        capture: {
          captureText,
          displayText:
            voice.state === "recording" && voice.interimTranscript
              ? captureText
                ? `${captureText}\n${voice.interimTranscript}`
                : voice.interimTranscript
              : captureText,
          isRecording: voice.state === "recording",
          canContinue: Boolean(trimmedCaptureText),
          onCaptureChange: setCaptureText,
          onVoiceToggle: () => void voice.toggle(),
          onContinue: handleSaveCapture,
          voiceSlot:
            voice.state === "recording" ? (
              <>
                <VoiceWaveform active />
                <span className="ml-1">Recording…</span>
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" strokeWidth={1.5} />
                Voice
              </>
            ),
        },
      },
    }),
    [
      captureText,
      hero,
      router,
      select,
      setInspectorTab,
      snapshot.intelligenceUpdates,
      trimmedCaptureText,
      voice,
    ]
  );

  return (
    <OrvekV0PageShell>
      <OrvekDataProvider value={dataApi}>
        <OrvekPageHandlersProvider value={pageHandlers}>
          <TodayPage />
        </OrvekPageHandlersProvider>
      </OrvekDataProvider>
    </OrvekV0PageShell>
  );
}
