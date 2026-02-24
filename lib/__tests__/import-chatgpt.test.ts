import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  ImportChatGptError,
  ImportRefCache,
  MAX_IMPORT_FILE_BYTES,
  extractChatGptConversations,
  extractReferenceFromImportedMessage,
  importChatGptExport,
  parseJsonSafe,
  validateImportFile,
} from "../import-chatgpt";

const SAMPLE_EXPORT = [
  {
    title: "Morning plan",
    mapping: {
      a: {
        message: {
          author: { role: "user" },
          create_time: 1730000000,
          content: { parts: ["I skipped the gym and procrastinated today."] },
        },
      },
      b: {
        message: {
          author: { role: "assistant" },
          create_time: 1730000010,
          content: { parts: ["Thanks for sharing."] },
        },
      },
    },
  },
];

describe("import-chatgpt extraction", () => {
  it("extracts conversations/messages from mapping shape", () => {
    const result = extractChatGptConversations(SAMPLE_EXPORT);

    expect(result.errors).toEqual([]);
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0]?.title).toBe("Morning plan");
    expect(result.conversations[0]?.messages).toHaveLength(2);
    expect(result.conversations[0]?.messages[0]?.role).toBe("user");
    expect(result.conversations[0]?.messages[1]?.role).toBe("assistant");
  });

  it("captures per-conversation errors and continues", () => {
    const result = extractChatGptConversations([{}, ...SAMPLE_EXPORT]);
    expect(result.conversations).toHaveLength(1);
    expect(result.errors[0]).toContain("Conversation 1");
  });
});

