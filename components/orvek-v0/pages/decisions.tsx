"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  GitBranch,
  MessageSquare,
  Receipt,
  Scale,
  Send,
} from "lucide-react";

import type { ActionBucket } from "@/lib/actions-api";
import type { V0DecisionsViewProps } from "@/lib/orvek-adapters/decisions";

import { useOrvekData } from "@/lib/orvek-v0/data-provider";
import { useOrvekPageHandlers } from "@/lib/orvek-v0/page-handlers";

import { Chip, SectionLabel } from "@/components/orvek-v0/primitives";
import { cn } from "@/lib/utils";

const STAGES = ["Active", "Chosen", "Outcome due", "Reviewed", "Model update"];

function WSBlock({
  label,
  children,
  testId,
}: {
  label: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="mt-5" data-testid={testId}>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

export type V0DecisionsViewHandlers = {
  onTabChange: (tab: ActionBucket) => void;
  onOpenDecision: (id: string) => void;
  onSendToFieldwork: (decisionId: string) => void;
  onInspectorSelect: (input: {
    claimId: string;
    title: string;
    tab: "evidence" | "movement";
  }) => void;
  onDraftChange: (value: string) => void;
  onReviewDueDecision: () => void;
};

export function V0DecisionsView({
  data,
  handlers,
  draft,
  fieldworkActionId,
}: {
  data: V0DecisionsViewProps;
  handlers: V0DecisionsViewHandlers;
  draft: string;
  fieldworkActionId: string | null;
}) {
  const {
    pageIntro,
    tabIntro,
    tab,
    stabilizeTabLabel,
    buildTabLabel,
    isLoading,
    loadingCopy,
    errorMessage,
    emptyCopy,
    headerStats,
    sidebarGroups,
    selectedDecisionId,
    stageIndex,
    decision,
    showWorkspace,
  } = data;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="orvek-decisions-page">
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Decisions</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Enter a decision, see what to choose, record what happened, and learn what it
              reveals.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {headerStats ? (
              <span className="hidden text-sm text-muted-foreground sm:block">
                <span className="font-medium text-action-foreground">{headerStats.openCount}</span>{" "}
                active ·{" "}
                <span className="font-medium text-foreground">{headerStats.reviewedCount}</span>{" "}
                reviewed
              </span>
            ) : null}
            <div className="o-sunken inline-flex rounded-[10px] p-1">
              {(
                [
                  { id: "stabilize" as const, label: stabilizeTabLabel },
                  { id: "build" as const, label: buildTabLabel },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handlers.onTabChange(option.id)}
                  className={cn(
                    "o-calm rounded-[7px] px-2.5 py-1.5 text-xs font-medium",
                    tab === option.id
                      ? "bg-card text-foreground shadow-[0_1px_3px_-1px_rgba(30,41,59,0.18)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mb-3 max-w-2xl text-[12px] text-muted-foreground">{tabIntro}</p>
        <p className="mb-3 max-w-2xl text-[12px] text-muted-foreground">{pageIntro}</p>

        <div className="rounded-2xl bg-evidence-muted/50 p-3 ring-1 ring-inset ring-primary/15">
          <div className="o-material flex items-center gap-2 rounded-[9px] px-3 py-2">
            <GitBranch className="size-4 shrink-0 text-primary" aria-hidden />
            <input
              value={draft}
              onChange={(event) => handlers.onDraftChange(event.target.value)}
              placeholder="What are you deciding?"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Link
              href="/explore"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Send className="size-3.5" aria-hidden />
              Talk it through
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: "Compare options", icon: Scale, href: "/explore" },
              {
                label: "Review due decision",
                icon: ArrowRight,
                onClick: handlers.onReviewDueDecision,
              },
            ].map((action) =>
              action.href ? (
                <Link
                  key={action.label}
                  href={action.href}
                  className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.12)] hover:bg-accent/60"
                >
                  <action.icon className="size-3.5 text-primary" aria-hidden />
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.12)] hover:bg-accent/60"
                >
                  <action.icon className="size-3.5 text-primary" aria-hidden />
                  {action.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="px-6 lg:px-8">
          <div className="o-material rounded-2xl p-5 text-[13px] text-muted-foreground">
            {loadingCopy}
          </div>
        </div>
      ) : errorMessage ? (
        <div className="px-6 lg:px-8">
          <div className="o-material rounded-2xl p-5 text-[13px] text-[hsl(12_80%_64%)]">
            {errorMessage}
          </div>
        </div>
      ) : !showWorkspace ? (
        <div className="px-6 lg:px-8">
          <div className="o-material space-y-1 rounded-2xl p-5 text-[13px] text-muted-foreground">
            <p>{emptyCopy}</p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr]">
          <div className="o-sunken m-3 mt-0 min-h-0 overflow-y-auto rounded-2xl px-3 py-4 lg:mr-1.5">
            {sidebarGroups.map((group) => (
              <div key={group.heading} className="mb-4" data-testid={`orvek-decisions-rail-${group.heading.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center gap-1.5 px-2">
                  <SectionLabel
                    className={group.tone === "action" ? "text-action-foreground" : ""}
                  >
                    {group.heading}
                  </SectionLabel>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {group.items.length}
                  </span>
                </div>
                {group.items.length === 0 ? (
                  <p className="mt-1.5 px-2 text-[11px] text-muted-foreground">None yet.</p>
                ) : (
                <div className="mt-1.5 space-y-0.5">
                  {group.items.map((item) => {
                    const active = selectedDecisionId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handlers.onOpenDecision(item.id)}
                        className={cn(
                          "o-calm flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-[13px] leading-snug",
                          active
                            ? "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.14)]"
                            : "text-foreground hover:bg-card/60"
                        )}
                      >
                        {active ? (
                          <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-primary" />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {item.showActiveDot ? (
                          <span className="size-1.5 shrink-0 rounded-full bg-action" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
            ))}
          </div>

          <div className="min-h-0 overflow-y-auto px-6 py-6 lg:px-8">
            {!decision ? (
              <div className="mx-auto max-w-2xl text-[13px] text-muted-foreground">
                Select a decision from the list.
              </div>
            ) : (
              <div className="mx-auto max-w-2xl">
                <div className="o-material mb-5 flex items-center rounded-[10px] px-3 py-2.5">
                  {STAGES.map((stage, index) => {
                    const done = index < stageIndex;
                    const current = index === stageIndex;
                    return (
                      <div key={stage} className="flex flex-1 items-center last:flex-none">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "o-calm flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                              done && "bg-primary text-primary-foreground",
                              current && "bg-action text-action-foreground ring-2 ring-action/30",
                              !done &&
                                !current &&
                                "border border-border bg-secondary text-muted-foreground"
                            )}
                          >
                            {done ? <Check className="size-3" /> : index + 1}
                          </span>
                          <span
                            className={cn(
                              "whitespace-nowrap text-[11px] font-medium",
                              current
                                ? "text-action-foreground"
                                : done
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                            )}
                          >
                            {stage}
                          </span>
                        </div>
                        {index < STAGES.length - 1 ? (
                          <span
                            className={cn(
                              "mx-2 h-px flex-1",
                              done ? "bg-primary/50" : "bg-border"
                            )}
                            aria-hidden
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <h2 className="text-2xl font-semibold leading-tight tracking-tight text-foreground text-balance">
                  {decision.title}
                </h2>

                <div className="mt-4 rounded-lg border-l-2 border-primary bg-evidence-muted/40 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Why this is surfaced
                  </p>
                  <p className="mt-1 text-[15px] leading-relaxed text-foreground">
                    {decision.whySuggested}
                  </p>
                </div>

                {decision.showConstraints ? (
                  <WSBlock label="Constraints, wants & fears">
                    <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                      {decision.linkedClaimSummary ? (
                        <div className="flex gap-2 text-[13px]">
                          <dt className="w-24 shrink-0 text-muted-foreground">Pattern</dt>
                          <dd className="text-foreground">{decision.linkedClaimSummary}</dd>
                        </div>
                      ) : null}
                      {decision.linkedGoalStatement ? (
                        <div className="flex gap-2 text-[13px]">
                          <dt className="w-24 shrink-0 text-muted-foreground">Direction</dt>
                          <dd className="text-foreground">{decision.linkedGoalStatement}</dd>
                        </div>
                      ) : null}
                      <div className="flex gap-2 text-[13px]">
                        <dt className="w-24 shrink-0 text-muted-foreground">Source</dt>
                        <dd className="text-foreground">{decision.linkedSourceLabel}</dd>
                      </div>
                      <div className="flex gap-2 text-[13px]">
                        <dt className="w-24 shrink-0 text-muted-foreground">Effort</dt>
                        <dd className="text-foreground">{decision.effort}</dd>
                      </div>
                    </dl>
                  </WSBlock>
                ) : null}

                <WSBlock label="Options" testId="orvek-decisions-options-panel">
                  <div className="o-material rounded-[10px] p-3.5">
                    <p className="text-[13px] text-muted-foreground">{decision.optionsEmptyCopy}</p>
                  </div>
                </WSBlock>

                <WSBlock label="Relevant background / context" testId="orvek-decisions-context-panel">
                  {decision.linkedClaimId ? (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handlers.onInspectorSelect({
                            claimId: decision.linkedClaimId!,
                            title: decision.linkedClaimSummary ?? decision.title,
                            tab: "evidence",
                          })
                        }
                      >
                        <Chip tone="neutral" className="cursor-pointer hover:opacity-80">
                          {decision.linkedClaimSummary ?? "Linked pattern"}
                        </Chip>
                      </button>
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">{decision.contextEmptyCopy}</p>
                  )}
                </WSBlock>

                {decision.receiptHref ? (
                  <WSBlock label="Related receipts">
                    <div className="space-y-1.5">
                      <Link
                        href={decision.receiptHref}
                        className="o-calm block w-full rounded-[9px] rounded-l-sm border-l-2 border-primary/50 bg-secondary/50 px-2.5 py-1.5 text-left text-[13px] italic text-foreground hover:bg-accent/60"
                      >
                        “{decision.receiptQuote}”
                      </Link>
                    </div>
                  </WSBlock>
                ) : null}

                <WSBlock label="Projection" testId="orvek-decisions-projection-panel">
                  <p className="text-[13px] text-muted-foreground">{decision.projectionEmptyCopy}</p>
                </WSBlock>

                <div className="o-material mt-5 rounded-[10px] p-4" data-testid="orvek-decisions-outcome-panel">
                  <SectionLabel>Outcome &amp; what it reveals</SectionLabel>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">
                    {decision.statusLabel} · Updated {decision.updatedAtLabel}
                  </p>
                  {decision.note ? (
                    <p className="mt-1.5 text-[13px]">
                      <span className="text-muted-foreground">What happened: </span>
                      {decision.note}
                    </p>
                  ) : decision.showFieldwork ? (
                    <button
                      type="button"
                      disabled={fieldworkActionId === decision.id}
                      onClick={() => handlers.onSendToFieldwork(decision.id)}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-xs font-semibold text-action-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {fieldworkActionId === decision.id
                        ? decision.fieldworkLoadingLabel
                        : decision.fieldworkLabel}
                    </button>
                  ) : (
                    <p className="mt-2 text-[13px] text-muted-foreground">
                      {decision.outcomeReviewEmptyCopy}
                    </p>
                  )}
                  {decision.fieldworkError ? (
                    <p className="mt-2 text-[12px] text-destructive">{decision.fieldworkError}</p>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap gap-1.5">
                  <Link
                    href="/explore"
                    className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
                  >
                    <MessageSquare className="size-3.5 text-primary" aria-hidden />
                    Talk through in Explore
                  </Link>
                  {decision.linkedClaimId ? (
                    <button
                      type="button"
                      onClick={() =>
                        handlers.onInspectorSelect({
                          claimId: decision.linkedClaimId!,
                          title: decision.linkedClaimSummary ?? decision.title,
                          tab: "movement",
                        })
                      }
                      className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
                    >
                      What this reveals
                    </button>
                  ) : null}
                  {decision.reflectHref ? (
                    <Link
                      href={decision.reflectHref}
                      className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
                    >
                      <Receipt className="size-3.5 text-primary" aria-hidden />
                      Reflect on this choice
                    </Link>
                  ) : (
                    <span
                      className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/40 px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
                      data-testid="orvek-decisions-review-cta-disabled"
                    >
                      <Receipt className="size-3.5" aria-hidden />
                      Decision review not ready yet
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DecisionsPage() {
  const { decisions: decisionsData } = useOrvekData();
  const pageHandlers = useOrvekPageHandlers().decisions;

  if (!decisionsData || !pageHandlers) {
    return (
      <div className="px-6 py-6" data-testid="orvek-v0-decisions-page">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const { draft, fieldworkActionId, ...handlers } = pageHandlers;

  return (
    <V0DecisionsView
      data={decisionsData}
      handlers={handlers}
      draft={draft}
      fieldworkActionId={fieldworkActionId}
    />
  );
}
