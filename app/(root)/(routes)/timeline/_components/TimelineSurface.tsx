"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, SectionLabel } from "@/components/AppShell";
import { OccurrenceDots } from "@/components/Visuals";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";

import {
  TIMELINE_WINDOWS,
  type TimelineWindow,
} from "@/lib/timeline-aggregation";
import {
  QUICK_CHECK_IN_EVENT_LABELS,
  QUICK_CHECK_IN_STATE_LABELS,
  type QuickCheckInStateTag,
} from "@/lib/quick-check-ins";
import {
  buildTimelineRequestUrl,
  hasEnoughCheckInsForRhythm,
  mapTimelineEntries,
  type TimelineEntry,
  type TimelineResponse,
} from "@/lib/timeline-surface";
import {
  buildTimelineModelLayersRequestUrl,
  type TimelineModelLayerItem,
} from "@/lib/timeline-model-layers";
import { PublicLinkedObjectContinuity } from "../../../../../lib/public-continuity-display";
import { PUBLIC_LINKED_DETAIL_FALLBACK_COPY } from "../../../../../lib/public-continuity-registry";

const STATE_DISPLAY_LABELS: Record<QuickCheckInStateTag, string> = {
  stable: "Calm",
  stressed: "Anxious",
  overloaded: "Overwhelmed",
  flat: "Numb",
  energized: "Energized",
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

function toDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "invalid";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateKey: string, now: Date): string {
  const todayKey = toDateKey(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday.toISOString());

  if (dateKey === todayKey) {
    return "Today";
  }

  if (dateKey === yesterdayKey) {
    return "Yesterday";
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return "Unknown day";
  }

  const parsed = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    ...(parsed.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  }).format(parsed);
}

