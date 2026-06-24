"use client";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import {
  TODAY_INTELLIGENCE_EMPTY_COPY,
  TODAY_INTELLIGENCE_LOADING_COPY,
  type TodaySurfacingCard,
} from "@/lib/today-surface";
import {
  TODAY_CHANGES_EMPTY_COPY,
  TODAY_CHANGES_SUBSECTION_LABEL,
  TODAY_CHANGES_VIEW_ALL_HREF,
  type TodayIntelligenceUpdateItem,
} from "@/lib/today-intelligence-updates";
import {
  TODAY_ATTENTION_EMPTY_COPY,
  TODAY_ATTENTION_SECTION_LABEL,
  TODAY_OPEN_LOOPS_LABEL,
  TODAY_REPORT_READY_LABEL,
  TODAY_TIMELINE_MOVEMENT_LABEL,
  buildTodayAttentionRows,
  buildTodayBriefingMeta,
  buildTodayBriefingTitle,
  fetchTodayReentrySnapshot,
  pickTodayHeroItem,
  type TodayAttentionRow,
  type TodayHeroItem,
  type TodayReentrySnapshot,
  type TodaySelectableTarget,
} from "@/lib/today-reentry";
import { PublicLinkedObjectContinuity } from "../../lib/public-continuity-display";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { VoiceWaveform } from "@/components/VoiceWaveform";
import { ArrowUpRight, GitCompareArrows, Mic, Receipt } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useInspector } from "@/components/inspector/InspectorContext";
import { parseSelectableObjectFromHref } from "@/lib/inspector-selection";

const EMPTY_SNAPSHOT: TodayReentrySnapshot = {
  surfacingCards: [],
  intelligenceUpdates: [],
  userMapConclusions: [],
  watchForItems: [],
  investigations: [],
  actions: [],
  timelineMovements: [],
};

const checkInStates = [
  { id: "calm", label: "Calm", color: "hsl(187 100% 50%)" },
  { id: "anxious", label: "Anxious", color: "hsl(32 90% 60%)" },
  { id: "tense", label: "Tense", color: "hsl(12 80% 55%)" },
  { id: "overwhelmed", label: "Overwhelmed", color: "hsl(280 50% 60%)" },
  { id: "numb", label: "Numb", color: "hsl(216 11% 55%)" },
] as const;

const todayQuickCheckInMap: Record<(typeof checkInStates)[number]["id"], string> = {
  calm: "stable",
  anxious: "stressed",
  tense: "overloaded",
  overwhelmed: "overloaded",
  numb: "flat",
};

const DISPLAY_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/London",
});

const DETAIL_DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampText(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DETAIL_DATE.format(date);
}

function applyInspectorSelection(
  selectObject: ReturnType<typeof useInspector>["selectObject"],
  selection: TodaySelectableTarget | null
) {
  if (!selection) {
    return;
  }
  selectObject({
    objectType: selection.objectType,
    objectId: selection.objectId,
    modelUpdateId: selection.modelUpdateId,
    title: selection.title,
    sourceSurface: "today",
    tab: selection.tab,
  });
}

function TodayLaneChip({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan/75">
      {label}
    </span>
  );
}

