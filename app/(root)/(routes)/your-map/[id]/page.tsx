import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserMapConclusionVisibility } from "@prisma/client";
import { notFound } from "next/navigation";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { MapDetailInspectorSync } from "@/components/inspector/InspectorSelectButton";
import { listYourMapPublicEvidenceContinuity } from "@/lib/public-evidence-continuity";
import { PUBLIC_EVIDENCE_FALLBACK_COPY } from "../../../../../lib/public-continuity-registry";
import prismadb from "@/lib/prismadb";
import { toYourMapDetailItem } from "@/lib/public-intelligence-safe-slice";
import {
  formatYourMapDateTime,
  YOUR_MAP_CORRECTION_DEFERRED_COPY,
  YOUR_MAP_EVIDENCE_BREADTH_INTRO,
  YOUR_MAP_PROVENANCE_INTRO,
} from "../../../../../lib/your-map-surface";

export const dynamic = "force-dynamic";

export default async function YourMapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    notFound();
  }

  const { id } = await params;
  const row = await prismadb.userMapConclusion.findFirst({
    where: {
      id,
      userId,
      visibility: UserMapConclusionVisibility.user_visible,
    },
    select: {
      id: true,
      title: true,
      summary: true,
      area: true,
      status: true,
      confidenceLevel: true,
      evidenceCount: true,
      sourceDiversity: true,
      timeSpreadDays: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!row) {
    notFound();
  }

  const item = toYourMapDetailItem(row);
  if (!item) {
    notFound();
  }

  const linkedEvidence = await listYourMapPublicEvidenceContinuity({
    userId,
    targetId: item.id,
  });

  return (
    <div className="animate-fade-in px-6 py-7 lg:px-10">
      <MapDetailInspectorSync conclusionId={item.id} title={item.title} />
      <div className="mx-auto max-w-3xl">
      <Link
        href="/your-map"
        className="label-meta mb-6 inline-block text-meta hover:text-cyan transition-colors"
      >
        ← Back to Your Map workbench
      </Link>

      <PageHeader
        eyebrow={`${item.areaLabel} · ${item.statusLabel}`}
        title={item.title}
        meta={`Confidence: ${item.confidenceLevelLabel}`}
        compact
      />

      <section className="ml-raised mb-6 rounded-2xl p-5">
        <SectionLabel>Current understanding</SectionLabel>
        <p className="text-[14px] leading-relaxed text-[hsl(216_11%_75%)]">
          {item.summary}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-white/[0.03] px-3 py-3 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Type</dt>
            <dd className="mt-0.5 text-[13px] font-medium">{item.areaLabel}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</dt>
            <dd className="mt-0.5 text-[13px] font-medium">{item.statusLabel}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Confidence</dt>
            <dd className="mt-0.5 text-[13px] font-medium">{item.confidenceLevelLabel}</dd>
          </div>
        </dl>
        <div className="label-meta mt-4">
          Created {formatYourMapDateTime(item.createdAt)} · Updated {formatYourMapDateTime(item.updatedAt)}
        </div>
      </section>

      <section className="mb-6">
        <SectionLabel>Why the system thinks this</SectionLabel>
        <p className="mb-3 text-[13px] text-muted-foreground">{YOUR_MAP_EVIDENCE_BREADTH_INTRO}</p>
        <div className="ml-material space-y-2 rounded-xl p-4 text-[13.5px] text-[hsl(216_11%_75%)]">
          <div>Linked evidence sources: {item.evidenceCount}</div>
          <div>Source diversity: {item.sourceDiversity}</div>
          <div>Time spread: {item.timeSpreadDays} days</div>
        </div>
      </section>

      <section>
        <SectionLabel>Supporting evidence</SectionLabel>
        <p className="mb-3 text-[13px] text-muted-foreground">{YOUR_MAP_PROVENANCE_INTRO}</p>
        {linkedEvidence.length === 0 ? (
          <div className="ml-material rounded-xl p-4 text-[13px] text-muted-foreground">
            {PUBLIC_EVIDENCE_FALLBACK_COPY}
          </div>
        ) : (
          <div className="space-y-2">
            {linkedEvidence.map((link) => (
              <article key={link.id} className="ml-material rounded-xl p-4 text-[13px]">
                <div className="label-meta text-cyan/70">{link.evidenceSummaryLabel}</div>
                <Link href={link.href} className="text-cyan hover:underline">
                  {link.sourceTypeLabel}
                </Link>
                <div className="label-meta mt-1 text-meta">
                  Linked {formatYourMapDateTime(link.createdAt)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <p className="label-meta mt-8 text-meta">{YOUR_MAP_CORRECTION_DEFERRED_COPY}</p>
      </div>
    </div>
  );
}
