"use client";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import {
  buildTodaySurfacingCards,
  TODAY_INTELLIGENCE_EMPTY_COPY,
  TODAY_INTELLIGENCE_LOADING_COPY,
  TODAY_INTELLIGENCE_SECTION_INTRO,
  TODAY_INTELLIGENCE_SECTION_TITLE,
  TODAY_SURFACED_SUBSECTION_LABEL,
  TODAY_SURFACING_ENDPOINTS,
  type TodayJournalEntry,
  type TodayPatternsResponse,
  type TodaySurfacingCard,
  type TodayTopContradiction,
} from "@/lib/today-surface";
import {
  TODAY_CHANGES_EMPTY_COPY,
  TODAY_CHANGES_SUBSECTION_LABEL,
  TODAY_CHANGES_VIEW_ALL_HREF,
  TODAY_INTELLIGENCE_UPDATES_ENDPOINT,
  type TodayIntelligenceUpdateItem,
} from "@/lib/today-intelligence-updates";
import { PublicLinkedObjectContinuity } from "../../lib/public-continuity-display";
import { PUBLIC_LINKED_DETAIL_FALLBACK_COPY } from "../../lib/public-continuity-registry";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { VoiceWaveform } from "@/components/VoiceWaveform";
import { ArrowUpRight, Mic, Receipt } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DETAIL_DATE.format(date);
}

