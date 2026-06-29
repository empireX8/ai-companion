"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Chip, TYPE_META } from "@/components/orvek-v0/primitives";
import { useWorkbench } from "@/components/orvek-v0/store";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import { PUBLIC_EVIDENCE_FALLBACK_COPY } from "@/lib/public-continuity-registry";
import { useOptionalOrvekData } from "@/lib/orvek-v0/data-provider";
import type { OrvekObject } from "@/lib/orvek-v0/orvek-types";
import {
  fetchInspectorContradiction,
  fetchInspectorEvidenceLinks,
  fetchInspectorModelUpdateDetail,
  fetchInspectorPatternClaim,
  fetchInspectorUserMapDetail,
  INSPECTOR_MODEL_UPDATE_EVIDENCE_ENDPOINT,
  INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT,
  type InspectorContradictionProjection,
  type InspectorEvidenceLinkItem,
  type InspectorModelUpdateDetail,
} from "@/lib/inspector-object-api";
import type { InspectorSelection } from "@/lib/inspector-selection";
import { getActionGateReason } from "@/lib/pattern-claim-action";
import { PATTERN_FAMILY_SECTIONS, STRENGTH_LABELS, type PatternClaimView } from "@/lib/patterns-api";
import type {
  RealityTrackingEvidenceRef,
  RealityTrackingModelMovementReport,
} from "@/lib/reality-tracking-output-contract";
import {
  formatUserMapArea,
  formatUserMapConfidenceLevel,
  formatUserMapStatus,
  type UserMapConclusionPublicApiDetailItem,
  type WhatChangedListItem,
} from "@/lib/public-intelligence-safe-slice";
import { resolveInspectorSourceObject } from "@/lib/inspector-source-object";
import {
  dedupeInspectorEvidenceLinks,
  filterResolvableEvidenceRefs,
  formatEvidenceRefDisplay,
  projectInspectorEvidenceCard,
} from "@/lib/inspector-evidence-presentation";
import { ORVEK_COPY } from "@/lib/trust-language";
import { PATTERN_STATUS_LABELS } from "@/lib/trust-language";
import { YOUR_MAP_CORRECTION_DEFERRED_COPY } from "@/lib/your-map-surface";

import { InspectorEvidenceSelectionControl } from "../InspectorEvidenceSelectionControl";

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

function ObjectHeader({
  typeLabel,
  title,
  meta,
}: {
  typeLabel: string;
  title: string;
  meta: string;
}) {
  return (
    <header className="border-b ml-hairline px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan/75">
        {typeLabel}
      </div>
      <h3 className="mt-1 text-[15px] font-semibold leading-snug text-foreground">{title}</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">{meta}</p>
    </header>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
      ))}
    </div>
  );
}

function UnavailableState({ objectTypeLabel }: { objectTypeLabel: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm font-medium text-foreground">Detail unavailable</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        This {objectTypeLabel.toLowerCase()} is not available through the public inspector projection.
      </p>
    </div>
  );
}

function SectionBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="px-4 pb-4">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">
        {children}
      </div>
    </section>
  );
}

function FactGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="uppercase tracking-wide text-[10px]">{item.label}</dt>
          <dd className="mt-0.5 font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RenderList({
  items,
  emptyCopy,
}: {
  items: string[];
  emptyCopy: string;
}) {
  if (items.length === 0) {
    return <p className="text-[12px] leading-relaxed text-muted-foreground">{emptyCopy}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-1.5 text-[13px] leading-relaxed">
          <span className="text-cyan/75">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function LinkedObjectsSection({
  label,
  ids,
  emptyCopy,
}: {
  label: string;
  ids: string[] | undefined;
  emptyCopy: string;
}) {
  const orvekData = useOptionalOrvekData();
  const safeIds = (ids ?? []).filter((id): id is string => typeof id === "string" && id.trim().length > 0);

  if (safeIds.length === 0) {
    return null;
  }

  const objects = orvekData?.getObjects(safeIds) ?? [];

  return (
    <SectionBlock label={label}>
      {objects.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-muted-foreground">{emptyCopy}</p>
      ) : (
        <ul className="space-y-2">
          {objects.map((object) => (
            <li key={object.id} className="ml-material rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Chip tone="neutral">{TYPE_META[object.type].label}</Chip>
                <span className="truncate font-medium text-foreground">{object.title}</span>
              </div>
              {object.summary ? (
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                  {object.summary}
                </p>
              ) : object.whyItMatters ? (
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                  {object.whyItMatters}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SectionBlock>
  );
}

function SourceObjectSections({
  object,
  hideSummary = false,
  deferredCorrectionCopy,
  showWhatWouldChange = true,
}: {
  object: OrvekObject | undefined;
  hideSummary?: boolean;
  deferredCorrectionCopy?: string | null;
  showWhatWouldChange?: boolean;
}) {
  const orvekData = useOptionalOrvekData();

  if (!object) {
    return null;
  }

  const getObjects = orvekData?.getObjects ?? (() => []);
  const receipts = getObjects(object.receiptIds ?? []);
  const relatedObjects = getObjects(object.relatedIds ?? []);
  const contextObjects = getObjects(object.contextIds ?? []);
  const hasDeferredCorrection = Boolean(
    deferredCorrectionCopy &&
      !object.whatWouldChange?.length &&
      (object.type === "map-object" || object.type === "context")
  );
  const showCurrentModelRead =
    Boolean(object.recommendation) && object.recommendation !== object.summary;
  const showOutcome =
    Boolean(object.outcomeWindow || object.expectedOutcome || object.actualOutcome);
  const showModelMovement = Boolean(object.before || object.after);
  const showOptions = Boolean(object.options && object.options.length > 0);
  const showDecisionContext = Boolean(object.decisionContext && object.decisionContext.length > 0);
  const showSupporting = Boolean(
    (object.supporting && object.supporting.length > 0) ||
      (object.conflicting && object.conflicting.length > 0)
  );

  return (
    <>
      {object.sourceText ? (
        <SectionBlock label="Source text">
          <blockquote className="rounded-md border-l-2 border-primary bg-evidence-muted/50 px-3 py-2 text-[13px] italic text-foreground">
            “{object.sourceText}”
          </blockquote>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {(object.sourceOrigin ?? "Source") + (object.date ? ` · ${object.date}` : "")}
          </p>
        </SectionBlock>
      ) : null}

      {object.whyResurfaced ? (
        <SectionBlock label="Why it resurfaced">{object.whyResurfaced}</SectionBlock>
      ) : null}

      {!hideSummary && object.summary ? (
        <SectionBlock label="Summary">{object.summary}</SectionBlock>
      ) : null}

      {object.whyItMatters ? (
        <SectionBlock label="Why it matters">{object.whyItMatters}</SectionBlock>
      ) : null}

      {showCurrentModelRead ? (
        <SectionBlock label="Current model read">{object.recommendation}</SectionBlock>
      ) : null}

      {showOptions ? (
        <SectionBlock label="Options">
          <div className="space-y-2.5">
            {object.options!.map((option) => (
              <div key={option.label} className="rounded-[9px] bg-secondary/50 p-2.5">
                <p className="text-[13px] font-medium text-foreground">
                  <span className="text-primary">{option.label}.</span> {option.text}
                </p>
                {option.pros?.length ? (
                  <ul className="mt-1.5 space-y-0.5">
                    {option.pros.map((item) => (
                      <li key={item} className="flex gap-1.5 text-xs text-foreground">
                        <span className="text-primary">+</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {option.cons?.length ? (
                  <ul className="mt-1 space-y-0.5">
                    {option.cons.map((item) => (
                      <li key={item} className="flex gap-1.5 text-xs text-muted-foreground">
                        <span className="text-destructive">−</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </SectionBlock>
      ) : null}

      {showDecisionContext ? (
        <SectionBlock label="Context">
          <dl className="space-y-1.5">
            {object.decisionContext!.map((contextItem) => (
              <div key={contextItem.label} className="flex gap-2 text-[13px]">
                <dt className="w-28 shrink-0 text-muted-foreground">{contextItem.label}</dt>
                <dd className="text-foreground">{contextItem.value}</dd>
              </div>
            ))}
          </dl>
        </SectionBlock>
      ) : null}

      {object.projection ? (
        <SectionBlock label="Projection">
          <p>{object.projection}</p>
          {object.confidence ? (
            <p className="mt-1.5 text-xs">
              <span className="text-muted-foreground">Confidence: </span>
              <span className="font-medium text-foreground">{object.confidence}</span>
            </p>
          ) : null}
        </SectionBlock>
      ) : null}

      {showOutcome ? (
        <SectionBlock label="Outcome">
          {object.outcomeWindow ? (
            <p className="text-[13px] text-muted-foreground">{object.outcomeWindow}</p>
          ) : null}
          {object.expectedOutcome ? (
            <p className="mt-1.5 text-[13px]">
              <span className="text-muted-foreground">Expected: </span>
              {object.expectedOutcome}
            </p>
          ) : null}
          {object.actualOutcome ? (
            <p className="mt-1 text-[13px]">
              <span className="text-muted-foreground">Actual: </span>
              {object.actualOutcome}
            </p>
          ) : null}
        </SectionBlock>
      ) : null}

      {object.hypotheses?.length ? (
        <SectionBlock label="Hypotheses">
          <RenderList items={object.hypotheses} emptyCopy="" />
        </SectionBlock>
      ) : null}

      {object.missingEvidence?.length ? (
        <SectionBlock label="Missing evidence">
          <RenderList items={object.missingEvidence} emptyCopy="" />
        </SectionBlock>
      ) : null}

      {showModelMovement ? (
        <SectionBlock label="Model movement">
          {object.before ? (
            <div className="rounded-[9px] bg-muted/70 px-2.5 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Before
              </p>
              <p className="mt-0.5 text-[13px] text-foreground">{object.before}</p>
            </div>
          ) : null}
          {object.after ? (
            <div className="mt-1.5 rounded-[9px] bg-evidence-muted/70 px-2.5 py-1.5 ring-1 ring-inset ring-primary/15">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                After
              </p>
              <p className="mt-0.5 text-[13px] text-foreground">{object.after}</p>
            </div>
          ) : null}
        </SectionBlock>
      ) : null}

      {showSupporting ? (
        <SectionBlock label="Supporting & conflicting">
          <div className="rounded-[10px] bg-secondary/40 px-3 py-2.5">
            {object.supporting?.length ? (
              <ul className="space-y-1">
                {object.supporting.map((item) => (
                  <li key={item} className="flex gap-1.5 text-[13px]">
                    <span className="text-primary">+</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            {object.conflicting?.length ? (
              <ul className={object.supporting?.length ? "mt-1.5 space-y-1" : "space-y-1"}>
                {object.conflicting.map((item) => (
                  <li key={item} className="flex gap-1.5 text-[13px] text-muted-foreground">
                    <span className="text-destructive">−</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </SectionBlock>
      ) : null}

      {receipts.length > 0 || (object.receiptIds?.length ?? 0) > 0 ? (
        <SectionBlock label="Receipts">
          {receipts.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {PUBLIC_EVIDENCE_FALLBACK_COPY}
            </p>
          ) : (
            <ul className="space-y-2">
              {receipts.map((receipt) => (
                <li key={receipt.id} className="ml-material rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Chip tone="neutral">{TYPE_META[receipt.type].label}</Chip>
                    <span className="truncate font-medium text-foreground">{receipt.title}</span>
                  </div>
                  {receipt.sourceText ? (
                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                      {receipt.sourceText}
                    </p>
                  ) : receipt.summary ? (
                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                      {receipt.summary}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionBlock>
      ) : null}

      <LinkedObjectsSection
        label="Relevant background / context"
        ids={contextObjects.length > 0 ? contextObjects.map((item) => item.id) : object.contextIds}
        emptyCopy="No background context is available in this projection yet."
      />

      <LinkedObjectsSection
        label="Related objects"
        ids={relatedObjects.length > 0 ? relatedObjects.map((item) => item.id) : object.relatedIds}
        emptyCopy="No related objects are available in this projection yet."
      />

      {showWhatWouldChange && object.whatWouldChange?.length ? (
        <SectionBlock label="What would change this">
          <RenderList items={object.whatWouldChange} emptyCopy="" />
        </SectionBlock>
      ) : showWhatWouldChange && hasDeferredCorrection ? (
        <SectionBlock label="What would change this">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {deferredCorrectionCopy}
          </p>
        </SectionBlock>
      ) : null}
    </>
  );
}

function EvidenceLinksSection({ items }: { items: InspectorEvidenceLinkItem[] }) {
  const cards = dedupeInspectorEvidenceLinks(items).map((item) =>
    projectInspectorEvidenceCard(item)
  );

  if (cards.length === 0) {
    return (
      <p className="px-4 pb-4 text-[12px] leading-relaxed text-muted-foreground">
        {PUBLIC_EVIDENCE_FALLBACK_COPY}
      </p>
    );
  }

  return (
    <ul className="space-y-2 px-4 pb-4">
      {cards.map((card) => (
        <li key={card.dedupeKey}>
          <InspectorEvidenceSelectionControl
            href={card.href}
            sourceType={card.sourceType}
            sourceId={card.sourceId}
            title={card.title}
            className="ml-material block w-full rounded-xl px-3 py-2.5 text-left text-[12px] hover:bg-white/[0.02]"
          >
            <div className="font-medium text-foreground">{card.title}</div>
            <div className="mt-0.5 text-[11px] font-medium text-cyan/80">{card.sourceKind}</div>
            {card.linkRoleLabel ? (
              <div className="mt-0.5 text-muted-foreground capitalize">{card.linkRoleLabel}</div>
            ) : null}
            <div className="label-meta mt-1">Linked {formatDateTime(card.createdAt)}</div>
          </InspectorEvidenceSelectionControl>
        </li>
      ))}
    </ul>
  );
}

function mergeInspectorEvidenceLinks(
  ...lists: InspectorEvidenceLinkItem[][]
): InspectorEvidenceLinkItem[] {
  return dedupeInspectorEvidenceLinks(lists.flat());
}

function collectMovementReportReceiptRefs(
  report: RealityTrackingModelMovementReport
): RealityTrackingEvidenceRef[] {
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

function resolveAffectedObjectEvidenceEndpoint(
  affectedObjectType: WhatChangedListItem["affectedObjectType"],
  affectedObjectId: string | null
): string | null {
  if (!affectedObjectId) {
    return null;
  }

  switch (affectedObjectType) {
    case "usermap_conclusion":
      return INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT(affectedObjectId);
    case "investigation":
      return `/api/active-questions/${encodeURIComponent(affectedObjectId)}/evidence`;
    case "fieldwork_assignment":
      return `/api/watch-for/${encodeURIComponent(affectedObjectId)}/evidence`;
    default:
      return null;
  }
}

type AffectedObjectContext = {
  userMap: UserMapConclusionPublicApiDetailItem | null;
  pattern: PatternClaimView | null;
  contradiction: InspectorContradictionProjection | null;
  affectedEvidence: InspectorEvidenceLinkItem[];
};

async function loadAffectedObjectContext(
  item: WhatChangedListItem
): Promise<AffectedObjectContext> {
  const empty: AffectedObjectContext = {
    userMap: null,
    pattern: null,
    contradiction: null,
    affectedEvidence: [],
  };

  const affectedObjectId = item.affectedObjectId;
  if (!affectedObjectId) {
    return empty;
  }

  const evidenceEndpoint = resolveAffectedObjectEvidenceEndpoint(
    item.affectedObjectType,
    affectedObjectId
  );
  const evidencePromise = evidenceEndpoint
    ? fetchInspectorEvidenceLinks(evidenceEndpoint)
    : Promise.resolve([]);

  switch (item.affectedObjectType) {
    case "usermap_conclusion": {
      const [userMap, affectedEvidence] = await Promise.all([
        fetchInspectorUserMapDetail(affectedObjectId),
        evidencePromise,
      ]);
      return { ...empty, userMap, affectedEvidence };
    }
    case "pattern_claim": {
      const [pattern, affectedEvidence] = await Promise.all([
        fetchInspectorPatternClaim(affectedObjectId),
        evidencePromise,
      ]);
      return { ...empty, pattern, affectedEvidence };
    }
    case "contradiction_node": {
      const [contradiction, affectedEvidence] = await Promise.all([
        fetchInspectorContradiction(affectedObjectId),
        evidencePromise,
      ]);
      return { ...empty, contradiction, affectedEvidence };
    }
    case "investigation":
    case "fieldwork_assignment": {
      const affectedEvidence = await evidencePromise;
      return { ...empty, affectedEvidence };
    }
    default:
      return empty;
  }
}

function RelatedMapConclusionSection({
  detail,
  href,
}: {
  detail: UserMapConclusionPublicApiDetailItem;
  href: string | null;
}) {
  return (
    <SectionBlock label="Related map conclusion">
      {href ? (
        <Link href={href} className="text-[14px] font-semibold text-foreground hover:text-cyan">
          {detail.title}
        </Link>
      ) : (
        <p className="text-[14px] font-semibold text-foreground">{detail.title}</p>
      )}
      <p className="mt-2 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">{detail.summary}</p>
      <FactGrid
        items={[
          { label: "Area", value: formatUserMapArea(detail.area) },
          { label: "Status", value: formatUserMapStatus(detail.status) },
          { label: "Confidence", value: formatUserMapConfidenceLevel(detail.confidenceLevel) },
          { label: "Evidence sources", value: String(detail.evidenceCount) },
          { label: "Source diversity", value: String(detail.sourceDiversity) },
          { label: "Time spread", value: `${detail.timeSpreadDays} days` },
        ]}
      />
      {detail.status === "disputed" ? (
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          This conclusion is marked as disputed, so linked evidence may point in conflicting
          directions.
        </p>
      ) : null}
    </SectionBlock>
  );
}

function RelatedPatternSection({ claim }: { claim: PatternClaimView }) {
  const familyLabel =
    PATTERN_FAMILY_SECTIONS.find((section) => section.familyKey === claim.patternType)
      ?.sectionLabel ?? "Pattern";

  return (
    <SectionBlock label="Related pattern">
      <p className="text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">{claim.summary}</p>
      <FactGrid
        items={[
          { label: "Family", value: familyLabel },
          { label: "Status", value: PATTERN_STATUS_LABELS[claim.status] },
          { label: "Strength", value: STRENGTH_LABELS[claim.strengthLevel] },
          { label: "Receipts", value: String(claim.evidenceCount) },
        ]}
      />
    </SectionBlock>
  );
}

function RelatedSignalSection({ item }: { item: InspectorContradictionProjection }) {
  return (
    <SectionBlock label="Related signal">
      <FactGrid
        items={[
          { label: "Status", value: item.status.replace(/_/g, " ") },
          { label: "Evidence", value: String(item.evidenceCount) },
        ]}
      />
      <div className="mt-3 space-y-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Side A</div>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">{item.sideA}</p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Side B</div>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">{item.sideB}</p>
        </div>
      </div>
    </SectionBlock>
  );
}

function ReportReceiptLinksSection({ refs }: { refs: RealityTrackingEvidenceRef[] }) {
  const visibleRefs = filterResolvableEvidenceRefs(refs);

  if (visibleRefs.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2 px-4 pb-4">
      {visibleRefs.map((ref) => (
        <li key={ref.id} className="ml-material rounded-xl px-3 py-2.5 text-[12px]">
          <InspectorEvidenceSelectionControl
            href={ref.href}
            sourceType={ref.sourceType}
            sourceId={ref.sourceId}
            title={formatEvidenceRefDisplay(ref)}
            className="block w-full text-left hover:text-foreground"
          >
            <div className="font-medium text-foreground">{formatEvidenceRefDisplay(ref)}</div>
            <div className="label-meta mt-1">Linked {formatDateTime(ref.createdAt)}</div>
          </InspectorEvidenceSelectionControl>
        </li>
      ))}
    </ul>
  );
}

function ModelUpdateEvidenceEmptyState({
  report,
  hasResolvableAffectedObject,
}: {
  report: RealityTrackingModelMovementReport;
  hasResolvableAffectedObject: boolean;
}) {
  const nextEvidence =
    report.fieldworkWatchFor.items[0]?.text ??
    report.realityGate.items[0]?.text ??
    report.whatWouldChangeThisConclusion.items[0]?.text ??
    "Capture the next instance with trigger, behavior, aftermath, and whether it repeats in a second context.";

  return (
    <div className="space-y-2 px-4 pb-4 text-[12px] leading-relaxed text-muted-foreground">
      <p>
        {hasResolvableAffectedObject
          ? "This movement is recorded, but no linked public evidence is available on the movement or related object yet."
          : "This movement is recorded, but no linked public evidence is attached yet."}
      </p>
      <p>
        <span className="font-medium text-foreground">Next evidence needed:</span> {nextEvidence}
      </p>
      <p className="text-[11px]">
        Open the {ORVEK_COPY.mindModelMovementTab} tab for the epistemic report on this movement.
      </p>
    </div>
  );
}

function UserMapEvidencePanel({
  selection,
  sourceObject,
}: {
  selection: InspectorSelection;
  sourceObject: OrvekObject | undefined;
}) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchInspectorUserMapDetail>>>(null);
  const [evidence, setEvidence] = useState<InspectorEvidenceLinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);

    void (async () => {
      const [nextDetail, nextEvidence] = await Promise.all([
        fetchInspectorUserMapDetail(selection.selectedObjectId),
        fetchInspectorEvidenceLinks(
          INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT(selection.selectedObjectId)
        ),
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
  }, [selection.selectedObjectId]);

  if (isLoading) {
    return <PanelSkeleton />;
  }

  if (notFound || !detail) {
    return <UnavailableState objectTypeLabel="Map conclusion" />;
  }

  return (
    <>
      <ObjectHeader
        typeLabel="Map conclusion"
        title={selection.selectedTitle ?? detail.title}
        meta={`${formatUserMapArea(detail.area)} · ${formatUserMapStatus(detail.status)} · ${formatUserMapConfidenceLevel(detail.confidenceLevel)}`}
      />
      <section className="px-4 pb-3">
        <p className="text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">{detail.summary}</p>
        <FactGrid
          items={[
            { label: "Evidence sources", value: String(detail.evidenceCount) },
            { label: "Source diversity", value: String(detail.sourceDiversity) },
            { label: "Time spread", value: `${detail.timeSpreadDays} days` },
            { label: "Created", value: formatDateTime(detail.createdAt) },
          ]}
        />
        <div className="label-meta mt-3">Updated {formatDateTime(detail.updatedAt)}</div>
        {detail.status === "disputed" ? (
          <p className="mt-3 text-[13px] text-muted-foreground">
            This conclusion is marked as disputed, so linked evidence may point in conflicting
            directions.
          </p>
        ) : null}
      </section>
      <SourceObjectSections
        object={sourceObject}
        hideSummary
        deferredCorrectionCopy={YOUR_MAP_CORRECTION_DEFERRED_COPY}
      />
      <SectionLabel>Supporting evidence</SectionLabel>
      <EvidenceLinksSection items={evidence} />
    </>
  );
}

function PatternEvidencePanel({
  selection,
  sourceObject,
}: {
  selection: InspectorSelection;
  sourceObject: OrvekObject | undefined;
}) {
  const [claim, setClaim] = useState<PatternClaimView | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    void fetchInspectorPatternClaim(selection.selectedObjectId).then((item) => {
      if (!cancelled) {
        setClaim(item);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selection.selectedObjectId]);

  if (isLoading) {
    return <PanelSkeleton />;
  }

  if (!claim) {
    return <UnavailableState objectTypeLabel="Pattern" />;
  }

  const familyLabel =
    PATTERN_FAMILY_SECTIONS.find((section) => section.familyKey === claim.patternType)?.sectionLabel ??
    "Pattern";
  const statusLabel = PATTERN_STATUS_LABELS[claim.status];
  const actionGateReason = getActionGateReason(claim);

  return (
    <>
      <ObjectHeader
        typeLabel="Pattern"
        title={selection.selectedTitle ?? claim.summary}
        meta={`${familyLabel} · ${statusLabel} · ${STRENGTH_LABELS[claim.strengthLevel]}`}
      />
      <section className="px-4 pb-3">
        <p className="text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">{claim.summary}</p>
        <FactGrid
          items={[
            { label: "Receipts", value: String(claim.evidenceCount) },
            { label: "Sessions", value: String(claim.sessionCount) },
            { label: "Journal-backed", value: String(claim.journalEvidenceCount) },
            { label: "Support spread", value: String(claim.supportContainerSpread) },
          ]}
        />
        <div className="mt-2 text-[12px] text-muted-foreground">
          Journal entry spread: {claim.journalEntrySpread} · Journal day spread:{" "}
          {claim.journalDaySpread}
        </div>
        <div className="label-meta mt-3">Updated {formatDateTime(claim.updatedAt)}</div>
      </section>

      <SourceObjectSections
        object={sourceObject}
        deferredCorrectionCopy={
          sourceObject?.type === "context" || sourceObject?.type === "map-object"
            ? YOUR_MAP_CORRECTION_DEFERRED_COPY
            : null
        }
      />

      <SectionBlock label="Next step">
        {claim.action ? (
          <div className="rounded-xl bg-secondary/50 px-3 py-2.5">
            <p className="text-[13px] font-medium text-foreground">{claim.action.prompt}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
              <div>
                <dt className="uppercase tracking-wide text-[10px]">Status</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {claim.action.status.replace(/_/g, " ")}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-[10px]">Outcome</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {claim.action.outcomeSignal ?? "No outcome yet"}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-[10px]">Created</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {formatDateTime(claim.action.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-[10px]">Completed</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {claim.action.completedAt ? formatDateTime(claim.action.completedAt) : "—"}
                </dd>
              </div>
            </dl>
            {claim.action.reflectionNote ? (
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                {claim.action.reflectionNote}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {actionGateReason ?? "No active next step is recorded for this pattern."}
          </p>
        )}
      </SectionBlock>

      <SectionLabel>Receipts</SectionLabel>
      {claim.receipts.length === 0 ? (
        <p className="px-4 pb-4 text-[12px] text-muted-foreground">{PUBLIC_EVIDENCE_FALLBACK_COPY}</p>
      ) : (
        <ul className="space-y-2 px-4 pb-4">
          {claim.receipts.slice(0, 6).map((receipt) => (
            <li key={receipt.id} className="ml-material rounded-xl px-3 py-2.5 text-[12px]">
              <div className="font-medium text-cyan/80">{receipt.source}</div>
              {receipt.quote ? (
                <p className="mt-1 leading-relaxed text-muted-foreground line-clamp-3">
                  {receipt.quote}
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">Receipt recorded without stored quote.</p>
              )}
              <div className="label-meta mt-1">{formatDateTime(receipt.createdAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ContradictionEvidencePanel({
  selection,
  sourceObject,
}: {
  selection: InspectorSelection;
  sourceObject: OrvekObject | undefined;
}) {
  const [item, setItem] = useState<Awaited<ReturnType<typeof fetchInspectorContradiction>>>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    void fetchInspectorContradiction(selection.selectedObjectId).then((next) => {
      if (!cancelled) {
        setItem(next);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selection.selectedObjectId]);

  if (isLoading) {
    return <PanelSkeleton />;
  }

  if (!item) {
    return <UnavailableState objectTypeLabel="Signal" />;
  }

  return (
    <>
      <ObjectHeader
        typeLabel="Active signal"
        title={selection.selectedTitle ?? item.title}
        meta={`${item.status.replace(/_/g, " ")} · ${item.evidenceCount} evidence`}
      />
      <section className="px-4 pb-3 space-y-3">
        <FactGrid
          items={[
            { label: "Status", value: item.status.replace(/_/g, " ") },
            { label: "Evidence", value: String(item.evidenceCount) },
            {
              label: "Last evidence",
              value: item.lastEvidenceAt ? formatDateTime(item.lastEvidenceAt) : "—",
            },
            { label: "Last touched", value: formatDateTime(item.lastTouchedAt) },
          ]}
        />
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Side A</div>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">{item.sideA}</p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Side B</div>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">{item.sideB}</p>
        </div>
      </section>
      <SourceObjectSections object={sourceObject} />
      <p className="px-4 pb-4 text-[12px] text-muted-foreground">
        Raw message evidence stays on the signal detail surface. Use the full page for deeper review.
      </p>
    </>
  );
}

function ModelUpdateEvidencePanel({
  selection,
  sourceObject,
  resolveOrvekObject,
}: {
  selection: InspectorSelection;
  sourceObject: OrvekObject | undefined;
  resolveOrvekObject: (id: string) => OrvekObject | undefined;
}) {
  const modelUpdateId = selection.selectedModelUpdateId ?? selection.selectedObjectId;
  const [detail, setDetail] = useState<InspectorModelUpdateDetail | null>(null);
  const [affectedContext, setAffectedContext] = useState<AffectedObjectContext | null>(null);
  const [movementEvidence, setMovementEvidence] = useState<InspectorEvidenceLinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      const nextDetail = await fetchInspectorModelUpdateDetail(modelUpdateId);
      if (cancelled) {
        return;
      }

      if (!nextDetail) {
        setDetail(null);
        setAffectedContext(null);
        setMovementEvidence([]);
        setIsLoading(false);
        return;
      }

      const [nextMovementEvidence, nextAffectedContext] = await Promise.all([
        fetchInspectorEvidenceLinks(INSPECTOR_MODEL_UPDATE_EVIDENCE_ENDPOINT(modelUpdateId)),
        loadAffectedObjectContext(nextDetail.item),
      ]);

      if (cancelled) {
        return;
      }

      setDetail(nextDetail);
      setMovementEvidence(nextMovementEvidence);
      setAffectedContext(nextAffectedContext);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [modelUpdateId]);

  if (isLoading) {
    return <PanelSkeleton />;
  }

  if (!detail || !affectedContext) {
    return <UnavailableState objectTypeLabel={ORVEK_COPY.mindModelMovement} />;
  }

  const { item, report } = detail;
  const supportingEvidence = mergeInspectorEvidenceLinks(
    movementEvidence,
    affectedContext.affectedEvidence
  );
  const reportReceiptRefs = collectMovementReportReceiptRefs(report);
  const hasResolvableAffectedObject = Boolean(
    item.affectedObjectId &&
      (affectedContext.userMap ||
        affectedContext.pattern ||
        affectedContext.contradiction ||
        item.affectedObjectHref)
  );
  const contextObject =
    sourceObject ??
    (item.affectedObjectId ? resolveOrvekObject(item.affectedObjectId) : undefined);
  const showSupportingEvidenceSection =
    supportingEvidence.length > 0 || reportReceiptRefs.length > 0;

  return (
    <>
      <ObjectHeader
        typeLabel={ORVEK_COPY.mindModelMovement}
        title={selection.selectedTitle ?? item.updateTypeLabel}
        meta={`${item.updateTypeLabel} · ${item.affectedObjectTypeLabel}`}
      />

      <SectionBlock label="Movement summary">{item.userFacingSummary}</SectionBlock>

      <section className="px-4 pb-3">
        <FactGrid
          items={[
            { label: "Recorded", value: formatDateTime(item.createdAt) },
            {
              label: "Receipts",
              value: String(report.evidencePacketSummary.receiptCount),
            },
            {
              label: "Linked object",
              value: report.evidencePacketSummary.targetLabel,
            },
          ]}
        />
        <div className="mt-3">
          <PublicLinkedObjectContinuity
            objectType={item.affectedObjectType}
            objectId={item.affectedObjectId}
            href={item.affectedObjectHref}
            context="model_update"
          />
        </div>
      </section>

      {affectedContext.userMap ? (
        <RelatedMapConclusionSection
          detail={affectedContext.userMap}
          href={item.affectedObjectHref}
        />
      ) : null}

      {affectedContext.pattern ? (
        <RelatedPatternSection claim={affectedContext.pattern} />
      ) : null}

      {affectedContext.contradiction ? (
        <RelatedSignalSection item={affectedContext.contradiction} />
      ) : null}

      <SourceObjectSections
        object={contextObject}
        hideSummary={Boolean(affectedContext.userMap?.summary)}
        deferredCorrectionCopy={
          item.affectedObjectType === "usermap_conclusion"
            ? YOUR_MAP_CORRECTION_DEFERRED_COPY
            : null
        }
        showWhatWouldChange={false}
      />

      <SectionLabel>Supporting evidence</SectionLabel>
      {supportingEvidence.length > 0 ? (
        <EvidenceLinksSection items={supportingEvidence} />
      ) : reportReceiptRefs.length > 0 ? (
        <ReportReceiptLinksSection refs={reportReceiptRefs} />
      ) : (
        <ModelUpdateEvidenceEmptyState
          report={report}
          hasResolvableAffectedObject={hasResolvableAffectedObject}
        />
      )}

      {showSupportingEvidenceSection ? (
        <p className="px-4 pb-4 text-[11px] text-muted-foreground">
          Open the {ORVEK_COPY.mindModelMovementTab} tab for facts, guardrails, and the full
          epistemic read on this movement.
        </p>
      ) : null}
    </>
  );
}

export function SelectedObjectEvidencePanel({
  selection,
}: {
  selection: InspectorSelection;
}) {
  const { selectedId } = useWorkbench();
  const orvekData = useOptionalOrvekData();
  const sourceObject = resolveInspectorSourceObject({
    selection,
    selectedWorkbenchId: selectedId,
    getObject: orvekData?.getObject ?? (() => undefined),
  });

  switch (selection.selectedObjectType) {
    case "usermap_conclusion":
      return <UserMapEvidencePanel selection={selection} sourceObject={sourceObject} />;
    case "pattern_claim":
      return <PatternEvidencePanel selection={selection} sourceObject={sourceObject} />;
    case "contradiction_node":
      return <ContradictionEvidencePanel selection={selection} sourceObject={sourceObject} />;
    case "model_update":
      return (
        <ModelUpdateEvidencePanel
          selection={selection}
          sourceObject={sourceObject}
          resolveOrvekObject={(id) => orvekData?.getObject(id)}
        />
      );
    default:
      return <UnavailableState objectTypeLabel="Object" />;
  }
}
