"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { ExploreInspectorAction } from "@/components/explore/ExploreInspectorAction";
import { useExploreSessionBridge } from "@/lib/explore-session-bridge";
import {
  EXPLORE_REVIEW_DRAFT_BADGE,
  EXPLORE_REVIEW_EMPTY_COPY,
  EXPLORE_REVIEW_EMPTY_SUBCOPY,
  EXPLORE_REVIEW_HAS_ITEMS_HEADLINE,
  EXPLORE_REVIEW_HAS_ITEMS_SUBCOPY,
  EXPLORE_REVIEW_LOADING_COPY,
  buildExploreReviewItemsMeta,
  confirmExploreReferenceReviewItem,
  fetchExploreSessionReviewItems,
  rejectExploreReferenceReviewItem,
  type ExploreConversationReviewItem,
} from "@/lib/explore-conversation-review";
import { EXPLORE_REVIEW_ERROR_COPY } from "@/lib/explore-surface";

function useExploreSessionReviewItems(): {
  items: ExploreConversationReviewItem[];
  isLoading: boolean;
  error: boolean;
  refresh: () => void;
} {
  const { sessionId, refreshToken } = useExploreSessionBridge();
  const [items, setItems] = useState<ExploreConversationReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [localRefresh, setLocalRefresh] = useState(0);

  const refresh = useCallback(() => {
    setLocalRefresh((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!sessionId) {
      setItems([]);
      setIsLoading(false);
      setError(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(false);

      try {
        const nextItems = await fetchExploreSessionReviewItems(sessionId);
        if (!cancelled) {
          setItems(nextItems);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setItems([]);
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
  }, [sessionId, refreshToken, localRefresh]);

  return { items, isLoading, error, refresh };
}

function ExploreConversationReviewCard({
  item,
  onActionComplete,
  surface = "default",
}: {
  item: ExploreConversationReviewItem;
  onActionComplete: () => void;
  surface?: "default" | "orvek";
}) {
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isOrvek = surface === "orvek";
  const shellClass = isOrvek ? "o-material" : "ml-material";
  const calmClass = isOrvek ? "o-calm" : "ml-calm";
  const kindClass = isOrvek
    ? "inline-flex rounded-md bg-evidence-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
    : "inline-flex rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan/75";
  const draftBadgeClass = isOrvek
    ? "rounded-full bg-action-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-action-foreground"
    : "rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground";
  const hairlineClass = isOrvek ? "o-hairline" : "ml-hairline";
  const confirmClass = isOrvek
    ? "o-calm rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-45"
    : "ml-calm rounded-md bg-cyan px-2.5 py-1 text-[11px] font-medium text-black disabled:opacity-45";
  const dismissClass = isOrvek
    ? "o-calm o-material rounded-md px-2.5 py-1 text-[11px] font-medium disabled:opacity-45"
    : "ml-calm ml-material rounded-md px-2.5 py-1 text-[11px] font-medium disabled:opacity-45";

  const handleConfirm = async () => {
    if (!item.referenceAction?.referenceId || !item.actions.canConfirm) {
      return;
    }
    setIsActing(true);
    setActionError(null);
    try {
      await confirmExploreReferenceReviewItem(item.referenceAction.referenceId);
      onActionComplete();
    } catch {
      setActionError("Could not confirm this item.");
    } finally {
      setIsActing(false);
    }
  };

  const handleReject = async () => {
    if (!item.referenceAction?.referenceId || !item.actions.canReject) {
      return;
    }
    setIsActing(true);
    setActionError(null);
    try {
      await rejectExploreReferenceReviewItem(item.referenceAction.referenceId);
      onActionComplete();
    } catch {
      setActionError("Could not dismiss this item.");
    } finally {
      setIsActing(false);
    }
  };

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={kindClass}>{item.kindLabel}</span>
            <span className={draftBadgeClass}>{EXPLORE_REVIEW_DRAFT_BADGE}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-meta">
              {item.statusLabel}
            </span>
          </div>
          <p className="text-[13px] font-medium leading-snug line-clamp-2">{item.title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
            {item.summary}
          </p>
          {item.sourceLabel || item.confidenceLabel ? (
            <div className="label-meta mt-1.5">
              {[item.sourceLabel, item.confidenceLabel].filter(Boolean).join(" · ")}
            </div>
          ) : null}
          {item.linkedObjectLabel ? (
            <div className="label-meta mt-1">{item.linkedObjectLabel}</div>
          ) : null}
          {item.selectableObject ? (
            <ExploreInspectorAction
              objectType={item.selectableObject.objectType}
              objectId={item.selectableObject.objectId}
              modelUpdateId={item.selectableObject.selectedModelUpdateId}
              title={item.selectableObject.title ?? item.title}
              tab="evidence"
            />
          ) : null}
        </div>
      </div>
      {(item.actions.canConfirm || item.actions.canReject) && (
        <div className={`mt-2.5 flex flex-wrap gap-2 border-t ${hairlineClass} pt-2.5`}>
          {item.actions.canConfirm ? (
            <button
              type="button"
              disabled={isActing}
              onClick={() => {
                void handleConfirm();
              }}
              className={confirmClass}
            >
              Confirm
            </button>
          ) : null}
          {item.actions.canReject ? (
            <button
              type="button"
              disabled={isActing}
              onClick={() => {
                void handleReject();
              }}
              className={dismissClass}
            >
              Dismiss
            </button>
          ) : null}
        </div>
      )}
      {actionError ? (
        <p className="mt-2 text-[11px] text-[hsl(12_80%_64%)]">{actionError}</p>
      ) : null}
    </>
  );

  if (item.linkedObjectHref) {
    return (
      <Link
        href={item.linkedObjectHref}
        className={`${shellClass} ${calmClass} block rounded-xl px-3.5 py-3 hover:bg-accent/40`}
      >
        {body}
      </Link>
    );
  }

  return <div className={`${shellClass} ${calmClass} rounded-xl px-3.5 py-3`}>{body}</div>;
}

export function ExploreConversationReviewStrip({
  surface = "default",
}: {
  surface?: "default" | "orvek";
}) {
  const { sessionId } = useExploreSessionBridge();
  const { items, isLoading, error, refresh } = useExploreSessionReviewItems();
  const isOrvek = surface === "orvek";
  const shellClass = isOrvek ? "o-material" : "ml-material";
  const iconClass = isOrvek ? "text-primary" : "text-cyan/70";

  if (!sessionId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`${shellClass} flex items-center gap-2 rounded-xl px-4 py-3 text-[12px] text-muted-foreground`}>
        <ClipboardList className={`size-3.5 ${iconClass}`} aria-hidden />
        {EXPLORE_REVIEW_LOADING_COPY}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${shellClass} rounded-xl px-4 py-3 text-[12px] text-muted-foreground`}>
        {EXPLORE_REVIEW_ERROR_COPY}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`${shellClass} rounded-xl px-4 py-3`}>
        <div className="text-[12px] font-medium text-foreground">{EXPLORE_REVIEW_EMPTY_COPY}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {EXPLORE_REVIEW_EMPTY_SUBCOPY}
        </p>
      </div>
    );
  }

  return (
    <div className={`${shellClass} rounded-xl px-4 py-3`}>
      <div className="mb-2 flex items-start gap-2">
        <ClipboardList className={`mt-0.5 size-3.5 shrink-0 ${isOrvek ? "text-primary" : "text-cyan/80"}`} aria-hidden />
        <div>
          <div className="text-[12px] font-medium text-foreground">
            {EXPLORE_REVIEW_HAS_ITEMS_HEADLINE}
          </div>
          <div className={isOrvek ? "mt-0.5 text-[11px] text-muted-foreground" : "label-meta mt-0.5"}>
            {buildExploreReviewItemsMeta(items.length)}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {EXPLORE_REVIEW_HAS_ITEMS_SUBCOPY}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {items.slice(0, 5).map((item) => (
          <ExploreConversationReviewCard
            key={item.id}
            item={item}
            onActionComplete={refresh}
            surface={surface}
          />
        ))}
      </div>
    </div>
  );
}

export function ExploreConversationReviewInspectorList() {
  const { sessionId } = useExploreSessionBridge();
  const { items, isLoading, error, refresh } = useExploreSessionReviewItems();

  if (!sessionId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-2 px-4 py-3">
        {[0, 1].map((index) => (
          <div key={index} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 text-[12px] text-muted-foreground">
        Could not load conversation review.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-3 text-[12px] text-muted-foreground">
        <p>{EXPLORE_REVIEW_EMPTY_COPY}</p>
        <p className="mt-1 text-[11px] leading-relaxed">{EXPLORE_REVIEW_EMPTY_SUBCOPY}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-4 py-3">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {EXPLORE_REVIEW_DRAFT_BADGE}
      </p>
      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        {EXPLORE_REVIEW_HAS_ITEMS_SUBCOPY}
      </p>
      {items.map((item) => (
        <ExploreConversationReviewCard key={item.id} item={item} onActionComplete={refresh} />
      ))}
    </div>
  );
}
