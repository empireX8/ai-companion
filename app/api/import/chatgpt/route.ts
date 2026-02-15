import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  extractChatGptConversations,
  importExtractedConversations,
  parseJsonSafe,
  validateImportFile,
} from "@/lib/import-chatgpt";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const formData = await req.formData();
    const fileValue = formData.get("file");
    const file = fileValue instanceof File ? fileValue : null;

    const validation = validateImportFile(file);
    if (!validation.ok) {
      return NextResponse.json(
        {
          sessionsCreated: 0,
          messagesCreated: 0,
          contradictionsCreated: 0,
          errors: [validation.error],
        },
        { status: validation.status }
      );
    }

    const safeFile = file as File;
    const rawText = await safeFile.text();
    const parsedResult = parseJsonSafe(rawText);
    if (!parsedResult.ok) {
      return NextResponse.json(
        {
          sessionsCreated: 0,
          messagesCreated: 0,
          contradictionsCreated: 0,
          errors: [parsedResult.error],
        },
        { status: 400 }
      );
    }

    const extracted = extractChatGptConversations(parsedResult.value);
    if (extracted.conversations.length === 0) {
      return NextResponse.json(
        {
          sessionsCreated: 0,
          messagesCreated: 0,
          contradictionsCreated: 0,
          errors: [...extracted.errors, "No importable conversations found"],
        },
        { status: 400 }
      );
    }

    const imported = await importExtractedConversations({
      userId,
      conversations: extracted.conversations,
    });

    return NextResponse.json({
      sessionsCreated: imported.sessionsCreated,
      messagesCreated: imported.messagesCreated,
      contradictionsCreated: imported.contradictionsCreated,
      errors: [...extracted.errors, ...imported.errors],
    });
  } catch (error) {
    console.log("[IMPORT_CHATGPT_POST_ERROR]", error);
    return NextResponse.json(
      {
        sessionsCreated: 0,
        messagesCreated: 0,
        contradictionsCreated: 0,
        errors: ["Internal Error"],
      },
      { status: 500 }
    );
  }
}
