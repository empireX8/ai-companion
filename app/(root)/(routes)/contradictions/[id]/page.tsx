"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, SectionLabel } from "@/components/AppShell";
import { DualWaveform, OccurrenceDots } from "@/components/Visuals";
import { fetchContradictionById, fetchLinkedReferences, type ContradictionDetail, type LinkedReference } from "@/lib/nodes-api";
import { ChevronLeft, Compass, Receipt } from "lucide-react";

const DATE_LABEL = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "Europe/London",
});

function formatDate(iso: string | null): string {
  if (!iso) {
    return "Unknown";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return DATE_LABEL.format(date);
}

function daysSince(iso: string | null): number {
  if (!iso) {
    return 0;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const delta = Date.now() - date.getTime();
  return Math.max(0, Math.floor(delta / (24 * 60 * 60 * 1000)));
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

function typeLabel(type: string): string {
  return type.replace(/_/g, " ");
}

function toPullPreview(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "No pull text captured yet.";
  }
  return clampText(normalized, 280);
}

function toEvidencePreview(value: string | null): string {
  const normalized = normalizeText(value ?? "");
  if (!normalized) {
    return "No quote captured for this evidence.";
  }
  return normalized;
}

export default function TensionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [detail, setDetail] = useState<ContradictionDetail | null>(null);
  const [references, setReferences] = useState<LinkedReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedEvidenceIds, setExpandedEvidenceIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [nextDetail, nextReferences] = await Promise.all([
          fetchContradictionById(id),
          fetchLinkedReferences(id).catch(() => []),
        ]);

        if (cancelled) {
          return;
        }

        if (!nextDetail) {
          setDetail(null);
          setReferences([]);
          setErrorMessage("Tension not found.");
          return;
        }

        setDetail(nextDetail);
        setReferences(nextReferences);
      } catch {
        if (!cancelled) {
          setDetail(null);
          setReferences([]);
          setErrorMessage("Could not load tension.");
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
  }, [id]);

  const sourceCounts = useMemo(() => {
    if (!detail) {
      return [] as Array<{ label: string; count: number }>;
    }

    const counts = new Map<string, number>();
    for (const evidence of detail.evidence) {
      const label = evidence.source.replace(/_/g, " ");
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
  }, [detail]);

  if (isLoading) {
    return (
      <div className="px-12 py-10 max-w-[1000px] mx-auto animate-fade-in">
        <Link href="/contradictions" className="inline-flex items-center gap-1.5 label-meta hover:text-white mb-6">
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Tensions
        </Link>
        <div className="card-standard p-4 text-[13px] text-meta">Loading tension…</div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="px-12 py-10 max-w-[1000px] mx-auto animate-fade-in">
        <Link href="/contradictions" className="inline-flex items-center gap-1.5 label-meta hover:text-white mb-6">
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Tensions
        </Link>
        <div className="card-standard p-4 text-[13px] text-[hsl(12_80%_64%)]">{errorMessage ?? "Tension not found."}</div>
      </div>
    );
  }

  return (
    <div className="px-12 py-10 max-w-[1000px] mx-auto animate-fade-in">
      <Link href="/contradictions" className="inline-flex items-center gap-1.5 label-meta hover:text-white mb-6">
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Tensions
      </Link>
      <PageHeader
        eyebrow={`Tension · ${detail.status.replace(/_/g, " ")}`}
        title={clampText(normalizeText(detail.title), 180)}
        meta={`${typeLabel(detail.type)} · Last touched ${formatDate(detail.lastTouchedAt)}`}
      />

      <div className="card-standard px-6 py-4 flex gap-10 mb-6">
        {[
          { label: "Occurrences", value: String(detail.evidenceCount) },
          { label: "Days active", value: String(daysSince(detail.lastTouchedAt)) },
          { label: "Intensity", value: detail.recommendedRung?.replace(/_/g, " ") ?? "Moderate" },
        ].map((stat) => (
          <div key={stat.label}>
            <div className="label-meta">{stat.label}</div>
            <div className="font-mono text-[16px] mt-0.5">{stat.value}</div>
          </div>
        ))}
      </div>

      <section className="grid gap-4 mb-6 lg:grid-cols-2">
        <div
          className="card-standard p-5 border-[hsl(187_100%_50%/0.18)] min-w-0"
          style={{ background: "linear-gradient(160deg, hsl(187 100% 50% / 0.05), transparent)" }}
        >
          <div className="label-meta text-cyan mb-2">Pull A</div>
          <div className="text-[16px] font-medium mb-2 leading-snug line-clamp-3">
            {clampText(normalizeText(detail.sideA), 150)}
          </div>
          <div className="text-[13px] text-[hsl(216_11%_75%)] leading-relaxed line-clamp-4">
            {toPullPreview(detail.sideA)}
          </div>
        </div>
        <div
          className="card-standard p-5 border-[hsl(32_90%_60%/0.18)] min-w-0"
          style={{ background: "linear-gradient(160deg, hsl(32 90% 60% / 0.05), transparent)" }}
        >
          <div className="label-meta text-warm mb-2">Pull B</div>
          <div className="text-[16px] font-medium mb-2 leading-snug line-clamp-3">
            {clampText(normalizeText(detail.sideB), 150)}
          </div>
          <div className="text-[13px] text-[hsl(216_11%_75%)] leading-relaxed line-clamp-4">
            {toPullPreview(detail.sideB)}
          </div>
        </div>
      </section>

      <section className="card-surfaced p-6 mb-6">
        <SectionLabel>Push-pull over time</SectionLabel>
        <DualWaveform height={120} />
        <div className="flex justify-between mt-3">
          <span className="label-meta">{formatDate(detail.createdAt)}</span>
          <span className="label-meta">{formatDate(detail.lastTouchedAt)}</span>
        </div>
      </section>

      <section className="mb-8">
        <SectionLabel>Recent evidence</SectionLabel>
        {detail.evidence.length === 0 ? (
          <div className="card-standard p-4 text-[13px] text-meta">No evidence attached yet.</div>
        ) : (
          <div className="space-y-3">
            {detail.evidence.slice(0, 6).map((evidence) => {
              const quote = toEvidencePreview(evidence.quote);
              const isExpanded = expandedEvidenceIds.includes(evidence.id);
              const isLong = quote.length > 360;

              return (
                <div key={evidence.id} className="card-standard p-4">
                  <div className="label-meta mb-2">
                    {formatDate(evidence.createdAt)} · {evidence.source.replace(/_/g, " ")}
                  </div>
                  <div className={`text-[14px] leading-relaxed text-[hsl(216_11%_82%)] ${isExpanded ? "" : "line-clamp-4"}`}>
                    {isExpanded ? quote : clampText(quote, 360)}
                  </div>
                  {isLong ? (
                    <button
                      type="button"
                      className="mt-2 label-meta hover:text-white transition-colors"
                      onClick={() =>
                        setExpandedEvidenceIds((current) =>
                          current.includes(evidence.id)
                            ? current.filter((entryId) => entryId !== evidence.id)
                            : [...current, evidence.id]
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
        <SectionLabel>What intensifies it</SectionLabel>
        {sourceCounts.length === 0 ? (
          <div className="card-standard p-4 text-[13px] text-meta">No intensity signals yet.</div>
        ) : (
          <div className="card-standard divide-y divide-white/[0.05]">
            {sourceCounts.map((item, index) => (
              <div key={`${item.label}-${index}`} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1 text-[13.5px]">{item.label}</div>
                <OccurrenceDots
                  count={10}
                  marks={Array.from({ length: Math.min(10, item.count) }, (_, i) => i)}
                />
                <div className="label-meta w-8 text-right">×{item.count}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionLabel>Linked references</SectionLabel>
        {references.length === 0 ? (
          <div className="card-standard p-4 text-[13px] text-meta mb-4">No linked references yet.</div>
        ) : (
          <div className="space-y-2 mb-4">
            {references.map((reference) => (
              <div key={reference.id} className="card-standard p-3 text-[13px]">
                <span className="text-cyan/70 label-meta mr-2">{reference.type.replace(/_/g, " ")}</span>
                {reference.statement}
              </div>
            ))}
          </div>
        )}
        {detail.evidence.length > 0 ? (
          <Link
            href={`/library/receipt-tension-${detail.id}`}
            className="card-standard px-4 h-9 inline-flex items-center gap-2 text-[12.5px] hover:border-[hsl(187_100%_50%/0.3)]"
          >
            <Receipt className="h-3.5 w-3.5 text-cyan/70" strokeWidth={1.5} />
            Receipts ({detail.evidence.length})
          </Link>
        ) : null}
      </section>

      <Link href="/explore" className="card-focal p-5 flex items-center gap-4 hover:opacity-95">
        <Compass className="h-5 w-5 text-cyan" strokeWidth={1.5} />
        <div className="flex-1">
          <div className="text-[14px] font-medium">Explore this tension</div>
          <div className="label-meta mt-1">Hold both pulls open in conversation</div>
        </div>
        <span className="label-meta text-cyan">Open →</span>
      </Link>
    </div>
  );
}
