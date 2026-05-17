import React from "react";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import prismadb from "@/lib/prismadb";
import {
  ACTIVE_QUESTION_VISIBLE_STATUSES,
  toActiveQuestionListItem,
} from "@/lib/public-intelligence-safe-slice";

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
    where: {
      userId,
      status: { in: ACTIVE_QUESTION_VISIBLE_STATUSES },
    },
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
      <PageHeader
        title="Active Questions"
        meta="Read-only investigation threads anchored to persisted backend records."
      />

      <SectionLabel>Open investigations</SectionLabel>
      {items.length === 0 ? (
        <div className="card-standard p-4 text-[13px] text-meta">
          No active questions right now.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="card-standard p-5 hover:border-[hsl(187_100%_50%/0.18)] transition-colors"
            >
              <Link href={item.detailHref} className="block">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="label-meta text-cyan/70 mb-2">
                      {item.statusLabel} · {item.seedTypeLabel}
                    </div>
                    <h2 className="text-[16px] font-medium leading-snug mb-1.5">
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
    </div>
  );
}