function formatRecentLabel(iso: string | null): string {
  if (!iso) {
    return "—";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const deltaMs = Math.max(0, Date.now() - date.getTime());
  const deltaMinutes = Math.floor(deltaMs / 60_000);

  if (deltaMinutes < 60) {
    return `${deltaMinutes}m`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 48) {
    return `${deltaHours}h`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `${deltaDays}d`;
}

function stateLabel(stateTag: QuickCheckInStateTag | null): string {
  if (!stateTag) {
    return "Check-in";
  }

  return STATE_DISPLAY_LABELS[stateTag] ?? QUICK_CHECK_IN_STATE_LABELS[stateTag];
}

export default function TimelineSurface() {
  const [windowValue, setWindowValue] = useState<TimelineWindow>("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<TimelineResponse | null>(null);
  const [modelLayers, setModelLayers] = useState<TimelineModelLayerItem[]>([]);
  const [isLoadingModelLayers, setIsLoadingModelLayers] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadTimeline = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(buildTimelineRequestUrl(windowValue), {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not load timeline.");
        }

        const nextPayload = (await response.json()) as TimelineResponse;
        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch (error) {
        if (!cancelled) {
          setPayload(null);
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : "Could not load timeline."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [windowValue]);

  useEffect(() => {
    let cancelled = false;

    const loadModelLayers = async () => {
      setIsLoadingModelLayers(true);

      try {
        const response = await fetch(
          buildTimelineModelLayersRequestUrl(windowValue),
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("Could not load model movement.");
        }

        const nextPayload = (await response.json()) as {
          items?: TimelineModelLayerItem[];
        };
        if (!cancelled) {
          setModelLayers(
            Array.isArray(nextPayload.items) ? nextPayload.items : []
          );
        }
      } catch {
        if (!cancelled) {
          setModelLayers([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingModelLayers(false);
        }
      }
    };

    void loadModelLayers();

    return () => {
      cancelled = true;
    };
  }, [windowValue]);

  const timelineEntries = useMemo(
    () => (payload ? mapTimelineEntries(payload) : []),
    [payload]
  );

  const rhythms = payload?.stateSummary.rhythms ?? null;
  const repeatedSignals = payload?.stateSummary.repeatedSignals ?? null;

  const groupedActivity = useMemo(() => {
    const now = new Date();
    const grouped = new Map<string, TimelineEntry[]>();

    for (const entry of timelineEntries) {
      const key = toDateKey(entry.occurredAt);
      const current = grouped.get(key) ?? [];
      current.push(entry);
      grouped.set(key, current);
    }

    return [...grouped.entries()]
      .sort((left, right) => right[0].localeCompare(left[0]))
      .map(([dateKey, entries]) => ({
        date: formatDateLabel(dateKey, now),
        entries,
      }));
  }, [timelineEntries]);

  const possibleLinks = (repeatedSignals?.repeatedPairs ?? []).slice(0, 4).map((pair) => ({
    event: QUICK_CHECK_IN_EVENT_LABELS[pair.eventTag],
    state: stateLabel(pair.stateTag),
    count: pair.count,
  }));

  const topStateChips = (rhythms?.topStateTags ?? []).map((item) => ({
    label: stateLabel(item.tag),
    count: item.count,
  }));
  const topEventChips = (rhythms?.topEventTags ?? []).map((item) => ({
    label: QUICK_CHECK_IN_EVENT_LABELS[item.tag],
    count: item.count,
  }));
  const totalCheckIns = payload?.stateSummary.totalCheckIns ?? 0;
  const rhythmReady = hasEnoughCheckInsForRhythm(totalCheckIns);
  const checkInDayCount = useMemo(() => {
    const checkIns = payload?.checkIns ?? [];
    const dayKeys = new Set(
      checkIns.map((item) => toDateKey(item.createdAt)).filter((item) => item !== "invalid")
    );
    return dayKeys.size;
  }, [payload?.checkIns]);

  return (
    <div className="px-12 py-10 max-w-[1180px] mx-auto animate-fade-in">
      <PageHeader
        title="Timeline"
        meta="Rhythms, signals, and connected activity"
        right={
          <div className="inline-flex card-standard p-1 rounded-md">
            {TIMELINE_WINDOWS.map((windowKey) => (
              <button
                key={windowKey}
                onClick={() => setWindowValue(windowKey)}
                className={`label-meta px-3 h-7 rounded ${windowValue === windowKey ? "bg-[hsl(187_100%_50%/0.12)] text-cyan" : "text-meta hover:text-white"}`}
              >
                {windowKey}
              </button>
            ))}
          </div>
        }
      />

      <section className="card-focal p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label-meta mb-1">Recent rhythms</div>
            <div className="text-[15px]">Check-in cadence · last {windowValue}</div>
            <div className="label-meta text-meta mt-1">Based on check-ins in this window.</div>
          </div>
          <div className="flex gap-4 text-right">
            <Stat label="Check-in days" value={String(checkInDayCount)} />
            <Stat label="Last check-in" value={formatRecentLabel(rhythms?.lastCheckInAt ?? null)} />
          </div>
        </div>
        {!rhythmReady ? (
          <div className="card-standard p-4 text-[13px] text-meta mt-4">Not enough check-ins to show a rhythm yet.</div>
        ) : (
          <div className="space-y-3 mt-4">
            <div className="flex gap-2 flex-wrap">
              {topStateChips.length > 0 ? (
                topStateChips.map((chip) => (
                  <span key={chip.label} className="label-meta px-2.5 h-6 rounded bg-white/[0.04] inline-flex items-center gap-2">
                    {chip.label} <span className="text-cyan/70">×{chip.count}</span>
                  </span>
                ))
              ) : (
                <span className="label-meta text-meta">No check-ins in this window yet.</span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {topEventChips.length > 0 ? (
                topEventChips.map((chip) => (
                  <span key={chip.label} className="label-meta px-2.5 h-6 rounded bg-white/[0.04] inline-flex items-center gap-2">
                    {chip.label} <span className="text-cyan/70">×{chip.count}</span>
                  </span>
                ))
              ) : (
                <span className="label-meta text-meta">No repeated events in this window yet.</span>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mb-10">
        <SectionLabel>Possible links</SectionLabel>
        <div className="label-meta text-meta mb-3">Based on check-ins in this window.</div>
        <div className="grid grid-cols-2 gap-3">
          {possibleLinks.length > 0 ? (
            possibleLinks.map((link, index) => (
              <div key={`${link.event}-${link.state}-${index}`} className="card-surfaced p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 card-standard px-3 py-2 text-[13px]">{link.event}</div>
                  <ArrowRight className="h-4 w-4 text-cyan" strokeWidth={1.5} />
                  <div className="flex-1 card-standard px-3 py-2 text-[13px]">{link.state}</div>
                </div>
                <div className="label-meta mt-3">Appeared together {link.count} times</div>
              </div>
            ))
          ) : (
            <div className="card-standard p-4 text-[13px] text-meta col-span-2">No recurring state/event links yet.</div>
          )}
        </div>
      </section>

      <section className="mb-10">
        <SectionLabel>Repeated signals</SectionLabel>
        <div className="card-standard divide-y divide-white/[0.05]">
          {(repeatedSignals?.rankedItems ?? []).length > 0 ? (
            (repeatedSignals?.rankedItems ?? []).map((signal, index) => {
              const text = signal.kind === "state"
                ? stateLabel(signal.tag)
                : signal.kind === "event"
                  ? QUICK_CHECK_IN_EVENT_LABELS[signal.tag]
                  : `${stateLabel(signal.stateTag)} + ${QUICK_CHECK_IN_EVENT_LABELS[signal.eventTag]}`;

              const marks = Array.from({ length: Math.min(14, signal.count) }, (_, markIndex) =>
                Math.min(13, markIndex * 2)
              );

              return (
                <div key={`${signal.kind}-${index}`} className="w-full p-4 flex items-center gap-4 text-left">
                  <div className="flex-1 text-[14px]">{text}</div>
                  <OccurrenceDots count={14} marks={marks} />
                  <div className="label-meta w-8 text-right">×{signal.count}</div>
                  <ChevronRight className="h-4 w-4 text-meta" strokeWidth={1.5} />
                </div>
              );
            })
          ) : (
            <div className="p-4 text-[13px] text-meta">No repeated signals in this window yet.</div>
          )}
        </div>
      </section>

      <section>
        <SectionLabel>Connected activity</SectionLabel>
        {isLoading ? (
          <div className="card-standard p-4 text-[13px] text-meta">Loading timeline activity...</div>
        ) : errorMessage ? (
          <div className="card-standard p-4 text-[13px] text-[hsl(12_80%_64%)]">{errorMessage}</div>
        ) : groupedActivity.length === 0 ? (
          <div className="card-standard p-4 text-[13px] text-meta">No activity yet in this window.</div>
        ) : (
          <div className="space-y-6">
            {groupedActivity.map((group) => (
              <div key={group.date}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan glow-cyan" />
                  <div className="label-meta">{group.date}</div>
                </div>
                <div className="ml-[3px] border-l hairline pl-6 space-y-4">
                  {group.entries.map((entry) => (
                    <div key={entry.id} className="relative">
                      <div className="absolute -left-[27px] top-1.5 h-1.5 w-1.5 rounded-full bg-white/20" />
                      <div className={entry.weight === "low" ? "opacity-60" : ""}>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="label-meta">{formatTime(entry.occurredAt)}</span>
                          {entry.href ? (
                            <Link href={entry.href} className="text-[14px] font-medium hover:text-cyan transition-colors">
                              {entry.title}
                            </Link>
                          ) : (
                            <span className="text-[14px] font-medium text-[hsl(216_11%_82%)]">{entry.title}</span>
                          )}
                          <span className="label-meta text-cyan/70 px-2 h-5 rounded bg-[hsl(187_100%_50%/0.08)] inline-flex items-center">
                            {entry.chip}
                          </span>
                        </div>
                        {entry.body && <div className="text-[13px] text-meta leading-relaxed line-clamp-2">{entry.body}</div>}
                        {!entry.href ? <div className="label-meta text-meta mt-1">{PUBLIC_LINKED_DETAIL_FALLBACK_COPY}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <SectionLabel>Model movement</SectionLabel>
        {isLoadingModelLayers ? (
          <div className="card-standard p-4 text-[13px] text-meta">
            Loading model movement...
          </div>
        ) : modelLayers.length === 0 ? (
          <div className="card-standard p-4 text-[13px] text-meta">
            No model movement in this window.
          </div>
        ) : (
          <div className="space-y-3">
            {modelLayers.map((item) => (
              <article key={item.id} className="card-standard p-5">
                <div className="label-meta text-cyan/70 mb-2">
                  {item.updateTypeLabel} · {item.affectedObjectTypeLabel}
                </div>
                <p className="text-[14px] text-[hsl(216_11%_70%)] leading-relaxed">
                  {item.userFacingSummary}
                </p>
                <div className="mt-3 pt-3 border-t hairline">
                  <PublicLinkedObjectContinuity
                    objectType={item.affectedObjectType}
                    objectId={item.affectedObjectId}
                    href={item.affectedObjectHref}
                    context="model_update"
                  />
                  <div className="label-meta mt-2">
                    Recorded {formatDateTime(item.createdAt)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-meta">{label}</div>
      <div className="font-mono text-[15px] mt-0.5">{value}</div>
    </div>
  );
}