function TodayAttentionRowView({ row }: { row: TodayAttentionRow }) {
  const { selectObject } = useInspector();
  const occurredLabel = formatDateTime(row.occurredAt);

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <TodayLaneChip label={row.laneLabel} />
            <span className="text-[10px] font-medium uppercase tracking-wide text-meta">
              {row.typeLabel}
            </span>
          </div>
          <p className="text-[14px] font-medium leading-snug line-clamp-2">{row.title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
            {row.reason}
          </p>
          {row.meta || occurredLabel ? (
            <div className="label-meta mt-1.5">
              {[row.meta, occurredLabel].filter(Boolean).join(" · ")}
            </div>
          ) : null}
        </div>
        {row.href || row.selection ? (
          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-meta group-hover:text-cyan transition-colors"
            strokeWidth={1.5}
          />
        ) : null}
      </div>
    </>
  );

  if (row.selection) {
    return (
      <button
        type="button"
        onClick={() => {
          applyInspectorSelection(selectObject, row.selection);
        }}
        className="ml-material ml-calm group w-full rounded-xl px-4 py-3 text-left hover:bg-white/[0.02]"
      >
        {inner}
      </button>
    );
  }

  if (row.href) {
    return (
      <Link
        href={row.href}
        className="ml-material ml-calm group block rounded-xl px-4 py-3 hover:bg-white/[0.02]"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="ml-material ml-calm rounded-xl px-4 py-3">
      {inner}
    </div>
  );
}

function TodayHeroView({ hero }: { hero: TodayHeroItem }) {
  const { selectObject } = useInspector();
  const occurredLabel = formatDateTime(hero.occurredAt);
  const primaryIsMovement = hero.selection?.tab === "movement";

  const handleHeroActivate = () => {
    if (hero.selection) {
      applyInspectorSelection(selectObject, hero.selection);
    }
  };

  return (
    <div
      className="ml-raised overflow-hidden rounded-2xl ring-1 ring-inset ring-[color-mix(in_oklab,var(--ml-action)_20%,transparent)]"
      role={hero.selection ? "button" : undefined}
      tabIndex={hero.selection ? 0 : undefined}
      onClick={hero.selection ? handleHeroActivate : undefined}
      onKeyDown={
        hero.selection
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleHeroActivate();
              }
            }
          : undefined
      }
    >
      <div
        className="px-5 py-2.5"
        style={{
          backgroundColor: "color-mix(in oklab, var(--ml-action-muted) 50%, transparent)",
        }}
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ml-action-foreground)]">
          {hero.laneLabel} · {hero.typeLabel}
        </span>
      </div>
      <div className="p-5">
        {hero.href && !primaryIsMovement ? (
          <Link
            href={hero.href}
            className="text-lg font-semibold leading-snug hover:text-cyan"
            onClick={(event) => {
              event.stopPropagation();
              if (hero.selection) {
                applyInspectorSelection(selectObject, hero.selection);
              }
            }}
          >
            {clampText(normalizeText(hero.title), 170)}
          </Link>
        ) : (
          <p className="text-lg font-semibold leading-snug text-foreground">
            {clampText(normalizeText(hero.title), 170)}
          </p>
        )}
        {hero.whyItMatters ? (
          <p className="mt-1 text-[12px] text-cyan/80">{hero.whyItMatters}</p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {clampText(normalizeText(hero.summary), 220)}
        </p>
        {hero.movement ? (
          <div className="mt-4">
            <PublicLinkedObjectContinuity
              objectType={hero.movement.affectedObjectType}
              objectId={hero.movement.affectedObjectId}
              href={hero.movement.affectedObjectHref}
              context="model_update"
            />
          </div>
        ) : hero.meta ? (
          <div className="label-meta mt-3">{hero.meta}</div>
        ) : null}
        {occurredLabel ? (
          <div className="label-meta mt-2">Recorded {occurredLabel}</div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {hero.selection?.tab === "movement" ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                applyInspectorSelection(selectObject, hero.selection);
              }}
              className="ml-calm inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-[var(--ml-action-foreground)]"
              style={{
                backgroundColor: "color-mix(in oklab, var(--ml-action) 92%, transparent)",
              }}
            >
              <GitCompareArrows className="size-4" aria-hidden />
              See movement
            </button>
          ) : hero.selection ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                applyInspectorSelection(selectObject, hero.selection);
              }}
              className="ml-calm inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-[var(--ml-action-foreground)]"
              style={{
                backgroundColor: "color-mix(in oklab, var(--ml-action) 92%, transparent)",
              }}
            >
              Open in Inspector
            </button>
          ) : null}
          {hero.affectedObjectHref ? (
            <Link
              href={hero.affectedObjectHref}
              className="ml-calm ml-material inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
              onClick={(event) => {
                event.stopPropagation();
                const parsed = parseSelectableObjectFromHref(hero.affectedObjectHref);
                if (parsed) {
                  selectObject({
                    ...parsed,
                    title: hero.title,
                    sourceSurface: "today",
                    tab: "evidence",
                  });
                }
              }}
            >
              Open object
            </Link>
          ) : hero.href && !hero.selection ? (
            <Link
              href={hero.href}
              className="ml-calm ml-material inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
              onClick={(event) => event.stopPropagation()}
            >
              Continue
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TodayMovementRow({ item }: { item: TodayIntelligenceUpdateItem }) {
  const { selectObject } = useInspector();

  return (
    <button
      type="button"
      onClick={() => {
        selectObject({
          objectType: "model_update",
          objectId: item.id,
          modelUpdateId: item.id,
          title: `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`,
          sourceSurface: "today",
          tab: "movement",
        });
      }}
      className="ml-material ml-calm w-full rounded-xl px-4 py-3.5 text-left hover:bg-white/[0.02]"
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-cyan/75">
        {item.updateTypeLabel}
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_75%)] line-clamp-3">
        {item.userFacingSummary}
      </p>
      <div className="mt-2 border-t ml-hairline pt-2">
        <PublicLinkedObjectContinuity
          objectType={item.affectedObjectType}
          objectId={item.affectedObjectId}
          href={item.affectedObjectHref}
          context="model_update"
        />
      </div>
    </button>
  );
}

