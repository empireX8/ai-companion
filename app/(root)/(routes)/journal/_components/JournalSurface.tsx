"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader, SectionLabel } from "@/components/AppShell";
import { Search, MessageCircle, Compass, Tag, Clock, X, ChevronRight, Mic, Image } from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { toJournalPreview, type JournalEntryView } from "@/lib/journal-ui";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { VoiceWaveform } from "@/components/VoiceWaveform";

const DATE_LABEL = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  timeZone: "Europe/London",
});

const DATE_TIME_LABEL = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/London",
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return DATE_LABEL.format(date);
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return DATE_TIME_LABEL.format(date);
}

function getEntryDate(entry: JournalEntryView): string {
  return entry.authoredAt ?? entry.createdAt;
}

function getEntryTitle(entry: JournalEntryView): string {
  const title = entry.title?.trim();
  if (title) {
    return title;
  }

  const preview = toJournalPreview(entry.body, 84);
  return preview.length > 0 ? preview : "Journal entry";
}

export default function JournalSurface() {
  const [entries, setEntries] = useState<JournalEntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [journalDraft, setJournalDraft] = useState("");
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [journalSaveMessage, setJournalSaveMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);

  const voice = useVoiceInput();

  // Insert voice transcript into journal draft when recording completes
  useEffect(() => {
    if (voice.transcript && voice.state === "idle") {
      setJournalDraft((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${voice.transcript}` : voice.transcript;
      });
    }
  }, [voice.transcript, voice.state]);

  // Auto-scroll textarea to bottom when interim transcript updates
  useEffect(() => {
    if (voice.state === "recording" && draftTextareaRef.current) {
      draftTextareaRef.current.scrollTop = draftTextareaRef.current.scrollHeight;
    }
  }, [voice.interimTranscript, voice.state]);

  useEffect(() => {
    let cancelled = false;

    const loadEntries = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/journal/entries?limit=100", {
          method: "GET",
          cache: "no-store",
        });

        if (response.status === 401) {
          throw new Error("Please sign in to view Journal entries.");
        }

        if (!response.ok) {
          throw new Error("Could not load Journal entries. The server may be unavailable.");
        }

        const payload = (await response.json()) as JournalEntryView[];
        if (cancelled) {
          return;
        }

        setEntries(payload);
        setSelectedId((current) => current ?? payload[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) {
          setEntries([]);
          setError(
            err instanceof Error ? err.message : "Could not load Journal entries."
          );
          setSelectedId(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadEntries();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return entries;
    }

    return entries.filter((entry) => {
      const title = getEntryTitle(entry).toLowerCase();
      const body = entry.body.toLowerCase();
      return title.includes(needle) || body.includes(needle);
    });
  }, [entries, query]);

  const selected =
    (selectedId ? filtered.find((entry) => entry.id === selectedId) : null) ??
    filtered[0] ??
    entries[0] ??
    null;

  const selectedParagraphs = useMemo(() => {
    if (!selected) {
      return [];
    }

    return selected.body
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }, [selected]);

  function handleMediaSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const selected = Array.from(files);
    setMediaFiles((prev) => [...prev, ...selected]);

    setJournalSaveMessage({
      tone: "success",
      text: `Media selected (${selected.length} file${selected.length === 1 ? "" : "s"}). Saving media is not wired yet.`,
    });

    event.target.value = "";
  }

  return (
    <div className="flex h-screen">
      {/* Hidden file input for Media */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,audio/*,video/*"
        multiple
        className="hidden"
        onChange={handleMediaSelect}
      />

      <div className="w-[360px] shrink-0 border-r hairline flex flex-col h-screen">
        <div className="p-5 border-b hairline">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-[20px] font-bold tracking-tight">Journal</h2>
            <div className="label-meta">
              {filtered.length} of {entries.length}
            </div>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-meta" strokeWidth={1.5} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search entries…"
              className="w-full h-9 pl-9 pr-8 rounded-md bg-[hsl(213_41%_9%)] border border-white/[0.06] text-[13px] focus:outline-none focus:border-[hsl(187_100%_50%/0.3)]"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-meta hover:text-white"
              >
                <X className="h-3 w-3" strokeWidth={1.5} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-5 py-10 text-center">
              <div className="text-[13px] text-meta mb-1">Loading entries…</div>
            </div>
          ) : error ? (
            <div className="px-5 py-10 text-center">
              <div className="text-[13px] text-[hsl(12_80%_64%)] mb-1">{error}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="text-[13px] text-meta mb-1">No entries match.</div>
              <div className="label-meta text-meta">Try another search.</div>
            </div>
          ) : (
            filtered.map((entry) => {
              const isSelected = selected?.id === entry.id;
              const entryDate = getEntryDate(entry);

              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  className={`group w-full text-left px-5 py-4 border-b hairline transition-colors ${
                    isSelected ? "bg-[hsl(187_100%_50%/0.04)]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="label-meta">{formatDate(entryDate)}</div>
                    <div className="label-meta">{entry.body.trim().length} chars</div>
                  </div>
                  <div
                    className={`text-[13.5px] mb-1 leading-snug flex items-start justify-between gap-2 ${
                      isSelected ? "text-white" : "text-[hsl(216_11%_75%)]"
                    }`}
                  >
                    <span>
                      <Highlight text={getEntryTitle(entry)} query={query} />
                    </span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 mt-0.5 transition-opacity ${
                        isSelected ? "opacity-100 text-cyan" : "opacity-0 group-hover:opacity-60"
                      }`}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div className="text-[12px] text-meta line-clamp-2 leading-relaxed">
                    <Highlight text={toJournalPreview(entry.body)} query={query} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-[760px] mx-auto px-12 py-10">
          {/* Voice-enabled capture area */}
          <div className="card-focal p-6 mb-8">
            <div className="label-meta mb-3">New entry</div>
            <textarea
              ref={draftTextareaRef}
              rows={3}
              placeholder="What's present right now…"
              value={
                voice.state === "recording" && voice.interimTranscript
                  ? journalDraft
                    ? `${journalDraft}\n${voice.interimTranscript}`
                    : voice.interimTranscript
                  : journalDraft
              }
              onChange={(event) => {
                setJournalDraft(event.target.value);
                if (journalSaveMessage) setJournalSaveMessage(null);
              }}
              className="w-full bg-transparent border-0 resize-none focus:outline-none text-[16px] leading-relaxed placeholder:text-meta-deep max-h-[200px] overflow-y-auto"
            />
            <div className="flex items-center justify-between pt-3 border-t hairline">
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    void voice.toggle();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[12px] transition-colors ${
                    voice.state === "recording"
                      ? "text-[hsl(12_80%_64%)] bg-[hsl(12_80%_64%/0.1)]"
                      : "text-meta hover:text-white hover:bg-white/5"
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
                  onClick={() => mediaInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[12px] text-meta hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Image className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Media
                </button>
              </div>
              <button
                onClick={async () => {
                  const trimmed = journalDraft.trim();
                  if (!trimmed || isSavingJournal) return;
                  setIsSavingJournal(true);
                  setJournalSaveMessage(null);
                  try {
                    const response = await fetch("/api/journal/entries", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title: null, body: trimmed, authoredAt: null }),
                    });
                    if (!response.ok) throw new Error("Could not save.");
                    setJournalDraft("");
                    setJournalSaveMessage({ tone: "success", text: "Saved to Journal." });
                    // Refresh entries
                    const refresh = await fetch("/api/journal/entries?limit=100", { method: "GET", cache: "no-store" });
                    if (refresh.ok) {
                      const payload = (await refresh.json()) as JournalEntryView[];
                      setEntries(payload);
                    }
                  } catch {
                    setJournalSaveMessage({ tone: "error", text: "Could not save to Journal." });
                  } finally {
                    setIsSavingJournal(false);
                  }
                }}
                disabled={!journalDraft.trim() || isSavingJournal}
                className="px-4 h-8 rounded-md bg-cyan text-black text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {isSavingJournal ? "Saving…" : "Save"}
              </button>
            </div>
            {voice.message ? (
              <div className="mt-2 text-[12px] text-[hsl(216_11%_65%)]">{voice.message}</div>
            ) : null}
            {journalSaveMessage ? (
              <div className={`mt-2 text-[12px] ${journalSaveMessage.tone === "success" ? "text-cyan/85" : "text-[hsl(12_80%_64%)]"}`}>
                {journalSaveMessage.text}
              </div>
            ) : null}
            {mediaFiles.length > 0 ? (
              <div className="mt-2 text-[12px] text-meta">
                {mediaFiles.length} file{mediaFiles.length === 1 ? "" : "s"} selected
              </div>
            ) : null}
          </div>

          {selected ? (
            <>
              <PageHeader
                eyebrow={`Entry · ${formatDate(getEntryDate(selected))}`}
                title={getEntryTitle(selected)}
                right={
                  <div className="flex gap-2">
                    <Link
                      href="/journal-chat"
                      className="flex items-center gap-2 px-3 h-9 rounded-md card-standard hover:border-[hsl(187_100%_50%/0.3)] text-[12.5px]"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-cyan" strokeWidth={1.5} />
                      Journal Chat
                    </Link>
                    <Link
                      href="/explore"
                      className="flex items-center gap-2 px-3 h-9 rounded-md card-standard hover:border-[hsl(187_100%_50%/0.3)] text-[12.5px]"
                    >
                      <Compass className="h-3.5 w-3.5 text-cyan" strokeWidth={1.5} />
                      Explore
                    </Link>
                  </div>
                }
              />

              <div className="card-standard p-7 mb-6">
                <div className="prose prose-invert text-[15px] leading-[1.75] text-[hsl(216_11%_82%)] space-y-4">
                  {selectedParagraphs.length > 0 ? (
                    selectedParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
                  ) : (
                    <p>{toJournalPreview(selected.body, 300)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-6 pt-5 border-t hairline">
                  <Chip icon={Clock}>{formatDateTime(getEntryDate(selected))}</Chip>
                  <Chip icon={Tag}>Journal</Chip>
                </div>
              </div>

              <SectionLabel>Linked</SectionLabel>
              <div className="card-standard p-4 text-[13px] text-meta">No linked surfaces yet for this entry.</div>
            </>
          ) : (
            <div className="card-standard p-6 text-[13px] text-meta">No Journal entries yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;

  const parts = text.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")})`, "ig"));

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark key={index} className="bg-[hsl(187_100%_50%/0.18)] text-cyan rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

function Chip({ icon: Icon, children }: { icon?: ComponentType<{ className?: string; strokeWidth?: number }>; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-white/[0.03] border hairline text-[12px] text-[hsl(216_11%_75%)]">
      {Icon ? <Icon className="h-3 w-3 text-meta" strokeWidth={1.5} /> : null}
      {children}
    </span>
  );
}
