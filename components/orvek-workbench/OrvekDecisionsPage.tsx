"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DecisionsPage } from "@/components/orvek-v0/pages/decisions";
import { OrvekV0PageShell } from "@/components/orvek-v0/production/OrvekV0PageShell";
import {
  createFieldworkFromAction,
  fetchActionsPageData,
  type ActionBucket,
  type ActionsPageData,
  type SurfacedActionView,
} from "@/lib/actions-api";
import {
  DECISIONS_ERROR_COPY,
  DECISIONS_SEND_TO_FIELDWORK_ERROR_COPY,
} from "@/lib/decisions-surface";
import { mapDecisionsDataToV0Props } from "@/lib/orvek-adapters/decisions";
import { EMPTY_ORVEK_DATA_API } from "@/lib/orvek-v0/empty-api";

import { useOrvekInspector } from "./useOrvekInspector";

export function OrvekDecisionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { select, setInspectorTab } = useOrvekInspector();

  const [tab, setTab] = useState<ActionBucket>("stabilize");
  const [data, setData] = useState<ActionsPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [creatingActionId, setCreatingActionId] = useState<string | null>(null);
  const [createErrorByActionId, setCreateErrorByActionId] = useState<Record<string, string>>({});

  useEffect(() => {
    const bucket = searchParams.get("bucket");
    if (bucket === "build") {
      setTab("build");
      return;
    }
    if (bucket === "stabilize") {
      setTab("stabilize");
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const nextData = await fetchActionsPageData();
        if (cancelled) return;
        if (!nextData) {
          setData(null);
          setErrorMessage(DECISIONS_ERROR_COPY);
          return;
        }
        setData(nextData);
      } catch {
        if (!cancelled) {
          setData(null);
          setErrorMessage(DECISIONS_ERROR_COPY);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const list = useMemo<SurfacedActionView[]>(() => {
    if (!data) return [];
    return tab === "stabilize" ? data.stabilizeNow : data.buildForward;
  }, [data, tab]);

  useEffect(() => {
    if (list.length === 0) {
      setWorkspaceId(null);
      return;
    }
    if (!workspaceId || !list.some((item) => item.id === workspaceId)) {
      setWorkspaceId(list[0]!.id);
    }
  }, [list, workspaceId]);

  const decisions = useMemo(
    () =>
      mapDecisionsDataToV0Props({
        tab,
        list,
        selectedDecisionId: workspaceId,
        isLoading,
        errorMessage,
        createErrorByActionId,
      }),
    [tab, list, workspaceId, isLoading, errorMessage, createErrorByActionId]
  );

  const dataApi = useMemo(
    () => ({
      ...EMPTY_ORVEK_DATA_API,
      decisions,
    }),
    [decisions]
  );

  const handleTabChange = (nextTab: ActionBucket) => {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("bucket", nextTab);
    router.replace(`/actions?${params.toString()}`, { scroll: false });
  };

  const openDecision = (id: string) => {
    setWorkspaceId(id);
    const action = list.find((item) => item.id === id);
    if (action?.linkedClaimId) {
      select({
        objectType: "pattern_claim",
        objectId: action.linkedClaimId,
        title: action.linkedClaimSummary ?? action.title,
        sourceSurface: "decisions",
        tab: "evidence",
      });
    }
  };

  const handleSendToFieldwork = async (decisionId: string) => {
    const action = list.find((item) => item.id === decisionId);
    if (!action || creatingActionId === action.id) return;

    setCreatingActionId(action.id);
    setCreateErrorByActionId((current) => {
      if (!current[action.id]) return current;
      const next = { ...current };
      delete next[action.id];
      return next;
    });

    try {
      const created = await createFieldworkFromAction(action);
      if (!created?.id) {
        setCreateErrorByActionId((current) => ({
          ...current,
          [action.id]: DECISIONS_SEND_TO_FIELDWORK_ERROR_COPY,
        }));
        return;
      }
      router.push(`/watch-for/${created.id}`);
    } finally {
      setCreatingActionId((current) => (current === action.id ? null : current));
    }
  };

  const pageHandlers = useMemo(
    () => ({
      decisions: {
        onTabChange: handleTabChange,
        onOpenDecision: openDecision,
        onSendToFieldwork: (decisionId: string) => {
          void handleSendToFieldwork(decisionId);
        },
        onInspectorSelect: ({
          claimId,
          title,
          tab: inspectorTab,
        }: {
          claimId: string;
          title: string;
          tab: "evidence" | "movement";
        }) => {
          select({
            objectType: "pattern_claim",
            objectId: claimId,
            title,
            sourceSurface: "decisions",
            tab: inspectorTab,
          });
          setInspectorTab(inspectorTab);
        },
        onDraftChange: setDraft,
        onReviewDueDecision: () => {
          const next = list.find((item) => item.status === "not_started");
          if (next) openDecision(next.id);
        },
        draft,
        fieldworkActionId: creatingActionId,
      },
    }),
    [creatingActionId, draft, list, select, setInspectorTab]
  );

  return (
    <OrvekV0PageShell data={dataApi} handlers={pageHandlers}>
      <DecisionsPage />
    </OrvekV0PageShell>
  );
}
