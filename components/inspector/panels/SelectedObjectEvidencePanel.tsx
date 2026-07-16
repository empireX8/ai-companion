"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Chip, SectionLabel, TYPE_META } from "@/components/orvek-v0/primitives";
import {
  DurableCorrectionControls,
  DurableDecisionOutcomeControls,
  DurableFieldworkCheckInControls,
  supportsDurableCorrection,
} from "@/components/orvek-v0/durable-user-action-controls";
import { useDurableActionsRefresh } from "@/lib/orvek-v0/durable-actions-context";
import { useWorkbench } from "@/components/orvek-v0/store";
import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import { PUBLIC_EVIDENCE_FALLBACK_COPY } from "@/lib/public-continuity-registry";
import {
  resolveOrvekObjectProvenance,
  useOptionalOrvekData,
} from "@/lib/orvek-v0/data-provider";
import type { OrvekObject } from "@/lib/orvek-v0/orvek-types";
import {
  fetchInspectorContradiction,
  fetchInspectorEvidenceLinks,
  fetchInspectorInvestigationDetail,
  fetchInspectorModelUpdateDetail,
  fetchInspectorPatternClaim,
  fetchInspectorUserMapDetail,
  INSPECTOR_MODEL_UPDATE_EVIDENCE_ENDPOINT,
  INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT,
  type InspectorContradictionProjection,
  type InspectorEvidenceLinkItem,
  type InspectorModelUpdateDetail,
} from "@/lib/inspector-object-api";
import {
  resolveInspectorObjectType,
  type InspectorSelection,
} from "@/lib/inspector-selection";
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
  formatEvidenceRefRole,
  filterResolvableEvidenceRefs,
  formatEvidenceRefDisplay,
  projectInspectorEvidenceCard,
  sanitizeInspectorDisplayText,
  splitInspectorReadoutText,
} from "@/lib/inspector-evidence-presentation";
import { ORVEK_COPY } from "@/lib/trust-language";
import { PATTERN_STATUS_LABELS } from "@/lib/trust-language";
import { YOUR_MAP_CORRECTION_DEFERRED_COPY } from "@/lib/your-map-surface";

import { useInspector } from "../InspectorContext";
import { InspectorEvidenceSelectionControl } from "../InspectorEvidenceSelectionControl";

const TODAY_HANDOFF_KEY = "mindlabs:today-capture-handoff";
const MODEL_GOAL_CORRECTION_DEFERRED_COPY =
  "To correct this model goal, capture contradicting evidence in Capture Life Data. Correction controls are deferred here.";

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
  const { canGoBack, backTarget, goBack } = useInspector();
  const backTitle =
    sanitizeInspectorDisplayText(backTarget?.selection.selectedTitle) ??
    backTarget?.selection.selectedObjectType;
  const displayTitle = sanitizeInspectorDisplayText(title) ?? "Selected object";

  return (
    <header className="px-5 pt-4">
      {canGoBack ? (
        <div className="mb-3 rounded-[10px] bg-secondary/50 px-2.5 py-2">
          <button
            type="button"
            onClick={goBack}
            className="o-calm inline-flex items-center gap-1 text-[12px] font-medium text-foreground hover:text-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to {backTitle}
          </button>
          <span className="ml-2 text-[11px] text-muted-foreground">
            {backTarget?.trailLabel ?? "Viewing linked evidence"}
          </span>
        </div>
      ) : null}
      <div className="inline-flex items-center rounded-md bg-evidence-muted px-2 py-0.5 text-xs font-medium text-primary">
        {typeLabel}
      </div>
      <h3 className="mt-2 text-base font-semibold leading-snug text-foreground text-pretty">
        {displayTitle}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
    </header>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-2 px-5 pt-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-[10px] bg-secondary/50" />
      ))}
    </div>
  );
}

function UnavailableState({ objectTypeLabel }: { objectTypeLabel: string }) {
  return (
    <div className="px-8 py-10 text-center">
      <p className="text-sm font-medium text-foreground">This linked object is recorded.</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
        Detail for this {objectTypeLabel.toLowerCase()} is not available in this view yet.
      </p>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        Use the related surface to inspect the full object when that surface is available.
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
    <section className="px-5 pt-4">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 text-sm leading-relaxed text-foreground">
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
          <div className="min-w-0 flex-1">
            <ReadoutText value={item} />
          </div>
        </li>
      ))}
    </ul>
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
  const { pushObject } = useInspector();
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
        <ul className="space-y-1.5">
          {objects.map((object) => {
            const objectType = resolveInspectorObjectType(object);
            return (
            <li key={object.id}>
              <button
                type="button"
                disabled={!objectType}
                onClick={() => {
                  if (!objectType || !orvekData) {
                    return;
                  }
                  const provenance = resolveOrvekObjectProvenance(orvekData, object);
                  pushObject({
                    objectType,
                    objectId: object.inspectorObjectId ?? object.id,
                    modelUpdateId:
                      objectType === "model_update"
                        ? object.inspectorObjectId ?? object.id
                        : undefined,
                    title: object.title,
                    availability:
                      objectType === "reference_decision" || objectType === "reference_report"
                        ? provenance === "live"
                          ? "unsupported"
                          : "reference_fallback"
                        : provenance,
                    trailLabel: `Viewing ${label.toLowerCase()}`,
                  });
                }}
                className="o-calm w-full rounded-[9px] bg-secondary/50 px-2.5 py-2 text-left hover:bg-accent/60 disabled:cursor-default"
              >
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = TYPE_META[object.type].icon;
                  return <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />;
                })()}
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                  {object.title}
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </div>
              {object.summary ? (
                <div className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed">
                  <ReadoutText value={object.summary} muted />
                </div>
              ) : object.whyItMatters ? (
                <div className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed">
                  <ReadoutText value={object.whyItMatters} muted />
                </div>
              ) : null}
              </button>
            </li>
            );
          })}
        </ul>
      )}
    </SectionBlock>
  );
}