function TodayReceiptRow({ card }: { card: TodaySurfacingCard }) {
  const { selectObject } = useInspector();
  const selectable = parseSelectableObjectFromHref(card.detailHref);

  if (selectable) {
    return (
      <button
        type="button"
        onClick={() => {
          selectObject({
            ...selectable,
            title: card.title,
            sourceSurface: "today",
            tab: "evidence",
          });
        }}
        className="ml-calm flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-white/[0.04]"
      >
        <Receipt className="size-3.5 text-cyan/70" aria-hidden />
        <span className="line-clamp-1">{card.title}</span>
      </button>
    );
  }

  if (card.receiptHref) {
    return (
      <Link
        href={card.receiptHref}
        className="ml-calm flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.04]"
      >
        <Receipt className="size-3.5 text-cyan/70" aria-hidden />
        <span className="line-clamp-1">{card.title}</span>
      </Link>
    );
  }

  return null;
}

export default function Today() {
  const router = useRouter();
  const [captureText, setCaptureText] = useState("");
  const [captureMessage, setCaptureMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const captureTextareaRef = useRef<HTMLTextAreaElement>(null);

  const voice = useVoiceInput();

  useEffect(() => {
    if (voice.transcript && voice.state === "idle") {
      setCaptureText((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${voice.transcript}` : voice.transcript;
      });
    }
  }, [voice.transcript, voice.state]);

  useEffect(() => {
    if (voice.state === "recording" && captureTextareaRef.current) {
      captureTextareaRef.current.scrollTop = captureTextareaRef.current.scrollHeight;
    }
  }, [voice.interimTranscript, voice.state]);

  const [snapshot, setSnapshot] = useState<TodayReentrySnapshot>(EMPTY_SNAPSHOT);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);

  const trimmedCaptureText = captureText.trim();

  const dateStr = useMemo(() => {
    const today = new Date();
    return DISPLAY_DATE.format(today).replace(",", "");
  }, []);

  const hero = useMemo(() => pickTodayHeroItem(snapshot), [snapshot]);
  const attentionRows = useMemo(
    () => buildTodayAttentionRows(snapshot, hero),
    [snapshot, hero]
  );

  const briefingTitle = useMemo(() => buildTodayBriefingTitle(snapshot), [snapshot]);
  const briefingMeta = useMemo(
    () => buildTodayBriefingMeta(snapshot, isLoadingSnapshot),
    [snapshot, isLoadingSnapshot]
  );

  const receiptCards = snapshot.surfacingCards.filter((card) => card.receiptHref);
  const openLoopCount =
    snapshot.investigations.length +
    snapshot.actions.filter((action) => action.status === "not_started").length;

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      setIsLoadingSnapshot(true);

      try {
        const data = await fetchTodayReentrySnapshot();
        if (!cancelled) {
          setSnapshot(data);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSnapshot(false);
        }
      }
    };

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleSaveCapture() {
    if (!trimmedCaptureText) {
      return;
    }

    try {
      window.sessionStorage.setItem("mindlabs:today-capture-handoff", trimmedCaptureText);
    } catch {
      // Ignore storage failures
    }
    router.push("/journal-chat");
  }

  return (
    <div className="animate-fade-in px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <PageHeader eyebrow={dateStr} title={briefingTitle} meta={briefingMeta} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-5">
            {hero && !isLoadingSnapshot ? (
              <TodayHeroView hero={hero} />
            ) : isLoadingSnapshot ? (
              <div className="ml-material rounded-2xl p-5 text-[13px] text-muted-foreground">
                {TODAY_INTELLIGENCE_LOADING_COPY}
              </div>
            ) : (
              <div className="ml-material rounded-2xl p-5 text-[13px] text-muted-foreground">
                {TODAY_INTELLIGENCE_EMPTY_COPY}
              </div>
            )}

            <section className="ml-material rounded-2xl p-5">
              <SectionLabel>{TODAY_ATTENTION_SECTION_LABEL}</SectionLabel>
              {isLoadingSnapshot ? (
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {TODAY_INTELLIGENCE_LOADING_COPY}
                </p>
              ) : attentionRows.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {TODAY_ATTENTION_EMPTY_COPY}
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {attentionRows.map((row) => (
                    <TodayAttentionRowView key={row.id} row={row} />
                  ))}
                </div>
              )}
            </section>

            <section className="ml-material rounded-2xl p-5">
              <SectionLabel>Capture</SectionLabel>
              <textarea
                ref={captureTextareaRef}
                rows={3}
                placeholder="What's present right now…"
                value={
                  voice.state === "recording" && voice.interimTranscript
                    ? captureText
                      ? `${captureText}\n${voice.interimTranscript}`
                      : voice.interimTranscript
                    : captureText
                }
                onChange={(event) => {
                  setCaptureText(event.target.value);
                  if (captureMessage) {
                    setCaptureMessage(null);
                  }
                }}
                className="w-full max-h-[200px] resize-none overflow-y-auto border-0 bg-transparent text-[16px] leading-relaxed placeholder:text-meta-deep focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between border-t ml-hairline pt-3">
                <button
                  onClick={() => {
                    void voice.toggle();
                  }}
                  className={`ml-calm flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] ${
                    voice.state === "recording"
                      ? "text-[hsl(12_80%_64%)] bg-[hsl(12_80%_64%/0.1)]"
                      : "text-meta hover:bg-white/[0.05] hover:text-foreground"
                  }`}
                  title="Voice input"
                >
                  {voice.state === "recording" ? (
                    <>
                      <VoiceWaveform active={true} />
                      <span className="ml-1">Recording…</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Voice
                    </>
                  )}
                </button>
                <button
                  onClick={handleSaveCapture}
                  disabled={!trimmedCaptureText}
                  className="ml-calm rounded-lg bg-cyan px-4 py-1.5 text-[12px] font-medium text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Continue
                </button>
              </div>
            </section>

            <section>
              <SectionLabel>Quick check-in</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {checkInStates.map((state) => (
                  <Link
                    key={state.id}
                    href={`/check-ins?state=${todayQuickCheckInMap[state.id]}`}
                    className="ml-calm ml-material flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] hover:bg-white/[0.03]"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: state.color }} />
                    {state.label}
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <aside className="min-w-0 space-y-4">
            <div className="ml-float rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>{TODAY_CHANGES_SUBSECTION_LABEL}</SectionLabel>
                {snapshot.intelligenceUpdates.length > 0 ? (
                  <Link
                    href={TODAY_CHANGES_VIEW_ALL_HREF}
                    className="text-[11px] font-medium text-muted-foreground hover:text-cyan"
                  >
                    View all
                  </Link>
                ) : null}
              </div>
              {isLoadingSnapshot ? (
                <p className="text-[13px] text-muted-foreground">{TODAY_INTELLIGENCE_LOADING_COPY}</p>
              ) : snapshot.intelligenceUpdates.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">{TODAY_CHANGES_EMPTY_COPY}</p>
              ) : (
                <div className="space-y-2.5">
                  {snapshot.intelligenceUpdates.map((item) => (
                    <TodayMovementRow key={`rail-${item.id}`} item={item} />
                  ))}
                </div>
              )}
            </div>

            {snapshot.intelligenceUpdates.length > 0 ? (
              <div className="ml-material rounded-2xl p-4">
                <SectionLabel>{TODAY_REPORT_READY_LABEL}</SectionLabel>
                <Link
                  href={TODAY_CHANGES_VIEW_ALL_HREF}
                  className="ml-calm mt-2 flex items-center justify-between rounded-lg px-2 py-2 text-[13px] hover:bg-white/[0.04]"
                >
                  <span>What changed report</span>
                  <ArrowUpRight className="size-3.5 text-meta" aria-hidden />
                </Link>
              </div>
            ) : null}

            {snapshot.timelineMovements.length > 0 ? (
              <div className="ml-material rounded-2xl p-4">
                <SectionLabel>{TODAY_TIMELINE_MOVEMENT_LABEL}</SectionLabel>
                <ul className="mt-2 space-y-2">
                  {snapshot.timelineMovements.map((item) => (
                    <li key={`timeline-rail-${item.id}`}>
                      <TodayMovementRow item={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {openLoopCount > 0 ? (
              <div className="ml-material rounded-2xl p-4">
                <SectionLabel>{TODAY_OPEN_LOOPS_LABEL}</SectionLabel>
                <ul className="mt-2 space-y-1.5">
                  {snapshot.investigations.slice(0, 3).map((item) => (
                    <li key={`loop-investigation-${item.id}`}>
                      <Link
                        href={`/active-questions/${item.id}`}
                        className="ml-calm block rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.04]"
                      >
                        <span className="line-clamp-1 font-medium">{item.title}</span>
                        <span className="label-meta block">{item.statusLabel}</span>
                      </Link>
                    </li>
                  ))}
                  {snapshot.actions
                    .filter((action) => action.status === "not_started")
                    .slice(0, 3)
                    .map((action) => (
                      <li key={`loop-action-${action.id}`}>
                        <Link
                          href="/actions"
                          className="ml-calm block rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.04]"
                        >
                          <span className="line-clamp-1 font-medium">{action.title}</span>
                          <span className="label-meta block">Not started</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            {receiptCards.length > 0 ? (
              <div className="ml-material rounded-2xl p-4">
                <SectionLabel>Resurfaced receipts</SectionLabel>
                <ul className="space-y-2">
                  {receiptCards.map((card) => (
                    <li key={`receipt-${card.title}`}>
                      <TodayReceiptRow card={card} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
