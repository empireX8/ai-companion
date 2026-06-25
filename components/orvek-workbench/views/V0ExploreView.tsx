"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Compass,
  Loader2,
  PanelRight,
  Send,
  Sparkles,
} from "lucide-react";

import { ExploreConversationReviewStrip } from "@/components/explore/ExploreConversationReviewStrip";
import { ExploreModelMovementStrip } from "@/components/explore/ExploreModelMovementStrip";
import type {
  V0ExploreGroundingChip,
  V0ExploreTabId,
  V0ExploreViewProps,
} from "@/lib/orvek-adapters/explore";
import { cn } from "@/lib/utils";

import { Chip, SectionLabel } from "../OrvekPrimitives";

export type V0ExploreViewHandlers = {
  onTabChange: (tab: V0ExploreTabId) => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onQuickPrompt: (prompt: string) => void;
  onOpenInspector: () => void;
  onComposerFocus: () => void;
  onGroundingChip?: (chip: V0ExploreGroundingChip) => void;
  onInvestigationSelect?: (id: string) => void;
  onQuestionSelect?: (id: string) => void;
  onFieldworkSelect?: (id: string) => void;
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
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      Thinking…
    </span>
  );
}

function ExploreHandoffBanner({
  handoff,
}: {
  handoff: V0ExploreViewProps["handoff"];
}) {
  if (!handoff.show) {
    return null;
  }

  if (handoff.isLoading) {
    return (
      <div className="o-material flex items-center gap-3 rounded-2xl px-4 py-3">
        <Compass className="size-4 text-muted-foreground" aria-hidden />
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

function InvBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-1.5 text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

function GroundedInRow({
  data,
  handlers,
}: {
  data: V0ExploreViewProps;
  handlers: V0ExploreViewHandlers;
}) {
  return (
    <div className="mt-3" data-testid="orvek-explore-grounding-row">
      <SectionLabel>{data.groundingSectionLabel}</SectionLabel>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {data.groundingChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={chip.disabled}
            onClick={() => {
              if (!chip.disabled) {
                handlers.onGroundingChip?.(chip);
              }
            }}
          >
            <Chip
              tone={chip.disabled ? "neutral" : "evidence"}
              className={cn(
                chip.disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:opacity-80"
              )}
            >
              {chip.label}
            </Chip>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        {data.groundingSectionIntro}
      </p>
    </div>
  );
}

function LiveDetectionLine({ copy }: { copy: string }) {
  return (
    <div
      className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground"
      data-testid="orvek-explore-live-detection"
    >
      <span className="inline-flex size-2 rounded-full bg-muted-foreground/40" aria-hidden />
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
    <div data-testid="orvek-explore-free-tab">
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

      <GroundedInRow data={data} handlers={handlers} />
      <LiveDetectionLine copy={data.liveDetectionCopy} />

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
          {data.inspectorMovementCta}
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

function InvestigationsTab({
  data,
  handlers,
}: {
  data: V0ExploreViewProps;
  handlers: V0ExploreViewHandlers;
}) {
  const { investigations } = data;
  const [localId, setLocalId] = useState<string | null>(investigations.selectedId);
  const selected =
    investigations.items.find((item) => item.id === localId) ?? investigations.items[0] ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[230px_1fr]" data-testid="orvek-explore-investigations-tab">
      <div>
        <SectionLabel>Threads</SectionLabel>
        {investigations.isLoading ? (
          <p className="mt-2 text-[13px] text-muted-foreground">Loading investigations…</p>
        ) : investigations.items.length === 0 ? (
          <div className="o-material mt-2 rounded-[10px] px-3 py-4 text-[13px] text-muted-foreground">
            {investigations.emptyListCopy}
          </div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {investigations.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setLocalId(item.id);
                  handlers.onInvestigationSelect?.(item.id);
                }}
                className={cn(
                  "o-calm w-full rounded-[10px] px-2.5 py-2 text-left text-[13px] leading-snug",
                  selected?.id === item.id
                    ? "bg-card text-foreground shadow-[0_1px_3px_-1px_rgba(30,41,59,0.16)] ring-1 ring-inset ring-primary/20"
                    : "bg-secondary/50 text-foreground hover:bg-secondary"
                )}
              >
                {item.title}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {item.statusLabel} · {item.meta}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0">
        {!selected ? (
          <div className="o-material rounded-[10px] px-4 py-5 text-[13px] text-muted-foreground">
            {investigations.emptyDetailCopy}
          </div>
        ) : (
          <>
            <Chip tone="evidence">Investigation · {selected.statusLabel}</Chip>
            <h2 className="mt-2 text-lg font-semibold leading-snug text-foreground text-pretty">
              {selected.title}
            </h2>
            <InvBlock label="Why it matters">
              <p className="text-muted-foreground">{selected.meta}</p>
            </InvBlock>
            <InvBlock label="Hypotheses">
              <p className="text-[13px] text-muted-foreground">No hypotheses captured yet.</p>
            </InvBlock>
            <InvBlock label="Missing evidence">
              <p className="text-[13px] text-muted-foreground">
                Missing evidence is not listed for this investigation yet.
              </p>
            </InvBlock>
            <InvBlock label="Linked objects">
              <p className="text-[13px] text-muted-foreground">No linked objects yet.</p>
            </InvBlock>
            <div className="mt-4 rounded-[12px] rounded-l-sm border-l-2 border-l-primary/50 bg-secondary/50 p-3 text-[13px] italic text-muted-foreground">
              Continue this thread in Free Explore when you are ready to add evidence.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QuestionsTab({
  data,
  handlers,
}: {
  data: V0ExploreViewProps;
  handlers: V0ExploreViewHandlers;
}) {
  const { questions } = data;
  const [localId, setLocalId] = useState<string | null>(questions.selectedId);
  const selected = questions.items.find((item) => item.id === localId) ?? questions.items[0] ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[290px_1fr]" data-testid="orvek-explore-questions-tab">
      <div>
        <SectionLabel>Open questions</SectionLabel>
        {questions.isLoading ? (
          <p className="mt-2 text-[13px] text-muted-foreground">Loading questions…</p>
        ) : questions.items.length === 0 ? (
          <div className="o-material mt-2 rounded-[10px] px-3 py-4 text-[13px] text-muted-foreground">
            {questions.emptyListCopy}
          </div>
        ) : (
          <div className="o-material mt-2 divide-y divide-border overflow-hidden rounded-[10px]">
            {questions.items.map((item) => {
              const active = selected?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setLocalId(item.id);
                    handlers.onQuestionSelect?.(item.id);
                  }}
                  className={cn(
                    "o-calm flex w-full items-start gap-2.5 px-3 py-2.5 text-left",
                    active ? "bg-accent/50" : "hover:bg-accent/30"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 size-1.5 shrink-0 rounded-full",
                      active ? "bg-action" : "bg-muted-foreground/40"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium leading-snug text-foreground text-pretty">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {item.evidenceMeta}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="min-w-0">
        {!selected ? (
          <div className="o-material rounded-[10px] px-4 py-5 text-[13px] text-muted-foreground">
            {questions.emptyDetailCopy}
          </div>
        ) : (
          <>
            <Chip tone="action">Active question · {selected.statusLabel}</Chip>
            <h2 className="mt-2 text-lg font-semibold leading-snug text-foreground text-pretty">
              {selected.title}
            </h2>
            <InvBlock label="Why this is open">{selected.organizingQuestion}</InvBlock>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="o-material rounded-[10px] p-3.5">
                <SectionLabel className="text-primary">Would resolve toward yes if</SectionLabel>
                <p className="mt-2 text-[13px] text-muted-foreground">{questions.resolveYesEmptyCopy}</p>
              </div>
              <div className="o-material rounded-[10px] p-3.5">
                <SectionLabel className="text-destructive/80">Would resolve toward no if</SectionLabel>
                <p className="mt-2 text-[13px] text-muted-foreground">{questions.resolveNoEmptyCopy}</p>
              </div>
            </div>
            <InvBlock label="What this question touches">
              <p className="text-[13px] text-muted-foreground">{questions.relatedEmptyCopy}</p>
            </InvBlock>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Link
                href={`/active-questions/${selected.id}`}
                className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-[1.05]"
              >
                See evidence
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FieldworkTab({
  data,
  handlers,
}: {
  data: V0ExploreViewProps;
  handlers: V0ExploreViewHandlers;
}) {
  const { fieldwork } = data;
  const [localId, setLocalId] = useState<string | null>(fieldwork.selectedId);
  const selected = fieldwork.items.find((item) => item.id === localId) ?? fieldwork.items[0] ?? null;

  const fields = selected
    ? [
        { label: "Expected signal", value: selected.reason || fieldwork.fieldsEmptyCopy },
        { label: "What to observe", value: fieldwork.fieldsEmptyCopy },
        { label: "What would confirm", value: fieldwork.fieldsEmptyCopy },
        { label: "What would weaken", value: fieldwork.fieldsEmptyCopy },
        { label: "Due / review window", value: fieldwork.fieldsEmptyCopy },
      ]
    : [];

  return (
    <div data-testid="orvek-explore-fieldwork-tab">
      {fieldwork.isLoading ? (
        <p className="text-[13px] text-muted-foreground">Loading fieldwork…</p>
      ) : fieldwork.items.length === 0 ? (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="o-material rounded-[10px] px-3 py-4 text-[13px] text-muted-foreground">
            {fieldwork.emptyListCopy}
          </div>
          <div className="o-material rounded-[10px] px-4 py-5 text-[13px] text-muted-foreground">
            {fieldwork.emptyDetailCopy}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <div>
            <SectionLabel>Fieldwork prompts</SectionLabel>
            <div className="mt-2 space-y-1.5">
              {fieldwork.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setLocalId(item.id);
                    handlers.onFieldworkSelect?.(item.id);
                  }}
                  className={cn(
                    "o-calm w-full rounded-[10px] px-2.5 py-2 text-left text-[13px] leading-snug",
                    selected?.id === item.id
                      ? "bg-card text-foreground shadow-[0_1px_3px_-1px_rgba(30,41,59,0.16)]"
                      : "bg-secondary/50 text-foreground hover:bg-secondary"
                  )}
                >
                  {item.title}
                  <span className="mt-1 block text-xs text-muted-foreground">{item.statusLabel}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            {selected ? (
              <>
                <Chip tone="action">Fieldwork Bridge</Chip>
                <h2 className="mt-2 text-base font-semibold text-foreground">{selected.title}</h2>
                <dl className="o-material mt-4 divide-y divide-border overflow-hidden rounded-[10px]">
                  {fields.map((field) => (
                    <div
                      key={field.label}
                      className="grid gap-1 px-3.5 py-2.5 sm:grid-cols-[180px_1fr]"
                    >
                      <dt className="text-[13px] font-medium text-muted-foreground">{field.label}</dt>
                      <dd className="text-[13px] text-foreground">{field.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex gap-1.5">
                  {selected.href ? (
                    <Link
                      href={selected.href}
                      className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-action px-3 py-1.5 text-xs font-semibold text-action-foreground hover:brightness-[1.03]"
                    >
                      Open fieldwork
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="o-material rounded-[10px] px-4 py-5 text-[13px] text-muted-foreground">
                {fieldwork.emptyDetailCopy}
              </div>
            )}
          </div>
        </div>
      )}
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
  const handoffBanner = useMemo(
    () =>
      handoffBannerSlot ?? (data.handoff.show ? <ExploreHandoffBanner handoff={data.handoff} /> : null),
    [data.handoff, handoffBannerSlot]
  );

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="orvek-explore-page">
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
            <InvestigationsTab data={data} handlers={handlers} />
          ) : data.activeTab === "questions" ? (
            <QuestionsTab data={data} handlers={handlers} />
          ) : (
            <FieldworkTab data={data} handlers={handlers} />
          )}
        </div>
      </div>
    </div>
  );
}
