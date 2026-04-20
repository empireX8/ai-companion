"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ChevronDown, ChevronRight } from "lucide-react";

import {
  QUICK_CHECK_IN_EVENT_LABELS,
  QUICK_CHECK_IN_STATE_LABELS,
  type QuickCheckInView,
  formatQuickCheckInTimestamp,
} from "@/lib/quick-check-ins";
import {
  TIMELINE_WINDOWS,
  TIMELINE_DEFAULT_WINDOW,
  computeRhythms,
  computeRepeatedSignals,
  computeImportedConversationSummary,
  groupCheckInsByDate,
  groupImportedConversationActivityByDate,
  type ImportedConversationActivityItem,
  type ImportedConversationDateGroup,
  type TimelineWindow,
} from "@/lib/timeline-aggregation";
import {
  computeTimelineLinks,
  type TimelineLink,
} from "@/lib/timeline-links";
import { cn } from "@/lib/utils";

// ── Fetch ──────────────────────────────────────────────────────────────────────

type TimelinePayload = {
  checkIns: QuickCheckInView[];
  importedActivity: ImportedConversationActivityItem[];
};

async function fetchTimeline(window: TimelineWindow): Promise<TimelinePayload> {
  const response = await fetch(`/api/timeline?window=${window}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return {
      checkIns: [],
      importedActivity: [],
    };
  }
  const data = (await response.json()) as Partial<TimelinePayload>;
  return {
    checkIns: data.checkIns ?? [],
    importedActivity: data.importedActivity ?? [],
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function WindowSelector({
  value,
  onChange,
}: {
  value: TimelineWindow;
  onChange: (w: TimelineWindow) => void;
}) {
  const LABELS: Record<TimelineWindow, string> = {
    "14d": "14 days",
    "30d": "30 days",
    "90d": "90 days",
  };

  return (
    <div className="flex gap-1 rounded-lg border border-border/40 bg-muted/30 p-0.5">
      {TIMELINE_WINDOWS.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onChange(w)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === w
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {LABELS[w]}
        </button>
      ))}
    </div>
  );
}

function TagPill({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "emphasis";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
        variant === "emphasis"
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-border/50 bg-muted/40 text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}

function formatSignalDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "recently";
  const now = new Date();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

function SignalRow({
  children,
  count,
  lastSeenAt,
}: {
  children: React.ReactNode;
  count: number;
  lastSeenAt?: string;
}) {
  const supportText = `${count} check-in${count !== 1 ? "s" : ""}${
    lastSeenAt ? ` · Last ${formatSignalDate(lastSeenAt)}` : ""
  }`;

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
      <span className="shrink-0 text-[11px] text-muted-foreground">{supportText}</span>
    </div>
  );
}

function formatConversationTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatConversationCount(count: number): string {
  return `${count} conversation${count !== 1 ? "s" : ""}`;
}

function formatMessageCount(count: number): string {
  return `${count} message${count !== 1 ? "s" : ""}`;
}

function formatConversationActivityDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const activityDay = new Date(d);
  activityDay.setHours(0, 0, 0, 0);

  if (activityDay.getTime() === today.getTime()) return "Today";
  if (activityDay.getTime() === yesterday.getTime()) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

function formatConversationActivityPreview(
  groups: ImportedConversationDateGroup[]
): string | null {
  if (groups.length === 0) return null;

  const labels = groups.slice(0, 3).map((group) => group.label);
  const prefix = labels.length === 1 ? "Recent day" : "Recent days";

  return `${prefix}: ${labels.join(" · ")}`;
}

function getConversationActivityTitle(item: ImportedConversationActivityItem): string {
  const label = item.label?.trim() ?? "";
  if (label && !/^Imported conversation \d+$/i.test(label)) {
    return label;
  }

  const preview = item.preview?.trim() ?? "";
  if (preview.length > 0) {
    return preview;
  }

  return "Conversation";
}

// ── Possible links — sentence formatters ─────────────────────────────────────

function formatLinkPrimaryText(link: TimelineLink): string {
  if (link.kind === "event_state") {
    const eventLabel = QUICK_CHECK_IN_EVENT_LABELS[link.eventTag];
    const stateLabel = QUICK_CHECK_IN_STATE_LABELS[link.stateTag];
    const qualifier =
      link.count >= 3 ? "often appears near" : "sometimes appears near";
    return `${eventLabel} ${qualifier} ${stateLabel}`;
  }
  const fromLabel = QUICK_CHECK_IN_STATE_LABELS[link.fromState];
  const toLabel = QUICK_CHECK_IN_STATE_LABELS[link.toState];
  return `${fromLabel} → ${toLabel}`;
}

function formatLinkSupportText(link: TimelineLink): string {
  const n = link.count;
  return `Seen ${n} time${n !== 1 ? "s" : ""} · Last ${formatSignalDate(link.lastSeenAt)}`;
}

// ── Main surface ───────────────────────────────────────────────────────────────

export function TimelineSurface({
  initialWindow = TIMELINE_DEFAULT_WINDOW,
}: {
  initialWindow?: TimelineWindow;
}) {
  const [window, setWindow] = useState<TimelineWindow>(initialWindow);
  const [conversationActivityOpen, setConversationActivityOpen] = useState(false);
  const [checkIns, setCheckIns] = useState<QuickCheckInView[]>([]);
  const [importedActivity, setImportedActivity] = useState<
    ImportedConversationActivityItem[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void fetchTimeline(window)
      .then((data) => {
        if (active) {
          setCheckIns(data.checkIns);
          setImportedActivity(data.importedActivity);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [window]);

  const rhythms = computeRhythms(checkIns);
  const repeated = computeRepeatedSignals(checkIns);
  const { links } = computeTimelineLinks(checkIns);
  const groups = groupCheckInsByDate(checkIns, new Date());
  const importedSummary = computeImportedConversationSummary(importedActivity);
  const importedGroups = groupImportedConversationActivityByDate(
    importedActivity,
    new Date()
  );
  const importedLatestDayLabel = importedSummary.lastActivityAt
    ? formatConversationActivityDay(importedSummary.lastActivityAt)
    : null;

  const hasAnyRepeated = repeated.rankedItems.length > 0;
  const hasImportedActivity = importedSummary.sessionCount > 0;
  const importedPreviewLine =
    hasImportedActivity ? formatConversationActivityPreview(importedGroups) : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h1 className="text-base font-semibold text-foreground">Timeline</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Review check-in signals first, with imported activity shown separately.
            </p>
          </div>
          <WindowSelector value={window} onChange={setWindow} />
        </div>

        {/* Recent Rhythms */}
        <section className="rounded-lg border border-border/40 bg-card px-4 py-4 space-y-2">
          <div className="space-y-0.5">
            <h2 className="text-sm font-medium text-foreground">Recent rhythms</h2>
            <p className="text-xs text-muted-foreground">
              Check-ins in this window, with imported activity listed below.
            </p>
          </div>

          {loading ? (
            <div className="space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted/50" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted/50" />
            </div>
          ) : rhythms.totalCount === 0 && !hasImportedActivity ? (
            <p className="text-xs text-muted-foreground">
              No check-ins in this window.{" "}
              <Link
                href="/check-ins"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Add one
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-3">
              {rhythms.totalCount === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No check-ins in this window yet.{" "}
                  <Link
                    href="/check-ins"
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Add one
                  </Link>
                  .
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {rhythms.totalCount} check-in{rhythms.totalCount !== 1 ? "s" : ""} recorded
                  {rhythms.lastCheckInAt
                    ? ` · Last: ${formatQuickCheckInTimestamp(rhythms.lastCheckInAt)}`
                    : ""}
                </p>
              )}

              {hasImportedActivity && (
                <p className="text-[10px] text-muted-foreground/55">
                  Imported activity: {importedSummary.activeDayCount} active day
                  {importedSummary.activeDayCount !== 1 ? "s" : ""} ·{" "}
                  {formatConversationCount(importedSummary.sessionCount)} ·{" "}
                  {formatMessageCount(importedSummary.messageCount)} logged
                </p>
              )}

              {rhythms.topStateTags.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    States
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rhythms.topStateTags.map(({ tag, count }) => (
                      <span key={tag} className="flex items-center gap-1">
                        <TagPill label={QUICK_CHECK_IN_STATE_LABELS[tag]} variant="emphasis" />
                        <span className="text-[11px] text-muted-foreground">{count}×</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {rhythms.topEventTags.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    Events
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rhythms.topEventTags.map(({ tag, count }) => (
                      <span key={tag} className="flex items-center gap-1">
                        <TagPill label={QUICK_CHECK_IN_EVENT_LABELS[tag]} />
                        <span className="text-[11px] text-muted-foreground">{count}×</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Possible links — event/state proximity and state transitions */}
        <section className="rounded-lg border border-border/40 bg-card px-4 py-4 space-y-2">
          <div className="space-y-0.5">
            <h2 className="text-sm font-medium text-foreground">Possible links</h2>
            <p className="text-xs text-muted-foreground">
              Repeated event/state proximity and state shifts from your{" "}
              <Link href="/check-ins" className="text-primary/70 underline-offset-2 hover:text-primary hover:underline">
                check-ins
              </Link>{" "}
              in this window.
            </p>
          </div>

          {loading ? (
            <div className="space-y-2">
              <div className="h-4 w-2/5 animate-pulse rounded bg-muted/50" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted/50" />
            </div>
          ) : links.length === 0 ? (
            <div>
              <p className="text-xs text-muted-foreground">
                No clear links in this window yet.
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                More check-ins over time make event and state links easier to see.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {links.map((link, i) => (
                <div key={i} className="py-1.5">
                  <p className="text-xs text-foreground">
                    {formatLinkPrimaryText(link)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    {formatLinkSupportText(link)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Repeated Signals — always rendered */}
        <section className="rounded-lg border border-border/40 bg-card px-4 py-4 space-y-2">
          <div className="space-y-0.5">
            <h2 className="text-sm font-medium text-foreground">Repeated signals</h2>
            <p className="text-xs text-muted-foreground">
              Most repeated states, events, and pairings across your{" "}
              <Link href="/check-ins" className="text-primary/70 underline-offset-2 hover:text-primary hover:underline">
                check-ins
              </Link>{" "}
              in this window.
            </p>
          </div>

          {loading ? (
            <div className="space-y-2">
              <div className="h-4 w-2/5 animate-pulse rounded bg-muted/50" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted/50" />
            </div>
          ) : !hasAnyRepeated ? (
            <div>
              <p className="text-xs text-muted-foreground">No clear repeats in this window yet.</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Add more check-ins over time to make repeats easier to spot.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {repeated.rankedItems.map((item) => {
                if (item.kind === "state") {
                  return (
                    <SignalRow
                      key={`state-${item.tag}`}
                      count={item.count}
                      lastSeenAt={item.lastSeenAt}
                    >
                      <TagPill label={QUICK_CHECK_IN_STATE_LABELS[item.tag]} variant="emphasis" />
                    </SignalRow>
                  );
                }
                if (item.kind === "event") {
                  const isStrong = item.count >= 3;
                  return (
                    <SignalRow
                      key={`event-${item.tag}`}
                      count={item.count}
                      lastSeenAt={item.lastSeenAt}
                    >
                      <TagPill
                        label={QUICK_CHECK_IN_EVENT_LABELS[item.tag]}
                        variant={isStrong ? "emphasis" : "default"}
                      />
                    </SignalRow>
                  );
                }
                const isStrong = item.count >= 3;
                return (
                  <SignalRow
                    key={`pair-${item.stateTag}-${item.eventTag}`}
                    count={item.count}
                    lastSeenAt={item.lastSeenAt}
                  >
                    <TagPill label={QUICK_CHECK_IN_STATE_LABELS[item.stateTag]} variant="emphasis" />
                    <span className="text-[11px] text-muted-foreground/50">+</span>
                    <TagPill
                      label={QUICK_CHECK_IN_EVENT_LABELS[item.eventTag]}
                      variant={isStrong ? "emphasis" : "default"}
                    />
                  </SignalRow>
                );
              })}
            </div>
          )}
        </section>

        {/* Conversation activity — imported chronology only */}
        <section className="space-y-2.5">
          <div className="space-y-0.5">
            <h2 className="text-sm font-medium text-foreground">Conversation activity</h2>
            <p className="text-xs text-muted-foreground">
              Imported chronology only, grouped by day in this window.
            </p>
          </div>

          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
                  <div className="h-20 animate-pulse rounded-lg bg-muted/50" />
                </div>
              ))}
            </div>
          )}

          {!loading && importedGroups.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/40 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No imported conversation activity in this window.
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Imported sessions will appear here when they fall inside the selected range.
              </p>
            </div>
          )}

          {/* Compact summary card — always shown when there is activity */}
          {!loading && hasImportedActivity && (
            <div className="rounded-lg border border-border/40 bg-card px-4 py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  {importedSummary.activeDayCount} active day
                  {importedSummary.activeDayCount !== 1 ? "s" : ""}
                </span>
                <span>{formatConversationCount(importedSummary.sessionCount)}</span>
                <span>{formatMessageCount(importedSummary.messageCount)}</span>
                {importedLatestDayLabel && <span>Latest day: {importedLatestDayLabel}</span>}
              </div>

              {importedPreviewLine && (
                <p className="truncate text-[11px] text-muted-foreground/70">
                  {importedPreviewLine}
                </p>
              )}

              <button
                type="button"
                onClick={() => setConversationActivityOpen((v) => !v)}
                aria-expanded={conversationActivityOpen}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {conversationActivityOpen ? (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>Hide activity</span>
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span>Show activity</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Expanded detail panel — separate container, only when open */}
          {!loading && hasImportedActivity && conversationActivityOpen && (
            <div className="rounded-lg border border-border/40 bg-card px-4 py-4">
              <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
                {importedGroups.map((group) => (
                  <div key={group.dateKey} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-muted-foreground/70">
                        {group.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatConversationCount(group.sessionCount)} ·{" "}
                        {formatMessageCount(group.messageCount)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {group.items.slice(0, 3).map((item) => {
                        const title = getConversationActivityTitle(item);
                        const preview = item.preview?.trim() ?? "";
                        const showPreview = preview.length > 0 && preview !== title;

                        return (
                          <div
                            key={item.id}
                            className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {title}
                                </p>
                                {showPreview && (
                                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                    {preview}
                                  </p>
                                )}
                              </div>
                              <span className="shrink-0 text-[11px] text-muted-foreground/70">
                                {formatConversationTime(item.startedAt)}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {group.items.length > 3 && (
                        <p className="text-[11px] text-muted-foreground/60">
                          +{group.items.length - 3} more imported conversation
                          {group.items.length - 3 !== 1 ? "s" : ""} that day.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Chronological log */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">Check-in log</h2>

          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
                  <div className="h-16 animate-pulse rounded-lg bg-muted/50" />
                </div>
              ))}
            </div>
          )}

          {!loading && groups.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/40 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No check-ins in this window.</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                <Link
                  href="/check-ins"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Add a check-in
                </Link>{" "}
                to start your timeline.
              </p>
            </div>
          )}

          {!loading &&
            groups.map((group) => (
              <div key={group.dateKey} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground/70">{group.label}</p>

                {group.items.map((checkIn) => (
                  <div
                    key={checkIn.id}
                    className="rounded-lg border border-border/40 bg-card px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-1.5">
                        {checkIn.stateTag && (
                          <TagPill
                            label={QUICK_CHECK_IN_STATE_LABELS[checkIn.stateTag]}
                            variant="emphasis"
                          />
                        )}
                        {checkIn.eventTags.map((tag) => (
                          <TagPill
                            key={`${checkIn.id}-${tag}`}
                            label={QUICK_CHECK_IN_EVENT_LABELS[tag]}
                          />
                        ))}
                        {!checkIn.stateTag && checkIn.eventTags.length === 0 && (
                          <span className="text-xs text-muted-foreground/50 italic">Note only</span>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground/70">
                        {formatQuickCheckInTimestamp(checkIn.createdAt)}
                      </span>
                    </div>
                    {checkIn.note && (
                      <p className="mt-2 text-sm text-foreground/90">{checkIn.note}</p>
                    )}
                  </div>
                ))}
              </div>
            ))}
        </section>
      </div>
    </div>
  );
}
