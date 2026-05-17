import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { UserMapConclusionVisibility } from "@prisma/client";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import prismadb from "@/lib/prismadb";
import { toYourMapListItem } from "@/lib/public-intelligence-safe-slice";

export const dynamic = "force-dynamic";

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
      <PageHeader
        title="Your Map"
        meta="Read-only confirmed map items anchored to persisted backend conclusions."
      />

      <SectionLabel>Confirmed map items</SectionLabel>
      {items.length === 0 ? (
        <div className="card-standard p-4 text-[13px] text-meta">
          No confirmed map items yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="card-standard p-5 hover:border-[hsl(187_100%_50%/0.18)] transition-colors"
            >
              <Link href={item.detailHref} className="block">
                <div className="label-meta text-cyan/70 mb-2">
                  {item.areaLabel} · {item.statusLabel} · {item.confidenceLevelLabel}
                </div>
                <h2 className="text-[16px] font-medium leading-snug mb-1.5">
                  {item.title}
                </h2>
                <p className="text-[13.5px] text-[hsl(216_11%_70%)] leading-relaxed line-clamp-3">
                  {item.summary}
                </p>
                <div className="label-meta mt-3">
                  Evidence links {item.evidenceCount} · Updated {formatDateTime(item.updatedAt)}
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
