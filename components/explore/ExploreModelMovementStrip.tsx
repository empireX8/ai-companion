"use client";

import { useEffect, useState } from "react";
import { GitCompareArrows } from "lucide-react";

import { useInspector } from "@/components/inspector/InspectorContext";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import {
  EXPLORE_MOVEMENT_EMPTY_COPY,
  EXPLORE_MOVEMENT_EMPTY_SUBCOPY,
  EXPLORE_MOVEMENT_HAS_UPDATES_HEADLINE,
  EXPLORE_MOVEMENT_LOADING_COPY,
  buildExploreMovementHasUpdatesMeta,
  fetchExploreSessionModelUpdates,
  type ExploreSessionModelUpdateItem,
} from "@/lib/explore-session-model-updates";
import { useExploreSessionBridge } from "@/lib/explore-session-bridge";
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
}: {
  item: ExploreSessionModelUpdateItem;
  compact?: boolean;
}) {
  const { selectObject } = useInspector();
  const title = `${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`;

  return (
    <button
      type="button"
      onClick={() => {
        selectObject({
          objectType: "model_update",
          objectId: item.id,
          modelUpdateId: item.id,
          title,
          sourceSurface: "explore",
          tab: "movement",
        });
      }}
      className={`ml-material ml-calm w-full rounded-xl text-left hover:bg-white/[0.02] ${
        compact ? "px-3 py-2.5" : "px-3.5 py-3"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan/75">
        {item.updateTypeLabel}
      </div>
      <p
        className={`mt-1 leading-relaxed text-[hsl(216_11%_75%)] ${
          compact ? "text-[12px] line-clamp-2" : "text-[13px] line-clamp-3"
        }`}
      >
        {item.userFacingSummary}
      </p>
      {!compact ? (
        <div className="mt-2 border-t ml-hairline pt-2">
          <PublicLinkedObjectContinuity
            objectType={item.affectedObjectType}
            objectId={item.affectedObjectId}
            href={item.affectedObjectHref}
            context="model_update"
          />
          <div className="label-meta mt-1.5">Recorded {formatDateTime(item.createdAt)}</div>
        </div>
      ) : (
        <div className="label-meta mt-1">{formatDateTime(item.createdAt)}</div>
      )}
    </button>
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

export function ExploreModelMovementStrip() {
  const { sessionId } = useExploreSessionBridge();
  const { items, isLoading, error } = useExploreSessionModelUpdates();

  if (!sessionId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="ml-material flex items-center gap-2 rounded-xl px-4 py-3 text-[12px] text-muted-foreground">
        <GitCompareArrows className="size-3.5 text-cyan/70" aria-hidden />
        {EXPLORE_MOVEMENT_LOADING_COPY}
      </div>
    );
  }

  if (error) {
    return (
      <div className="ml-material rounded-xl px-4 py-3 text-[12px] text-muted-foreground">
        Could not check for published movement right now.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="ml-material rounded-xl px-4 py-3">
        <div className="text-[12px] font-medium text-foreground">{EXPLORE_MOVEMENT_EMPTY_COPY}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {EXPLORE_MOVEMENT_EMPTY_SUBCOPY}
        </p>
      </div>
    );
  }

  return (
    <div className="ml-material rounded-xl px-4 py-3">
      <div className="mb-2 flex items-start gap-2">
        <GitCompareArrows className="mt-0.5 size-3.5 shrink-0 text-cyan/80" aria-hidden />
        <div>
          <div className="text-[12px] font-medium text-foreground">
            {EXPLORE_MOVEMENT_HAS_UPDATES_HEADLINE}
          </div>
          <div className="label-meta mt-0.5">{buildExploreMovementHasUpdatesMeta(items.length)}</div>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <ExploreModelMovementRow key={item.id} item={item} compact />
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
