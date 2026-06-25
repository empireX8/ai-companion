import type { ActionStatus, SurfacedActionView } from "@/lib/actions-api";
import {
  mapDecisionsDataToV0Props,
  type V0DecisionsViewProps,
} from "@/lib/orvek-adapters/decisions";
import {
  mapExploreDataToV0Props,
  mapInvestigationRowsToExploreItems,
  type V0ExploreViewProps,
} from "@/lib/orvek-adapters/explore";
import type { V0TodayViewProps } from "@/lib/orvek-adapters/types";
import type { V0WhatChangedViewProps } from "@/lib/orvek-adapters/what-changed";
import type { V0TimelineViewProps } from "@/lib/orvek-adapters/timeline";
import { TIMELINE_SEMANTIC_FILTERS } from "@/lib/timeline-semantic-layers";
import { WHAT_CHANGED_REENTRY_LINKS } from "@/lib/what-changed-surface";

import { getObject, getObjects, OBJECTS } from "./mock-orvek-data";

function mockSurfacedAction(
  id: string,
  status: ActionStatus,
  note: string | null = null
): SurfacedActionView {
  const obj = getObject(id)!;
  return {
    id: obj.id,
    title: obj.title,
    whySuggested: obj.summary ?? obj.recommendation ?? "",
    bucket: "stabilize",
    effort: "Medium",
    linkedFamily: null,
    linkedFamilyLabel: null,
    linkedClaimId: null,
    linkedClaimSummary: obj.summary ?? null,
    linkedGoalId: null,
    linkedGoalStatement: null,
    linkedSourceLabel: "Map",
    status,
    note,
    surfacedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildReferenceTodayProps(): V0TodayViewProps {
  const lead = getObject("d1")!;

  return {
    briefingDate: "Tuesday",
    briefingTitle: "Your model moved in 3 places.",
    briefingMeta:
      "2 reviews are due and 1 report is ready. Start where the change is most consequential.",
    isLoading: false,
    loadingCopy: "",
    heroEmptyCopy: "Nothing needs your attention right now.",
    hero: {
      kicker: "decision outcome due",
      title: lead.title,
      summary:
        "You set a review window after choosing to prototype the architecture first. Recording what happened is what lets Orvek tell whether the scope-reopening loop actually eased.",
      whatChanged: "Outcome window closed",
      linkedReceipts: `${lead.evidenceCount ?? 6} receipts`,
      lastEvidence: "2 hours ago",
      primaryAction: { kind: "inspect" },
      showSeeWhyMoved: true,
    },
    primaryActions: [
      { label: "Continue from what changed", href: "/what-changed", primary: true },
      { label: "Add what happened", href: "/journal-chat" },
      { label: "Review outcome", href: "/actions" },
      { label: "Check in on fieldwork", href: "/watch-for" },
      { label: "Capture new signal", href: "/journal-chat" },
    ],
    nowRows: [
      {
        id: "m-loop-1",
        kicker: "Watch For",
        icon: "watch",
        title: "Scope-reopening pattern triggered again",
        status: "Active",
        href: null,
        hasSelection: true,
      },
      {
        id: "f1",
        kicker: "Fieldwork",
        icon: "fieldwork",
        title: "Small public test — narrow version before reopening",
        status: "Due today",
        href: null,
        hasSelection: true,
      },
      {
        id: "d1",
        kicker: "Outcome review",
        icon: "decision",
        title: lead.title,
        status: "Review due",
        href: null,
        hasSelection: true,
      },
      {
        id: "aq-3",
        kicker: "Open question",
        icon: "question",
        title: "Which features are essential for a first version?",
        status: "Needs input",
        href: null,
        hasSelection: true,
      },
    ],
    nowEmptyCopy: "Nothing is active in this window.",
    movements: [
      {
        id: "mu-1",
        previous: "Decision pressure was treated as an isolated state.",
        updated: "Pressure is now modeled as an output of the scope-reopening loop.",
        evidence: "6 receipts tied pressure to repeated scope reopening.",
      },
      {
        id: "mu-2",
        previous: "Background context was held as loose metadata.",
        updated: "Context Profile promoted to a first-class, correctable model layer.",
        evidence: "Recent captures referenced current build constraints directly.",
      },
      {
        id: "aq-1",
        previous: "Avoidance read as a general tendency under pressure.",
        updated: "Avoidance appears strongest when social consequence is uncertain.",
        evidence: "A decision review added social-consequence detail.",
      },
    ],
    movementEmptyCopy: "No recent movement in this window.",
    report: {
      title: "Weekly Model Movement report",
      meta: "Ready · 3 loops, 2 decisions, 1 context update",
      href: "/what-changed",
    },
    receipts: getObjects(["r6", "r5", "r2"]).map((r) => ({
      id: r.id,
      quote: r.sourceText ?? r.title,
      meta: `${r.sourceOrigin ?? "Receipt"} · ${r.date ?? r.lastUpdated ?? ""}`,
      href: "#",
    })),
    checkIns: [],
    priorReadEmptyCopy:
      "Prior read is not shown in this feed — open movement in the inspector.",
  };
}

export function buildReferenceExploreProps(activeTab: V0ExploreViewProps["activeTab"] = "free"): V0ExploreViewProps {
  return mapExploreDataToV0Props({
    activeTab,
    hasActionHandoffRequest: false,
    handoffContext: null,
    isLoadingHandoff: false,
    handoffError: null,
    messages: [
      {
        id: "ref-1",
        role: "user",
        content:
          "Why do I feel like we need to see the architecture visually before locking design?",
      },
      {
        id: "ref-2",
        role: "assistant",
        content:
          "You seem to trust decisions more once the system can express itself visually. This connects to a broader pattern: you reject abstract strategy when it feels untested, but you also resist shallow visual polish. The useful move may be an architecture prototype, not a design prototype.",
      },
    ],
    composerDraft: "",
    isBooting: false,
    isSending: false,
    errorMessage: null,
    investigations: {
      isLoading: false,
      items: mapInvestigationRowsToExploreItems([
        {
          id: "inv-1",
          title: getObject("inv-1")!.title,
          status: getObject("inv-1")!.status,
          organizingQuestion: getObject("inv-1")!.summary,
        },
        {
          id: "inv-2",
          title: getObject("inv-2")!.title,
          status: getObject("inv-2")!.status,
          organizingQuestion: getObject("inv-2")!.summary,
        },
      ]),
      selectedId: "inv-1",
    },
    questions: {
      isLoading: false,
      items: [],
      selectedId: null,
    },
    fieldwork: {
      isLoading: false,
      items: [],
      selectedId: null,
    },
  });
}

export function buildReferenceDecisionsProps(): V0DecisionsViewProps {
  const list = [
    mockSurfacedAction("d1", "done", null),
    mockSurfacedAction("d2", "not_started"),
    mockSurfacedAction("d3", "not_started"),
    mockSurfacedAction("d-public", "done", "Chose to ship narrow prototype"),
    mockSurfacedAction("d-nav", "done", null),
    mockSurfacedAction("d-rev-1", "helped", "Helped clarify scope"),
    mockSurfacedAction("d-rev-2", "didnt_help", "Did not reduce reopening"),
    mockSurfacedAction("d-rev-3", "helped", "Useful signal"),
  ];

  return mapDecisionsDataToV0Props({
    tab: "stabilize",
    list,
    selectedDecisionId: "d1",
    isLoading: false,
    errorMessage: null,
    createErrorByActionId: {},
  });
}

export function buildReferenceTimelineProps(): V0TimelineViewProps {
  const groups: V0TimelineViewProps["groups"] = [
    {
      heading: "Today",
      rows: getObjects(["t1", "t2", "t3", "t4"]).map((event) => ({
        id: event.id,
        title: event.title,
        summary: event.after ?? event.summary ?? null,
        eventLabel: event.eventType ?? "Event",
        time: "10:00",
        date: "24 Jun",
        laneKey: "evidence",
        moved: Boolean(event.before || event.after),
        href: null,
        inspectorTarget: null,
        selectableObjectId: event.id,
        isModelChange: event.type === "model-update",
        showBeforeAfterBlock: Boolean(event.before || event.after),
        beforeSummary: event.before ?? null,
        afterSummary: event.after ?? null,
        priorReadUnavailableCopy:
          "Prior read not shown in this stream.",
      })),
    },
    {
      heading: "This week",
      rows: getObjects(["t5", "t6", "t7"]).map((event) => ({
        id: event.id,
        title: event.title,
        summary: event.after ?? event.summary ?? null,
        eventLabel: event.eventType ?? "Event",
        time: "09:00",
        date: "22 Jun",
        laneKey: "receipt",
        moved: false,
        href: null,
        inspectorTarget: null,
        selectableObjectId: event.id,
        isModelChange: false,
        showBeforeAfterBlock: false,
        beforeSummary: null,
        afterSummary: null,
        priorReadUnavailableCopy:
          "Prior read not shown in this stream.",
      })),
    },
  ];

  return {
    pageIntro:
      "How the model evolved — receipts, decisions, reports, fieldwork, and movement.",
    filters: TIMELINE_SEMANTIC_FILTERS,
    activeFilter: "all",
    lanes: [
      { dotClass: "bg-primary", label: "Model / context movement" },
      { dotClass: "bg-action", label: "Reports / fieldwork / imports" },
      { dotClass: "bg-foreground/60", label: "Decisions" },
      { dotClass: "bg-muted-foreground", label: "Receipts" },
    ],
    searchQuery: "",
    isLoading: false,
    loadingCopy: "",
    activityError: null,
    modelLayerError: null,
    emptyCopy: "No timeline events in this window.",
    emptyStreamHeading: "Earlier",
    groups,
    selectedObjectId: null,
  };
}

export function buildReferenceWhatChangedProps(): V0WhatChangedViewProps {
  const primary = getObject("mu-1")!;

  return {
    pageTitle: "What Changed",
    pageMeta: "Movement across your model",
    pageIntro:
      "The most recent meaningful updates to your understanding — with evidence and re-entry links.",
    emptyPrimary: "No model movement is visible yet.",
    emptySecondary: "Capture signal and supported updates will appear here.",
    primarySectionLabel: "Most recent movement",
    primarySectionIntro: "The latest meaningful change in your model.",
    earlierSectionLabel: "Earlier movement",
    earlierSectionIntro: "Previous updates in this window.",
    whatChangedLabel: "What changed",
    whyLabel: "Why Orvek thinks this moved",
    evidenceLabel: "Supporting evidence",
    evidenceIntro: "Receipts and links tied to this movement.",
    reentryLabel: "Continue from here",
    reentryIntro: "Open related surfaces to review or act on this movement.",
    reentryLinks: [...WHAT_CHANGED_REENTRY_LINKS],
    primary: {
      id: primary.id,
      title: primary.title,
      recordedAt: primary.lastUpdated ?? "Today",
      summary: primary.after ?? primary.summary ?? "",
      affectedObjectType: "usermap_conclusion",
      affectedObjectId: "m-loop-1",
      affectedObjectHref: "/your-map",
    },
    earlier: getObjects(["mu-2", "mu-3"]).map((item) => ({
      id: item.id,
      title: item.title,
      recordedAt: item.lastUpdated ?? "—",
      summary: item.after ?? item.summary ?? "",
      affectedObjectType: "usermap_conclusion" as const,
      affectedObjectId: null,
      affectedObjectHref: null,
    })),
    evidenceItems: [],
  };
}

export function listAllMockObjects(): Record<string, (typeof OBJECTS)[string]> {
  return OBJECTS;
}
