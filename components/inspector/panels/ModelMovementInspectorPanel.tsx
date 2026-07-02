"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, GitCompareArrows, ScrollText } from "lucide-react";

import { ExploreSessionMovementInspectorList } from "@/components/explore/ExploreModelMovementStrip";

import { InspectorEvidenceSelectionControl } from "@/components/inspector/InspectorEvidenceSelectionControl";
import {
  formatEvidenceRefRole,
  filterResolvableEvidenceRefs,
  formatEvidenceRefDisplay,
  sanitizeInspectorDisplayText,
  splitInspectorReadoutText,
} from "@/lib/inspector-evidence-presentation";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import { fetchInspectorModelUpdateDetail } from "@/lib/inspector-object-api";
import { resolveActiveModelUpdateId } from "@/lib/inspector-selection";
import type {
  RealityTrackingClaimSection,
  RealityTrackingEvidenceRef,
  RealityTrackingModelMovementReport,
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

function ReadoutText({
  value,
  muted = false,
}: {
  value: string;
  muted?: boolean;
}) {
  const parts = splitInspectorReadoutText(value);

  if (parts.length <= 1) {
    return (
      <p className={muted ? "text-muted-foreground" : "text-foreground"}>
        {sanitizeInspectorDisplayText(value) ?? value}
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {parts.map((part) => (
        <li key={part} className="flex gap-1.5">
          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-primary/55" aria-hidden />
          <span className={muted ? "text-muted-foreground" : "text-foreground"}>
            {sanitizeInspectorDisplayText(part) ?? part}
          </span>
        </li>
      ))}
    </ul>
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

function EvidenceRefs({
  refs,
  showEmptyCopy = true,
}: {
  refs: RealityTrackingEvidenceRef[];
  showEmptyCopy?: boolean;
}) {
  const visibleRefs = filterResolvableEvidenceRefs(refs);

  if (visibleRefs.length === 0) {
    return showEmptyCopy ? (
      <p className="mt-2 text-[11px] text-muted-foreground">
        No linked receipt references were attached to this item.
      </p>
    ) : null;
  }

  return (
    <ul className="mt-2 space-y-1.5">
      {visibleRefs.map((ref) => (
        <li key={ref.id} className="text-[11px] leading-relaxed text-muted-foreground">
          <InspectorEvidenceSelectionControl
            href={ref.href}
            sourceType={ref.sourceType}
            sourceId={ref.sourceId}
            title={formatEvidenceRefDisplay(ref)}
            trailLabel="Viewing movement evidence"
            className="text-left hover:text-foreground"
          >
            <span className="font-medium text-cyan/80">{formatEvidenceRefDisplay(ref)}</span>
            {formatEvidenceRefRole(ref.role) ? (
              <span className="ml-2 text-muted-foreground capitalize">
                {formatEvidenceRefRole(ref.role)}
              </span>
            ) : null}
          </InspectorEvidenceSelectionControl>
        </li>
      ))}
    </ul>
  );
}

function InspectorReturnBanner() {
  const { canGoBack, backTarget, goBack } = useInspector();
  const backTitle =
    sanitizeInspectorDisplayText(backTarget?.selection.selectedTitle) ??
    backTarget?.selection.selectedObjectType;

  if (!canGoBack) {
    return null;
  }

  return (
    <div className="rounded-xl bg-secondary/35 px-3 py-2">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground hover:text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to {backTitle}
      </button>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {backTarget?.trailLabel ?? "Viewing linked evidence"}
      </p>
    </div>
  );
}

function collectUniqueReceiptRefs(report: RealityTrackingModelMovementReport) {
  const seen = new Set<string>();
  const refs: RealityTrackingEvidenceRef[] = [];
  const sections = [
    report.facts,
    report.stronglySupportedClaims,
    report.inferences,
    report.speculations,
    report.overreachGuardrails,
    report.loopPatternDetection,
    report.modelMovement,
    report.realityGate,
    report.fieldworkWatchFor,
    report.reentryAction,
    report.whatWouldChangeThisConclusion,
  ];

  for (const section of sections) {
    for (const item of section.items) {
      for (const ref of item.evidenceRefs) {
        if (seen.has(ref.id)) {
          continue;
        }
        seen.add(ref.id);
        refs.push(ref);
      }
    }
  }

  return filterResolvableEvidenceRefs(refs);
}

function ThinPacketNotice({ report }: { report: RealityTrackingModelMovementReport }) {
  const nextEvidence =
    report.fieldworkWatchFor.items[0]?.text ??
    report.realityGate.items[0]?.text ??
    report.whatWouldChangeThisConclusion.items[0]?.text ??
    "Capture the next instance with trigger, behavior, aftermath, and whether it repeats in a second context.";

  return (
    <section className="rounded-xl border ml-hairline bg-muted/40 px-3.5 py-3">
      <p className="text-[13px] leading-relaxed text-foreground">
        This movement exists, but no receipt packet is linked yet.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        {PRODUCT_NAME} cannot strengthen this claim until receipts are attached.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Next evidence needed:</span>
      </p>
      <div className="mt-1 text-[12px] leading-relaxed">
        <ReadoutText value={nextEvidence} muted />
      </div>
    </section>
  );
}

function PacketReceiptRollup({ refs }: { refs: RealityTrackingEvidenceRef[] }) {
  if (refs.length === 0) {
    return null;
  }

  return (
    <section>
      <SectionLabel>Evidence used</SectionLabel>
      <EvidenceRefs refs={refs} showEmptyCopy={false} />
    </section>
  );
}

function ClaimSection({
  label,
  section,
  compact = false,
  collapseWhenEmpty = false,
  showPerCardRefs = true,
}: {
  label: string;
  section: RealityTrackingClaimSection;
  compact?: boolean;
  collapseWhenEmpty?: boolean;
  showPerCardRefs?: boolean;
}) {
  if (collapseWhenEmpty && section.items.length === 0) {
    return null;
  }

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
            <article
              key={`${label}-${index}-${item.text}`}
              className={compact ? "rounded-xl px-1 py-1" : "ml-material rounded-xl px-3 py-2.5"}
            >
              {!compact ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-cyan/75">
                    {formatEvidenceStatus(item.evidenceStatus)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {formatEvidenceStatus(item.classification)}
                  </div>
                </div>
              ) : null}
              <div
                className={
                  compact
                    ? "text-[12px] leading-relaxed text-muted-foreground"
                    : "mt-1.5 text-[13px] leading-relaxed"
                }
              >
                <ReadoutText value={item.text} muted={!compact} />
              </div>
              {showPerCardRefs ? <EvidenceRefs refs={item.evidenceRefs} showEmptyCopy={false} /> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MovementSection({
  label,
  section,
  compact = false,
  showPerCardRefs = true,
}: {
  label: string;
  section: RealityTrackingModelMovementSection;
  compact?: boolean;
  showPerCardRefs?: boolean;
}) {
  return (
    <section>
      <SectionLabel>{label}</SectionLabel>
      <div className="space-y-2.5">
        {section.before ? (
          <div className="rounded-xl bg-muted/70 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Before
            </div>
            <div className="mt-1 text-[13px] leading-relaxed">
              <ReadoutText value={section.before} />
            </div>
          </div>
        ) : null}
        {section.after ? (
          <div className="rounded-xl bg-evidence-muted/70 px-3 py-2.5 ring-1 ring-inset ring-primary/15">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              After
            </div>
            <div className="mt-1 text-[13px] leading-relaxed">
              <ReadoutText value={section.after} />
            </div>
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
              <article
                key={`movement-${index}-${item.text}`}
                className={compact ? "rounded-xl px-1 py-1" : "ml-material rounded-xl px-3 py-2.5"}
              >
                {!compact ? (
                  <div className="text-[11px] font-medium uppercase tracking-wide text-cyan/75">
                    {formatEvidenceStatus(item.evidenceStatus)}
                  </div>
                ) : null}
                <div
                  className={
                    compact
                      ? "text-[12px] leading-relaxed text-muted-foreground"
                      : "mt-1.5 text-[13px] leading-relaxed"
                  }
                >
                  <ReadoutText value={item.text} muted={!compact} />
                </div>
                {showPerCardRefs ? (
                  <EvidenceRefs refs={item.evidenceRefs} showEmptyCopy={false} />
                ) : null}
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
      <div className="px-5 py-8 text-center">
        <p className="text-sm font-medium text-foreground">This movement is recorded.</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          Detail for this movement is not available in this view yet.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          Use the related surface to inspect the full object when that surface is available.
        </p>
      </div>
    );
  }

  const receiptCount = detail.report.evidencePacketSummary.receiptCount;
  const isThinPacket = receiptCount === 0;
  const packetReceiptRefs = collectUniqueReceiptRefs(detail.report);
  const targetLabel =
    sanitizeInspectorDisplayText(detail.report.evidencePacketSummary.targetLabel) ??
    detail.item.affectedObjectTypeLabel;

  return (
    <div className="space-y-3 px-4 py-4">
      <header className="border-b ml-hairline pb-3">
        <InspectorReturnBanner />
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan/75">
          {ORVEK_COPY.mindModelMovement}
        </div>
        <h3 className="mt-1 text-[15px] font-semibold leading-snug">
          {detail.item.updateTypeLabel} · {detail.item.affectedObjectTypeLabel}
        </h3>
        <div className="mt-2 text-[13px] leading-relaxed">
          <ReadoutText value={detail.item.userFacingSummary} muted />
        </div>
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

      {isThinPacket ? <ThinPacketNotice report={detail.report} /> : null}

      <section>
        <SectionLabel>Evidence strength / confidence</SectionLabel>
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
          Receipt counts show packet size, not certainty.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          Target:{" "}
          <span className="font-medium text-foreground">
            {targetLabel}
          </span>{" "}
          · {detail.report.evidencePacketSummary.targetObjectTypeLabel}
        </p>
      </section>

      {!isThinPacket ? <PacketReceiptRollup refs={packetReceiptRefs} /> : null}

      <ClaimSection
        label="Evidence used"
        section={detail.report.facts}
        compact={isThinPacket}
        showPerCardRefs={!isThinPacket}
      />
      <ClaimSection
        label="Why Orvek thinks this"
        section={detail.report.stronglySupportedClaims}
        collapseWhenEmpty
        showPerCardRefs={!isThinPacket}
      />
      <ClaimSection
        label="What Orvek infers"
        section={detail.report.inferences}
        collapseWhenEmpty
        showPerCardRefs={!isThinPacket}
      />
      <ClaimSection
        label="Weak or uncertain"
        section={detail.report.speculations}
        collapseWhenEmpty
        showPerCardRefs={!isThinPacket}
      />
      <ClaimSection
        label="Guardrails / confidence"
        section={detail.report.overreachGuardrails}
        compact={isThinPacket}
        collapseWhenEmpty
        showPerCardRefs={!isThinPacket}
      />
      <ClaimSection
        label="Pattern context"
        section={detail.report.loopPatternDetection}
        collapseWhenEmpty
        showPerCardRefs={!isThinPacket}
      />
      <MovementSection
        label="What changed"
        section={detail.report.modelMovement}
        compact={isThinPacket}
        showPerCardRefs={!isThinPacket}
      />
      <ClaimSection
        label="Reality check"
        section={detail.report.realityGate}
        compact={isThinPacket}
        showPerCardRefs={!isThinPacket}
      />
      <ClaimSection
        label="Watch for next"
        section={detail.report.fieldworkWatchFor}
        compact={isThinPacket}
        showPerCardRefs={!isThinPacket}
      />
      <ClaimSection
        label="Re-entry"
        section={detail.report.reentryAction}
        collapseWhenEmpty
        showPerCardRefs={!isThinPacket}
      />
      <ClaimSection
        label="What could change this read"
        section={detail.report.whatWouldChangeThisConclusion}
        compact={isThinPacket}
        showPerCardRefs={!isThinPacket}
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
          <div className="mt-1.5 text-[13px] leading-relaxed">
            <ReadoutText value={item.userFacingSummary} muted />
          </div>
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
