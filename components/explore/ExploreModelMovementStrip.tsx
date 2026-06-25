"use client";

import { useEffect, useState } from "react";
import { GitCompareArrows } from "lucide-react";

import { ExploreInspectorAction } from "@/components/explore/ExploreInspectorAction";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import {
  EXPLORE_MOVEMENT_EMPTY_COPY,
  EXPLORE_MOVEMENT_EMPTY_SUBCOPY,
  EXPLORE_MOVEMENT_HAS_UPDATES_HEADLINE,
  EXPLORE_MOVEMENT_LOADING_COPY,
  EXPLORE_MOVEMENT_PUBLISHED_BADGE,
  buildExploreMovementHasUpdatesMeta,
  fetchExploreSessionModelUpdates,
  type ExploreSessionModelUpdateItem,
} from "@/lib/explore-session-model-updates";
import { useExploreSessionBridge } from "@/lib/explore-session-bridge";
import { EXPLORE_MOVEMENT_ERROR_COPY } from "@/lib/explore-surface";
import { ORVEK_COPY } from "@/lib/trust-language";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

export function ExploreModelMovementRow({
  item,
  compact = false,
  surface = "default",
}: {
  item: ExploreSessionModelUpdateItem;
  compact?: boolean;
  surface?: "default" | "orvek";
}) {
  const title = `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`;
  const isOrvek = surface === "orvek";
  const shellClass = isOrvek ? "o-material" : "ml-material";
  const accentClass = isOrvek ? "text-primary" : "text-cyan/75";
  const badgeClass = isOrvek
    ? "rounded-full bg-evidence-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary"
    : "rounded-full bg-cyan/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-cyan/80";
  const bodyClass = isOrvek
    ? "mt-1 leading-relaxed text-muted-foreground"
    : "mt-1 leading-relaxed text-[hsl(216_11%_75%)]";
  const hairlineClass = isOrvek ? "o-hairline" : "ml-hairline";
  const metaClass = isOrvek ? "mt-1.5 text-[11px] text-muted-foreground" : "label-meta mt-1.5";

  return (
    <div
      className={`${shellClass} w-full rounded-xl ${
        compact ? "px-3 py-2.5" : "px-3.5 py-3"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${accentClass}`}>
          {item.updateTypeLabel}
        </span>
        <span className={badgeClass}>{EXPLORE_MOVEMENT_PUBLISHED_BADGE}</span>
      </div>
      <p
        className={`${bodyClass} ${
          compact ? "text-[12px] line-clamp-2" : "text-[13px] line-clamp-3"
        }`}
      >
        {item.userFacingSummary}
      </p>
      {!compact ? (
        <div className={`mt-2 border-t ${hairlineClass} pt-2`}>
          <PublicLinkedObjectContinuity
            objectType={item.affectedObjectType}
            objectId={item.affectedObjectId}
            href={item.affectedObjectHref}
            context="model_update"
          />
          <div className={metaClass}>Recorded {formatDateTime(item.createdAt)}</div>
        </div>
      ) : (
        <div className={isOrvek ? "mt-1 text-[11px] text-muted-foreground" : "label-meta mt-1"}>
          {formatDateTime(item.createdAt)}
        </div>
      )}
      <ExploreInspectorAction
        objectType="model_update"
        objectId={item.id}
        modelUpdateId={item.id}
        title={title}
        tab="movement"
      />
    </div>
  );
}

export function useExploreSessionModelUpdates(): {
  items: ExploreSessionModelUpdateItem[];
  isLoading: boolean;
  error: boolean;
} {
  const { sessionId, refreshToken } = useExploreSessionBridge();
  const [items, setItems] = useState<ExploreSessionModelUpdateItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

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
        const nextItems = await fetchExploreSessionModelUpdates(sessionId);
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
  }, [sessionId, refreshToken]);

  return { items, isLoading, error };
}

export function ExploreModelMovementStrip({ surface = "default" }: { surface?: "default" | "orvek" }) {
  const { sessionId } = useExploreSessionBridge();
  const { items, isLoading, error } = useExploreSessionModelUpdates();
  const isOrvek = surface === "orvek";
  const shellClass = isOrvek ? "o-material" : "ml-material";
  const iconClass = isOrvek ? "text-primary" : "text-cyan/70";

  if (!sessionId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`${shellClass} flex items-center gap-2 rounded-xl px-4 py-3 text-[12px] text-muted-foreground`}>
        <GitCompareArrows className={`size-3.5 ${iconClass}`} aria-hidden />
        {EXPLORE_MOVEMENT_LOADING_COPY}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${shellClass} rounded-xl px-4 py-3 text-[12px] text-muted-foreground`}>
        {EXPLORE_MOVEMENT_ERROR_COPY}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`${shellClass} rounded-xl px-4 py-3`}>
        <div className="text-[12px] font-medium text-foreground">{EXPLORE_MOVEMENT_EMPTY_COPY}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {EXPLORE_MOVEMENT_EMPTY_SUBCOPY}
        </p>
      </div>
    );
  }

  return (
    <div className={`${shellClass} rounded-xl px-4 py-3`}>
      <div className="mb-2 flex items-start gap-2">
        <GitCompareArrows className={`mt-0.5 size-3.5 shrink-0 ${isOrvek ? "text-primary" : "text-cyan/80"}`} aria-hidden />
        <div>
          <div className="text-[12px] font-medium text-foreground">
            {EXPLORE_MOVEMENT_HAS_UPDATES_HEADLINE}
          </div>
          <div className={isOrvek ? "mt-0.5 text-[11px] text-muted-foreground" : "label-meta mt-0.5"}>
            {buildExploreMovementHasUpdatesMeta(items.length)}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <ExploreModelMovementRow key={item.id} item={item} compact surface={surface} />
        ))}
      </div>
    </div>
  );
}

export function ExploreSessionMovementInspectorList() {
  const { sessionId } = useExploreSessionBridge();
  const { items, isLoading, error } = useExploreSessionModelUpdates();

  if (!sessionId) {
    return (
      <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
        {EXPLORE_MOVEMENT_EMPTY_COPY}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1].map((index) => (
          <div key={index} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
        Could not load session {ORVEK_COPY.mindModelMovement}.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
        <p>{EXPLORE_MOVEMENT_EMPTY_COPY}</p>
        <p className="mt-2 text-[12px] leading-relaxed">{EXPLORE_MOVEMENT_EMPTY_SUBCOPY}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Published {ORVEK_COPY.mindModelMovement} from this conversation
      </p>
      {items.map((item) => (
        <ExploreModelMovementRow key={item.id} item={item} />
      ))}
    </div>
  );
}