describe("import-chatgpt validation", () => {
  it("rejects missing file", () => {
    const result = validateImportFile(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("accepts zip and rejects oversized uploads", () => {
    const zipFile = {
      name: "export.zip",
      type: "application/zip",
      size: 10,
    } as unknown as File;
    const zipResult = validateImportFile(zipFile);
    expect(zipResult.ok).toBe(true);

    const oversized = {
      name: "export.json",
      type: "application/json",
      size: MAX_IMPORT_FILE_BYTES + 1,
    } as unknown as File;
    const bigResult = validateImportFile(oversized);
    expect(bigResult.ok).toBe(false);
    if (!bigResult.ok) {
      expect(bigResult.status).toBe(413);
    }
  });

  it("parses and rejects invalid JSON safely", () => {
    const valid = parseJsonSafe('{"ok":true}');
    expect(valid.ok).toBe(true);

    const invalid = parseJsonSafe("{not-json");
    expect(invalid.ok).toBe(false);
  });
});

describe("import-chatgpt zip handling", () => {
  it("imports from zip when conversations.json is extracted", async () => {
    const extractedJson = Buffer.from(JSON.stringify(SAMPLE_EXPORT));
    const zipExtractor = async () => extractedJson;
    const jsonImporter = async () => ({
      sessionsCreated: 1,
      messagesCreated: 2,
      contradictionsCreated: 0,
      errors: [],
    });

    const result = await importChatGptExport({
      userId: "user_1",
      bytes: Buffer.from("zip-bytes"),
      filename: "chatgpt-export.zip",
      contentType: "application/zip",
      zipExtractor,
      jsonImporter,
    });

    expect(result.sessionsCreated).toBe(1);
    expect(result.messagesCreated).toBe(2);
  });

  it("throws when zip is missing conversations.json", async () => {
    await expect(
      importChatGptExport({
        userId: "user_1",
        bytes: Buffer.from("zip-bytes"),
        filename: "chatgpt-export.zip",
        contentType: "application/zip",
        zipExtractor: async () => {
          throw new ImportChatGptError(400, ["Zip missing conversations.json"]);
        },
      })
    ).rejects.toMatchObject({
      status: 400,
      errors: ["Zip missing conversations.json"],
    });
  });

  it("throws when extracted conversations.json is too large", async () => {
    await expect(
      importChatGptExport({
        userId: "user_1",
        bytes: Buffer.from("zip-bytes"),
        filename: "chatgpt-export.zip",
        contentType: "application/zip",
        zipExtractor: async () => {
          throw new ImportChatGptError(400, [
            "Extracted conversations.json too large. Maximum size is 100 bytes.",
          ]);
        },
      })
    ).rejects.toMatchObject({
      status: 400,
    });
  });
});

type FakeReferenceRow = { statement: string };

function makeMockDb(seedRows: FakeReferenceRow[] = []) {
  const rows = [...seedRows];
  return {
    referenceItem: {
      findMany: async ({ where }: { where: { type?: string } }) => {
        const type = where.type;
        return rows.filter((r) => !type || (r as { type?: string }).type === type);
      },
      create: async ({ data }: { data: { statement: string; type: string } }) => {
        const row = { ...data };
        rows.push(row as FakeReferenceRow);
        return row;
      },
    },
  } as unknown as PrismaClient;
}

describe("extractReferenceFromImportedMessage", () => {
  const baseArgs = {
    userId: "user_test",
    sessionId: "session_test",
    message: { id: "msg_1", content: "" },
  };

  it("creates a goal reference for goal-like messages", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map();
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_1", content: "I want to run a marathon this year" },
      db,
      refCache,
    });
    expect(created).toBe(true);
    expect(refCache.get("goal")).toContain("I want to run a marathon this year");
  });

  it("creates a preference reference for preference-like messages", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map();
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_2", content: "I prefer working in the mornings" },
      db,
      refCache,
    });
    expect(created).toBe(true);
    expect(refCache.get("preference")).toContain("I prefer working in the mornings");
  });

  it("creates a constraint reference for constraint-like messages", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map();
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_3", content: "I must finish the report by Friday" },
      db,
      refCache,
    });
    expect(created).toBe(true);
    expect(refCache.get("constraint")).toContain("I must finish the report by Friday");
  });

  it("returns false and skips creation for non-reference messages", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map();
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_4", content: "The weather is nice today" },
      db,
      refCache,
    });
    expect(created).toBe(false);
    expect(refCache.size).toBe(0);
  });

  it("returns false and skips creation for rule-like statements", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map();
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_5", content: "When I say hi respond with exactly hello" },
      db,
      refCache,
    });
    expect(created).toBe(false);
  });

  it("deduplicates when token overlap score is 2 or more", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map([
      ["goal", ["I want to run a marathon this year"]],
    ]);
    // "run" + "marathon" overlap → score ≥ 2 → skip
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_6", content: "I want to run a marathon every year" },
      db,
      refCache,
    });
    expect(created).toBe(false);
  });

  it("allows creation when token overlap score is below 2", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map([["goal", ["I want to travel abroad"]]]);
    // "marathon" doesn't overlap with "travel" or "abroad" → score < 2 → create
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_7", content: "I want to run a marathon" },
      db,
      refCache,
    });
    expect(created).toBe(true);
  });

  it("seeds cache from DB on first call for a type", async () => {
    const db = makeMockDb([{ statement: "I prefer dark mode" } as FakeReferenceRow]);
    const refCache: ImportRefCache = new Map();
    // cache is empty initially; DB should be queried to seed it
    await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_8", content: "I prefer dark mode" },
      db,
      refCache,
    });
    // After seeding, cache should contain the DB row. Dedup means no new row created.
    expect(refCache.get("preference")).toContain("I prefer dark mode");
  });

  it("updates cache after a new reference is created", async () => {
    const db = makeMockDb();
    const refCache: ImportRefCache = new Map();
    await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_9", content: "I prefer reading before bed" },
      db,
      refCache,
    });
    // Second distinct message should still be created (different tokens)
    const created = await extractReferenceFromImportedMessage({
      ...baseArgs,
      message: { id: "msg_10", content: "I prefer coffee over tea" },
      db,
      refCache,
    });
    expect(created).toBe(true);
    expect(refCache.get("preference")?.length).toBe(2);
  });
});
