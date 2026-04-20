"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  QUICK_CHECK_IN_EVENT_LABELS,
  QUICK_CHECK_IN_EVENT_TAGS,
  QUICK_CHECK_IN_LIST_LIMIT,
  QUICK_CHECK_IN_NOTE_MAX_LENGTH,
  QUICK_CHECK_IN_STATE_LABELS,
  QUICK_CHECK_IN_STATE_TAGS,
  type QuickCheckInEventTag,
  type QuickCheckInStateTag,
  type QuickCheckInView,
  formatQuickCheckInTimestamp,
} from "@/lib/quick-check-ins";
import { cn } from "@/lib/utils";

function CheckInComposerChip({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        pressed
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border/50 bg-background text-muted-foreground hover:border-border hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function CheckInDisplayChip({
  label,
  emphasized = false,
}: {
  label: string;
  emphasized?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
        emphasized
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-border/50 bg-muted/40 text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}

async function fetchCheckIns(): Promise<QuickCheckInView[]> {
  const response = await fetch("/api/check-ins", { cache: "no-store" });
  if (!response.ok) {
    return [];
  }

  return (await response.json()) as QuickCheckInView[];
}

export function CheckInsSurface() {
  const [checkIns, setCheckIns] = useState<QuickCheckInView[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateTag, setStateTag] = useState<QuickCheckInStateTag | null>(null);
  const [eventTags, setEventTags] = useState<QuickCheckInEventTag[]>([]);
  const [note, setNote] = useState("");
  const [savingCheckIn, setSavingCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void fetchCheckIns()
      .then((data) => {
        if (isActive) {
          setCheckIns(data);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const canSaveCheckIn =
    !savingCheckIn &&
    (stateTag !== null || eventTags.length > 0 || note.trim().length > 0);

  function toggleEventTag(tag: QuickCheckInEventTag) {
    setEventTags((current) =>
      current.includes(tag)
        ? current.filter((currentTag) => currentTag !== tag)
        : [...current, tag]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSaveCheckIn) {
      return;
    }

    setSavingCheckIn(true);
    setCheckInError(null);

    try {
      const response = await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stateTag,
          eventTags,
          note,
        }),
      });

      const payload = (await response.json()) as QuickCheckInView | { error?: string };

      if (!response.ok) {
        setCheckInError(
          typeof payload === "object" && payload && "error" in payload && payload.error
            ? payload.error
            : "Could not save check-in."
        );
        return;
      }

      const savedCheckIn = payload as QuickCheckInView;
      setCheckIns((current) => [savedCheckIn, ...current].slice(0, QUICK_CHECK_IN_LIST_LIMIT));
      setStateTag(null);
      setEventTags([]);
      setNote("");
    } catch {
      setCheckInError("Could not save check-in.");
    } finally {
      setSavingCheckIn(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold text-foreground">Check-ins</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Capture a short state update. Check-ins feed into your{" "}
            <Link href="/timeline" className="text-primary/70 underline-offset-2 hover:text-primary hover:underline">
              Timeline
            </Link>
            .
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-border/40 bg-card px-4 py-4"
        >
          <h2 className="text-sm font-medium text-foreground">Quick check-in</h2>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">State</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_CHECK_IN_STATE_TAGS.map((tag) => (
                <CheckInComposerChip
                  key={tag}
                  label={QUICK_CHECK_IN_STATE_LABELS[tag]}
                  pressed={stateTag === tag}
                  onClick={() => setStateTag((current) => (current === tag ? null : tag))}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Events</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_CHECK_IN_EVENT_TAGS.map((tag) => (
                <CheckInComposerChip
                  key={tag}
                  label={QUICK_CHECK_IN_EVENT_LABELS[tag]}
                  pressed={eventTags.includes(tag)}
                  onClick={() => toggleEventTag(tag)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">Note</p>
              <span className="text-[11px] text-muted-foreground/70">
                {note.length}/{QUICK_CHECK_IN_NOTE_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              value={note}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value)}
              maxLength={QUICK_CHECK_IN_NOTE_MAX_LENGTH}
              rows={3}
              placeholder="Optional note"
              className="min-h-[84px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-[1rem] flex-1">
              {checkInError ? (
                <p className="text-xs text-destructive">{checkInError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Save a quick snapshot without writing a full journal entry.
                </p>
              )}
            </div>
            <Button type="submit" size="sm" disabled={!canSaveCheckIn} className="sm:self-auto self-end">
              {savingCheckIn ? "Saving..." : "Save check-in"}
            </Button>
          </div>
        </form>

        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-medium text-foreground">Recent check-ins</h2>
            <p className="text-xs text-muted-foreground">Newest first.</p>
          </div>

          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-lg bg-muted/50"
                />
              ))}
            </div>
          )}

          {!loading && checkIns.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/40 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No check-ins yet.</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Your saved check-ins will show up here.
              </p>
            </div>
          )}

          {!loading && checkIns.length > 0 && (
            <div className="space-y-2">
              {checkIns.map((checkIn) => (
                <div
                  key={checkIn.id}
                  className="rounded-lg border border-border/40 bg-card px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {checkIn.stateTag && (
                        <CheckInDisplayChip
                          label={QUICK_CHECK_IN_STATE_LABELS[checkIn.stateTag]}
                          emphasized
                        />
                      )}
                      {checkIn.eventTags.map((tag) => (
                        <CheckInDisplayChip
                          key={`${checkIn.id}-${tag}`}
                          label={QUICK_CHECK_IN_EVENT_LABELS[tag]}
                        />
                      ))}
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
          )}
        </section>
      </div>
    </div>
  );
}
