"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  GitBranch,
  MessageSquare,
  Receipt,
  Scale,
  Send,
} from "lucide-react";

import {
  createFieldworkFromAction,
  fetchActionsPageData,
  type ActionBucket,
  type ActionsPageData,
  type SurfacedActionView,
} from "@/lib/actions-api";
import { buildExploreActionHandoffHref } from "@/lib/explore-action-handoff";
import {
  DECISIONS_BUILD_TAB_LABEL,
  DECISIONS_EMPTY_COPY,
  DECISIONS_ERROR_COPY,
  DECISIONS_LOADING_COPY,
  DECISIONS_PAGE_INTRO,
  DECISIONS_SEND_TO_FIELDWORK_ERROR_COPY,
  DECISIONS_SEND_TO_FIELDWORK_LABEL,
  DECISIONS_SEND_TO_FIELDWORK_LOADING_LABEL,
  DECISIONS_STABILIZE_TAB_LABEL,
  formatDecisionDateTime,
  getDecisionTabIntro,
  groupDecisionsByResolution,
  toDecisionStatusLabel,
} from "@/lib/decisions-surface";
import { buildPublicReceiptHref } from "@/lib/public-continuity-registry";
import { cn } from "@/lib/utils";

import { Chip, SectionLabel } from "./OrvekPrimitives";
import { useOrvekInspector } from "./useOrvekInspector";

const STAGES = ["Active", "Chosen", "Outcome due", "Reviewed", "Model update"];

type SidebarList = {
  heading: string;
  tone?: "action";
  items: SurfacedActionView[];
};

function deriveStageIndex(action: SurfacedActionView): number {
  if (action.status === "helped" || action.status === "didnt_help") {
    return 4;
  }
  if (action.status === "done") {
    return 3;
  }
  return 0;
}

function WSBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

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

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextData = await fetchActionsPageData();
        if (cancelled) {
          return;
        }

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
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const list = useMemo<SurfacedActionView[]>(() => {
    if (!data) {
      return [];
    }
    return tab === "stabilize" ? data.stabilizeNow : data.buildForward;
  }, [data, tab]);

  const sidebarLists = useMemo<SidebarList[]>(() => {
    return groupDecisionsByResolution(list).map((group) => ({
      heading: group.key === "open" ? "Active" : "Reviewed",
      tone: group.key === "open" ? undefined : undefined,
      items: group.items,
    }));
  }, [list]);

  useEffect(() => {
    if (list.length === 0) {
      setWorkspaceId(null);
      return;
    }

    if (!workspaceId || !list.some((item) => item.id === workspaceId)) {
      setWorkspaceId(list[0]!.id);
    }
  }, [list, workspaceId]);

  const decision = list.find((item) => item.id === workspaceId) ?? null;

  const headerStats = useMemo(() => {
    const openCount = list.filter((item) => item.status === "not_started").length;
    const reviewedCount = list.filter(
      (item) => item.status === "done" || item.status === "helped" || item.status === "didnt_help"
    ).length;
    return { openCount, reviewedCount };
  }, [list]);

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

  const handleSendToFieldwork = async (
    action: Pick<SurfacedActionView, "id" | "title" | "whySuggested">
  ) => {
    if (creatingActionId === action.id) {
      return;
    }

    setCreatingActionId(action.id);
    setCreateErrorByActionId((current) => {
      if (!current[action.id]) {
        return current;
      }
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

  const stageIndex = decision ? deriveStageIndex(decision) : 0;
  const reflectHref = decision ? buildExploreActionHandoffHref(decision.id) : null;
  const receiptHref = decision
    ? buildPublicReceiptHref({
        namespace: "receipt-pattern",
        id: decision.linkedClaimId,
      })
    : null;

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
            {!isLoading && list.length > 0 ? (
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
                  { id: "stabilize" as const, label: DECISIONS_STABILIZE_TAB_LABEL },
                  { id: "build" as const, label: DECISIONS_BUILD_TAB_LABEL },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleTabChange(option.id)}
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

        <p className="mb-3 max-w-2xl text-[12px] text-muted-foreground">
          {getDecisionTabIntro(tab)}
        </p>
        <p className="mb-3 max-w-2xl text-[12px] text-muted-foreground">{DECISIONS_PAGE_INTRO}</p>

        <div className="rounded-2xl bg-evidence-muted/50 p-3 ring-1 ring-inset ring-primary/15">
          <div className="o-material flex items-center gap-2 rounded-[9px] px-3 py-2">
            <GitBranch className="size-4 shrink-0 text-primary" aria-hidden />
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
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
                onClick: () => {
                  const next = list.find((item) => item.status === "not_started");
                  if (next) {
                    openDecision(next.id);
                  }
                },
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
            {DECISIONS_LOADING_COPY}
          </div>
        </div>
      ) : errorMessage ? (
        <div className="px-6 lg:px-8">
          <div className="o-material rounded-2xl p-5 text-[13px] text-[hsl(12_80%_64%)]">
            {errorMessage}
          </div>
        </div>
      ) : list.length === 0 ? (
        <div className="px-6 lg:px-8">
          <div className="o-material space-y-1 rounded-2xl p-5 text-[13px] text-muted-foreground">
            <p>{DECISIONS_EMPTY_COPY}</p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr]">
          <div className="o-sunken m-3 mt-0 min-h-0 overflow-y-auto rounded-2xl px-3 py-4 lg:mr-1.5">
            {sidebarLists.map((group) => (
              <div key={group.heading} className="mb-4">
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
                <div className="mt-1.5 space-y-0.5">
                  {group.items.map((item) => {
                    const active = workspaceId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openDecision(item.id)}
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
                        {group.heading === "Active" ? (
                          <span className="size-1.5 shrink-0 rounded-full bg-action" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
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

                {(decision.linkedClaimSummary ||
                  decision.linkedGoalStatement ||
                  decision.linkedSourceLabel) && (
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
                )}

                {decision.linkedClaimId ? (
                  <WSBlock label="Relevant background / context">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          select({
                            objectType: "pattern_claim",
                            objectId: decision.linkedClaimId!,
                            title: decision.linkedClaimSummary ?? decision.title,
                            sourceSurface: "decisions",
                            tab: "evidence",
                          });
                          setInspectorTab("evidence");
                        }}
                      >
                        <Chip tone="neutral" className="cursor-pointer hover:opacity-80">
                          {decision.linkedClaimSummary ?? "Linked pattern"}
                        </Chip>
                      </button>
                    </div>
                  </WSBlock>
                ) : null}

                {receiptHref ? (
                  <WSBlock label="Related receipts">
                    <div className="space-y-1.5">
                      <Link
                        href={receiptHref}
                        className="o-calm block w-full rounded-[9px] rounded-l-sm border-l-2 border-primary/50 bg-secondary/50 px-2.5 py-1.5 text-left text-[13px] italic text-foreground hover:bg-accent/60"
                      >
                        “{decision.linkedClaimSummary ?? decision.title}”
                      </Link>
                    </div>
                  </WSBlock>
                ) : null}

                <div className="o-material mt-5 rounded-[10px] p-4">
                  <SectionLabel>Outcome &amp; what it reveals</SectionLabel>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">
                    {toDecisionStatusLabel(decision.status)} · Updated{" "}
                    {formatDecisionDateTime(decision.updatedAt)}
                  </p>
                  {decision.note ? (
                    <p className="mt-1.5 text-[13px]">
                      <span className="text-muted-foreground">What happened: </span>
                      {decision.note}
                    </p>
                  ) : decision.status === "not_started" ? (
                    <button
                      type="button"
                      disabled={creatingActionId === decision.id}
                      onClick={() => {
                        void handleSendToFieldwork(decision);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-xs font-semibold text-action-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {creatingActionId === decision.id
                        ? DECISIONS_SEND_TO_FIELDWORK_LOADING_LABEL
                        : DECISIONS_SEND_TO_FIELDWORK_LABEL}
                    </button>
                  ) : null}
                  {createErrorByActionId[decision.id] ? (
                    <p className="mt-2 text-[12px] text-destructive">
                      {createErrorByActionId[decision.id]}
                    </p>
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
                      onClick={() => {
                        select({
                          objectType: "pattern_claim",
                          objectId: decision.linkedClaimId!,
                          title: decision.linkedClaimSummary ?? decision.title,
                          sourceSurface: "decisions",
                          tab: "movement",
                        });
                        setInspectorTab("movement");
                      }}
                      className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
                    >
                      What this reveals
                    </button>
                  ) : null}
                  {reflectHref ? (
                    <Link
                      href={reflectHref}
                      className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-secondary/70 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60"
                    >
                      <Receipt className="size-3.5 text-primary" aria-hidden />
                      Reflect on this choice
                    </Link>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
