"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, SectionLabel } from "@/components/AppShell";
import { RhythmGraph } from "@/components/Visuals";
import { Tag } from "lucide-react";
import {
  QUICK_CHECK_IN_EVENT_LABELS,
  QUICK_CHECK_IN_EVENT_TAGS,
  isQuickCheckInStateTag,
  type QuickCheckInEventTag,
  type QuickCheckInStateTag,
  type QuickCheckInView,
} from "@/lib/quick-check-ins";

const STATE_ORDER: QuickCheckInStateTag[] = [
  "stable",
  "stressed",
  "overloaded",
  "flat",
  "energized",
];

const STATE_DISPLAY_LABELS: Record<QuickCheckInStateTag, string> = {
  stable: "Calm",
  stressed: "Anxious",
  overloaded: "Overwhelmed",
  flat: "Numb",
  energized: "Energized",
};

const STATE_COLORS: Record<QuickCheckInStateTag, string> = {
  stable: "hsl(187 100% 50%)",
  stressed: "hsl(32 90% 60%)",
  overloaded: "hsl(280 50% 60%)",
  flat: "hsl(216 11% 55%)",
  energized: "hsl(88 70% 55%)",
};

type HistoryGroup = {
  key: string;
  label: string;
  items: QuickCheckInView[];
};

function toDayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "invalid";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown day";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function groupHistory(items: QuickCheckInView[]): HistoryGroup[] {
  const grouped = new Map<string, HistoryGroup>();

  for (const item of items) {
    const dayKey = toDayKey(item.createdAt);
    const existing = grouped.get(dayKey);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    grouped.set(dayKey, {
      key: dayKey,
      label: formatDayLabel(item.createdAt),
      items: [item],
    });
  }

  return [...grouped.values()].sort((left, right) => right.key.localeCompare(left.key));
}

