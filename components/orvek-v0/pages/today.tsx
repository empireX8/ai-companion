"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CircleHelp,
  FileText,
  GitCompareArrows,
  Plus,
  ScrollText,
  Telescope,
  type LucideIcon,
} from "lucide-react";

import type { V0NowRowIcon, V0TodayViewProps } from "@/lib/orvek-adapters/types";

import { useOrvekData } from "@/lib/orvek-v0/data-provider";
import { useOrvekPageHandlers } from "@/lib/orvek-v0/page-handlers";

import { SectionLabel } from "@/components/orvek-v0/primitives";

const ICONS: Record<V0NowRowIcon, LucideIcon> = {
  watch: BellRing,
  fieldwork: Telescope,
  decision: FileText,
  question: CircleHelp,
  movement: GitCompareArrows,
};

const ACTION_ICONS: Record<string, LucideIcon> = {
  "Continue from what changed": ArrowRight,
  "Add what happened": Plus,
  "Review outcome": FileText,
  "Check in on fieldwork": BellRing,
  "Capture new signal": Telescope,
};

export type V0TodayViewHandlers = {
  onHeroInspect: () => void;
  onHeroSeeWhy: () => void;
  onNowRowSelect: (rowId: string) => void;
  onMovementSeeWhy: (movementId: string) => void;
};

export type V0TodayCaptureProps = {
  captureText: string;
  displayText: string;
  isRecording: boolean;
  canContinue: boolean;
  onCaptureChange: (value: string) => void;
  onVoiceToggle: () => void;
  onContinue: () => void;
  voiceSlot?: React.ReactNode;
};

