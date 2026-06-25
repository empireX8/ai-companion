"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Compass, Loader2, PanelRight, Send, Sparkles } from "lucide-react";

import { ExploreConversationReviewStrip } from "@/components/explore/ExploreConversationReviewStrip";
import { ExploreModelMovementStrip } from "@/components/explore/ExploreModelMovementStrip";
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
import {
  EXPLORE_CHAT_EMPTY_PROMPT,
  EXPLORE_CHAT_PLACEHOLDER,
  EXPLORE_GROUNDING_SECTION_INTRO,
  EXPLORE_GROUNDING_SECTION_LABEL,
  EXPLORE_HANDOFF_BANNER_LABEL,
  EXPLORE_HANDOFF_LOADING_COPY,
  EXPLORE_HANDOFF_UNAVAILABLE_COPY,
  EXPLORE_HANDOFF_VIEW_DECISION_LABEL,
  EXPLORE_PAGE_INTRO,
  EXPLORE_PAGE_TITLE,
} from "@/lib/explore-surface";
import { cn } from "@/lib/utils";

import { SectionLabel } from "./OrvekPrimitives";
import { useOrvekExploreChat } from "./useOrvekExploreChat";
import { useOrvekInspector } from "./useOrvekInspector";

type ExploreTab = "free" | "investigations" | "questions" | "fieldwork";

const TABS: { id: ExploreTab; label: string }[] = [
  { id: "free", label: "Free Explore" },
  { id: "investigations", label: "Investigations" },
  { id: "questions", label: "Active Questions" },
  { id: "fieldwork", label: "Fieldwork Bridge" },
];

const QUICK_PROMPTS = [
  "Explore a pattern",
  "Talk through a decision",
  "Start an investigation",
  "Inspect a conflict",
] as const;

function ExploreBubble({
  role,
  children,
}: {
  role: "user" | "orvek";
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "rounded-[14px] rounded-br-[5px] bg-primary text-primary-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.25)]"
            : "o-material rounded-[14px] rounded-bl-[5px] text-foreground"
        )}
      >
        {!isUser ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Orvek
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <span className="flex items-center gap-[3px]">
        <span className="size-[5px] animate-pulse rounded-full bg-primary/70" />
        <span
          className="size-[5px] animate-pulse rounded-full bg-primary/70"
          style={{ animationDelay: "400ms" }}
        />
        <span
          className="size-[5px] animate-pulse rounded-full bg-primary/70"
          style={{ animationDelay: "800ms" }}
        />
      </span>
      <span className="opacity-60">reflecting</span>
    </span>
  );
}

function ExploreActionHandoffBanner({
  context,
  isLoading,
  error,
}: {
  context: ExploreActionHandoffContext | null;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <div className="o-material flex items-center gap-3 rounded-2xl px-4 py-3">
        <Loader2 className="size-4 animate-spin text-action" aria-hidden />
        <div className="text-[13px] text-muted-foreground">{EXPLORE_HANDOFF_LOADING_COPY}</div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="o-material flex items-center gap-3 rounded-2xl px-4 py-3">
        <Compass className="size-4 text-muted-foreground" aria-hidden />
        <div className="text-[13px] text-muted-foreground">
          {error ?? EXPLORE_HANDOFF_UNAVAILABLE_COPY}
        </div>
      </div>
    );
  }

  return (
    <div className="o-material flex items-center gap-3 rounded-2xl px-4 py-3">
      <Compass className="size-4 shrink-0 text-action" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-action-foreground">
          {EXPLORE_HANDOFF_BANNER_LABEL}
        </div>
        <div className="mt-0.5 text-[13px] font-medium text-foreground">{context.title}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {toBucketLabel(context.bucket)} · {toStatusLabel(context.status)}
        </div>
      </div>
      <Link
        href={`/actions?bucket=${context.bucket}`}
        className="o-calm shrink-0 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:bg-accent/60"
      >
        {EXPLORE_HANDOFF_VIEW_DECISION_LABEL}
      </Link>
    </div>
  );
}

function toBucketLabel(bucket: ExploreActionHandoffContext["bucket"]): string {
  return bucket === "build" ? "Build Forward" : "Stabilize Now";
}

function toStatusLabel(status: ExploreActionHandoffContext["status"]): string {
  if (status === "done") return "Done";
  if (status === "helped") return "Helped";
  if (status === "didnt_help") return "Didn't help";
  return "Not started";
}

