import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import {
  createJournalEntrySchema,
  parseJournalEntryListLimit,
  toJournalEntryView,
} from "../../../../lib/journal-entries";

const JOURNAL_ENTRY_SELECT = {
  id: true,
  title: true,
  body: true,
  authoredAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsedLimit = parseJournalEntryListLimit(searchParams.get("limit"));
  if (!parsedLimit.ok) {
    return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
  }

  try {
    const entries = await prismadb.journalEntry.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: parsedLimit.value,
      select: JOURNAL_ENTRY_SELECT,
    });

    return NextResponse.json(entries.map(toJournalEntryView));
  } catch (error) {
    console.log("[JOURNAL_ENTRIES_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createJournalEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid journal entry" },
      { status: 400 }
    );
  }

  try {
    const entry = await prismadb.journalEntry.create({
      data: {
        userId,
        title: parsed.data.title,
        body: parsed.data.body,
        authoredAt: parsed.data.authoredAt,
      },
      select: JOURNAL_ENTRY_SELECT,
    });

    return NextResponse.json(toJournalEntryView(entry), { status: 201 });
  } catch (error) {
    console.log("[JOURNAL_ENTRIES_POST_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