function DeferredActionsSection() {
  return (
    <section className="mx-4 mt-5 rounded-2xl bg-secondary/40 px-4 py-3.5">
      <SectionLabel>Correct the model</SectionLabel>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        Correction controls are deferred here until a durable evidence-backed write path is
        available.
      </p>
      <button
        type="button"
        disabled
        className="mt-3 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium text-muted-foreground opacity-70"
      >
        Correct the model · deferred
      </button>
      <button
        type="button"
        disabled
        className="ml-2 mt-3 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium text-muted-foreground opacity-70"
      >
        Ask in Explore · deferred
      </button>
    </section>
  );
}

function SourceObjectSections({
  object,
  hideSummary = false,
  deferredCorrectionCopy,
  hideReceipts = false,
}: {
  object: OrvekObject | undefined;
  hideSummary?: boolean;
  deferredCorrectionCopy?: string | null;
  hideReceipts?: boolean;
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
      (object.type === "map-object" || object.type === "context" || object.type === "model-goal")
  );
  const showCurrentModelRead =
    Boolean(object.recommendation) && object.recommendation !== object.summary;
  const showOutcome =
    Boolean(object.outcomeWindow || object.expectedOutcome || object.actualOutcome);
  const showModelMovement = Boolean(object.before || object.after);
  const showOptions = Boolean(object.options && object.options.length > 0);
  const showDecisionContext = Boolean(object.decisionContext && object.decisionContext.length > 0);
  const showSupportingEvidence = Boolean(
    (object.receiptIds?.length ?? 0) > 0 || receipts.length > 0
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
        <SectionBlock label="Current understanding">
          <ReadoutText value={object.summary} />
        </SectionBlock>
      ) : null}

      {object.whyItMatters ? (
        <SectionBlock label="Why Orvek thinks this">
          <ReadoutText value={object.whyItMatters} />
        </SectionBlock>
      ) : null}

      {showCurrentModelRead ? (
        <SectionBlock label="Current read">
          <ReadoutText value={object.recommendation ?? ""} />
        </SectionBlock>
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
        <SectionBlock label="Evidence strength / confidence">
          <ReadoutText value={object.projection} />
          {object.confidence ? (
            <p className="mt-2 text-xs">
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
          {object.type === "decision" && !object.actualOutcome ? (
            <DurableDecisionOutcomeControls object={object} className="mt-2.5" />
          ) : null}
        </SectionBlock>
      ) : null}

      {object.type === "fieldwork" ? (
        <SectionBlock label="Check in">
          <DurableFieldworkCheckInControls object={object} />
        </SectionBlock>
      ) : null}

      {object.hypotheses?.length ? (
        <SectionBlock label="Open questions">
          <RenderList items={object.hypotheses} emptyCopy="" />
        </SectionBlock>
      ) : null}

      {showModelMovement ? (
        <SectionBlock label="What changed">
          {object.before ? (
            <div className="rounded-[9px] bg-muted/70 px-2.5 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Before
              </p>
              <div className="mt-1 text-[13px]">
                <ReadoutText value={object.before} />
              </div>
            </div>
          ) : null}
          {object.after ? (
            <div className="mt-1.5 rounded-[9px] bg-evidence-muted/70 px-2.5 py-1.5 ring-1 ring-inset ring-primary/15">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                After
              </p>
              <div className="mt-1 text-[13px]">
                <ReadoutText value={object.after} />
              </div>
            </div>
          ) : null}
        </SectionBlock>
      ) : null}

      {object.supporting?.length ? (
        <SectionBlock label="Supporting signals">
          <RenderList items={object.supporting} emptyCopy="" />
        </SectionBlock>
      ) : null}

      {!hideReceipts && showSupportingEvidence ? (
        <SectionBlock label="Supporting evidence">
          {receipts.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {PUBLIC_EVIDENCE_FALLBACK_COPY}
            </p>
          ) : (
            <ul className="space-y-2">
              {receipts.map((receipt) => (
                <li
                  key={receipt.id}
                  className="o-calm rounded-[10px] bg-card p-2.5 shadow-[0_1px_3px_-1px_rgba(30,41,59,0.1)]"
                >
                  <div className="flex items-center gap-2">
                    <Chip tone="neutral">{TYPE_META[receipt.type].label}</Chip>
                    <span className="truncate font-medium text-foreground">{receipt.title}</span>
                  </div>
                  {receipt.sourceText ? (
                    <div className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed">
                      <ReadoutText value={receipt.sourceText} muted />
                    </div>
                  ) : receipt.summary ? (
                    <div className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed">
                      <ReadoutText value={receipt.summary} muted />
                    </div>
                  ) : null}
                  {receipt.date ? (
                    <div className="label-meta mt-1.5">Recorded {receipt.date}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionBlock>
      ) : null}

      {object.conflicting?.length ? (
        <SectionBlock label="Conflicting evidence">
          <RenderList items={object.conflicting} emptyCopy="" />
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

      {object.whatWouldChange?.length ? (
        <SectionBlock label="What could change this read">
          <RenderList items={object.whatWouldChange} emptyCopy="" />
        </SectionBlock>
      ) : hasDeferredCorrection ? (
        <SectionBlock label="What could change this read">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {deferredCorrectionCopy}
          </p>
        </SectionBlock>
      ) : null}

      {object.missingEvidence?.length ? (
        <SectionBlock label="Missing or unavailable evidence">
          <RenderList items={object.missingEvidence} emptyCopy="" />
        </SectionBlock>
      ) : null}

      {supportsDurableCorrection(object) ? (
        <DurableCorrectionControls object={object} className="mx-0" />
      ) : (
        <DeferredActionsSection />
      )}
    </>
  );
}

function EvidenceLinksSection({ items }: { items: InspectorEvidenceLinkItem[] }) {
  const cards = dedupeInspectorEvidenceLinks(items).map((item) =>
    projectInspectorEvidenceCard(item)
  );

  if (cards.length === 0) {
    return (
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        {PUBLIC_EVIDENCE_FALLBACK_COPY}
      </p>
    );
  }

  return (
    <ul className="mt-2 space-y-1.5">
      {cards.map((card) => (
        <li key={card.dedupeKey}>
          <InspectorEvidenceSelectionControl
            href={card.href}
            sourceType={card.sourceType}
            sourceId={card.sourceId}
            title={card.title}
            trailLabel="Viewing supporting evidence"
            className="o-calm block w-full rounded-[10px] bg-card p-2.5 text-left text-[12px] shadow-[0_1px_3px_-1px_rgba(30,41,59,0.1)] hover:bg-accent/40"
          >
            <div className="font-medium text-foreground">{card.title}</div>
            {card.summary ? (
              <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                <ReadoutText value={card.summary} muted />
              </div>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              <span className="font-medium text-cyan/80">{card.sourceKind}</span>
              {card.linkRoleLabel ? (
                <span className="text-muted-foreground capitalize">{card.linkRoleLabel}</span>
              ) : (
                <span className="text-muted-foreground">Support relation not recorded</span>
              )}
            </div>
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
      <div className="mt-2 text-[13px] leading-relaxed">
        <ReadoutText value={detail.summary} muted />
      </div>
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
      <ReadoutText value={claim.summary} muted />
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
          <div className="mt-1 text-[13px] leading-relaxed">
            <ReadoutText value={item.sideA} muted />
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Side B</div>
          <div className="mt-1 text-[13px] leading-relaxed">
            <ReadoutText value={item.sideB} muted />
          </div>
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
    <ul className="mt-2 space-y-1.5">
      {visibleRefs.map((ref) => (
        <li
          key={ref.id}
          className="o-calm rounded-[10px] bg-card p-2.5 text-[12px] shadow-[0_1px_3px_-1px_rgba(30,41,59,0.1)] hover:bg-accent/40"
        >
          <InspectorEvidenceSelectionControl
            href={ref.href}
            sourceType={ref.sourceType}
            sourceId={ref.sourceId}
            title={formatEvidenceRefDisplay(ref)}
            trailLabel="Viewing supporting receipt"
            className="block w-full text-left hover:text-foreground"
          >
            <div className="font-medium text-foreground">{formatEvidenceRefDisplay(ref)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              <span className="font-medium text-cyan/80">{ref.sourceTypeLabel}</span>
              {formatEvidenceRefRole(ref.role) ? (
                <span className="text-muted-foreground capitalize">
                  {formatEvidenceRefRole(ref.role)}
                </span>
              ) : null}
            </div>
            <div className="label-meta mt-1">Linked {formatDateTime(ref.createdAt)}</div>
          </InspectorEvidenceSelectionControl>
        </li>
      ))}
    </ul>
  );
}

function ModelUpdateEvidenceEmptyState({
  hasResolvableAffectedObject,
}: {
  hasResolvableAffectedObject: boolean;
}) {
  return (
    <div className="mt-2 space-y-2 text-[12px] leading-relaxed text-muted-foreground">
      <p>
        {hasResolvableAffectedObject
          ? "This linked object is recorded, but its detail is not available in this view yet."
          : "This linked object is recorded, but no readable evidence is attached in this view yet."}
      </p>
      <p className="text-[11px]">
        Use the {ORVEK_COPY.mindModelMovementTab} tab for the full movement read, facts, and
        guardrails.
      </p>
    </div>
  );
}

function buildContextCapturePrompt(
  selection: InspectorSelection,
  sourceObject: OrvekObject
): string {
  const currentRead = selection.selectedTitle?.trim() || sourceObject.title;
  const lines = [
    "Correct this context read.",
    `Current read: ${currentRead}`,
    sourceObject.summary ? `Model read: ${sourceObject.summary}` : null,
    sourceObject.confidence ? `Confidence: ${sourceObject.confidence}` : null,
    sourceObject.evidenceCount != null
      ? `Evidence count: ${sourceObject.evidenceCount}`
      : null,
    sourceObject.detailHref ? "Related surface: available" : "Related surface: unavailable",
    sourceObject.supporting?.length
      ? `Supporting evidence: ${sourceObject.supporting.join(" | ")}`
      : null,
    sourceObject.missingEvidence?.length
      ? `Missing evidence: ${sourceObject.missingEvidence.join(" | ")}`
      : null,
    "User correction is first-class evidence. Capture the correction in Capture Life Data.",
  ];

  return lines.filter((line): line is string => Boolean(line && line.trim().length > 0)).join("\n");
}

function buildModelGoalCapturePrompt(
  selection: InspectorSelection,
  sourceObject: OrvekObject
): string {
  const currentRead = selection.selectedTitle?.trim() || sourceObject.title;
  const lines = [
    "Correct this model goal.",
    `Current read: ${currentRead}`,
    sourceObject.summary ? `Model read: ${sourceObject.summary}` : null,
    sourceObject.confidence ? `Confidence: ${sourceObject.confidence}` : null,
    sourceObject.evidenceCount != null
      ? `Evidence count: ${sourceObject.evidenceCount}`
      : null,
    sourceObject.detailHref ? "Related surface: available" : "Related surface: unavailable",
    sourceObject.supporting?.length
      ? `Supporting evidence: ${sourceObject.supporting.join(" | ")}`
      : null,
    sourceObject.missingEvidence?.length
      ? `Missing evidence: ${sourceObject.missingEvidence.join(" | ")}`
      : null,
    "User correction is first-class evidence. Capture the correction in Capture Life Data.",
  ];

  return lines.filter((line): line is string => Boolean(line && line.trim().length > 0)).join("\n");
}

function ContextEvidencePanel({
  selection,
  sourceObject,
}: {
  selection: InspectorSelection;
  sourceObject: OrvekObject | undefined;
}) {
  const router = useRouter();

  if (!sourceObject) {
    return <UnavailableState objectTypeLabel="Mind Context" />;
  }

  const evidenceCountLabel =
    sourceObject.evidenceCount != null
      ? `${sourceObject.evidenceCount} evidence source${sourceObject.evidenceCount === 1 ? "" : "s"}`
      : "Evidence count unavailable";
  const meta = [
    sourceObject.confidence ?? "Evidence-backed read",
    evidenceCountLabel,
    sourceObject.lastUpdated ? `Updated ${formatDateTime(sourceObject.lastUpdated)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const currentRead = sourceObject.recommendation ?? sourceObject.summary ?? sourceObject.title;

  return (
    <>
      <ObjectHeader typeLabel="Mind Context" title={selection.selectedTitle ?? sourceObject.title} meta={meta} />
      <section className="px-5 pt-4">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          This is a correctable model read, not a final conclusion about you.
        </p>
        <div className="mt-3 rounded-[9px] bg-secondary/50 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Current read
          </p>
          <div className="mt-1 text-[13px] leading-relaxed">
            <ReadoutText value={currentRead} />
          </div>
        </div>
        <FactGrid
          items={[
            { label: "Evidence", value: evidenceCountLabel },
            { label: "Confidence", value: sourceObject.confidence ?? "Evidence-linked" },
            {
              label: "Related surface",
              value: sourceObject.detailHref ? "Available" : "Unavailable",
            },
          ]}
        />
        {sourceObject.detailHref ? (
          <div className="mt-3">
            <Link href={sourceObject.detailHref} className="text-[13px] font-medium text-primary hover:underline">
              Open related surface
            </Link>
          </div>
        ) : null}
      </section>

      <SourceObjectSections object={sourceObject} hideSummary />

      <SectionBlock label="Capture correction">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          User correction is first-class evidence. Capture the correction in Capture Life Data.
        </p>
        <button
          type="button"
          onClick={() => {
            const handoffText = buildContextCapturePrompt(selection, sourceObject);
            try {
              window.sessionStorage.setItem(TODAY_HANDOFF_KEY, handoffText);
            } catch {
              // Ignore storage failures.
            }
            router.push("/journal-chat");
          }}
          className="o-calm mt-3 inline-flex items-center gap-1.5 rounded-md bg-evidence-muted px-3 py-1.5 text-[13px] font-medium text-primary hover:brightness-[0.98]"
        >
          Capture correction
        </button>
      </SectionBlock>
    </>
  );
}

function ModelGoalEvidencePanel({
  selection,
  sourceObject,
}: {
  selection: InspectorSelection;
  sourceObject: OrvekObject | undefined;
}) {
  const router = useRouter();

  if (!sourceObject) {
    return <UnavailableState objectTypeLabel="Model Goal" />;
  }

  const evidenceCountLabel =
    sourceObject.evidenceCount != null
      ? `${sourceObject.evidenceCount} evidence source${sourceObject.evidenceCount === 1 ? "" : "s"}`
      : "Evidence count unavailable";
  const meta = [
    sourceObject.confidence ?? "Evidence-linked read",
    evidenceCountLabel,
    sourceObject.lastUpdated ? `Updated ${formatDateTime(sourceObject.lastUpdated)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const currentRead = sourceObject.recommendation ?? sourceObject.summary ?? sourceObject.title;

  return (
    <>
      <ObjectHeader
        typeLabel="Model Goal"
        title={selection.selectedTitle ?? sourceObject.title}
        meta={meta}
      />
      <section className="px-5 pt-4">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          This is a correctable model read, not a final conclusion about you.
        </p>
        <div className="mt-3 rounded-[9px] bg-secondary/50 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Current read
          </p>
          <div className="mt-1 text-[13px] leading-relaxed">
            <ReadoutText value={currentRead} />
          </div>
        </div>
        <FactGrid
          items={[
            { label: "Evidence", value: evidenceCountLabel },
            { label: "Confidence", value: sourceObject.confidence ?? "Evidence-linked" },
            {
              label: "Related surface",
              value: sourceObject.detailHref ? "Available" : "Unavailable",
            },
          ]}
        />
        {sourceObject.detailHref ? (
          <div className="mt-3">
            <Link
              href={sourceObject.detailHref}
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Open related surface
            </Link>
          </div>
        ) : null}
        {sourceObject.missingEvidence?.length ? (
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            {sourceObject.missingEvidence.join(" ")}
          </p>
        ) : null}
      </section>

      <SourceObjectSections
        object={sourceObject}
        hideSummary
        deferredCorrectionCopy={MODEL_GOAL_CORRECTION_DEFERRED_COPY}
      />

      <SectionBlock label="Capture correction">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          User correction is first-class evidence. Capture the correction in Capture Life Data.
        </p>
        <button
          type="button"
          onClick={() => {
            const handoffText = buildModelGoalCapturePrompt(selection, sourceObject);
            try {
              window.sessionStorage.setItem(TODAY_HANDOFF_KEY, handoffText);
            } catch {
              // Ignore storage failures.
            }
            router.push("/journal-chat");
          }}
          className="o-calm mt-3 inline-flex items-center gap-1.5 rounded-md bg-evidence-muted px-3 py-1.5 text-[13px] font-medium text-primary hover:brightness-[0.98]"
        >
          Capture correction
        </button>
      </SectionBlock>
    </>
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
      try {
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
      } catch (error) {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setEvidence([]);
        setNotFound(true);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
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
    <div data-testid="inspector-map-conclusion-panel" data-object-id={detail.id}>
      <ObjectHeader
        typeLabel="Map conclusion"
        title={selection.selectedTitle ?? detail.title}
        meta={`${formatUserMapArea(detail.area)} · ${formatUserMapStatus(detail.status)} · ${formatUserMapConfidenceLevel(detail.confidenceLevel)}`}
      />
      <section className="px-5 pt-4">
        <div className="text-[13px] leading-relaxed">
          <ReadoutText value={detail.summary} muted />
        </div>
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
        hideReceipts
      />
      <section className="px-5 pt-4">
        <SectionLabel>Supporting evidence</SectionLabel>
        <EvidenceLinksSection items={evidence} />
      </section>
    </div>
  );
}

function DecisionEvidencePanel({
  selection,
  sourceObject,
}: {
  selection: InspectorSelection;
  sourceObject: OrvekObject | undefined;
}) {
  if (!sourceObject) {
    return <UnavailableState objectTypeLabel="Decision" />;
  }

  return (
    <div data-testid="inspector-decision-panel" data-object-id={sourceObject.id}>
      <ObjectHeader
        typeLabel="Decision"
        title={selection.selectedTitle ?? sourceObject.title}
        meta={sourceObject.tags?.join(" · ") ?? "Live decision"}
      />
      <SourceObjectSections object={sourceObject} />
    </div>
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
      <section className="px-5 pt-4">
        <div className="text-[13px] leading-relaxed">
          <ReadoutText value={claim.summary} muted />
        </div>
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
        hideReceipts
        deferredCorrectionCopy={
          sourceObject?.type === "context" || sourceObject?.type === "map-object"
            ? YOUR_MAP_CORRECTION_DEFERRED_COPY
            : null
        }
      />

      <SectionBlock label="Next step">
        {claim.action ? (
          <div className="rounded-[9px] bg-secondary/50 p-2.5">
            <div className="text-[13px] font-medium leading-relaxed text-foreground">
              <ReadoutText value={claim.action.prompt} />
            </div>
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
              <div className="mt-2 text-[12px] leading-relaxed">
                <ReadoutText value={claim.action.reflectionNote} muted />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {actionGateReason ?? "No active next step is recorded for this pattern."}
          </p>
        )}
      </SectionBlock>

      <section className="px-5 pt-4">
        <SectionLabel>Supporting evidence</SectionLabel>
        {claim.receipts.length === 0 ? (
          <p className="mt-2 text-[12px] text-muted-foreground">{PUBLIC_EVIDENCE_FALLBACK_COPY}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {claim.receipts.slice(0, 6).map((receipt) => (
              <li
                key={receipt.id}
                className="rounded-[9px] rounded-l-sm border-l-2 border-primary/50 bg-secondary/50 px-2.5 py-1.5 text-[12px]"
              >
                <div className="font-medium text-foreground">{receipt.source}</div>
                {receipt.quote ? (
                  <div className="mt-1 leading-relaxed line-clamp-3">
                    <ReadoutText value={receipt.quote} muted />
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground">Receipt recorded without stored quote.</p>
                )}
                <div className="label-meta mt-1">{formatDateTime(receipt.createdAt)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
      <section className="space-y-3 px-5 pt-4">
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
          <div className="mt-1 text-[13px] leading-relaxed">
            <ReadoutText value={item.sideA} muted />
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Side B</div>
          <div className="mt-1 text-[13px] leading-relaxed">
            <ReadoutText value={item.sideB} muted />
          </div>
        </div>
      </section>
      <SourceObjectSections object={sourceObject} />
      <p className="px-5 pt-4 text-[12px] text-muted-foreground">
        Raw message evidence stays on the signal detail surface. Use the full page for deeper review.
      </p>
    </>
  );
}

function ModelUpdateEvidencePanel({
  selection,
  resolveOrvekObject,
}: {
  selection: InspectorSelection;
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
  const contextObject = item.affectedObjectId
    ? resolveOrvekObject(item.affectedObjectId)
    : undefined;
  const affectedTitle =
    sanitizeInspectorDisplayText(contextObject?.title) ??
    sanitizeInspectorDisplayText(affectedContext.userMap?.title) ??
    sanitizeInspectorDisplayText(affectedContext.pattern?.summary) ??
    sanitizeInspectorDisplayText(affectedContext.contradiction?.title) ??
    item.affectedObjectTypeLabel;
  const targetLabel =
    sanitizeInspectorDisplayText(report.evidencePacketSummary.targetLabel) ??
    item.affectedObjectTypeLabel;
  const showSupportingEvidenceSection = supportingEvidence.length > 0 || reportReceiptRefs.length > 0;

  return (
    <>
      <ObjectHeader
        typeLabel="Affected object"
        title={affectedTitle}
        meta={`${item.affectedObjectTypeLabel} · Recorded ${formatDateTime(item.createdAt)}`}
      />

      <section className="px-5 pt-4">
        <FactGrid
          items={[
            { label: "Recorded", value: formatDateTime(item.createdAt) },
            {
              label: "Receipts",
              value: String(report.evidencePacketSummary.receiptCount),
            },
            {
              label: "Selected object",
              value: targetLabel,
            },
          ]}
        />
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Receipt counts show packet size, not certainty.
        </p>
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
        hideReceipts
        deferredCorrectionCopy={
          item.affectedObjectType === "usermap_conclusion"
            ? YOUR_MAP_CORRECTION_DEFERRED_COPY
            : null
        }
      />

      <section className="px-5 pt-4">
        <SectionLabel>Supporting evidence</SectionLabel>
        {supportingEvidence.length > 0 ? (
          <EvidenceLinksSection items={supportingEvidence} />
        ) : reportReceiptRefs.length > 0 ? (
          <ReportReceiptLinksSection refs={reportReceiptRefs} />
        ) : (
          <ModelUpdateEvidenceEmptyState hasResolvableAffectedObject={hasResolvableAffectedObject} />
        )}
      </section>

      {showSupportingEvidenceSection ? (
        <p className="px-5 pt-2 text-[11px] text-muted-foreground">
          Open the {ORVEK_COPY.mindModelMovementTab} tab for the full movement read, guardrails,
          and evidence used.
        </p>
      ) : null}
    </>
  );
}

function SelectionAvailabilityPanel({
  selection,
}: {
  selection: InspectorSelection;
}) {
  const kind =
    selection.selectedObjectType === "reference_decision"
      ? "Decision"
      : selection.selectedObjectType === "reference_report"
        ? "Report"
        : "Object";
  const isMissing = selection.availability === "missing";
  const isFallback = selection.availability === "reference_fallback";

  return (
    <>
      <ObjectHeader
        typeLabel={isFallback ? `${kind} · reference fallback` : `${kind} · unsupported`}
        title={selection.selectedTitle ?? selection.selectedObjectId}
        meta={
          isMissing
            ? "No object resolved from the active production graph"
            : isFallback
              ? "Reference-only object; authenticated production detail is unavailable"
              : "The active production Inspector does not support this object family"
        }
      />
      <section className="px-5 pt-4">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {isMissing
            ? "Nothing has been substituted for this missing selection."
            : isFallback
              ? "This selection is identified as fallback and is not being presented as live data."
              : "No fixture content or unrelated live object has been substituted."}
        </p>
        {selection.selectedObjectType === "reference_report" ? (
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            Opening or generating this report is deferred. The reference report route remains
            isolated.
          </p>
        ) : null}
        {selection.selectedObjectType === "reference_decision" ? (
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            Decision outcome and correction controls are deferred until a complete write path is
            mounted here.
          </p>
        ) : null}
      </section>
      <DeferredActionsSection />
    </>
  );
}

function LiveProvenanceNotice() {
  return (
    <div className="mx-4 mt-4 rounded-[10px] bg-evidence-muted/55 px-3 py-2 text-[11px] text-primary">
      Authenticated live object · no reference fixture substitution
    </div>
  );
}

function ReceiptEvidencePanel({
  selection,
  sourceObject,
}: {
  selection: InspectorSelection;
  sourceObject: OrvekObject | undefined;
}) {
  if (!sourceObject) {
    return <UnavailableState objectTypeLabel="Evidence pointer" />;
  }

  return (
    <>
      <ObjectHeader
        typeLabel="Evidence pointer"
        title={selection.selectedTitle ?? sourceObject.title}
        meta={[
          sourceObject.sourceOrigin ?? "Source recorded",
          sourceObject.date,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <SourceObjectSections object={sourceObject} />
    </>
  );
}

function QuestionEvidencePanel({
  selection,
}: {
  selection: InspectorSelection;
  sourceObject: OrvekObject | undefined;
}) {
  const { revision } = useDurableActionsRefresh();
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchInspectorInvestigationDetail>>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);

    void fetchInspectorInvestigationDetail(selection.selectedObjectId).then((next) => {
      if (cancelled) {
        return;
      }

      setDetail(next);
      setNotFound(!next);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [revision, selection.selectedObjectId]);

  if (isLoading) {
    return <PanelSkeleton />;
  }

  if (notFound || !detail) {
    return (
      <UnavailableState
        objectTypeLabel={
          selection.selectedObjectType === "investigation" ? "Investigation" : "Active question"
        }
      />
    );
  }

  return (
    <div data-testid="inspector-investigation-panel">
      <ObjectHeader
        typeLabel={
          selection.selectedObjectType === "investigation"
            ? "Investigation"
            : "Active question"
        }
        title={selection.selectedTitle ?? detail.title}
        meta={[
          detail.statusLabel,
          detail.closureStateLabel,
          `Updated ${formatDateTime(detail.updatedAt)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <SectionBlock label="Identity">
        <p className="mb-2 text-[11px] text-cyan/70" data-testid="inspector-investigation-id">
          Investigation ID {detail.id}
        </p>
        <p className="mb-2 text-[11px] text-muted-foreground" data-testid="inspector-investigation-status">
          {detail.statusLabel} · {detail.closureStateLabel}
        </p>
        <FactGrid
          items={[
            { label: "ID", value: detail.id },
            { label: "Seed", value: detail.seedTypeLabel },
            { label: "State", value: detail.statusLabel },
            { label: "Created", value: formatDateTime(detail.createdAt) },
            { label: "Updated", value: formatDateTime(detail.updatedAt) },
            ...(typeof detail.priority === "number"
              ? [{ label: "Priority", value: String(detail.priority) }]
              : []),
          ]}
        />
        {detail.detailHref ? (
          <div className="mt-3">
            <Link href={detail.detailHref} className="text-[13px] font-medium text-primary hover:underline">
              Open related surface
            </Link>
          </div>
        ) : null}
      </SectionBlock>

      <SectionBlock label="Organizing question">
        <ReadoutText value={detail.organizingQuestion} />
      </SectionBlock>

      {detail.competingTheories.length > 0 ? (
        <SectionBlock label="Competing theories">
          <RenderList
            items={detail.competingTheories}
            emptyCopy="No competing theories recorded."
          />
        </SectionBlock>
      ) : null}

      <SectionBlock label="Missing or pending evidence">
        <RenderList
          items={detail.evidenceNeeded}
          emptyCopy="No pending evidence requests are recorded."
        />
      </SectionBlock>

      <SectionBlock label="Outcome and closure">
        <div className="space-y-2">
          <div className="rounded-[9px] bg-secondary/50 p-2.5 text-[13px] leading-relaxed">
            <ReadoutText
              value={
                detail.resolutionSummary ??
                "No durable outcome has been recorded for this investigation yet."
              }
              muted={!detail.resolutionSummary}
            />
          </div>
          <FactGrid
            items={[
              { label: "Closure", value: detail.closureStateLabel },
              {
                label: "Resolved at",
                value: detail.resolvedAt ? formatDateTime(detail.resolvedAt) : "Not closed",
              },
            ]}
          />
          {detail.reopenReason ? (
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Reopen reason: {detail.reopenReason}
            </p>
          ) : null}
        </div>
      </SectionBlock>

      <SectionBlock label="Linked evidence">
        {detail.linkedEvidence.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            No evidence spans are linked to this investigation yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {detail.linkedEvidence.map((evidence) => (
              <li
                key={evidence.linkId}
                className="rounded-[10px] bg-card p-2.5 text-[12px] shadow-[0_1px_3px_-1px_rgba(30,41,59,0.1)]"
              >
                <div className="font-medium text-foreground">Evidence ID {evidence.evidenceId}</div>
                <div className="mt-1 leading-relaxed text-muted-foreground">
                  <ReadoutText value={evidence.excerpt} muted />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <span className="font-medium text-cyan/80">
                    {evidence.sessionLabel ?? "Unnamed session"}
                  </span>
                  <span className="text-muted-foreground">
                    Role {evidence.role.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="label-meta mt-1">Linked {formatDateTime(evidence.createdAt)}</div>
                <div className="mt-1">
                  <Link href={evidence.evidenceHref} className="text-[11px] text-primary hover:underline">
                    Open evidence span
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionBlock>

      <SectionBlock label="Linked fieldwork and check-ins">
        {detail.linkedFieldwork.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            No fieldwork prompts are linked to this investigation yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {detail.linkedFieldwork.map((fieldwork) => (
              <li
                key={fieldwork.id}
                className="rounded-[10px] bg-card p-2.5 text-[12px] shadow-[0_1px_3px_-1px_rgba(30,41,59,0.1)]"
              >
                <div className="font-medium text-foreground">
                  {fieldwork.prompt}
                </div>
                <div className="label-meta mt-1 text-cyan/70">Fieldwork ID {fieldwork.id}</div>
                <div className="mt-1 leading-relaxed text-muted-foreground">
                  <ReadoutText value={fieldwork.reason} muted />
                </div>
                <FactGrid
                  items={[
                    { label: "Status", value: fieldwork.statusLabel },
                    { label: "Updated", value: formatDateTime(fieldwork.updatedAt) },
                  ]}
                />
                <div className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  Observation note: {fieldwork.observationNote ?? "Not recorded yet."}
                </div>
                <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  Observation outcome: {fieldwork.observationOutcome ?? "Not recorded yet."}
                </div>
                {fieldwork.detailHref ? (
                  <div className="mt-2">
                    <Link href={fieldwork.detailHref} className="text-[11px] text-primary hover:underline">
                      Open fieldwork detail
                    </Link>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionBlock>

      <SectionBlock label="Connected map item">
        {detail.resolvedConclusionHref && detail.resolvedConclusionId ? (
          <Link href={detail.resolvedConclusionHref} className="text-[13px] font-medium text-primary hover:underline">
            Related map item
          </Link>
        ) : (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            No verified map conclusion link is available for this investigation.
          </p>
        )}
      </SectionBlock>
    </div>
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

  if (selection.availability && selection.availability !== "live") {
    if (selection.selectedObjectType === "usermap_conclusion") {
    }
    return <SelectionAvailabilityPanel selection={selection} />;
  }

  let panel: ReactNode;
  switch (selection.selectedObjectType) {
    case "usermap_conclusion":
      panel = <UserMapEvidencePanel selection={selection} sourceObject={sourceObject} />;
      break;
    case "pattern_claim":
      panel = <PatternEvidencePanel selection={selection} sourceObject={sourceObject} />;
      break;
    case "context_profile":
      panel = <ContextEvidencePanel selection={selection} sourceObject={sourceObject} />;
      break;
    case "model_goal":
      panel = <ModelGoalEvidencePanel selection={selection} sourceObject={sourceObject} />;
      break;
    case "contradiction_node":
      panel = <ContradictionEvidencePanel selection={selection} sourceObject={sourceObject} />;
      break;
    case "model_update":
      panel = (
        <ModelUpdateEvidencePanel
          selection={selection}
          resolveOrvekObject={(id) => orvekData?.getObject(id)}
        />
      );
      break;
    case "reference_decision":
      panel = <DecisionEvidencePanel selection={selection} sourceObject={sourceObject} />;
      break;
    case "receipt":
      panel = <ReceiptEvidencePanel selection={selection} sourceObject={sourceObject} />;
      break;
    case "active_question":
    case "investigation":
      panel = <QuestionEvidencePanel selection={selection} sourceObject={sourceObject} />;
      break;
    default:
      return <SelectionAvailabilityPanel selection={{ ...selection, availability: "unsupported" }} />;
  }

  return (
    <>
      <LiveProvenanceNotice />
      {panel}
    </>
  );
}
