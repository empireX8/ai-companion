import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserMapConclusionVisibility } from "@prisma/client";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import prismadb from "@/lib/prismadb";
import { toYourMapListItem } from "@/lib/public-intelligence-safe-slice";

export const dynamic = "force-dynamic";

const PAGE_INTRO =
  "What MindLab currently understands about you from your evidence. Each item is read-only and links to supporting signals when available.";
const LIST_SECTION_LABEL = "On your map";
const EMPTY_PRIMARY = "Nothing on your map yet.";
const EMPTY_SECONDARY =
  "When there is enough evidence, MindLab will surface conclusions here. Keep journaling, checking in, or exploring to build more signal.";

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

export default async function YourMapPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const rows = await prismadb.userMapConclusion.findMany({
    where: {
      userId,
      visibility: UserMapConclusionVisibility.user_visible,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      summary: true,
      area: true,
      status: true,
      confidenceLevel: true,
      evidenceCount: true,
      updatedAt: true,
    },
  });

  const items = rows
    .map((row) => toYourMapListItem(row))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="px-12 py-10 max-w-[1100px] mx-auto animate-fade-in">
      <PageHeader title="Your Map" meta="Supported understanding from your evidence" />

      <p className="text-[13px] text-meta mb-6 max-w-2xl">{PAGE_INTRO}</p>

      <SectionLabel>{LIST_SECTION_LABEL}</SectionLabel>
      {items.length === 0 ? (
        <div className="card-standard p-5 text-[13px] text-meta space-y-1">
          <p>{EMPTY_PRIMARY}</p>
          <p className="text-meta/80">{EMPTY_SECONDARY}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="card-standard p-5 hover:border-[hsl(187_100%_50%/0.18)] transition-colors"
            >
              <Link href={item.detailHref} className="block group">
                <div className="label-meta text-cyan/70 mb-2">
                  {item.areaLabel} · {item.statusLabel} · {item.confidenceLevelLabel}
                </div>
                <h2 className="text-[16px] font-medium leading-snug mb-1.5 group-hover:text-cyan transition-colors">
                  {item.title}
                </h2>
                <p className="text-[13.5px] text-[hsl(216_11%_70%)] leading-relaxed line-clamp-3">
                  {item.summary}
                </p>
                <div className="label-meta mt-3">
                  {item.evidenceCount} linked evidence
                  {item.evidenceCount === 1 ? " source" : " sources"} · Updated{" "}
                  {formatDateTime(item.updatedAt)}
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      <p className="label-meta text-meta mt-8">
        Explore related surfaces:{" "}
        <Link href="/active-questions" className="hover:text-cyan transition-colors">
          Active Questions
        </Link>{" "}
        ·{" "}
        <Link href="/watch-for" className="hover:text-cyan transition-colors">
          Watch For
        </Link>
      </p>
    </div>
  );
}