export function V0TodayView({
  data,
  handlers,
  capture,
}: {
  data: V0TodayViewProps;
  handlers: V0TodayViewHandlers;
  capture: V0TodayCaptureProps;
}) {
  const {
    briefingDate,
    briefingTitle,
    briefingMeta,
    isLoading,
    loadingCopy,
    heroEmptyCopy,
    hero,
    primaryActions,
    nowRows,
    nowEmptyCopy,
    movements,
    movementEmptyCopy,
    priorReadEmptyCopy,
    report,
    receipts,
    checkIns,
  } = data;

  return (
    <div className="px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {briefingDate} · since your last visit
        </p>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-tight text-foreground text-balance">
          {briefingTitle}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {briefingMeta}
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {isLoading ? (
              <div className="o-material rounded-2xl p-5 text-[13px] text-muted-foreground">
                {loadingCopy}
              </div>
            ) : hero ? (
              <div className="o-raised overflow-hidden rounded-2xl ring-1 ring-inset ring-action/20">
                <div className="bg-action-muted/50 px-5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-action-foreground">
                    <BellRing className="size-3.5" aria-hidden />
                    Most consequential now · {hero.kicker}
                  </span>
                </div>
                <div className="p-5">
                  <button
                    type="button"
                    onClick={handlers.onHeroInspect}
                    className="text-left"
                  >
                    <h2 className="text-lg font-semibold leading-snug text-foreground text-pretty hover:text-primary">
                      {hero.title}
                    </h2>
                  </button>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {hero.summary}
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-secondary/40 px-3 py-3">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        What changed
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                        {hero.whatChanged}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Linked receipts
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                        {hero.linkedReceipts}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Last evidence
                      </dt>
                      <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                        {hero.lastEvidence}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {hero.primaryAction?.kind === "link" ? (
                      <Link
                        href={hero.primaryAction.href}
                        className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-action px-3.5 py-2 text-sm font-semibold text-action-foreground shadow-[0_1px_2px_-1px_rgba(60,40,10,0.3)] hover:brightness-[1.03] active:scale-[0.98]"
                      >
                        {hero.primaryAction.label}
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    ) : hero.primaryAction?.kind === "inspect" ? (
                      <button
                        type="button"
                        onClick={handlers.onHeroInspect}
                        className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-action px-3.5 py-2 text-sm font-semibold text-action-foreground shadow-[0_1px_2px_-1px_rgba(60,40,10,0.3)] hover:brightness-[1.03] active:scale-[0.98]"
                      >
                        Inspect
                        <ArrowRight className="size-4" aria-hidden />
                      </button>
                    ) : null}
                    {hero.showSeeWhyMoved ? (
                      <button
                        type="button"
                        onClick={handlers.onHeroSeeWhy}
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
                {heroEmptyCopy}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {primaryActions.map((action) => {
                const Icon = ACTION_ICONS[action.label];
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
                {nowEmptyCopy}
              </div>
            ) : (
              <div className="o-material divide-y divide-border overflow-hidden rounded-[10px]">
                {nowRows.map((row) => {
                  const Icon = ICONS[row.icon];
                  const inner = (
                    <>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {row.kicker}
                        </span>
                        <span className="block truncate text-[14px] font-medium text-foreground">
                          {row.title}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-action-muted px-2 py-0.5 text-[11px] font-medium text-action-foreground ring-1 ring-inset ring-action/15">
                        {row.status}
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
                        row.hasSelection ? handlers.onNowRowSelect(row.id) : undefined
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
                {movementEmptyCopy}
              </div>
            ) : (
              <div className="space-y-2.5">
                {movements.map((m) => (
                  <div key={m.id} className="o-material rounded-[10px] p-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                      <div className="rounded-[10px] bg-muted/70 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Previously
                        </p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                          {m.previous ?? priorReadEmptyCopy}
                        </p>
                      </div>
                      <div className="hidden items-center justify-center sm:flex">
                        <ArrowRight className="size-4 text-primary" aria-hidden />
                      </div>
                      <div className="rounded-[10px] bg-evidence-muted/70 px-3 py-2 ring-1 ring-inset ring-primary/15">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Updated understanding
                        </p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">
                          {m.updated}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-3">
                      <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                        <ScrollText className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                        {m.evidence}
                      </p>
                      <button
                        type="button"
                        onClick={() => handlers.onMovementSeeWhy(m.id)}
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
          </div>

          <aside className="min-w-0 lg:sticky lg:top-2 lg:self-start">
            {report ? (
              <Link
                href={report.href}
                className="o-calm flex w-full items-center gap-3 rounded-2xl bg-evidence-muted/60 px-4 py-3 text-left ring-1 ring-inset ring-primary/15 hover:bg-evidence-muted"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                  <FileText className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-foreground">
                    {report.title}
                  </span>
                  <span className="block text-[12px] text-muted-foreground">{report.meta}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
              </Link>
            ) : (
              <div className="o-material rounded-2xl px-4 py-3 text-[12px] text-muted-foreground">
                No movement report ready in this window.
              </div>
            )}

            <div className="mb-2 mt-7 flex items-center gap-1.5">
              <ScrollText className="size-3.5 text-primary" aria-hidden />
              <SectionLabel>Receipts resurfaced</SectionLabel>
            </div>
            {receipts.length === 0 ? (
              <div className="o-material rounded-[10px] p-4 text-[13px] text-muted-foreground">
                No receipts resurfaced in this window.
              </div>
            ) : (
              <div className="o-material space-y-px overflow-hidden rounded-[10px]">
                {receipts.map((card) => (
                  <Link
                    key={card.id}
                    href={card.href}
                    className="o-calm flex w-full items-start gap-3 border-l-2 border-primary/50 px-4 py-2.5 text-left hover:bg-accent/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] italic leading-relaxed text-foreground">
                        “{card.quote}”
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {card.meta}
                      </span>
                    </span>
                    <ArrowRight
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                ))}
              </div>
            )}

            <SectionLabel className="mb-2 mt-7">Capture</SectionLabel>
            <div className="o-material rounded-2xl p-4">
              <textarea
                rows={3}
                placeholder="What's present right now…"
                value={capture.displayText}
                onChange={(event) => capture.onCaptureChange(event.target.value)}
                className="w-full max-h-[200px] resize-none overflow-y-auto border-0 bg-transparent text-[16px] leading-relaxed placeholder:text-muted-foreground focus:outline-none"
              />
              <div className="mt-3 flex items-center justify-between border-t o-hairline pt-3">
                <button
                  type="button"
                  onClick={capture.onVoiceToggle}
                  className={
                    capture.isRecording
                      ? "o-calm flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] bg-destructive/10 text-destructive"
                      : "o-calm flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                  }
                >
                  {capture.voiceSlot}
                </button>
                <button
                  type="button"
                  onClick={capture.onContinue}
                  disabled={!capture.canContinue}
                  className="o-calm rounded-lg bg-action px-4 py-1.5 text-[12px] font-medium text-action-foreground hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Continue
                </button>
              </div>
            </div>

            <SectionLabel className="mb-2 mt-6">Quick check-in</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {checkIns.map((state) => (
                <Link
                  key={state.id}
                  href={state.href}
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
          </aside>
        </div>
      </div>
    </div>
  );
}

export function TodayPage() {
  const { today } = useOrvekData();
  const pageHandlers = useOrvekPageHandlers().today;

  if (!today || !pageHandlers) {
    return (
      <div className="px-6 py-7" data-testid="orvek-v0-today-page">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <V0TodayView
      data={today}
      handlers={pageHandlers}
      capture={pageHandlers.capture}
    />
  );
}
