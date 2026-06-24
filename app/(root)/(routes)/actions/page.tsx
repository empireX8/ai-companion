"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { PageHeader, SectionLabel } from "@/components/AppShell";
import { DecisionItemCard } from "@/components/decisions/DecisionItemCard";
import { DecisionsPriorityBand } from "@/components/decisions/DecisionsPriorityBand";
import {
  createFieldworkFromAction,
  fetchActionsPageData,
  type ActionBucket,
  type ActionsPageData,
  type SurfacedActionView,
} from "@/lib/actions-api";
import {
  DECISIONS_BUILD_TAB_LABEL,
  DECISIONS_EMPTY_COPY,
  DECISIONS_ERROR_COPY,
  DECISIONS_FOOTER_BUILD_COPY,
  DECISIONS_FOOTER_STABILIZE_COPY,
  DECISIONS_LOADING_COPY,
  DECISIONS_PAGE_INTRO,
  DECISIONS_PAGE_META,
  DECISIONS_PAGE_TITLE,
  DECISIONS_SEND_TO_FIELDWORK_ERROR_COPY,
  DECISIONS_STABILIZE_TAB_LABEL,
  getDecisionTabIntro,
  groupDecisionsByResolution,
} from "@/lib/decisions-surface";

export default function ActionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ActionBucket>("stabilize");
  const [data, setData] = useState<ActionsPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creatingActionId, setCreatingActionId] = useState<string | null>(null);
  const [createErrorByActionId, setCreateErrorByActionId] = useState<
    Record<string, string>
  >({});

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

  const groups = useMemo(() => groupDecisionsByResolution(list), [list]);

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
      setCreatingActionId((current) =>
        current === action.id ? null : current
      );
    }
  };

  return (
    <div className="animate-fade-in px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title={DECISIONS_PAGE_TITLE}
          meta={DECISIONS_PAGE_META}
          compact
          right={
            <div className="ml-segmented">
              {[
                { id: "stabilize" as const, label: DECISIONS_STABILIZE_TAB_LABEL },
                { id: "build" as const, label: DECISIONS_BUILD_TAB_LABEL },
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setTab(option.id)}
                  className={`px-3 py-1.5 text-[11px] font-medium ${tab === option.id ? "ml-segment-active" : "ml-segment-inactive"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        />

        <p className="mb-5 max-w-2xl text-[13px] text-muted-foreground">{DECISIONS_PAGE_INTRO}</p>

        {data ? <DecisionsPriorityBand snapshot={data.currentPriority} /> : null}

        <p className="mb-3 text-[12px] text-muted-foreground">{getDecisionTabIntro(tab)}</p>

        {isLoading ? (
          <div className="ml-material rounded-xl p-4 text-[13px] text-muted-foreground">
            {DECISIONS_LOADING_COPY}
          </div>
        ) : errorMessage ? (
          <div className="ml-material rounded-xl p-4 text-[13px] text-[hsl(12_80%_64%)]">
            {errorMessage}
          </div>
        ) : list.length === 0 ? (
          <div className="ml-material space-y-1 rounded-xl p-4 text-[13px] text-muted-foreground">
            <p>{DECISIONS_EMPTY_COPY}</p>
          </div>
        ) : (
          <div className="space-y-6" data-testid="decisions-list">
            {groups.map((group) => (
              <section key={group.key}>
                <SectionLabel>{group.label}</SectionLabel>
                <p className="mt-1 mb-3 text-[12px] text-muted-foreground">{group.intro}</p>
                <div className="space-y-2.5">
                  {group.items.map((action) => (
                    <DecisionItemCard
                      key={action.id}
                      action={action}
                      isCreating={creatingActionId === action.id}
                      createError={createErrorByActionId[action.id]}
                      onSendToFieldwork={(item) => {
                        void handleSendToFieldwork(item);
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="label-meta mt-8 text-center text-muted-foreground">
          {tab === "stabilize" ? DECISIONS_FOOTER_STABILIZE_COPY : DECISIONS_FOOTER_BUILD_COPY}
        </p>

        <p className="label-meta mt-6 text-center text-meta">
          Related:{" "}
          <Link href="/watch-for" className="hover:text-cyan transition-colors">
            Fieldwork
          </Link>{" "}
          ·{" "}
          <Link href="/your-map" className="hover:text-cyan transition-colors">
            Your Map
          </Link>{" "}
          ·{" "}
          <Link href="/" className="hover:text-cyan transition-colors">
            Today
          </Link>
        </p>
      </div>
    </div>
  );
}
