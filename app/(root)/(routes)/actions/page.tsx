"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, SectionLabel } from "@/components/AppShell";
import { Clock, Receipt } from "lucide-react";
import Link from "next/link";

import {
  fetchActionsPageData,
  type ActionBucket,
  type ActionsPageData,
  type SurfacedActionView,
} from "@/lib/actions-api";

export default function ActionsPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ActionBucket>("stabilize");
  const [data, setData] = useState<ActionsPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
          setErrorMessage("Could not load actions.");
          return;
        }

        setData(nextData);
      } catch {
        if (!cancelled) {
          setData(null);
          setErrorMessage("Could not load actions.");
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

  return (
    <div className="px-12 py-10 max-w-[1000px] mx-auto animate-fade-in">
      <PageHeader
        title="Actions"
        meta="Invitations connected to recent patterns and tensions"
        right={
          <div className="inline-flex card-standard p-1 rounded-md">
            {[
              { id: "stabilize", label: "Stabilize Now" },
              { id: "build", label: "Build Forward" },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setTab(option.id as ActionBucket)}
                className={`px-4 h-8 rounded text-[12.5px] ${tab === option.id ? "bg-[hsl(187_100%_50%/0.12)] text-cyan" : "text-meta hover:text-white"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      <SectionLabel>Recommended for you</SectionLabel>

      {isLoading ? (
        <div className="card-standard p-4 text-[13px] text-meta">Loading actions...</div>
      ) : errorMessage ? (
        <div className="card-standard p-4 text-[13px] text-[hsl(12_80%_64%)]">{errorMessage}</div>
      ) : list.length === 0 ? (
        <div className="card-standard p-4 text-[13px] text-meta">No actions are available yet.</div>
      ) : (
        <div className="space-y-3">
          {list.map((action) => (
            <div key={action.id} className="card-standard p-5 hover:border-[hsl(187_100%_50%/0.18)] transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="label-meta text-cyan/70">{action.linkedSourceLabel}</div>
                    <span className="label-meta">·</span>
                    <div className="label-meta inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" strokeWidth={1.5} /> {action.effort}
                    </div>
                    <span className="label-meta">·</span>
                    <span className="label-meta">{toStatusLabel(action.status)}</span>
                  </div>
                  <div className="text-[15.5px] font-medium mb-1.5">{action.title}</div>
                  <div className="text-[13.5px] text-[hsl(216_11%_70%)] leading-relaxed mb-3 max-w-[640px]">
                    {action.whySuggested}
                  </div>
                  <div className="label-meta inline-flex items-center gap-2">
                    Based on <span className="text-cyan">{action.linkedClaimSummary ?? action.linkedGoalStatement ?? "Recent activity"}</span>
                  </div>
                  {action.linkedClaimId ? (
                    <div className="mt-3 pt-3 border-t hairline">
                      <Link
                        href={`/library/receipt-pattern-${action.linkedClaimId}`}
                        className="label-meta inline-flex items-center gap-1.5 text-meta hover:text-cyan transition-colors"
                      >
                        <Receipt className="h-3 w-3" strokeWidth={1.5} />
                        Receipts
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

          ))}
        </div>
      )}

      <div className="label-meta text-center mt-10">
        {tab === "stabilize"
          ? "These are invitations, not tasks."
          : "These are experiments, not commitments."}
      </div>
    </div>
  );
}

function toStatusLabel(status: SurfacedActionView["status"]): string {
  if (status === "done") return "Done";
  if (status === "helped") return "Helped";
  if (status === "didnt_help") return "Didn't help";
  return "Not started";
}
