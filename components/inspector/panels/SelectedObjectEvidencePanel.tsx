"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import { PUBLIC_EVIDENCE_FALLBACK_COPY } from "@/lib/public-continuity-registry";
import {
  fetchInspectorContradiction,
  fetchInspectorEvidenceLinks,
  fetchInspectorModelUpdateDetail,
  fetchInspectorPatternClaim,
  fetchInspectorUserMapDetail,
  INSPECTOR_USER_MAP_EVIDENCE_ENDPOINT,
  type InspectorEvidenceLinkItem,
} from "@/lib/inspector-object-api";
import type { InspectorSelection } from "@/lib/inspector-selection";
import { ORVEK_COPY } from "@/lib/trust-language";
import { STRENGTH_LABELS } from "@/lib/patterns-api";
import type { PatternClaimView } from "@/lib/patterns-api";
import type { UserMapConclusionPublicApiDetailItem } from "@/lib/public-intelligence-safe-slice";
import { formatUserMapArea, formatUserMapConfidenceLevel, formatUserMapStatus } from "@/lib/public-intelligence-safe-slice";

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

function EvidenceLinksSection({ items }: { items: InspectorEvidenceLinkItem[] }) {
  if (items.length === 0) {
    return (
      <p className="px-4 pb-4 text-[12px] leading-relaxed text-muted-foreground">
        {PUBLIC_EVIDENCE_FALLBACK_COPY}
      </p>
    );
  }

  return (
    <ul className="space-y-2 px-4 pb-4">
      {items.map((item) => (
        <li key={`${item.sourceObjectHref}-${item.createdAt}`}>
          <Link
            href={item.sourceObjectHref}
            className="ml-material block rounded-xl px-3 py-2.5 text-[12px] hover:bg-white/[0.02]"
          >
            <div className="font-medium text-cyan/80">{item.sourceTypeLabel}</div>
            <div className="mt-0.5 text-muted-foreground">{item.evidenceSummaryLabel}</div>
            <div className="label-meta mt-1">Linked {formatDateTime(item.createdAt)}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function UserMapEvidencePanel({ selection }: { selection: InspectorSelection }) {
  const [detail, setDetail] = useState<UserMapConclusionPublicApiDetailItem | null>(null);
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
        <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
          <div>
            <dt className="uppercase tracking-wide text-[10px]">Evidence sources</dt>
            <dd className="mt-0.5 font-medium text-foreground">{detail.evidenceCount}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide text-[10px]">Updated</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {formatDateTime(detail.updatedAt)}
            </dd>
          </div>
        </dl>
      </section>
      <SectionLabel>Supporting evidence</SectionLabel>
      <EvidenceLinksSection items={evidence} />
    </>
  );
}

function PatternEvidencePanel({ selection }: { selection: InspectorSelection }) {
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

  return (
    <>
      <ObjectHeader
        typeLabel="Pattern"
        title={selection.selectedTitle ?? claim.summary}
        meta={`${STRENGTH_LABELS[claim.strengthLevel]} · ${claim.evidenceCount} receipts`}
      />
      <section className="px-4 pb-3">
        <p className="text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">{claim.summary}</p>
        <div className="label-meta mt-2">
          Updated {formatDateTime(claim.updatedAt)}
        </div>
      </section>
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

function ContradictionEvidencePanel({ selection }: { selection: InspectorSelection }) {
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
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Side A</div>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">{item.sideA}</p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Side B</div>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">{item.sideB}</p>
        </div>
        <div className="label-meta">
          Last evidence {item.lastEvidenceAt ? formatDateTime(item.lastEvidenceAt) : "—"}
        </div>
      </section>
      <p className="px-4 pb-4 text-[12px] text-muted-foreground">
        Raw message evidence stays on the signal detail surface. Use the full page for deeper review.
      </p>
    </>
  );
}

function ModelUpdateEvidencePanel({ selection }: { selection: InspectorSelection }) {
  const modelUpdateId = selection.selectedModelUpdateId ?? selection.selectedObjectId;
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchInspectorModelUpdateDetail>>>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void fetchInspectorModelUpdateDetail(modelUpdateId).then((next) => {
      if (!cancelled) {
        setDetail(next);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [modelUpdateId]);

  if (isLoading) {
    return <PanelSkeleton />;
  }

  if (!detail) {
    return <UnavailableState objectTypeLabel={ORVEK_COPY.mindModelMovement} />;
  }

  return (
    <>
      <ObjectHeader
        typeLabel={ORVEK_COPY.mindModelMovement}
        title={selection.selectedTitle ?? detail.updateTypeLabel}
        meta={detail.affectedObjectTypeLabel}
      />
      <section className="px-4 pb-4">
        <p className="text-[13px] leading-relaxed text-[hsl(216_11%_75%)]">
          {detail.userFacingSummary}
        </p>
        <div className="mt-3">
          <PublicLinkedObjectContinuity
            objectType={detail.affectedObjectType}
            objectId={detail.affectedObjectId}
            href={detail.affectedObjectHref}
            context="model_update"
          />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Open the {ORVEK_COPY.mindModelMovementTab} tab for linked evidence on this update.
        </p>
      </section>
    </>
  );
}

export function SelectedObjectEvidencePanel({
  selection,
}: {
  selection: InspectorSelection;
}) {
  switch (selection.selectedObjectType) {
    case "usermap_conclusion":
      return <UserMapEvidencePanel selection={selection} />;
    case "pattern_claim":
      return <PatternEvidencePanel selection={selection} />;
    case "contradiction_node":
      return <ContradictionEvidencePanel selection={selection} />;
    case "model_update":
      return <ModelUpdateEvidencePanel selection={selection} />;
    default:
      return <UnavailableState objectTypeLabel="Object" />;
  }
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

function SectionLabel({ children }: { children: React.ReactNode }) {
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
