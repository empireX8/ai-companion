"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { ExplorePage } from "@/components/orvek-v0/pages/explore";
import { OrvekV0PageShell } from "@/components/orvek-v0/production/OrvekV0PageShell";
import { buildExploreProductionDataApi } from "@/lib/orvek-v0/production/explore-api";

import { useOrvekExploreChat } from "./useOrvekExploreChat";

export function OrvekExplorePage() {
  const searchParams = useSearchParams();

  const {
    messages,
    draft,
    setDraft,
    isBooting,
    isSending,
    errorMessage,
    sendMessage,
  } = useOrvekExploreChat({});

  const dataApi = useMemo(
    () =>
      buildExploreProductionDataApi({
        activeTab: "free",
        hasActionHandoffRequest: false,
        handoffContext: null,
        isLoadingHandoff: false,
        handoffError: null,
        messages: messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          isThinking: message.role === "assistant" && !message.content.trim(),
        })),
        composerDraft: draft,
        isBooting,
        isSending,
        errorMessage,
        investigations: { isLoading: false, items: [], selectedId: null },
        questions: { isLoading: false, items: [], selectedId: null },
        fieldwork: { isLoading: false, items: [], selectedId: null },
      }),
    [messages, draft, isBooting, isSending, errorMessage]
  );

  const handlers = useMemo(
    () => ({
      explore: {
        onTabChange: () => {},
        onDraftChange: setDraft,
        onSend: () => {
          void sendMessage();
        },
        onQuickPrompt: (prompt: string) => setDraft(prompt),
        onOpenInspector: () => {},
        onComposerFocus: () => {},
      },
    }),
    [sendMessage, setDraft]
  );

  void searchParams;

  return (
    <OrvekV0PageShell data={dataApi} handlers={handlers}>
      <ExplorePage />
    </OrvekV0PageShell>
  );
}
