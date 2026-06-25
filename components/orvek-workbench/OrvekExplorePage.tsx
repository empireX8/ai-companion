"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ExplorePage } from "@/components/orvek-v0/pages/explore";
import { OrvekV0PageShell } from "@/components/orvek-v0/production/OrvekV0PageShell";
import { fetchActionsPageData } from "@/lib/actions-api";
import {
  EXPLORE_ACTION_ID_PARAM,
  parseExploreActionIdParam,
  resolveExploreActionHandoffContext,
  type ExploreActionHandoffContext,
} from "@/lib/explore-action-handoff";
import {
  refreshExploreSessionMovement,
  setExploreSessionBridgeSessionId,
} from "@/lib/explore-session-bridge";
import { EXPLORE_HANDOFF_UNAVAILABLE_COPY } from "@/lib/explore-surface";
import {
  mapActiveQuestionsToExploreQuestions,
  mapExploreDataToV0Props,
  mapInvestigationRowsToExploreItems,
  mapWatchForToExploreFieldwork,
  type V0ExploreTabId,
} from "@/lib/orvek-adapters/explore";
import { EMPTY_ORVEK_DATA_API } from "@/lib/orvek-v0/empty-api";
import { ACTIVE_QUESTIONS_ENDPOINT, type ActiveQuestionItem } from "@/lib/active-questions";
import { WATCH_FOR_ENDPOINT, type WatchForItem } from "@/lib/watch-for";

import { useOrvekExploreChat } from "./useOrvekExploreChat";
import { useOrvekInspector } from "./useOrvekInspector";

