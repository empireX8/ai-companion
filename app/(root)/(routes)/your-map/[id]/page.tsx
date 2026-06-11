import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserMapConclusionVisibility } from "@prisma/client";
import { notFound } from "next/navigation";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { listYourMapPublicEvidenceContinuity } from "@/lib/public-evidence-continuity";
import { PUBLIC_EVIDENCE_FALLBACK_COPY } from "../../../../../lib/public-continuity-registry";
import prismadb from "@/lib/prismadb";
import { toYourMapDetailItem } from "@/lib/public-intelligence-safe-slice";

export const dynamic = "force-dynamic";

const PROVENANCE_INTRO =
  "Patterns and signals linked to this conclusion. Message content is never shown here.";
const EVIDENCE_BREADTH_INTRO =
  "Counts from linked evidence — not a certainty score.";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_FORMATTER.format(date);
}

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
    <div className="px-12 py-10 max-w-[980px] mx-auto animate-fade-in">
      <Link
        href="/your-map"
        className="label-meta text-meta hover:text-cyan transition-colors mb-6 inline-block"
      >
        ← Back to Your Map
      </Link>

      <PageHeader
        eyebrow={`${item.areaLabel} · ${item.statusLabel}`}
        title={item.title}
        meta={`Confidence: ${item.confidenceLevelLabel}`}
      />

      <section className="card-standard p-5 mb-8">
        <SectionLabel>What this concludes</SectionLabel>
        <p className="text-[14px] text-[hsl(216_11%_70%)] leading-relaxed">
          {item.summary}
        </p>
        <div className="label-meta mt-4">
          Created {formatDateTime(item.createdAt)} · Updated {formatDateTime(item.updatedAt)}
        </div>
      </section>

      <section className="mb-8">
        <SectionLabel>Evidence breadth</SectionLabel>
        <p className="text-[13px] text-meta mb-3">{EVIDENCE_BREADTH_INTRO}</p>
        <div className="card-standard p-5 text-[13.5px] text-[hsl(216_11%_70%)] space-y-2">
          <div>Linked evidence sources: {item.evidenceCount}</div>
          <div>Source diversity: {item.sourceDiversity}</div>
          <div>Time spread: {item.timeSpreadDays} days</div>
        </div>
      </section>

      <section>
        <SectionLabel>Provenance</SectionLabel>
        <p className="text-[13px] text-meta mb-3">{PROVENANCE_INTRO}</p>
        {linkedEvidence.length === 0 ? (
          <div className="card-standard p-4 text-[13px] text-meta">
            {PUBLIC_EVIDENCE_FALLBACK_COPY}
          </div>
        ) : (
          <div className="space-y-2">
            {linkedEvidence.map((link) => (
              <article key={link.id} className="card-standard p-4 text-[13px]">
                <div className="label-meta text-cyan/70">{link.evidenceSummaryLabel}</div>
                <Link href={link.href} className="text-cyan hover:underline">
                  {link.sourceTypeLabel}
                </Link>
                <div className="label-meta mt-1 text-meta">
                  Linked {formatDateTime(link.createdAt)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
