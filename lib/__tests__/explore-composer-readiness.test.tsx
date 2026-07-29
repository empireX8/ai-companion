import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

Object.assign(globalThis, { React });

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const renderState = vi.hoisted(() => ({
  api: {
    referenceSurface: false,
    canonicalRuntime: true,
    exploreMessages: [] as Array<{ id: string; role: "user" | "assistant"; content: string }>,
    exploreIsLoading: true,
    freeExploreSendHandlerAvailable: false,
    explore: {
      composerDraft: "",
      isBooting: true,
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

describe("explore composer readiness (production canonical path)", () => {
  beforeEach(() => {
    renderState.api = {
      referenceSurface: false,
      canonicalRuntime: true,
      exploreMessages: [],
      exploreIsLoading: true,
      freeExploreSendHandlerAvailable: false,
      explore: {
        composerDraft: "",
        isBooting: true,
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

  it("does not omit explore draft handlers behind exploreChatSendReady", () => {
    const hookSource = readSource(
      "components/orvek-workbench/useOrvekHybridWorkbenchDataApi.ts",
    );
    const handlersBlock =
      hookSource.match(
        /const handlers = useMemo\(\(\): OrvekPageHandlers => \{([\s\S]*?)\n  \}, \[/,
      )?.[1] ?? "";

    expect(handlersBlock).toContain("onDraftChange: setExploreChatDraft");
    expect(handlersBlock).not.toContain("if (!exploreChatSendReady)");
    expect(handlersBlock).not.toContain("return { map: mapHandlers };");
    expect(handlersBlock).toContain("...(exploreChatSendReady");
    expect(handlersBlock).toContain("onSend:");
  });

  it("keeps production runtime free of speculative pending-draft overlay", () => {
    const runtimeSource = readSource(
      "components/orvek-v0-canonical/canonical-live-runtime-entry.tsx",
    );

    expect(runtimeSource).toContain("value={handlers}");
    expect(runtimeSource).not.toContain("pendingExploreDraft");
    expect(runtimeSource).not.toContain("usePendingExploreDraft");
    expect(runtimeSource).not.toContain("setPendingExploreDraft");
  });

  it("accepts typing before send readiness and keeps Ask disabled without a live send handler", async () => {
    const { ExplorePage } = await import(
      "../../components/orvek-v0-canonical/pages/explore"
    );

    const composerInput = (markup: string) => {
      const match = markup.match(
        /data-shell-slot="explore-composer"[\s\S]*?(<input\b[^>]*>)/,
      );
      return match?.[1] ?? "";
    };
    const askButton = (markup: string) => {
      const match = markup.match(/<button\b[^>]*data-shell-item="explore-send-action"[^>]*>/);
      return match?.[0] ?? "";
    };
    const hasDisabledAttr = (tag: string) => /\sdisabled(?:=""|(?=\s|>))/.test(tag);

    // Reproduce the pre-fix production failure: no explore handlers while booting.
    let html = renderToStaticMarkup(React.createElement(ExplorePage));
    expect(hasDisabledAttr(composerInput(html))).toBe(true);
    expect(hasDisabledAttr(askButton(html))).toBe(true);

    // After the fix: draft handler is present before send readiness.
    renderState.exploreHandlers = {
      onDraftChange: (value: string) => {
        renderState.api.explore.composerDraft = value;
      },
      onSend: undefined,
      onQuickPrompt: (prompt: string) => {
        renderState.api.explore.composerDraft = prompt;
      },
      onComposerFocus: () => {},
      onOpenInspector: undefined,
    };
    renderState.api.explore.composerDraft = "typed before ready";
    renderState.api.freeExploreSendHandlerAvailable = false;

    html = renderToStaticMarkup(React.createElement(ExplorePage));
    expect(html).toContain('value="typed before ready"');
    expect(hasDisabledAttr(composerInput(html))).toBe(false);
    expect(hasDisabledAttr(askButton(html))).toBe(true);

    // Send stays gated until both availability flag and onSend exist.
    renderState.api.freeExploreSendHandlerAvailable = true;
    renderState.exploreHandlers.onSend = () => {};
    html = renderToStaticMarkup(React.createElement(ExplorePage));
    expect(hasDisabledAttr(askButton(html))).toBe(false);
  });

  it("surfaces bootstrap errors in the canonical Explore UI", async () => {
    const { ExplorePage } = await import(
      "../../components/orvek-v0-canonical/pages/explore"
    );

    renderState.exploreHandlers = {
      onDraftChange: () => {},
      onSend: undefined,
      onQuickPrompt: () => {},
      onComposerFocus: () => {},
      onOpenInspector: undefined,
    };
    renderState.api.freeExploreSendHandlerAvailable = false;
    renderState.api.explore.errorMessage =
      "Could not load sessions. The server may be unavailable.";

    const html = renderToStaticMarkup(React.createElement(ExplorePage));
    expect(html).toContain('data-testid="explore-bootstrap-error"');
    expect(html).toContain("Could not load sessions. The server may be unavailable.");
    expect(hasDisabledAttr(
      html.match(/<button\b[^>]*data-shell-item="explore-send-action"[^>]*>/)?.[0] ?? "",
    )).toBe(true);
  });
});

function hasDisabledAttr(tag: string) {
  return /\sdisabled(?:=""|(?=\s|>))/.test(tag);
}