export default function CheckInsSurface() {
  const searchParams = useSearchParams();
  const queryState = searchParams.get("state");

  const [selectedStateTag, setSelectedStateTag] = useState<QuickCheckInStateTag | null>(null);
  const [selectedEventTags, setSelectedEventTags] = useState<QuickCheckInEventTag[]>([]);
  const [note, setNote] = useState("");
  const [historyItems, setHistoryItems] = useState<QuickCheckInView[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const trimmedNote = note.trim();
  const hasInput =
    selectedStateTag !== null || selectedEventTags.length > 0 || trimmedNote.length > 0;
  const canSave = hasInput && !isSaving;

  useEffect(() => {
    if (!queryState || !isQuickCheckInStateTag(queryState)) {
      return;
    }

    setSelectedStateTag(queryState);
  }, [queryState]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const response = await fetch("/api/check-ins", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not load check-ins.");
        }

        const nextItems = (await response.json()) as QuickCheckInView[];
        if (!cancelled) {
          setHistoryItems(nextItems);
        }
      } catch {
        if (!cancelled) {
          setHistoryItems([]);
          setHistoryError("Could not load check-ins.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const historyGroups = useMemo(() => groupHistory(historyItems), [historyItems]);

  const activeDays = historyGroups.length;

  const toggleEventTag = (tag: QuickCheckInEventTag) => {
    setStatusMessage(null);
    setSelectedEventTags((current) =>
      current.includes(tag)
        ? current.filter((value) => value !== tag)
        : [...current, tag]
    );
  };

  const saveCheckIn = async () => {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateTag: selectedStateTag,
          eventTags: selectedEventTags,
          note: trimmedNote || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not save check-in.");
      }

      const created = (await response.json()) as QuickCheckInView;
      setHistoryItems((current) => [created, ...current]);
      setSelectedStateTag(null);
      setSelectedEventTags([]);
      setNote("");
      setStatusMessage({ tone: "success", text: "Saved check-in." });
    } catch (error) {
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error && error.message
            ? error.message
            : "Could not save check-in.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="px-12 py-10 max-w-[1000px] mx-auto animate-fade-in">
      <PageHeader title="Check-ins" meta="Brief state captures, kept lightly" />

      <section className="card-focal p-6 mb-8">
        <div className="label-meta mb-3">How are you, right now</div>
        <div className="flex gap-2 flex-wrap mb-5">
          {STATE_ORDER.map((stateTag) => {
            const isSelected = selectedStateTag === stateTag;
            return (
              <button
                key={stateTag}
                onClick={() => {
                  setSelectedStateTag((current) =>
                    current === stateTag ? null : stateTag
                  );
                  setStatusMessage(null);
                }}
                className={`flex items-center gap-2 px-4 h-10 rounded-lg border transition-colors text-[13px] ${
                  isSelected
                    ? "border-[hsl(187_100%_50%/0.5)] bg-[hsl(187_100%_50%/0.06)]"
                    : "card-standard hover:border-[hsl(187_100%_50%/0.2)]"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: STATE_COLORS[stateTag] }}
                />
                {STATE_DISPLAY_LABELS[stateTag]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Tag className="h-3.5 w-3.5 text-meta" strokeWidth={1.5} />
          <div className="label-meta">Event tags</div>
        </div>
        <div className="flex gap-2 flex-wrap mb-4">
          {QUICK_CHECK_IN_EVENT_TAGS.map((eventTag) => {
            const active = selectedEventTags.includes(eventTag);
            return (
              <button
                key={eventTag}
                onClick={() => toggleEventTag(eventTag)}
                className={`px-2.5 h-7 rounded-md text-[12px] border transition-colors ${
                  active
                    ? "border-[hsl(187_100%_50%/0.4)] bg-[hsl(187_100%_50%/0.12)] text-cyan"
                    : "card-standard text-meta hover:text-white hover:border-[hsl(187_100%_50%/0.2)]"
                }`}
              >
                {QUICK_CHECK_IN_EVENT_LABELS[eventTag]}
              </button>
            );
          })}
        </div>

        <textarea
          rows={2}
          maxLength={160}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            if (statusMessage) {
              setStatusMessage(null);
            }
          }}
          placeholder="Optional note…"
          className="w-full p-3 rounded-md bg-[hsl(213_41%_9%)] border hairline text-[13px] resize-none focus:outline-none focus:border-[hsl(187_100%_50%/0.3)] placeholder:text-meta-deep"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="label-meta">{note.trim().length}/160</div>
          <button
            onClick={() => {
              void saveCheckIn();
            }}
            disabled={!canSave}
            className="px-5 h-9 rounded-md bg-cyan text-black text-[12.5px] font-medium disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save check-in"}
          </button>
        </div>
        {statusMessage && (
          <div
            className={`mt-2 text-[12px] ${
              statusMessage.tone === "success"
                ? "text-cyan/85"
                : "text-[hsl(12_80%_64%)]"
            }`}
          >
            {statusMessage.text}
          </div>
        )}
      </section>

      <section className="card-standard p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="label-meta">Rhythm · last 30 days</div>
          <div className="label-meta">
            {activeDays} active day{activeDays === 1 ? "" : "s"}
          </div>
        </div>
        <RhythmGraph seed={6} height={90} />
      </section>

      <SectionLabel>History</SectionLabel>
      {isLoadingHistory ? (
        <div className="card-standard p-4 text-[13px] text-meta">
          Loading check-ins...
        </div>
      ) : historyError ? (
        <div className="card-standard p-4 text-[13px] text-[hsl(12_80%_64%)]">
          {historyError}
        </div>
      ) : historyGroups.length === 0 ? (
        <div className="card-standard p-4 text-[13px] text-meta">
          No check-ins yet.
        </div>
      ) : (
        <div className="space-y-6">
          {historyGroups.map((group) => (
            <div key={group.key}>
              <div className="label-meta mb-2">{group.label}</div>
              <div className="card-standard divide-y divide-white/[0.05]">
                {group.items.map((item) => {
                  const stateLabel = item.stateTag
                    ? STATE_DISPLAY_LABELS[item.stateTag]
                    : "No state";
                  const stateColor = item.stateTag
                    ? STATE_COLORS[item.stateTag]
                    : "hsl(216 11% 40%)";
                  const tagLabel =
                    item.eventTags.length > 0
                      ? item.eventTags
                          .map((eventTag) => QUICK_CHECK_IN_EVENT_LABELS[eventTag])
                          .join(", ")
                      : "—";

                  return (
                    <div key={item.id} className="px-4 py-3 flex items-center gap-4">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: stateColor }}
                      />
                      <span className="text-[13.5px] w-24">{stateLabel}</span>
                      <span className="label-meta w-32 truncate" title={tagLabel}>
                        {tagLabel}
                      </span>
                      <span className="text-[13px] text-meta flex-1 truncate">
                        {item.note ?? ""}
                      </span>
                      <span className="label-meta">{formatTimeLabel(item.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