function FreeExplore({
  handoffBanner,
  onActiveSessionIdChange,
  onConversationUpdated,
}: {
  handoffBanner: React.ReactNode;
  onActiveSessionIdChange: (sessionId: string | null) => void;
  onConversationUpdated: () => void;
}) {
  const { setInspectorTab } = useOrvekInspector();
  const {
    messages,
    draft,
    setDraft,
    isBooting,
    isSending,
    errorMessage,
    sendMessage,
  } = useOrvekExploreChat({
    onActiveSessionIdChange,
    onConversationUpdated,
  });

  return (
    <div>
      {handoffBanner ? <div className="mb-4">{handoffBanner}</div> : null}

      <div className="space-y-3">
        {isBooting ? (
          <div className="text-[13px] text-muted-foreground">Loading conversation…</div>
        ) : messages.length === 0 ? (
          <div className="text-[14px] leading-relaxed text-muted-foreground">
            {EXPLORE_CHAT_EMPTY_PROMPT}
          </div>
        ) : (
          messages.map((message) => (
            <ExploreBubble key={message.id} role={message.role === "user" ? "user" : "orvek"}>
              {message.role === "assistant" && !message.content ? (
                <ThinkingIndicator />
              ) : (
                message.content
              )}
            </ExploreBubble>
          ))
        )}
      </div>

      <div className="mt-3">
        <SectionLabel>Grounded in</SectionLabel>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {EXPLORE_GROUNDING_SECTION_INTRO}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        <ExploreConversationReviewStrip surface="orvek" />
        <ExploreModelMovementStrip surface="orvek" />
      </div>

      <button
        type="button"
        onClick={() => setInspectorTab("movement")}
        className="o-calm mt-2.5 flex w-full items-center gap-2.5 rounded-2xl bg-action-muted/50 px-4 py-3 text-left ring-1 ring-inset ring-action/15 hover:bg-action-muted/70"
      >
        <Sparkles className="size-4 shrink-0 text-action-foreground" aria-hidden />
        <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground">
          Review possible model movement and confirm what is true in the inspector.
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-action-foreground">
          <PanelRight className="size-3.5" aria-hidden />
          Open
        </span>
      </button>

      <div className="o-material mt-4 flex items-center gap-2 rounded-2xl p-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => setInspectorTab("movement")}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
          placeholder={EXPLORE_CHAT_PLACEHOLDER}
          disabled={isBooting || isSending}
          className="flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => {
            void sendMessage();
          }}
          disabled={isBooting || isSending || !draft.trim()}
          className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-[1.05] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="size-3.5" />
          Ask
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-2 text-[12px] text-destructive">{errorMessage}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => {
              setDraft(prompt);
              setInspectorTab("movement");
            }}
            className="o-calm rounded-full bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function ExploreTabPlaceholder({ label }: { label: string }) {
  return (
    <div className="o-material rounded-2xl px-4 py-5 text-[13px] leading-relaxed text-muted-foreground">
      {label} will appear here when linked threads and fieldwork are available in this surface.
    </div>
  );
}

export function OrvekExplorePage() {
  const searchParams = useSearchParams();
  const rawActionId = searchParams.get(EXPLORE_ACTION_ID_PARAM);
  const parsedActionId = useMemo(
    () => parseExploreActionIdParam(rawActionId),
    [rawActionId]
  );
  const hasActionHandoffRequest = rawActionId !== null;

  const [tab, setTab] = useState<ExploreTab>("free");
  const [handoffContext, setHandoffContext] = useState<ExploreActionHandoffContext | null>(null);
  const [isLoadingHandoff, setIsLoadingHandoff] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const handleConversationUpdated = useCallback(() => {
    refreshExploreSessionMovement();
  }, []);

  const handleActiveSessionIdChange = useCallback((sessionId: string | null) => {
    setExploreSessionBridgeSessionId(sessionId);
  }, []);

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

  const handoffBanner = hasActionHandoffRequest ? (
    <ExploreActionHandoffBanner
      context={handoffContext}
      isLoading={isLoadingHandoff}
      error={handoffError}
    />
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{EXPLORE_PAGE_TITLE}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{EXPLORE_PAGE_INTRO}</p>
        <div className="o-sunken mt-3 inline-flex flex-wrap gap-0.5 rounded-[9px] p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "o-calm rounded-[6px] px-3 py-1.5 text-[13px] font-medium",
                tab === item.id
                  ? "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.16)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {tab === "free" ? (
            <FreeExplore
              handoffBanner={handoffBanner}
              onActiveSessionIdChange={handleActiveSessionIdChange}
              onConversationUpdated={handleConversationUpdated}
            />
          ) : tab === "investigations" ? (
            <ExploreTabPlaceholder label="Investigations" />
          ) : tab === "questions" ? (
            <ExploreTabPlaceholder label="Active questions" />
          ) : (
            <ExploreTabPlaceholder label="Fieldwork bridge" />
          )}
        </div>
      </div>
    </div>
  );
}
