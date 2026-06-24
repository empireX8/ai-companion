"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { SectionLabel } from "@/components/AppShell";
import {
  fetchInspectorEvidenceLinks,
  fetchInspectorUserMapDetail,
  INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT,
  type InspectorEvidenceLinkItem,
} from "@/lib/inspector-object-api";
import { PUBLIC_EVIDENCE_FALLBACK_COPY } from "@/lib/public-continuity-registry";
import {
  formatUserMapArea,
  formatUserMapConfidenceLevel,
  formatUserMapStatus,
  type UserMapConclusionPublicApiDetailItem,
} from "@/lib/public-intelligence-safe-slice";
import {
  formatYourMapDateTime,
  summarizeCentreEvidence,
  toYourMapDetailEyebrow,
  YOUR_MAP_CORRECTION_DEFERRED_COPY,
  YOUR_MAP_EVIDENCE_BREADTH_INTRO,
  YOUR_MAP_INSPECTOR_EVIDENCE_HINT,
  YOUR_MAP_PROVENANCE_INTRO,
} from "@/lib/your-map-surface";

function DetailSkeleton() {
  return (
    <div className="space-y-4 p-5">
      <div className="h-6 w-2/3 animate-pulse rounded bg-white/[0.06]" />
      <div className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />
      <div className="h-32 animate-pulse rounded-xl bg-white/[0.04]" />
    </div>
  );
}

export function YourMapDetailPane({ selectedId }: { selectedId: string | null }) {
  const [detail, setDetail] = useState<UserMapConclusionPublicApiDetailItem | null>(null);
  const [evidence, setEvidence] = useState<InspectorEvidenceLinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setEvidence([]);
      setNotFound(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);

    void (async () => {
      const [nextDetail, nextEvidence] = await Promise.all([
        fetchInspectorUserMapDetail(selectedId),
        fetchInspectorEvidenceLinks(INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT(selectedId)),
      ]);

      if (cancelled) {
        return;
      }

      setDetail(nextDetail);
      setEvidence(nextEvidence);
      setNotFound(!nextDetail);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (!selectedId) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center text-[13px] text-muted-foreground">
        Select a conclusion from the list to inspect current understanding and evidence.
      </div>
    );
  }

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (notFound || !detail) {
    return (
      <div className="p-6 text-[13px] text-muted-foreground">
        This conclusion is not available through the public projection.
      </div>
    );
  }

  const { preview, hasMore } = summarizeCentreEvidence(evidence);

  return (
    <div className="p-5 lg:p-6">
      <header className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-cyan/75">
          Map conclusion · {toYourMapDetailEyebrow(detail)}
        </p>
        <h2 className="mt-1 text-xl font-semibold leading-snug text-foreground">
          {detail.title}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Confidence: {formatUserMapConfidenceLevel(detail.confidenceLevel)}
        </p>
        <Link
          href={`/your-map/${detail.id}`}
          className="label-meta mt-2 inline-block text-meta hover:text-cyan"
        >
          Open permalink
        </Link>
      </header>

      <section className="ml-raised mb-5 rounded-2xl p-4">
        <SectionLabel>Current understanding</SectionLabel>
        <p className="text-[14px] leading-relaxed text-[hsl(216_11%_75%)]">{detail.summary}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-white/[0.03] px-3 py-3 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Type</dt>
            <dd className="mt-0.5 text-[13px] font-medium">{formatUserMapArea(detail.area)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</dt>
            <dd className="mt-0.5 text-[13px] font-medium">{formatUserMapStatus(detail.status)}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Confidence</dt>
            <dd className="mt-0.5 text-[13px] font-medium">
              {formatUserMapConfidenceLevel(detail.confidenceLevel)}
            </dd>
          </div>
        </dl>
        <div className="label-meta mt-4">
          Created {formatYourMapDateTime(detail.createdAt)} · Updated{" "}
          {formatYourMapDateTime(detail.updatedAt)}
        </div>
      </section>

      <section className="mb-5">
        <SectionLabel>Why the system thinks this</SectionLabel>
        <p className="mb-3 text-[13px] text-muted-foreground">{YOUR_MAP_EVIDENCE_BREADTH_INTRO}</p>
        <div className="ml-material space-y-2 rounded-xl p-4 text-[13.5px] text-[hsl(216_11%_75%)]">
          <div>Linked evidence sources: {detail.evidenceCount}</div>
          <div>Source diversity: {detail.sourceDiversity}</div>
          <div>Time spread: {detail.timeSpreadDays} days</div>
        </div>
        {detail.status === "disputed" ? (
          <p className="mt-3 text-[13px] text-muted-foreground">
            This conclusion is marked as disputed — conflicting signals may be present in linked
            evidence.
          </p>
        ) : null}
      </section>

      <section>
        <SectionLabel>Supporting evidence</SectionLabel>
        <p className="mb-3 text-[13px] text-muted-foreground">{YOUR_MAP_PROVENANCE_INTRO}</p>
        {preview.length === 0 ? (
          <div className="ml-material rounded-xl p-4 text-[13px] text-muted-foreground">
            {PUBLIC_EVIDENCE_FALLBACK_COPY}
          </div>
        ) : (
          <div className="space-y-2">
            {preview.map((link) => (
              <article key={`${link.sourceObjectHref}-${link.createdAt}`} className="ml-material rounded-xl p-4 text-[13px]">
                <div className="label-meta text-cyan/70">{link.evidenceSummaryLabel}</div>
                <Link href={link.sourceObjectHref} className="text-cyan hover:underline">
                  {link.sourceTypeLabel}
                </Link>
                <div className="label-meta mt-1 text-meta">
                  Linked {formatYourMapDateTime(link.createdAt)}
                </div>
              </article>
            ))}
            {hasMore ? (
              <p className="text-[12px] text-muted-foreground">{YOUR_MAP_INSPECTOR_EVIDENCE_HINT}</p>
            ) : null}
          </div>
        )}
      </section>

      <p className="label-meta mt-8 text-meta">{YOUR_MAP_CORRECTION_DEFERRED_COPY}</p>
    </div>
  );
}
