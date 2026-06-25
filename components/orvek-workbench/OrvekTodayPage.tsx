"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CircleHelp,
  FileText,
  GitCompareArrows,
  Mic,
  Plus,
  ScrollText,
  Telescope,
  type LucideIcon,
} from "lucide-react";

import { VoiceWaveform } from "@/components/VoiceWaveform";
import { useVoiceInput } from "@/hooks/use-voice-input";
import {
  TODAY_CHANGES_VIEW_ALL_HREF,
  type TodayIntelligenceUpdateItem,
} from "@/lib/today-intelligence-updates";
import { TODAY_INTELLIGENCE_LOADING_COPY } from "@/lib/today-surface";
import {
  buildTodayAttentionRows,
  buildTodayBriefingMeta,
  buildTodayBriefingTitle,
  buildTodayChangeRows,
  buildTodayFieldworkRows,
  buildTodayOpenLoopRows,
  buildTodayReceiptCards,
  fetchTodayReentrySnapshot,
  pickTodayHeroItem,
  type TodayAttentionRow,
  type TodayHeroItem,
  type TodayReentrySnapshot,
  type TodaySelectableTarget,
} from "@/lib/today-reentry";
import { cn } from "@/lib/utils";

import { SectionLabel } from "./OrvekPrimitives";
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

const PRIMARY_ACTIONS: { label: string; href: string; primary?: boolean; icon?: LucideIcon }[] = [
  { label: "Continue from what changed", href: "/what-changed", primary: true, icon: ArrowRight },
  { label: "Add what happened", href: "/journal-chat", icon: Plus },
  { label: "Review outcome", href: "/actions", icon: FileText },
  { label: "Check in on fieldwork", href: "/watch-for", icon: BellRing },
  { label: "Capture new signal", href: "/journal-chat", icon: Telescope },
];

const checkInStates = [
  { id: "calm", label: "Calm", color: "oklch(0.72 0.05 220)" },
  { id: "anxious", label: "Anxious", color: "oklch(0.78 0.12 72)" },
  { id: "tense", label: "Tense", color: "oklch(0.62 0.16 25)" },
  { id: "overwhelmed", label: "Overwhelmed", color: "oklch(0.55 0.03 250)" },
  { id: "numb", label: "Numb", color: "oklch(0.66 0.006 250)" },
] as const;

const todayQuickCheckInMap: Record<(typeof checkInStates)[number]["id"], string> = {
  calm: "stable",
  anxious: "stressed",
  tense: "overloaded",
  overwhelmed: "overloaded",
  numb: "flat",
};

function rowIcon(row: TodayAttentionRow): LucideIcon {
  const lane = row.laneLabel.toLowerCase();
  if (lane.includes("watch") || lane.includes("fieldwork")) return BellRing;
  if (lane.includes("decision")) return FileText;
  if (lane.includes("question") || lane.includes("investigation")) return CircleHelp;
  if (lane.includes("movement") || lane.includes("model")) return GitCompareArrows;
  return BellRing;
}

function formatRelativeTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

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
  const captureTextareaRef = useRef<HTMLTextAreaElement>(null);
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

  const hero = useMemo(() => pickTodayHeroItem(snapshot), [snapshot]);
  const attentionRows = useMemo(
    () => buildTodayAttentionRows(snapshot, hero),
    [snapshot, hero]
  );
  const fieldworkRows = useMemo(
    () => buildTodayFieldworkRows(snapshot, hero),
    [snapshot, hero]
  );
  const openLoopRows = useMemo(() => buildTodayOpenLoopRows(snapshot), [snapshot]);
  const changeRows = useMemo(() => buildTodayChangeRows(snapshot, hero), [snapshot, hero]);
  const receiptCards = useMemo(() => buildTodayReceiptCards(snapshot), [snapshot]);
  const nowRows = useMemo(
    () => [...attentionRows, ...fieldworkRows, ...openLoopRows].slice(0, 6),
    [attentionRows, fieldworkRows, openLoopRows]
  );
  const movements = useMemo(
    () => (hero?.movement ? [hero.movement, ...changeRows] : changeRows).slice(0, 3),
    [hero, changeRows]
  );
  const hasReportReady = snapshot.intelligenceUpdates.length > 0;
  const briefingTitle = buildTodayBriefingTitle(snapshot);
  const briefingMeta = buildTodayBriefingMeta(snapshot, isLoadingSnapshot);
  const trimmedCaptureText = captureText.trim();

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

  function seeWhyHero(heroItem: TodayHeroItem) {
    if (heroItem.selection) {
      applySelection(select, setInspectorTab, heroItem.selection, "movement");
      return;
    }
    if (heroItem.movement) {
      seeWhyMovement(heroItem.movement);
    }
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

  return (
    <div className="px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {DISPLAY_DATE} · since your last visit
        </p>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-tight text-foreground text-balance">
          {isLoadingSnapshot ? TODAY_INTELLIGENCE_LOADING_COPY : briefingTitle}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {briefingMeta}
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {isLoadingSnapshot ? (
              <div className="o-material rounded-2xl p-5 text-[13px] text-muted-foreground">
                {TODAY_INTELLIGENCE_LOADING_COPY}
              </div>
            ) : hero ? (
              <div className="o-raised overflow-hidden rounded-2xl ring-1 ring-inset ring-action/20">
                <div className="bg-action-muted/50 px-5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-action-foreground">
                    <BellRing className="size-3.5" aria-hidden />
                    Most consequential now · {hero.laneLabel}
                  </span>
                </div>
                <div className="p-5">
                  {hero.selection ? (
                    <button
                      type="button"
                      onClick={() => applySelection(select, setInspectorTab, hero.selection)}
                      className="text-left"
                    >
                      <h2 className="text-lg font-semibold leading-snug text-foreground text-pretty hover:text-primary">
                        {hero.title}
                      </h2>
                    </button>
                  ) : hero.href ? (
                    <Link href={hero.href} className="block">
                      <h2 className="text-lg font-semibold leading-snug text-foreground text-pretty hover:text-primary">
                        {hero.title}
                      </h2>
                    </Link>
                  ) : (
                    <h2 className="text-lg font-semibold leading-snug text-foreground text-pretty">
                      {hero.title}
                    </h2>
                  )}
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {hero.summary || hero.whyItMatters}
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-secondary/40 px-3 py-3">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        What changed
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                        {hero.typeLabel}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Linked signal
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                        {hero.meta ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Last evidence
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                        {formatRelativeTime(hero.occurredAt)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {hero.href ? (
                      <Link
                        href={hero.href}
                        className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-action px-3.5 py-2 text-sm font-semibold text-action-foreground shadow-[0_1px_2px_-1px_rgba(60,40,10,0.3)] hover:brightness-[1.03] active:scale-[0.98]"
                      >
                        Open
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    ) : hero.selection ? (
                      <button
                        type="button"
                        onClick={() => applySelection(select, setInspectorTab, hero.selection)}
                        className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-action px-3.5 py-2 text-sm font-semibold text-action-foreground shadow-[0_1px_2px_-1px_rgba(60,40,10,0.3)] hover:brightness-[1.03] active:scale-[0.98]"
                      >
                        Inspect
                        <ArrowRight className="size-4" aria-hidden />
                      </button>
                    ) : null}
                    {hero.movement ? (
                      <button
                        type="button"
                        onClick={() => seeWhyHero(hero)}
                        className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-card px-3 py-2 text-sm font-medium text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.14)] hover:bg-accent/60"
                      >
                        <GitCompareArrows className="size-4 text-primary" aria-hidden />
                        See why it moved
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="o-material rounded-2xl p-5 text-[13px] text-muted-foreground">
                Nothing consequential right now.
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {PRIMARY_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className={
                      action.primary
                        ? "o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:brightness-[1.05]"
                        : "o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-accent/60"
                    }
                  >
                    {Icon ? (
                      <Icon
                        className={action.primary ? "size-3.5" : "size-3.5 text-primary"}
                        aria-hidden
                      />
                    ) : null}
                    {action.label}
                  </Link>
                );
              })}
            </div>

            <SectionLabel className="mb-2 mt-8">Now</SectionLabel>
            {nowRows.length === 0 ? (
              <div className="o-material rounded-[10px] p-4 text-[13px] text-muted-foreground">
                Nothing needs attention right now.
              </div>
            ) : (
              <div className="o-material divide-y divide-border overflow-hidden rounded-[10px]">
                {nowRows.map((row) => {
                  const Icon = rowIcon(row);
                  const inner = (
                    <>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {row.laneLabel}
                        </span>
                        <span className="block truncate text-[14px] font-medium text-foreground">
                          {row.title}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-action-muted px-2 py-0.5 text-[11px] font-medium text-action-foreground ring-1 ring-inset ring-action/15">
                        {row.meta ?? row.typeLabel}
                      </span>
                      <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                        aria-hidden
                      />
                    </>
                  );
                  if (row.href) {
                    return (
                      <Link
                        key={row.id}
                        href={row.href}
                        className="o-calm group flex w-full items-center gap-3.5 px-4 py-3 text-left hover:bg-accent/40"
                      >
                        {inner}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() =>
                        row.selection
                          ? applySelection(select, setInspectorTab, row.selection)
                          : undefined
                      }
                      className="o-calm group flex w-full items-center gap-3.5 px-4 py-3 text-left hover:bg-accent/40"
                    >
                      {inner}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mb-2 mt-8 flex items-center gap-1.5">
              <GitCompareArrows className="size-3.5 text-primary" aria-hidden />
              <SectionLabel>Recent model movement</SectionLabel>
            </div>
            {movements.length === 0 ? (
              <div className="o-material rounded-[10px] p-4 text-[13px] text-muted-foreground">
                No recent movement in this window.
              </div>
            ) : (
              <div className="space-y-2.5">
                {movements.map((m) => (
                  <div key={m.id} className="o-material rounded-[10px] p-4">
                    <div className="rounded-[10px] bg-evidence-muted/70 px-3 py-2 ring-1 ring-inset ring-primary/15">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Updated understanding
                      </p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                        {m.userFacingSummary}
                      </p>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-3">
                      <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                        <ScrollText className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                        {m.updateTypeLabel} · {m.affectedObjectTypeLabel}
                      </p>
                      <button
                        type="button"
                        onClick={() => seeWhyMovement(m)}
                        className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                      >
                        See why
                        <ArrowUpRight className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <SectionLabel className="mb-2 mt-8">Capture</SectionLabel>
            <div className="o-material rounded-2xl p-4">
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
                onChange={(event) => setCaptureText(event.target.value)}
                className="w-full max-h-[200px] resize-none overflow-y-auto border-0 bg-transparent text-[16px] leading-relaxed placeholder:text-muted-foreground focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between border-t o-hairline pt-3">
                <button
                  type="button"
                  onClick={() => void voice.toggle()}
                  className={cn(
                    "o-calm flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px]",
                    voice.state === "recording"
                      ? "bg-destructive/10 text-destructive"
                      : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                  )}
                >
                  {voice.state === "recording" ? (
                    <>
                      <VoiceWaveform active />
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
                  type="button"
                  onClick={handleSaveCapture}
                  disabled={!trimmedCaptureText}
                  className="o-calm rounded-lg bg-action px-4 py-1.5 text-[12px] font-medium text-action-foreground hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Continue
                </button>
              </div>
            </div>

            <SectionLabel className="mb-2 mt-6">Quick check-in</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {checkInStates.map((state) => (
                <Link
                  key={state.id}
                  href={`/check-ins?state=${todayQuickCheckInMap[state.id]}`}
                  className="o-calm o-material flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] hover:bg-white/[0.03]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: state.color }}
                  />
                  {state.label}
                </Link>
              ))}
            </div>
          </div>

          <aside className="min-w-0 lg:sticky lg:top-2 lg:self-start">
            {hasReportReady ? (
              <Link
                href={TODAY_CHANGES_VIEW_ALL_HREF}
                className="o-calm flex w-full items-center gap-3 rounded-2xl bg-evidence-muted/60 px-4 py-3 text-left ring-1 ring-inset ring-primary/15 hover:bg-evidence-muted"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <FileText className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-foreground">
                    What Changed report
                  </span>
                  <span className="block text-[12px] text-muted-foreground">
                    Ready · {snapshot.intelligenceUpdates.length} movement
                    {snapshot.intelligenceUpdates.length === 1 ? "" : "s"}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
              </Link>
            ) : null}

            {receiptCards.length > 0 ? (
              <>
                <div className="mb-2 mt-7 flex items-center gap-1.5">
                  <ScrollText className="size-3.5 text-primary" aria-hidden />
                  <SectionLabel>Receipts resurfaced</SectionLabel>
                </div>
                <div className="o-material space-y-px overflow-hidden rounded-[10px]">
                  {receiptCards.map((card) => (
                    <Link
                      key={card.title}
                      href={card.receiptHref ?? card.detailHref ?? "#"}
                      className="o-calm flex w-full items-start gap-3 border-l-2 border-primary/50 px-4 py-2.5 text-left hover:bg-accent/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] italic leading-relaxed text-foreground">
                          “{card.body}”
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {card.kind} · {card.meta ?? "Receipt"}
                        </span>
                      </span>
                      <ArrowRight
                        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </Link>
                  ))}
                </div>
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