function TodaySurfacingCardView({ card }: { card: TodaySurfacingCard }) {
  const content = (
    <div className="flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="label-meta mb-2 text-cyan/70">{card.kind}</div>
        <div className="text-[16px] font-medium mb-1.5 leading-snug line-clamp-2">
          {clampText(normalizeText(card.title), 170)}
        </div>
        <div className="text-[13.5px] text-[hsl(216_11%_65%)] leading-relaxed line-clamp-3">
          {clampText(normalizeText(card.body), 220)}
        </div>
        <div className="label-meta mt-3">{card.meta}</div>
        {!card.detailHref ? (
          <div className="label-meta text-meta mt-2">{PUBLIC_LINKED_DETAIL_FALLBACK_COPY}</div>
        ) : null}
      </div>
      {card.detailHref ? (
        <ArrowUpRight
          className="h-4 w-4 text-meta group-hover:text-cyan transition-colors shrink-0"
          strokeWidth={1.5}
        />
      ) : null}
    </div>
  );

  return (
    <div className="card-surfaced p-5 hover:border-[hsl(187_100%_50%/0.32)] transition-colors">
      {card.detailHref ? (
        <Link href={card.detailHref} className="block group">
          {content}
        </Link>
      ) : (
        content
      )}
      {card.receiptHref ? (
        <div className="mt-3 pt-3 border-t hairline">
          <Link
            href={card.receiptHref}
            className="label-meta inline-flex items-center gap-1.5 text-meta hover:text-cyan transition-colors"
          >
            <Receipt className="h-3 w-3" strokeWidth={1.5} />
            Receipts
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function TodayIntelligenceUpdateView({ item }: { item: TodayIntelligenceUpdateItem }) {
  return (
    <article className="card-standard p-5">
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
        <div className="label-meta mt-2">Recorded {formatDateTime(item.createdAt)}</div>
      </div>
    </article>
  );
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

  const [surfacingCards, setSurfacingCards] = useState<TodaySurfacingCard[]>([]);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [intelligenceUpdates, setIntelligenceUpdates] = useState<
    TodayIntelligenceUpdateItem[]
  >([]);

  const trimmedCaptureText = captureText.trim();

  const dateStr = useMemo(() => {
    const today = new Date();
    return DISPLAY_DATE.format(today).replace(",", "");
  }, []);

  const hasSnapshotContent = surfacingCards.length > 0 || intelligenceUpdates.length > 0;

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      setIsLoadingSnapshot(true);

      try {
        const [journalResult, contradictionResult, patternsResult, intelligenceResult] =
          await Promise.allSettled([
            fetch(TODAY_SURFACING_ENDPOINTS.journal, {
              method: "GET",
              cache: "no-store",
            }),
            fetch(TODAY_SURFACING_ENDPOINTS.contradiction, {
              method: "GET",
              cache: "no-store",
            }),
            fetch(TODAY_SURFACING_ENDPOINTS.patterns, {
              method: "GET",
              cache: "no-store",
            }),
            fetch(TODAY_INTELLIGENCE_UPDATES_ENDPOINT, {
              method: "GET",
              cache: "no-store",
            }),
          ]);

        if (cancelled) {
          return;
        }

        let journalEntries: TodayJournalEntry[] = [];
        let contradictions: TodayTopContradiction[] = [];
        let patterns: TodayPatternsResponse | null = null;

        if (journalResult.status === "fulfilled" && journalResult.value.ok) {
          try {
            journalEntries = (await journalResult.value.json()) as TodayJournalEntry[];
          } catch {
            journalEntries = [];
          }
        }

        if (contradictionResult.status === "fulfilled" && contradictionResult.value.ok) {
          try {
            contradictions = (await contradictionResult.value.json()) as TodayTopContradiction[];
          } catch {
            contradictions = [];
          }
        }

        if (patternsResult.status === "fulfilled" && patternsResult.value.ok) {
          try {
            patterns = (await patternsResult.value.json()) as TodayPatternsResponse;
          } catch {
            patterns = null;
          }
        }

        let nextIntelligenceUpdates: TodayIntelligenceUpdateItem[] = [];
        if (
          intelligenceResult.status === "fulfilled" &&
          intelligenceResult.value.ok
        ) {
          try {
            const payload = (await intelligenceResult.value.json()) as {
              items?: TodayIntelligenceUpdateItem[];
            };
            if (Array.isArray(payload.items)) {
              nextIntelligenceUpdates = payload.items;
            }
          } catch {
            nextIntelligenceUpdates = [];
          }
        }

        setSurfacingCards(
          buildTodaySurfacingCards({
            journalEntries,
            contradictions,
            patterns,
          })
        );
        setIntelligenceUpdates(nextIntelligenceUpdates);
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
    <div className="px-12 py-10 max-w-[1100px] mx-auto animate-fade-in">
      <PageHeader title="Today" meta={dateStr} />

      <section className="card-focal p-6 mb-10">
        <div className="label-meta mb-3">Capture</div>
        <textarea
          ref={captureTextareaRef}
          rows={4}
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
          className="w-full bg-transparent border-0 resize-none focus:outline-none text-[18px] leading-relaxed placeholder:text-meta-deep max-h-[240px] overflow-y-auto"
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
          </div>
          <button
            onClick={handleSaveCapture}
            disabled={!trimmedCaptureText}
            className="px-4 h-8 rounded-md bg-cyan text-black text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
        {voice.message ? (
          <div className="mt-2 text-[12px] text-[hsl(216_11%_65%)]">{voice.message}</div>
        ) : null}
        {captureMessage ? (
          <div className={`mt-2 text-[12px] ${captureMessage.tone === "success" ? "text-cyan/85" : "text-[hsl(12_80%_64%)]"}`}>
            {captureMessage.text}
          </div>
        ) : null}
      </section>

      <section className="mb-10">
        <SectionLabel>Quick check-in</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          {checkInStates.map((state) => (
            <Link
              key={state.id}
              href={`/check-ins?state=${todayQuickCheckInMap[state.id]}`}
              className="flex items-center gap-2 px-4 h-10 rounded-lg card-standard hover:border-[hsl(187_100%_50%/0.3)] transition-colors text-[13px]"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: state.color }} />
              {state.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>{TODAY_INTELLIGENCE_SECTION_TITLE}</SectionLabel>
        <p className="text-[13px] text-meta mb-4">{TODAY_INTELLIGENCE_SECTION_INTRO}</p>

        {isLoadingSnapshot ? (
          <div className="card-standard p-4 text-[13px] text-meta">
            {TODAY_INTELLIGENCE_LOADING_COPY}
          </div>
        ) : !hasSnapshotContent ? (
          <div className="card-standard p-4 text-[13px] text-meta">
            {TODAY_INTELLIGENCE_EMPTY_COPY}
          </div>
        ) : (
          <div className="card-focal p-6 space-y-8">
            <div>
              <div className="label-meta mb-3">{TODAY_SURFACED_SUBSECTION_LABEL}</div>
              {surfacingCards.length === 0 ? (
                <div className="card-standard p-4 text-[13px] text-meta">
                  {TODAY_INTELLIGENCE_EMPTY_COPY}
                </div>
              ) : (
                <div className="space-y-3">
                  {surfacingCards.map((card) => (
                    <TodaySurfacingCardView key={`${card.kind}-${card.title}`} card={card} />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t hairline pt-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="label-meta">{TODAY_CHANGES_SUBSECTION_LABEL}</div>
                {intelligenceUpdates.length > 0 ? (
                  <Link
                    href={TODAY_CHANGES_VIEW_ALL_HREF}
                    className="label-meta text-meta hover:text-cyan transition-colors"
                  >
                    View all changes
                  </Link>
                ) : null}
              </div>
              {intelligenceUpdates.length === 0 ? (
                <div className="card-standard p-4 text-[13px] text-meta">
                  {TODAY_CHANGES_EMPTY_COPY}
                </div>
              ) : (
                <div className="space-y-3">
                  {intelligenceUpdates.map((item) => (
                    <TodayIntelligenceUpdateView key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