export function OrvekExplorePage() {
  const searchParams = useSearchParams();
  const { setInspectorTab } = useOrvekInspector();
  const rawActionId = searchParams.get(EXPLORE_ACTION_ID_PARAM);
  const parsedActionId = useMemo(
    () => parseExploreActionIdParam(rawActionId),
    [rawActionId]
  );
  const hasActionHandoffRequest = rawActionId !== null;

  const [tab, setTab] = useState<V0ExploreTabId>("free");
  const [handoffContext, setHandoffContext] = useState<ExploreActionHandoffContext | null>(null);
  const [isLoadingHandoff, setIsLoadingHandoff] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [investigations, setInvestigations] = useState<
    Array<{ id: string; title: string; status?: string; organizingQuestion?: string }>
  >([]);
  const [isLoadingInvestigations, setIsLoadingInvestigations] = useState(true);
  const [activeQuestions, setActiveQuestions] = useState<ActiveQuestionItem[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [fieldworkItems, setFieldworkItems] = useState<WatchForItem[]>([]);
  const [isLoadingFieldwork, setIsLoadingFieldwork] = useState(true);
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedFieldworkId, setSelectedFieldworkId] = useState<string | null>(null);

  const handleConversationUpdated = useCallback(() => {
    refreshExploreSessionMovement();
  }, []);

  const handleActiveSessionIdChange = useCallback((sessionId: string | null) => {
    setExploreSessionBridgeSessionId(sessionId);
  }, []);

  const {
    messages,
    draft,
    setDraft,
    isBooting,
    isSending,
    errorMessage,
    sendMessage,
  } = useOrvekExploreChat({
    onActiveSessionIdChange: handleActiveSessionIdChange,
    onConversationUpdated: handleConversationUpdated,
  });

  useEffect(() => {
    return () => {
      setExploreSessionBridgeSessionId(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!hasActionHandoffRequest) {
      setHandoffContext(null);
      setHandoffError(null);
      setIsLoadingHandoff(false);
      return;
    }

    if (!parsedActionId) {
      setHandoffContext(null);
      setHandoffError(EXPLORE_HANDOFF_UNAVAILABLE_COPY);
      setIsLoadingHandoff(false);
      return;
    }

    void (async () => {
      setIsLoadingHandoff(true);
      setHandoffError(null);
      try {
        const data = await fetchActionsPageData();
        if (cancelled) return;
        const context = resolveExploreActionHandoffContext(data, parsedActionId);
        if (!context) {
          setHandoffContext(null);
          setHandoffError(EXPLORE_HANDOFF_UNAVAILABLE_COPY);
          return;
        }
        setHandoffContext(context);
      } catch {
        if (!cancelled) {
          setHandoffContext(null);
          setHandoffError(EXPLORE_HANDOFF_UNAVAILABLE_COPY);
        }
      } finally {
        if (!cancelled) setIsLoadingHandoff(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasActionHandoffRequest, parsedActionId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoadingInvestigations(true);
      setIsLoadingQuestions(true);
      setIsLoadingFieldwork(true);
      try {
        const [investigationsResponse, questionsResponse, fieldworkResponse] = await Promise.all([
          fetch("/api/investigations?limit=20", { method: "GET", cache: "no-store" }),
          fetch(ACTIVE_QUESTIONS_ENDPOINT, { method: "GET", cache: "no-store" }),
          fetch(WATCH_FOR_ENDPOINT, { method: "GET", cache: "no-store" }),
        ]);

        if (!cancelled) {
          if (investigationsResponse.ok) {
            const payload = (await investigationsResponse.json()) as {
              items?: Array<{
                id: string;
                title: string;
                status?: string;
                organizingQuestion?: string;
              }>;
            };
            const items = Array.isArray(payload.items) ? payload.items : [];
            setInvestigations(items);
            setSelectedInvestigationId(items[0]?.id ?? null);
          } else {
            setInvestigations([]);
          }

          if (questionsResponse.ok) {
            const payload = (await questionsResponse.json()) as { items?: ActiveQuestionItem[] };
            const items = Array.isArray(payload.items) ? payload.items : [];
            setActiveQuestions(items);
            setSelectedQuestionId(items[0]?.id ?? null);
          } else {
            setActiveQuestions([]);
          }

          if (fieldworkResponse.ok) {
            const payload = (await fieldworkResponse.json()) as { items?: WatchForItem[] };
            const items = Array.isArray(payload.items) ? payload.items : [];
            setFieldworkItems(items);
            setSelectedFieldworkId(items[0]?.id ?? null);
          } else {
            setFieldworkItems([]);
          }
        }
      } catch {
        if (!cancelled) {
          setInvestigations([]);
          setActiveQuestions([]);
          setFieldworkItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingInvestigations(false);
          setIsLoadingQuestions(false);
          setIsLoadingFieldwork(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const explore = useMemo(
    () =>
      mapExploreDataToV0Props({
        activeTab: tab,
        hasActionHandoffRequest,
        handoffContext,
        isLoadingHandoff,
        handoffError,
        messages,
        composerDraft: draft,
        isBooting,
        isSending,
        errorMessage,
        investigations: {
          isLoading: isLoadingInvestigations,
          items: mapInvestigationRowsToExploreItems(investigations),
          selectedId: selectedInvestigationId,
        },
        questions: {
          isLoading: isLoadingQuestions,
          items: mapActiveQuestionsToExploreQuestions(activeQuestions),
          selectedId: selectedQuestionId,
        },
        fieldwork: {
          isLoading: isLoadingFieldwork,
          items: mapWatchForToExploreFieldwork(fieldworkItems),
          selectedId: selectedFieldworkId,
        },
      }),
    [
      tab,
      hasActionHandoffRequest,
      handoffContext,
      isLoadingHandoff,
      handoffError,
      messages,
      draft,
      isBooting,
      isSending,
      errorMessage,
      isLoadingInvestigations,
      investigations,
      selectedInvestigationId,
      isLoadingQuestions,
      activeQuestions,
      selectedQuestionId,
      isLoadingFieldwork,
      fieldworkItems,
      selectedFieldworkId,
    ]
  );

  const dataApi = useMemo(
    () => ({
      ...EMPTY_ORVEK_DATA_API,
      explore,
    }),
    [explore]
  );

  const openInspectorMovement = useCallback(() => {
    setInspectorTab("movement");
  }, [setInspectorTab]);

  const pageHandlers = useMemo(
    () => ({
      explore: {
        onTabChange: setTab,
        onDraftChange: setDraft,
        onSend: () => {
          void sendMessage();
        },
        onQuickPrompt: (prompt: string) => {
          setDraft(prompt);
          openInspectorMovement();
        },
        onOpenInspector: openInspectorMovement,
        onComposerFocus: openInspectorMovement,
        onInvestigationSelect: setSelectedInvestigationId,
        onQuestionSelect: setSelectedQuestionId,
        onFieldworkSelect: setSelectedFieldworkId,
      },
    }),
    [openInspectorMovement, sendMessage, setDraft]
  );

  return (
    <OrvekV0PageShell data={dataApi} handlers={pageHandlers}>
      <ExplorePage />
    </OrvekV0PageShell>
  );
}
