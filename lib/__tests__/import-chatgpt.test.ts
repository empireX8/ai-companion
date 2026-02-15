import { describe, expect, it } from "vitest";

import {
  MAX_IMPORT_FILE_BYTES,
  extractChatGptConversations,
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

  it("rejects zip and oversized uploads", () => {
    const zipFile = {
      name: "export.zip",
      type: "application/zip",
      size: 10,
    } as unknown as File;
    const zipResult = validateImportFile(zipFile);
    expect(zipResult.ok).toBe(false);
    if (!zipResult.ok) {
      expect(zipResult.status).toBe(400);
    }

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
