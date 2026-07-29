import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

Object.assign(globalThis, { React });

import {
  bootstrapExploreChatSession,
  type OrvekExploreMessage,
  type OrvekExploreSession,
} from "../explore-chat-bootstrap";
import { buildFreeExploreChatProductionDataApi } from "../../lib/orvek-v0/production/free-explore-chat-api";
import {
  isFreeExploreChatSessionSendReady,
  shouldMergeFreeExploreChatProductionApi,
} from "../../lib/orvek-v0/production/free-explore-chat-presentation";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const renderState = vi.hoisted(() => ({
  api: {
    referenceSurface: false,
    canonicalRuntime: true,
    exploreMessages: [] as Array<{ id: string; role: "user" | "orvek"; content: string }>,
    exploreIsLoading: false,
    freeExploreChatSessionId: null as string | null,
    freeExploreSendHandlerAvailable: false,
    explore: {
      composerDraft: "",
      isBooting: false,
      isSending: false,
      errorMessage: null as string | null,
    },
    exploreLiveDetectionCopy: undefined as string | undefined,
    exploreMovement: [] as unknown[],
  },
  exploreHandlers: {
    onDraftChange: undefined as ((value: string) => void) | undefined,
    onSend: undefined as (() => void) | undefined,
    onQuickPrompt: undefined as ((prompt: string) => void) | undefined,
    onComposerFocus: undefined as (() => void) | undefined,
    onOpenInspector: undefined as (() => void) | undefined,
  },
  setInspectorTab: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...values: unknown[]) => values.flat().filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => ({
  ArrowRight: (props: Record<string, unknown>) =>
    React.createElement("span", { "data-icon": "arrow-right", ...props }),
  PanelRight: (props: Record<string, unknown>) =>
    React.createElement("span", { "data-icon": "panel-right", ...props }),
  Send: (props: Record<string, unknown>) =>
    React.createElement("span", { "data-icon": "send", ...props }),
  Sparkles: (props: Record<string, unknown>) =>
    React.createElement("span", { "data-icon": "sparkles", ...props }),
}));

vi.mock("@/components/orvek-v0-canonical/permanent-presentation", () => ({
  minimumPermanentSlots: <T,>(items: readonly T[] | undefined, count: number) => {
    const values = items ?? [];
    return Array.from(
      { length: Math.max(values.length, count) },
      (_, index) => values[index] ?? null,
    );
  },
}));

vi.mock("@/components/orvek-v0-canonical/canonical-data-context", () => ({
  useCanonicalData: () => ({
    getObjects: () => [],
    exploreGroundingIds: [],
  }),
}));

vi.mock("@/lib/orvek-v0/data-provider", () => ({
  useOrvekData: () => renderState.api,
}));

vi.mock("@/lib/orvek-v0/page-handlers", () => ({
  useOrvekPageHandlers: () => ({
    explore: renderState.exploreHandlers,
  }),
}));

vi.mock("@/components/orvek-v0/store", () => ({
  useWorkbench: () => ({
    select: renderState.select,
    setInspectorTab: renderState.setInspectorTab,
    setExploreActive: vi.fn(),
    canonicalCorrectionHandoff: null,
    setCanonicalCorrectionHandoff: vi.fn(),
  }),
}));

vi.mock("@/components/orvek-v0/primitives", () => ({
  Chip: ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement("span", props, children),
  SectionLabel: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children),
}));

vi.mock("@/lib/canonical-correction-handoff", () => ({
  formatCanonicalCorrectionContextCopy: () => "",
}));

