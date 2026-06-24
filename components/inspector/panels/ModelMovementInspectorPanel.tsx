"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitCompareArrows, ScrollText } from "lucide-react";

import { ExploreSessionMovementInspectorList } from "@/components/explore/ExploreModelMovementStrip";

import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import {
  fetchInspectorEvidenceLinks,
  fetchInspectorModelUpdateDetail,
  INSPECTOR_MODEL_UPDATE_EVIDENCE_ENDPOINT,
  type InspectorEvidenceLinkItem,
} from "@/lib/inspector-object-api";
import { resolveActiveModelUpdateId } from "@/lib/inspector-selection";
import {
  TODAY_INTELLIGENCE_UPDATES_ENDPOINT,
  type TodayIntelligenceUpdateItem,
} from "@/lib/today-intelligence-updates";
import { ORVEK_COPY, PRODUCT_NAME } from "@/lib/trust-language";
import { useInspector } from "../InspectorContext";

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

function SelectedModelMovementDetail({ modelUpdateId }: { modelUpdateId: string }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchInspectorModelUpdateDetail>>>(null);
  const [evidence, setEvidence] = useState<InspectorEvidenceLinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);

    void (async () => {
      const [nextDetail, nextEvidence] = await Promise.all([
        fetchInspectorModelUpdateDetail(modelUpdateId),
        fetchInspectorEvidenceLinks(INSPECTOR_MODEL_UPDATE_EVIDENCE_ENDPOINT(modelUpdateId)),
      ]);

      if (cancelled) {
        return;
      }

      setDetail(nextDetail);
      setEvidence(nextEvidence);
      setNotFound(!nextDetail);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [modelUpdateId]);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
        This {ORVEK_COPY.mindModelMovement} is not available through the public projection.
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <header className="border-b ml-hairline pb-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan/75">
          {ORVEK_COPY.mindModelMovement}
        </div>
        <h3 className="mt-1 text-[15px] font-semibold leading-snug">
          {detail.updateTypeLabel} · {detail.affectedObjectTypeLabel}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">
          {detail.userFacingSummary}
        </p>
        <div className="mt-3">
          <PublicLinkedObjectContinuity
            objectType={detail.affectedObjectType}
            objectId={detail.affectedObjectId}
            href={detail.affectedObjectHref}
            context="model_update"
          />
          <div className="label-meta mt-1.5">Recorded {formatDateTime(detail.createdAt)}</div>
        </div>
      </header>

      {/* beforeSummary/afterSummary need a dedicated public-safe movement projection. */}
      <section>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Linked evidence
        </div>
        {evidence.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No linked public evidence yet.</p>
        ) : (
          <ul className="space-y-2">
            {evidence.map((item) => (
              <li key={`${item.sourceObjectHref}-${item.createdAt}`}>
                <Link
                  href={item.sourceObjectHref}
                  className="ml-material block rounded-xl px-3 py-2.5 text-[12px]"
                >
                  <div className="font-medium text-cyan/80">{item.sourceTypeLabel}</div>
                  <div className="mt-0.5 text-muted-foreground">{item.evidenceSummaryLabel}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GlobalModelMovementList() {
  const [items, setItems] = useState<TodayIntelligenceUpdateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(false);

      try {
        const response = await fetch(TODAY_INTELLIGENCE_UPDATES_ENDPOINT, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("load failed");
        }

        const payload = (await response.json()) as { items?: TodayIntelligenceUpdateItem[] };
        if (!cancelled) {
          setItems(Array.isArray(payload.items) ? payload.items : []);
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
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">
        Could not load recent {ORVEK_COPY.mindModelMovement}.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 py-10 text-center">
        <GitCompareArrows className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">No recent movement</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          When {PRODUCT_NAME} updates its understanding from your evidence, the summary appears here.
        </p>
        <Link
          href="/what-changed"
          className="mt-2 text-xs font-medium text-cyan/85 hover:text-cyan"
        >
          View change history →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Recent {ORVEK_COPY.mindModelMovement}
      </p>
      {items.map((item) => (
        <article key={item.id} className="ml-material rounded-xl px-3.5 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-cyan/75">
            {item.updateTypeLabel} · {item.affectedObjectTypeLabel}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">
            {item.userFacingSummary}
          </p>
          <div className="mt-2.5 border-t ml-hairline pt-2.5">
            <PublicLinkedObjectContinuity
              objectType={item.affectedObjectType}
              objectId={item.affectedObjectId}
              href={item.affectedObjectHref}
              context="model_update"
            />
            <div className="label-meta mt-1.5">Recorded {formatDateTime(item.createdAt)}</div>
          </div>
        </article>
      ))}
      <Link
        href="/what-changed"
        className="ml-calm ml-material flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ScrollText className="size-3.5" aria-hidden />
        View all changes
      </Link>
    </div>
  );
}

export function ModelMovementInspectorPanel() {
  const pathname = usePathname();
  const { selection } = useInspector();
  const activeModelUpdateId = resolveActiveModelUpdateId(selection);

  if (activeModelUpdateId) {
    return <SelectedModelMovementDetail modelUpdateId={activeModelUpdateId} />;
  }

  if (pathname.startsWith("/explore")) {
    return <ExploreSessionMovementInspectorList />;
  }

  return <GlobalModelMovementList />;
}
