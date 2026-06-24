import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import prismadb from "@/lib/prismadb";
import { buildPublicActiveInvestigationWhere } from "@/lib/active-questions";
import { toActiveQuestionListItem } from "@/lib/public-intelligence-safe-slice";
import {
  ACTIVE_QUESTIONS_EMPTY_PRIMARY,
  ACTIVE_QUESTIONS_EMPTY_SECONDARY,
  ACTIVE_QUESTIONS_LIST_SECTION_LABEL,
  ACTIVE_QUESTIONS_PAGE_INTRO,
} from "../../../../lib/active-questions-surface";

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

export default async function ActiveQuestionsPage() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const rows = await prismadb.investigation.findMany({
    where: buildPublicActiveInvestigationWhere({ userId }),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      organizingQuestion: true,
      status: true,
      seedType: true,
      priority: true,
      updatedAt: true,
    },
  });

  const items = rows
    .map((row) => toActiveQuestionListItem(row))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="px-12 py-10 max-w-[1100px] mx-auto animate-fade-in">
      <PageHeader title="Active Questions" meta="Questions still being investigated" />

      <p className="text-[13px] text-meta mb-6 max-w-2xl">{ACTIVE_QUESTIONS_PAGE_INTRO}</p>

      <SectionLabel>{ACTIVE_QUESTIONS_LIST_SECTION_LABEL}</SectionLabel>
      {items.length === 0 ? (
        <div className="card-standard p-5 text-[13px] text-meta space-y-1">
          <p>{ACTIVE_QUESTIONS_EMPTY_PRIMARY}</p>
          <p className="text-meta/80">{ACTIVE_QUESTIONS_EMPTY_SECONDARY}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="card-standard p-5 hover:border-[hsl(187_100%_50%/0.18)] transition-colors"
            >
              <Link href={item.detailHref} className="block group">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="label-meta text-cyan/70 mb-2">
                      {item.statusLabel} · {item.seedTypeLabel}
                    </div>
                    <h2 className="text-[16px] font-medium leading-snug mb-1.5 group-hover:text-cyan transition-colors">
                      {item.title}
                    </h2>
                    <p className="text-[13.5px] text-[hsl(216_11%_70%)] leading-relaxed line-clamp-2">
                      {item.organizingQuestion}
                    </p>
                    <div className="label-meta mt-3">
                      Updated {formatDateTime(item.updatedAt)}
                      {typeof item.priority === "number"
                        ? ` · Priority ${item.priority}`
                        : ""}
                    </div>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      <p className="label-meta text-meta mt-8">
        Explore related surfaces:{" "}
        <Link href="/your-map" className="hover:text-cyan transition-colors">
          Your Map
        </Link>{" "}
        ·{" "}
        <Link href="/watch-for" className="hover:text-cyan transition-colors">
          Watch For
        </Link>
      </p>
    </div>
  );
}
