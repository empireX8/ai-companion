"use client";

import Link from "next/link";
import { Compass, Loader2, PanelRight, Send, Sparkles } from "lucide-react";

import { ExploreConversationReviewStrip } from "@/components/explore/ExploreConversationReviewStrip";
import { ExploreModelMovementStrip } from "@/components/explore/ExploreModelMovementStrip";
import type { V0ExploreTabId, V0ExploreViewProps } from "@/lib/orvek-adapters/explore";
import { cn } from "@/lib/utils";

import { SectionLabel } from "../OrvekPrimitives";

export type V0ExploreViewHandlers = {
  onTabChange: (tab: V0ExploreTabId) => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onQuickPrompt: (prompt: string) => void;
  onOpenInspector: () => void;
  onComposerFocus: () => void;
};

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

function ExploreHandoffBanner({ handoff }: { handoff: V0ExploreViewProps["handoff"] }) {
  if (handoff.isLoading) {
    return (
      <div className="o-material flex items-center gap-3 rounded-2xl px-4 py-3">
        <Loader2 className="size-4 animate-spin text-action" aria-hidden />
        <div className="text-[13px] text-muted-foreground">{handoff.loadingCopy}</div>
      </div>
    );
  }

  if (!handoff.context) {
    return (
      <div className="o-material flex items-center gap-3 rounded-2xl px-4 py-3">
        <Compass className="size-4 text-muted-foreground" aria-hidden />
        <div className="text-[13px] text-muted-foreground">
          {handoff.error ?? handoff.unavailableCopy}
        </div>
      </div>
    );
  }

  return (
    <div className="o-material flex items-center gap-3 rounded-2xl px-4 py-3">
      <Compass className="size-4 shrink-0 text-action" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-action-foreground">
          {handoff.bannerLabel}
        </div>
        <div className="mt-0.5 text-[13px] font-medium text-foreground">{handoff.context.title}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {handoff.context.bucketLabel} · {handoff.context.statusLabel}
        </div>
      </div>
      <Link
        href={handoff.context.viewDecisionHref}
        className="o-calm shrink-0 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:bg-accent/60"
      >
        {handoff.viewDecisionLabel}
      </Link>
    </div>
  );
}

function ExploreTabPlaceholder({ copy }: { copy: string }) {
  return (
    <div className="o-material rounded-2xl px-4 py-5 text-[13px] leading-relaxed text-muted-foreground">
      {copy}
    </div>
  );
}

function FreeExploreTab({
  data,
  handlers,
  handoffBanner,
}: {
  data: V0ExploreViewProps;
  handlers: V0ExploreViewHandlers;
  handoffBanner: React.ReactNode;
}) {
  return (
    <div>
      {handoffBanner ? <div className="mb-4">{handoffBanner}</div> : null}

      <div className="space-y-3">
        {data.isBooting ? (
          <div className="text-[13px] text-muted-foreground">{data.chatLoadingCopy}</div>
        ) : data.messages.length === 0 ? (
          <div className="text-[14px] leading-relaxed text-muted-foreground">{data.emptyPrompt}</div>
        ) : (
          data.messages.map((message) => (
            <ExploreBubble key={message.id} role={message.role}>
              {message.isThinking ? <ThinkingIndicator /> : message.content}
            </ExploreBubble>
          ))
        )}
      </div>

      <div className="mt-3">
        <SectionLabel>{data.groundingSectionLabel}</SectionLabel>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {data.groundingSectionIntro}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        <ExploreConversationReviewStrip surface="orvek" />
        <ExploreModelMovementStrip surface="orvek" />
      </div>

      <button
        type="button"
        onClick={handlers.onOpenInspector}
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
          value={data.composerDraft}
          onChange={(event) => handlers.onDraftChange(event.target.value)}
          onFocus={handlers.onComposerFocus}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handlers.onSend();
            }
          }}
          placeholder={data.composerPlaceholder}
          disabled={data.isBooting || data.isSending}
          className="flex-1 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handlers.onSend}
          disabled={data.isBooting || data.isSending || !data.composerDraft.trim()}
          className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:brightness-[1.05] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="size-3.5" />
          Ask
        </button>
      </div>

      {data.errorMessage ? (
        <p className="mt-2 text-[12px] text-destructive">{data.errorMessage}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {data.quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handlers.onQuickPrompt(prompt)}
            className="o-calm rounded-full bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function V0ExploreView({
  data,
  handlers,
  handoffBannerSlot,
}: {
  data: V0ExploreViewProps;
  handlers: V0ExploreViewHandlers;
  handoffBannerSlot?: React.ReactNode;
}) {
  const handoffBanner =
    handoffBannerSlot ??
    (data.handoff.show ? <ExploreHandoffBanner handoff={data.handoff} /> : null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{data.pageTitle}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{data.pageIntro}</p>
        <div className="o-sunken mt-3 inline-flex flex-wrap gap-0.5 rounded-[9px] p-1">
          {data.tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handlers.onTabChange(item.id)}
              className={cn(
                "o-calm rounded-[6px] px-3 py-1.5 text-[13px] font-medium",
                data.activeTab === item.id
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
          {data.activeTab === "free" ? (
            <FreeExploreTab data={data} handlers={handlers} handoffBanner={handoffBanner} />
          ) : data.activeTab === "investigations" ? (
            <ExploreTabPlaceholder copy={data.placeholderTabs.investigations} />
          ) : data.activeTab === "questions" ? (
            <ExploreTabPlaceholder copy={data.placeholderTabs.questions} />
          ) : (
            <ExploreTabPlaceholder copy={data.placeholderTabs.fieldwork} />
          )}
        </div>
      </div>
    </div>
  );
}
