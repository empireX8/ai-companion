import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import prismadb from "@/lib/prismadb";
import {
  toJournalEntryView,
  updateJournalEntrySchema,
} from "../../../../../lib/journal-entries";

const JOURNAL_ENTRY_SELECT = {
  id: true,
  title: true,
  body: true,
  authoredAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Journal entry id is required" }, { status: 400 });
  }

  try {
    const entry = await prismadb.journalEntry.findFirst({
      where: { id, userId },
      select: JOURNAL_ENTRY_SELECT,
    });

    if (!entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toJournalEntryView(entry));
  } catch (error) {
    console.log("[JOURNAL_ENTRY_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Journal entry id is required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateJournalEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid journal entry" },
      { status: 400 }
    );
  }

  try {
    const existing = await prismadb.journalEntry.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prismadb.journalEntry.update({
      where: { id },
      data: {
        title: parsed.data.title,
        body: parsed.data.body,
        authoredAt: parsed.data.authoredAt,
      },
      select: JOURNAL_ENTRY_SELECT,
    });

    return NextResponse.json(toJournalEntryView(updated));
  } catch (error) {
    console.log("[JOURNAL_ENTRY_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Journal entry id is required" }, { status: 400 });
  }

  try {
    const existing = await prismadb.journalEntry.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prismadb.journalEntry.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.log("[JOURNAL_ENTRY_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
