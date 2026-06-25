"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  mapExploreDataToV0Props,
  type V0ExploreTabId,
} from "@/lib/orvek-adapters/explore";

import { useOrvekExploreChat } from "./useOrvekExploreChat";
import { useOrvekInspector } from "./useOrvekInspector";
import { V0ExploreView } from "./views/V0ExploreView";

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

    const load = async () => {
      setIsLoadingHandoff(true);
      setHandoffError(null);

      try {
        const data = await fetchActionsPageData();
        if (cancelled) {
          return;
        }

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
        if (!cancelled) {
          setIsLoadingHandoff(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [hasActionHandoffRequest, parsedActionId]);

  const viewData = useMemo(
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
    ]
  );

  const openInspectorMovement = useCallback(() => {
    setInspectorTab("movement");
  }, [setInspectorTab]);

  return (
    <V0ExploreView
      data={viewData}
      handlers={{
        onTabChange: setTab,
        onDraftChange: setDraft,
        onSend: () => {
          void sendMessage();
        },
        onQuickPrompt: (prompt) => {
          setDraft(prompt);
          openInspectorMovement();
        },
        onOpenInspector: openInspectorMovement,
        onComposerFocus: openInspectorMovement,
      }}
    />
  );
}
