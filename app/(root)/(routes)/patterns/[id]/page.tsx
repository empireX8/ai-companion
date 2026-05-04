"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, SectionLabel } from "@/components/AppShell";
import { RhythmGraph, OccurrenceDots } from "@/components/Visuals";
import { fetchPatterns, type PatternClaimView, type PatternContradictionView, type PatternsResponse } from "@/lib/patterns-api";
import { ChevronLeft, Compass } from "lucide-react";

const DATE_TIME_LABEL = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/London",
});

const DATE_LABEL = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Europe/London",
});

function formatDateTime(iso: string | null): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return DATE_TIME_LABEL.format(date);
}

function formatDate(iso: string | null): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return DATE_LABEL.format(date);
}

function strengthLabel(level: PatternClaimView["strengthLevel"]): string {
  if (level === "established") return "High";
  if (level === "developing") return "Medium";
  return "Emerging";
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampText(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function toReceiptPreview(value: string | null): string {
  const normalized = normalizeText(value ?? "");
  if (!normalized) {
    return "No quote stored for this receipt.";
  }
  return normalized;
}

type PatternClaimWithSection = PatternClaimView & { sectionLabel: string };

export default function PatternDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [data, setData] = useState<PatternsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const next = await fetchPatterns();
        if (cancelled) {
          return;
        }

        if (!next) {
          setData(null);
          setErrorMessage("Could not load pattern detail.");
          return;
        }

        setData(next);
      } catch {
        if (!cancelled) {
          setData(null);
          setErrorMessage("Could not load pattern detail.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const allClaims = useMemo<PatternClaimWithSection[]>(() => {
    if (!data) {
      return [];
    }

    return data.sections.flatMap((section) =>
      section.claims.map((claim) => ({
        ...claim,
        sectionLabel: section.sectionLabel,
      }))
    );
  }, [data]);

  const claim = useMemo(
    () => allClaims.find((candidate) => candidate.id === id) ?? allClaims[0] ?? null,
    [allClaims, id]
  );

  const keyTension = useMemo<PatternContradictionView | null>(() => {
    if (!data) {
      return null;
    }

    const contradictionSection = data.sections.find((section) => section.familyKey === "contradiction_drift");
    return contradictionSection?.contradictionItems?.[0] ?? null;
  }, [data]);

  const receiptDates = useMemo(() => {
    if (!claim) {
      return [] as number[];
    }

    return claim.receipts
      .map((receipt) => new Date(receipt.createdAt).getTime())
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right);
  }, [claim]);

  const firstSeenIso = receiptDates.length > 0 ? new Date(receiptDates[0]).toISOString() : null;
  const lastSeenIso = receiptDates.length > 0 ? new Date(receiptDates[receiptDates.length - 1]).toISOString() : null;

  const topSources = useMemo(() => {
    if (!claim) {
      return [] as Array<{ label: string; count: number }>;
    }

    const counts = new Map<string, number>();
    for (const receipt of claim.receipts) {
      const key = receipt.source.replace(/_/g, " ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
  }, [claim]);

  if (isLoading) {
    return (
      <div className="px-12 py-10 max-w-[1000px] mx-auto animate-fade-in">
        <Link href="/patterns" className="inline-flex items-center gap-1.5 label-meta hover:text-white mb-6">
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Patterns
        </Link>
        <div className="card-standard p-4 text-[13px] text-meta">Loading pattern…</div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="px-12 py-10 max-w-[1000px] mx-auto animate-fade-in">
        <Link href="/patterns" className="inline-flex items-center gap-1.5 label-meta hover:text-white mb-6">
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Patterns
        </Link>
        <div className="card-standard p-4 text-[13px] text-[hsl(12_80%_64%)]">
          {errorMessage ?? "Pattern not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="px-12 py-10 max-w-[1000px] mx-auto animate-fade-in">
      <Link href="/patterns" className="inline-flex items-center gap-1.5 label-meta hover:text-white mb-6">
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Patterns
      </Link>
      <PageHeader
        eyebrow="Pattern"
        title={clampText(normalizeText(claim.summary), 180)}
        meta={`Strength · ${strengthLabel(claim.strengthLevel)}`}
      />

      <div className="card-standard px-6 py-4 flex gap-10 mb-6">
        {[
          { label: "Total signals", value: String(claim.evidenceCount) },
          { label: "Session spread", value: String(claim.sessionCount) },
          { label: "First seen", value: formatDate(firstSeenIso) },
          { label: "Last seen", value: formatDate(lastSeenIso) },
        ].map((item) => (
          <div key={item.label}>
            <div className="label-meta">{item.label}</div>
            <div className="font-mono text-[16px] mt-0.5">{item.value}</div>
          </div>
        ))}
      </div>

      <section className="card-surfaced p-6 mb-6">
        <SectionLabel>Occurrence over time</SectionLabel>
        <RhythmGraph seed={9} height={140} />
      </section>

      <section className="mb-8">
        <SectionLabel>What this is</SectionLabel>
        <p className="text-[15px] leading-[1.75] text-[hsl(216_11%_82%)] max-w-[760px]">
          {clampText(normalizeText(claim.summary), 420)}
        </p>
        <p className="text-[13px] text-meta mt-3">Family · {claim.sectionLabel}</p>
      </section>

      <section className="mb-8">
        <SectionLabel>Recent evidence</SectionLabel>
        {claim.receipts.length === 0 ? (
          <div className="card-standard p-4 text-[13px] text-meta">No evidence receipts yet.</div>
        ) : (
          <div className="space-y-3">
            {claim.receipts.slice(0, 6).map((receipt) => {
              const quote = toReceiptPreview(receipt.quote);
              const isExpanded = expandedReceiptIds.includes(receipt.id);
              const isLong = quote.length > 360;

              return (
                <div key={receipt.id} className="card-standard p-4">
                  <div className="label-meta mb-2">{formatDateTime(receipt.createdAt)}</div>
                  <div className={`text-[14px] leading-relaxed text-[hsl(216_11%_82%)] ${isExpanded ? "" : "line-clamp-4"}`}>
                    {isExpanded ? quote : clampText(quote, 360)}
                  </div>
                  {isLong ? (
                    <button
                      type="button"
                      className="mt-2 label-meta hover:text-white transition-colors"
                      onClick={() =>
                        setExpandedReceiptIds((current) =>
                          current.includes(receipt.id)
                            ? current.filter((entryId) => entryId !== receipt.id)
                            : [...current, receipt.id]
                        )
                      }
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionLabel>Common triggers</SectionLabel>
        {topSources.length === 0 ? (
          <div className="card-standard p-4 text-[13px] text-meta">No trigger/source groupings yet.</div>
        ) : (
          <div className="card-standard divide-y divide-white/[0.05]">
            {topSources.map((source, index) => (
              <div key={`${source.label}-${index}`} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 text-[13.5px]">{source.label}</div>
                <OccurrenceDots
                  count={10}
                  marks={Array.from({ length: Math.min(10, source.count) }, (_, markIndex) => markIndex)}
                />
                <div className="label-meta w-8 text-right">×{source.count}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionLabel>Related</SectionLabel>
        <div className="flex gap-2 flex-wrap mb-4">
          {keyTension ? (
            <Link
              href={`/contradictions/${keyTension.id}`}
              className="card-standard px-3 h-8 inline-flex items-center text-[12px] hover:border-[hsl(187_100%_50%/0.3)]"
            >
              <span className="text-cyan/70 label-meta mr-2">Tension</span>
              {clampText(normalizeText(keyTension.title), 80)}
            </Link>
          ) : (
            <div className="card-standard px-3 h-8 inline-flex items-center text-[12px] text-meta">No linked tension yet.</div>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/actions?bucket=stabilize"
            className="card-standard px-4 h-9 inline-flex items-center text-[12.5px] hover:border-[hsl(187_100%_50%/0.3)]"
          >
            Stabilize Now
          </Link>
          <Link
            href="/actions?bucket=build"
            className="card-standard px-4 h-9 inline-flex items-center text-[12.5px] hover:border-[hsl(187_100%_50%/0.3)]"
          >
            Build Forward
          </Link>
        </div>
      </section>

      <Link href="/explore" className="card-focal p-5 flex items-center gap-4 hover:opacity-95">
        <Compass className="h-5 w-5 text-cyan" strokeWidth={1.5} />
        <div className="flex-1">
          <div className="text-[14px] font-medium">Explore this pattern</div>
          <div className="label-meta mt-1">Open a free-thinking session anchored to this</div>
        </div>
        <span className="label-meta text-cyan">Open →</span>
      </Link>
    </div>
  );
}
