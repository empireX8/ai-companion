"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, SectionLabel } from "@/components/AppShell";
import Link from "next/link";
import { DualWaveform } from "@/components/Visuals";
import { ArrowUpRight, Receipt } from "lucide-react";
import { fetchContradictions, type ContradictionListItem } from "@/lib/nodes-api";

function PTToggle({ active }: { active: "patterns" | "tensions" }) {
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

function toDaysSince(iso: string): number {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  const delta = Date.now() - parsed.getTime();
  return Math.max(0, Math.floor(delta / (24 * 60 * 60 * 1000)));
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function typeLabel(type: string): string {
  return type.replace(/_/g, " ");
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

function toPreviewFromSides(item: ContradictionListItem): string {
  const sideA = normalizeText(item.sideA);
  const sideB = normalizeText(item.sideB);
  const combined = [sideA, sideB].filter(Boolean).join(" · ");
  if (!combined) {
    return clampText(normalizeText(item.title), 220);
  }
  return clampText(combined, 220);
}

function toCompactLabel(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "Unspecified";
  }
  return clampText(normalized, 56);
}

function toExpandedSide(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "No pull text captured yet.";
  }
  return clampText(normalized, 320);
}

export default function TensionsPage() {
  const [items, setItems] = useState<ContradictionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const next = await fetchContradictions("activeish");
        if (cancelled) {
          return;
        }

        if (!next) {
          setItems([]);
          setErrorMessage("Could not load tensions.");
          return;
        }

        setItems(next);
      } catch {
        if (!cancelled) {
          setItems([]);
          setErrorMessage("Could not load tensions.");
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

  const active = useMemo(
    () => items.filter((item) => item.status === "open" || item.status === "explored" || item.status === "snoozed"),
    [items]
  );

  const dormant = useMemo(
    () => items.filter((item) => item.status === "resolved" || item.status === "accepted_tradeoff" || item.status === "archived_tension"),
    [items]
  );

  return (
    <div className="px-12 py-10 max-w-[1100px] mx-auto animate-fade-in">
      <PageHeader
        title="Tensions"
        meta="Internal pulls held alongside each other"
        right={<PTToggle active="tensions" />}
      />

      <SectionLabel>Active</SectionLabel>
      {isLoading ? (
        <div className="card-standard p-4 text-[13px] text-meta mb-10">Loading tensions…</div>
      ) : errorMessage ? (
        <div className="card-standard p-4 text-[13px] text-[hsl(12_80%_64%)] mb-10">{errorMessage}</div>
      ) : active.length === 0 ? (
        <div className="card-standard p-4 text-[13px] text-meta mb-10">No active tensions yet.</div>
      ) : (
        <div className="space-y-3 mb-10">
          {active.map((item) => {
            const days = toDaysSince(item.lastTouchedAt);
            const isExpanded = expandedIds.includes(item.id);
            const preview = toPreviewFromSides(item);
            return (
              <article
                key={item.id}
                className="p-5 card-standard hover:border-[hsl(187_100%_50%/0.24)] transition-colors relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-cyan to-warm opacity-70" />
                <div className="flex items-start gap-4 pl-2">
                  <div className="flex-1 min-w-0">
                    <div className="label-meta text-cyan/70 mb-2">
                      Tension · {statusLabel(item.status)} · {typeLabel(item.type)} · {days} days
                    </div>
                    <div className="text-[16px] font-medium mb-2 leading-snug line-clamp-2">
                      {clampText(normalizeText(item.title), 180)}
                    </div>
                    <div className="text-[13.5px] text-[hsl(216_11%_70%)] leading-relaxed line-clamp-3 max-w-[640px]">
                      {preview}
                    </div>
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      <Pole color="cyan" label={toCompactLabel(item.sideA)} />
                      <span className="label-meta">·</span>
                      <Pole color="warm" label={toCompactLabel(item.sideB)} />
                    </div>
                  </div>
                  <div className="w-[180px] shrink-0 hidden md:block">
                    <DualWaveform height={70} />
                  </div>
                </div>

                {isExpanded ? (
                  <div className="mt-4 border-t hairline pt-4 grid gap-3 lg:grid-cols-2 max-h-[280px] overflow-y-auto pr-1">
                    <div className="card-standard p-3 border-[hsl(187_100%_50%/0.16)] bg-[hsl(187_100%_50%/0.03)]">
                      <div className="label-meta text-cyan mb-1.5">Pull A</div>
                      <div className="text-[13px] leading-relaxed text-[hsl(216_11%_80%)] line-clamp-5">
                        {toExpandedSide(item.sideA)}
                      </div>
                    </div>
                    <div className="card-standard p-3 border-[hsl(32_90%_60%/0.16)] bg-[hsl(32_90%_60%/0.03)]">
                      <div className="label-meta text-warm mb-1.5">Pull B</div>
                      <div className="text-[13px] leading-relaxed text-[hsl(216_11%_80%)] line-clamp-5">
                        {toExpandedSide(item.sideB)}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 border-t hairline pt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIds((current) =>
                          current.includes(item.id)
                            ? current.filter((expandedId) => expandedId !== item.id)
                            : [...current, item.id]
                        )
                      }
                      className="label-meta hover:text-white transition-colors"
                    >
                      {isExpanded ? "Collapse" : "Show more"}
                    </button>
                    <Link
                      href={`/library/receipt-tension-${item.id}`}
                      className="label-meta inline-flex items-center gap-1.5 text-meta hover:text-cyan transition-colors"
                    >
                      <Receipt className="h-3 w-3" strokeWidth={1.5} />
                      Receipts
                    </Link>
                  </div>
                  <Link
                    href={`/contradictions/${item.id}`}
                    className="inline-flex items-center gap-1.5 text-[12px] text-meta hover:text-cyan transition-colors"
                  >
                    Open
                    <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {dormant.length > 0 ? (
        <>
          <SectionLabel>Dormant</SectionLabel>
          <div className="space-y-3 opacity-60">
            {dormant.map((item) => {
              const days = toDaysSince(item.lastTouchedAt);
              return (
                <Link
                  href={`/contradictions/${item.id}`}
                  key={item.id}
                  className="block p-4 card-standard hover:opacity-100 transition-opacity"
                >
                  <div className="label-meta mb-1">Dormant · {days} days</div>
                  <div className="text-[14px] leading-snug line-clamp-2">
                    {clampText(normalizeText(item.title), 140)}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Pole({ color, label }: { color: "cyan" | "warm"; label: string }) {
  const classes =
    color === "cyan"
      ? "text-cyan border-[hsl(187_100%_50%/0.3)] bg-[hsl(187_100%_50%/0.06)]"
      : "text-warm border-[hsl(32_90%_60%/0.3)] bg-[hsl(32_90%_60%/0.06)]";

  return (
    <span className={`px-2.5 h-6 rounded inline-flex items-center text-[12px] border ${classes}`}>
      {label}
    </span>
  );
}
