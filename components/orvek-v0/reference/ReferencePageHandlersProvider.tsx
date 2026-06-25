"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { V0ExploreTabId } from "@/lib/orvek-adapters/explore";
import { OrvekPageHandlersProvider } from "@/lib/orvek-v0/page-handlers";

import { useWorkbench } from "../store";

export function ReferencePageHandlersProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { select, setInspectorTab, openReport } = useWorkbench();
  const [exploreTab, setExploreTab] = useState<V0ExploreTabId>("free");
  const [exploreDraft, setExploreDraft] = useState("");
  const [decisionTab, setDecisionTab] = useState<"stabilize" | "build">("stabilize");
  const [selectedDecisionId, setSelectedDecisionId] = useState("d1");
  const [selectedInvestigationId, setSelectedInvestigationId] = useState("inv-1");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedFieldworkId, setSelectedFieldworkId] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState("all");
  const [timelineQuery, setTimelineQuery] = useState("");

  const handlers = useMemo(
    () => ({
      today: {
        onHeroInspect: () => select("d1"),
        onHeroSeeWhy: () => {
          select("mu-1");
          setInspectorTab("movement");
        },
        onNowRowSelect: (rowId: string) => select(rowId),
        onMovementSeeWhy: (movementId: string) => {
          select(movementId);
          setInspectorTab("movement");
        },
        capture: {
          captureText: "",
          displayText: "",
          isRecording: false,
          canContinue: false,
          onCaptureChange: () => {},
          onVoiceToggle: () => {},
          onContinue: () => router.push("/journal-chat"),
        },
      },
      explore: {
        onTabChange: setExploreTab,
        onDraftChange: setExploreDraft,
        onSend: () => setExploreDraft(""),
        onQuickPrompt: (prompt: string) => setExploreDraft(prompt),
        onOpenInspector: () => setInspectorTab("movement"),
        onComposerFocus: () => setInspectorTab("movement"),
        onInvestigationSelect: setSelectedInvestigationId,
        onQuestionSelect: setSelectedQuestionId,
        onFieldworkSelect: setSelectedFieldworkId,
      },
      decisions: {
        onTabChange: setDecisionTab,
        onOpenDecision: setSelectedDecisionId,
        onSendToFieldwork: () => {},
        onInspectorSelect: ({
          claimId,
          tab,
        }: {
          claimId: string;
          title: string;
          tab: "evidence" | "movement";
        }) => {
          select(claimId);
          setInspectorTab(tab);
        },
        onDraftChange: () => {},
        onReviewDueDecision: () => select("d1"),
        draft: "",
        fieldworkActionId: null,
      },
      timeline: {
        onFilterChange: setTimelineFilter,
        onSearchChange: setTimelineQuery,
        onOpenItem: (rowId: string) => {
          select(rowId);
          setInspectorTab("movement");
        },
      },
      whatChanged: {
        onMovementSelect: (id: string) => {
          select(id);
          setInspectorTab("movement");
        },
      },
    }),
    [router, select, setInspectorTab]
  );

  return <OrvekPageHandlersProvider value={handlers}>{children}</OrvekPageHandlersProvider>;
}
