import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import {
  ImportChatGptError,
  importChatGptExport,
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
    const imported = await importChatGptExport({
      userId,
      bytes: Buffer.from(await safeFile.arrayBuffer()),
      filename: safeFile.name,
      contentType: safeFile.type,
    });

    return NextResponse.json({
      sessionsCreated: imported.sessionsCreated,
      messagesCreated: imported.messagesCreated,
      contradictionsCreated: imported.contradictionsCreated,
      errors: imported.errors,
    });
  } catch (error) {
    if (error instanceof ImportChatGptError) {
      return NextResponse.json(
        {
          sessionsCreated: 0,
          messagesCreated: 0,
          contradictionsCreated: 0,
          errors: error.errors,
        },
        { status: error.status }
      );
    }

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
