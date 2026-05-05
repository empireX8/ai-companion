"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, SectionLabel } from "@/components/AppShell";
import { Waveform } from "@/components/Visuals";
import { fetchPatterns, type PatternClaimView, type PatternContradictionView, type PatternsResponse } from "@/lib/patterns-api";
import { ArrowUpRight, Receipt } from "lucide-react";

export function PTToggle({ active }: { active: "patterns" | "tensions" }) {
  return (
    <div className="inline-flex card-standard p-1 rounded-md">
      <Link
        href="/patterns"
        className={`px-4 h-8 rounded text-[12.5px] inline-flex items-center ${active === "patterns" ? "bg-[hsl(187_100%_50%/0.12)] text-cyan" : "text-meta hover:text-white"}`}
      >
        Patterns
      </Link>
      <Link
        href="/contradictions"
        className={`px-4 h-8 rounded text-[12.5px] inline-flex items-center ${active === "tensions" ? "bg-[hsl(187_100%_50%/0.12)] text-cyan" : "text-meta hover:text-white"}`}
      >
        Tensions
      </Link>
    </div>
  );
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

function toTensionPreview(item: PatternContradictionView): string {
  const combined = [normalizeText(item.sideA), normalizeText(item.sideB)].filter(Boolean).join(" · ");
  if (!combined) {
    return clampText(normalizeText(item.title), 220);
  }
  return clampText(combined, 220);
}

export default function PatternsPage() {
  const [data, setData] = useState<PatternsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          setErrorMessage("Could not load patterns.");
          return;
        }

        setData(next);
      } catch {
        if (!cancelled) {
          setData(null);
          setErrorMessage("Could not load patterns.");
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

  const claims = useMemo(() => {
    if (!data) {
      return [] as Array<PatternClaimView & { familyLabel: string }>;
    }

    return data.sections.flatMap((section) =>
      section.claims
        .filter((claim) => claim.status === "active" || claim.status === "candidate")
        .map((claim) => ({
          ...claim,
          familyLabel: section.sectionLabel,
        }))
    );
  }, [data]);

  const topClaims = useMemo(
    () => [...claims].sort((left, right) => right.evidenceCount - left.evidenceCount),
    [claims]
  );

  const keyTension = useMemo<PatternContradictionView | null>(() => {
    if (!data) {
      return null;
    }

    const contradictionSection = data.sections.find((section) => section.familyKey === "contradiction_drift");
    return contradictionSection?.contradictionItems?.[0] ?? null;
  }, [data]);

  return (
    <div className="px-12 py-10 max-w-[1100px] mx-auto animate-fade-in">
      <PageHeader
        title="Patterns"
        meta="Recurring inner motion the system has noticed"
        right={<PTToggle active="patterns" />}
      />

      <SectionLabel>Recurring patterns</SectionLabel>
      {isLoading ? (
        <div className="card-standard p-4 text-[13px] text-meta mb-10">Loading patterns…</div>
      ) : errorMessage ? (
        <div className="card-standard p-4 text-[13px] text-[hsl(12_80%_64%)] mb-10">{errorMessage}</div>
      ) : topClaims.length === 0 ? (
        <div className="card-standard p-4 text-[13px] text-meta mb-10">No recurring patterns yet.</div>
      ) : (
        <div className="space-y-3 mb-10">
          {topClaims.map((claim, index) => (
            <div
              key={claim.id}
              className={`p-5 ${
                index === 0 ? "card-surfaced" : "card-standard hover:border-[hsl(187_100%_50%/0.18)]"
              } transition-colors`}
            >
              <Link href={`/patterns/${claim.id}`} className="block group">
                <div className="flex items-start gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="label-meta text-cyan/70">Pattern</div>
                      <span className="label-meta">·</span>
                      <div className="label-meta">
                        Strength <span className="text-white/80">{strengthLabel(claim.strengthLevel)}</span>
                      </div>
                    </div>
                    <div className="text-[16px] font-medium leading-snug mb-1.5 line-clamp-2">
                      {clampText(normalizeText(claim.summary), 180)}
                    </div>
                    <div className="text-[13.5px] text-[hsl(216_11%_70%)] leading-relaxed mb-4 max-w-[640px]">
                      {claim.evidenceCount > 0
                        ? `${claim.evidenceCount} evidence receipts across ${claim.sessionCount} sessions.`
                        : "Early signal in recent material."}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="label-meta px-2.5 h-6 rounded bg-white/[0.04] inline-flex items-center gap-2">
                        <span className="text-cyan/70">Family</span> {claim.familyLabel}
                      </span>
                      <span className="label-meta px-2.5 h-6 rounded bg-white/[0.04] inline-flex items-center gap-2">
                        <span className="text-cyan/70">Action</span>{" "}
                        <span className="max-w-[240px] truncate">
                          {clampText(normalizeText(claim.action?.prompt ?? "No action suggested yet"), 72)}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="w-[200px] shrink-0">
                    <Waveform seed={index + 1} height={48} />
                    <div className="label-meta mt-2 text-right">Seen {claim.evidenceCount}×</div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-meta group-hover:text-cyan transition-colors shrink-0" strokeWidth={1.5} />
                </div>
              </Link>
              {claim.evidenceCount > 0 ? (
                <div className="mt-3 pt-3 border-t hairline">
                  <Link
                    href={`/library/receipt-pattern-${claim.id}`}
                    className="label-meta inline-flex items-center gap-1.5 text-meta hover:text-cyan transition-colors"
                  >
                    <Receipt className="h-3 w-3" strokeWidth={1.5} />
                    Receipts
                  </Link>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <SectionLabel>Key tension</SectionLabel>
      {keyTension ? (
        <div className="card-surfaced p-5 hover:border-[hsl(187_100%_50%/0.32)] transition-colors">
          <Link href={`/contradictions/${keyTension.id}`} className="block">
            <div className="label-meta text-cyan/70 mb-2">Tension · {keyTension.status.replace(/_/g, " ")}</div>
            <div className="text-[16px] font-medium mb-1.5 leading-snug line-clamp-2">
              {clampText(normalizeText(keyTension.title), 170)}
            </div>
            <div className="text-[13.5px] text-[hsl(216_11%_70%)] leading-relaxed line-clamp-3">
              {toTensionPreview(keyTension)}
            </div>
          </Link>
          <div className="mt-3 pt-3 border-t hairline">
            <Link
              href={`/library/receipt-tension-${keyTension.id}`}
              className="label-meta inline-flex items-center gap-1.5 text-meta hover:text-cyan transition-colors"
            >
              <Receipt className="h-3 w-3" strokeWidth={1.5} />
              Receipts
            </Link>
          </div>
        </div>
      ) : (
        <div className="card-standard p-4 text-[13px] text-meta">No active tensions yet.</div>
      )}
    </div>
  );
}
