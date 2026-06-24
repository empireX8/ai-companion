"use client";

import Link from "next/link";
import { Clock, Compass, Receipt } from "lucide-react";

import { useInspector } from "@/components/inspector/InspectorContext";
import type { SurfacedActionView } from "@/lib/actions-api";
import { buildExploreActionHandoffHref } from "@/lib/explore-action-handoff";
import { buildPublicReceiptHref } from "@/lib/public-continuity-registry";
import {
  DECISIONS_LINKED_CONTEXT_PREFIX,
  DECISIONS_RECEIPTS_LABEL,
  DECISIONS_REFLECT_IN_EXPLORE_LABEL,
  DECISIONS_SEND_TO_FIELDWORK_ERROR_COPY,
  DECISIONS_SEND_TO_FIELDWORK_LABEL,
  DECISIONS_SEND_TO_FIELDWORK_LOADING_LABEL,
  formatDecisionDateTime,
  toDecisionStatusLabel,
} from "@/lib/decisions-surface";

export function DecisionItemCard({
  action,
  isCreating,
  createError,
  onSendToFieldwork,
}: {
  action: SurfacedActionView;
  isCreating: boolean;
  createError: string | undefined;
  onSendToFieldwork: (action: Pick<SurfacedActionView, "id" | "title" | "whySuggested">) => void;
}) {
  const { selectObject } = useInspector();
  const receiptHref = buildPublicReceiptHref({
    namespace: "receipt-pattern",
    id: action.linkedClaimId,
  });
  const reflectHref = buildExploreActionHandoffHref(action.id);

  return (
    <article className="ml-material ml-calm rounded-xl p-4 hover:bg-white/[0.02]">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan/75">
              {toDecisionStatusLabel(action.status)}
            </span>
            <span className="label-meta">{action.linkedSourceLabel}</span>
            <span className="label-meta">·</span>
            <span className="label-meta inline-flex items-center gap-1">
              <Clock className="h-3 w-3" strokeWidth={1.5} />
              {action.effort}
            </span>
          </div>
          <h2 className="mb-1.5 text-[15.5px] font-medium leading-snug">{action.title}</h2>
          <p className="mb-3 max-w-[640px] text-[13.5px] leading-relaxed text-muted-foreground">
            {action.whySuggested}
          </p>
          <div className="label-meta inline-flex flex-wrap items-center gap-1">
            {DECISIONS_LINKED_CONTEXT_PREFIX}{" "}
            {action.linkedClaimId ? (
              <button
                type="button"
                onClick={() => {
                  selectObject({
                    objectType: "pattern_claim",
                    objectId: action.linkedClaimId!,
                    title: action.linkedClaimSummary ?? action.title,
                    sourceSurface: "decisions",
                    tab: "evidence",
                  });
                }}
                className="text-cyan hover:underline"
              >
                {action.linkedClaimSummary ?? action.linkedGoalStatement ?? "Recent pattern"}
              </button>
            ) : (
              <span className="text-muted-foreground">
                {action.linkedClaimSummary ?? action.linkedGoalStatement ?? "Recent activity"}
              </span>
            )}
          </div>
          <div className="label-meta mt-2">
            Updated {formatDecisionDateTime(action.updatedAt)}
          </div>
          <div className="mt-3 border-t hairline pt-3">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                disabled={isCreating}
                onClick={() => {
                  onSendToFieldwork(action);
                }}
                className="label-meta inline-flex items-center gap-1.5 text-meta transition-colors hover:text-cyan disabled:opacity-60 disabled:hover:text-meta"
              >
                {isCreating ? DECISIONS_SEND_TO_FIELDWORK_LOADING_LABEL : DECISIONS_SEND_TO_FIELDWORK_LABEL}
              </button>
              {reflectHref ? (
                <Link
                  href={reflectHref}
                  className="label-meta inline-flex items-center gap-1.5 text-meta transition-colors hover:text-cyan"
                >
                  <Compass className="h-3 w-3" strokeWidth={1.5} />
                  {DECISIONS_REFLECT_IN_EXPLORE_LABEL}
                </Link>
              ) : null}
              {receiptHref ? (
                <Link
                  href={receiptHref}
                  className="label-meta inline-flex items-center gap-1.5 text-meta transition-colors hover:text-cyan"
                >
                  <Receipt className="h-3 w-3" strokeWidth={1.5} />
                  {DECISIONS_RECEIPTS_LABEL}
                </Link>
              ) : null}
            </div>
            {createError ? (
              <div className="label-meta mt-2 text-[hsl(12_80%_64%)]">
                {createError ?? DECISIONS_SEND_TO_FIELDWORK_ERROR_COPY}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