describe("explore session bootstrap integration", () => {
  beforeEach(() => {
    renderState.api = {
      referenceSurface: false,
      canonicalRuntime: true,
      exploreMessages: [],
      exploreIsLoading: false,
      freeExploreChatSessionId: null,
      freeExploreSendHandlerAvailable: false,
      explore: {
        composerDraft: "",
        isBooting: false,
        isSending: false,
        errorMessage: null,
      },
      exploreLiveDetectionCopy: undefined,
      exploreMovement: [],
    };
    renderState.exploreHandlers = {
      onDraftChange: undefined,
      onSend: undefined,
      onQuickPrompt: undefined,
      onComposerFocus: undefined,
      onOpenInspector: undefined,
    };
    renderState.setInspectorTab.mockReset();
    renderState.select.mockReset();
  });

  it("bootstraps from an empty session list through create + message load", async () => {
    const sessionsAfterCreate: OrvekExploreSession[] = [
      {
        id: "sess-explore-1",
        label: null,
        preview: null,
        startedAt: "2026-07-29T18:00:00.000Z",
        endedAt: null,
      },
    ];
    const emptyMessages: OrvekExploreMessage[] = [];

    const loadSessions = vi
      .fn()
      .mockResolvedValueOnce([] as OrvekExploreSession[])
      .mockResolvedValueOnce(sessionsAfterCreate);
    const createSession = vi.fn().mockResolvedValue("sess-explore-1");
    const loadMessages = vi.fn().mockResolvedValue(emptyMessages);

    const result = await bootstrapExploreChatSession({
      loadSessions,
      createSession,
      loadMessages,
      storedSessionId: null,
    });

    expect(loadSessions).toHaveBeenCalledTimes(2);
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(loadMessages).toHaveBeenCalledWith("sess-explore-1");
    expect(result.sessionId).toBe("sess-explore-1");
    expect(result.sessions).toEqual(sessionsAfterCreate);
    expect(result.messages).toEqual([]);

    const sendReady = isFreeExploreChatSessionSendReady({
      sessionId: result.sessionId,
      isBooting: false,
      errorMessage: null,
    });
    expect(sendReady).toBe(true);

    const freeExploreChatApi = buildFreeExploreChatProductionDataApi({
      sessionId: result.sessionId,
      messages: result.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        grounding: message.grounding ?? null,
      })),
      composerDraft: "",
      isBooting: false,
      isSending: false,
      errorMessage: null,
      sendHandlerAvailable: sendReady,
    });

    expect(shouldMergeFreeExploreChatProductionApi(freeExploreChatApi)).toBe(true);
    expect(freeExploreChatApi.freeExploreChatSessionId).toBe("sess-explore-1");
    expect(freeExploreChatApi.freeExploreSendHandlerAvailable).toBe(true);

    const messagePosts: Array<{ url: string; body: unknown }> = [];
    const sendMessage = vi.fn(async (_content?: string) => {
      messagePosts.push({
        url: "/api/message",
        body: {
          sessionId: result.sessionId,
          content: "bootstrap regression prompt",
          model: "gpt-4o-mini",
          responseMode: "standard",
        },
      });
    });

    // Mirror production hybrid handler gating: onSend only when session send-ready.
    const handlers = {
      explore: {
        onDraftChange: vi.fn(),
        onComposerFocus: vi.fn(),
        onQuickPrompt: sendReady
          ? (prompt: string) => {
              void sendMessage(prompt);
            }
          : vi.fn(),
        ...(sendReady
          ? {
              onSend: () => {
                void sendMessage();
              },
            }
          : {}),
      },
    };

    expect(handlers.explore.onSend).toEqual(expect.any(Function));

    renderState.api = {
      ...renderState.api,
      freeExploreChatSessionId: freeExploreChatApi.freeExploreChatSessionId ?? null,
      freeExploreSendHandlerAvailable:
        freeExploreChatApi.freeExploreSendHandlerAvailable === true,
      exploreIsLoading: false,
      explore: {
        composerDraft: "bootstrap regression prompt",
        isBooting: false,
        isSending: false,
        errorMessage: null,
      },
    };
    renderState.exploreHandlers = {
      onDraftChange: handlers.explore.onDraftChange,
      onSend: handlers.explore.onSend,
      onQuickPrompt: handlers.explore.onQuickPrompt,
      onComposerFocus: handlers.explore.onComposerFocus,
      onOpenInspector: undefined,
    };

    const { ExplorePage } = await import(
      "../../components/orvek-v0-canonical/pages/explore"
    );
    const html = renderToStaticMarkup(React.createElement(ExplorePage));
    const askButton = html.match(
      /<button\b[^>]*data-shell-item="explore-send-action"[^>]*>/,
    )?.[0];
    expect(askButton).toBeTruthy();
    expect(/\sdisabled(?:=""|(?=\s|>))/.test(askButton ?? "")).toBe(false);

    handlers.explore.onSend?.();
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(messagePosts).toEqual([
      {
        url: "/api/message",
        body: {
          sessionId: "sess-explore-1",
          content: "bootstrap regression prompt",
          model: "gpt-4o-mini",
          responseMode: "standard",
        },
      },
    ]);
  });

  it("keeps Ask disabled when bootstrap never yields a session", async () => {
    await expect(
      bootstrapExploreChatSession({
        loadSessions: async () => [],
        createSession: async () => {
          throw new Error("Could not create session. The server may be unavailable.");
        },
        loadMessages: async () => [],
        storedSessionId: null,
      }),
    ).rejects.toThrow(/Could not create session/);

    expect(
      isFreeExploreChatSessionSendReady({
        sessionId: null,
        isBooting: false,
        errorMessage: "Could not create session. The server may be unavailable.",
      }),
    ).toBe(false);

    renderState.api.explore.errorMessage =
      "Could not create session. The server may be unavailable.";
    renderState.api.freeExploreSendHandlerAvailable = false;
    renderState.exploreHandlers = {
      onDraftChange: () => {},
      onSend: undefined,
      onQuickPrompt: () => {},
      onComposerFocus: () => {},
      onOpenInspector: undefined,
    };

    const { ExplorePage } = await import(
      "../../components/orvek-v0-canonical/pages/explore"
    );
    const html = renderToStaticMarkup(React.createElement(ExplorePage));
    expect(html).toContain("Could not create session. The server may be unavailable.");
    expect(html).toContain('data-testid="explore-bootstrap-error"');
    const askButton = html.match(
      /<button\b[^>]*data-shell-item="explore-send-action"[^>]*>/,
    )?.[0];
    expect(/\sdisabled(?:=""|(?=\s|>))/.test(askButton ?? "")).toBe(true);
  });

  it("wires hybrid handlers so onSend exists only after exploreChatSendReady", () => {
    const hookSource = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );
    const handlersBlock =
      hookSource.match(
        /const handlers = useMemo\(\(\): OrvekPageHandlers => \{([\s\S]*?)\n  \}, \[/,
      )?.[1] ?? "";

    expect(handlersBlock).toContain("onDraftChange: setExploreChatDraft");
    expect(handlersBlock).toContain("...(exploreChatSendReady");
    expect(handlersBlock).toContain("onSend:");
    expect(handlersBlock).toContain("void sendMessage()");
    expect(handlersBlock).toContain(": {}");
  });
});
