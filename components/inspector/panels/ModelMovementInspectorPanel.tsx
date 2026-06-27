"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitCompareArrows, ScrollText } from "lucide-react";

import { ExploreSessionMovementInspectorList } from "@/components/explore/ExploreModelMovementStrip";

import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import { fetchInspectorModelUpdateDetail } from "@/lib/inspector-object-api";
import { resolveActiveModelUpdateId } from "@/lib/inspector-selection";
import type {
  RealityTrackingClaimSection,
  RealityTrackingEvidenceRef,
  RealityTrackingModelMovementSection,
} from "@/lib/reality-tracking-output-contract";
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

function formatEvidenceStatus(value: string): string {
  return value.replace(/_/g, " ");
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </div>
  );
}

function FactGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="uppercase tracking-wide text-[10px]">{item.label}</dt>
          <dd className="mt-0.5 font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EvidenceRefs({ refs }: { refs: RealityTrackingEvidenceRef[] }) {
  if (refs.length === 0) {
    return (
      <p className="mt-2 text-[11px] text-muted-foreground">
        No linked receipt references were attached to this item.
      </p>
    );
  }

  return (
    <ul className="mt-2 space-y-1.5">
      {refs.map((ref) => (
        <li key={ref.id} className="text-[11px] leading-relaxed text-muted-foreground">
          {ref.href ? (
            <Link href={ref.href} className="hover:text-foreground">
              <span className="font-medium text-cyan/80">{ref.sourceTypeLabel}</span>
              <span> · {ref.label}</span>
            </Link>
          ) : (
            <>
              <span className="font-medium text-cyan/80">{ref.sourceTypeLabel}</span>
              <span> · {ref.label}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function ClaimSection({
  label,
  section,
}: {
  label: string;
  section: RealityTrackingClaimSection;
}) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      {section.items.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {section.emptyState ?? "No detail available."}
        </p>
      ) : (
        <div className="space-y-2.5">
          {section.items.map((item, index) => (
            <article key={`${label}-${index}-${item.text}`} className="ml-material rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-medium uppercase tracking-wide text-cyan/75">
                  {formatEvidenceStatus(item.evidenceStatus)}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {formatEvidenceStatus(item.classification)}
                </div>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">
                {item.text}
              </p>
              <EvidenceRefs refs={item.evidenceRefs} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MovementSection({
  section,
}: {
  section: RealityTrackingModelMovementSection;
}) {
  return (
    <section>
      <SectionLabel>Model Movement</SectionLabel>
      <div className="space-y-2.5">
        {section.before ? (
          <div className="rounded-xl bg-muted/70 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Before
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground">{section.before}</p>
          </div>
        ) : null}
        {section.after ? (
          <div className="rounded-xl bg-evidence-muted/70 px-3 py-2.5 ring-1 ring-inset ring-primary/15">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              After
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-foreground">{section.after}</p>
          </div>
        ) : null}
        {section.confidenceShift !== null ? (
          <p className="text-[12px] text-muted-foreground">
            Confidence shift:{" "}
            <span className="font-medium text-foreground">
              {section.confidenceShift >= 0 ? "+" : ""}
              {section.confidenceShift.toFixed(2)}
            </span>
          </p>
        ) : null}
        {section.items.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {section.emptyState ?? "No additional movement detail available."}
          </p>
        ) : (
          <div className="space-y-2.5">
            {section.items.map((item, index) => (
              <article key={`movement-${index}-${item.text}`} className="ml-material rounded-xl px-3 py-2.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-cyan/75">
                  {formatEvidenceStatus(item.evidenceStatus)}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">
                  {item.text}
                </p>
                <EvidenceRefs refs={item.evidenceRefs} />
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SelectedModelMovementDetail({ modelUpdateId }: { modelUpdateId: string }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchInspectorModelUpdateDetail>>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);

    void (async () => {
      const nextDetail = await fetchInspectorModelUpdateDetail(modelUpdateId);

      if (cancelled) {
        return;
      }

      setDetail(nextDetail);
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
          {detail.item.updateTypeLabel} · {detail.item.affectedObjectTypeLabel}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">
          {detail.item.userFacingSummary}
        </p>
        <div className="mt-3">
          <PublicLinkedObjectContinuity
            objectType={detail.item.affectedObjectType}
            objectId={detail.item.affectedObjectId}
            href={detail.item.affectedObjectHref}
            context="model_update"
          />
          <div className="label-meta mt-1.5">Recorded {formatDateTime(detail.item.createdAt)}</div>
        </div>
      </header>

      <section>
        <SectionLabel>Evidence Packet Summary</SectionLabel>
        <FactGrid
          items={[
            {
              label: "Date range",
              value: detail.report.evidencePacketSummary.dateRangeLabel ?? "Unavailable",
            },
            {
              label: "Receipts",
              value: String(detail.report.evidencePacketSummary.receiptCount),
            },
            {
              label: "Source types",
              value: String(detail.report.evidencePacketSummary.sourceTypeCount),
            },
            {
              label: "Linked objects",
              value: String(detail.report.evidencePacketSummary.linkedObjectCount),
            },
            {
              label: "Decisions",
              value: String(detail.report.evidencePacketSummary.linkedDecisionCount),
            },
            {
              label: "Fieldwork",
              value: String(detail.report.evidencePacketSummary.fieldworkCount),
            },
            {
              label: "Corrections",
              value: String(detail.report.evidencePacketSummary.correctionCount),
            },
            {
              label: "Recent movement",
              value: String(detail.report.evidencePacketSummary.recentMovementCount),
            },
          ]}
        />
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          Target:{" "}
          <span className="font-medium text-foreground">
            {detail.report.evidencePacketSummary.targetLabel}
          </span>{" "}
          · {detail.report.evidencePacketSummary.targetObjectTypeLabel}
        </p>
      </section>

      <ClaimSection label="Facts" section={detail.report.facts} />
      <ClaimSection
        label="Strongly Supported Claims"
        section={detail.report.stronglySupportedClaims}
      />
      <ClaimSection label="Inferences" section={detail.report.inferences} />
      <ClaimSection
        label="Speculations / Uncertainties"
        section={detail.report.speculations}
      />
      <ClaimSection
        label="Overreach Guardrails"
        section={detail.report.overreachGuardrails}
      />
      <ClaimSection
        label="Loop / Pattern Detection"
        section={detail.report.loopPatternDetection}
      />
      <MovementSection section={detail.report.modelMovement} />
      <ClaimSection label="Reality Gate" section={detail.report.realityGate} />
      <ClaimSection
        label="Fieldwork / Watch For"
        section={detail.report.fieldworkWatchFor}
      />
      <ClaimSection label="Re-entry Action" section={detail.report.reentryAction} />
      <ClaimSection
        label="What Would Change This Conclusion"
        section={detail.report.whatWouldChangeThisConclusion}
      />
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
