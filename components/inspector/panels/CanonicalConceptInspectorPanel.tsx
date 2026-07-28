"use client";

import { useEffect, useState } from "react";

import { SectionLabel } from "@/components/orvek-v0/primitives";
import { fetchCanonicalProductConcept } from "@/lib/canonical-model-client";
import {
  resolveCanonicalConceptInspectorLoadState,
  type CanonicalConceptInspectorLoadState,
} from "@/lib/canonical-concept-inspector-load-state";
import type { CanonicalProductConceptV1 } from "@/lib/canonical-model-product-projection";
import { formatPublicEvidenceSourceTypeLabel } from "@/lib/public-continuity-registry";
import { useInspector } from "../InspectorContext";
import Link from "next/link";

export {
  resolveCanonicalConceptInspectorLoadState,
  type CanonicalConceptInspectorLoadState,
} from "@/lib/canonical-concept-inspector-load-state";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}

export function CanonicalConceptInspectorPanel() {
  const { selection } = useInspector();
  const conceptId =
    selection?.selectedObjectType === "canonical_concept"
      ? selection.selectedObjectId
      : null;

  const [concept, setConcept] = useState<CanonicalProductConceptV1 | null>(null);
  const [loadState, setLoadState] =
    useState<CanonicalConceptInspectorLoadState>("loading");

  useEffect(() => {
    let cancelled = false;
    if (!conceptId) {
      const resolved = resolveCanonicalConceptInspectorLoadState({
        conceptId: null,
        fetchResult: null,
      });
      setConcept(resolved.concept);
      setLoadState(resolved.loadState);
      return;
    }
    setLoadState("loading");
    void (async () => {
      let next: CanonicalProductConceptV1 | null | "unavailable" | "rejected";
      try {
        next = await fetchCanonicalProductConcept(conceptId);
      } catch {
        next = "rejected";
      }
      if (cancelled) return;
      const resolved = resolveCanonicalConceptInspectorLoadState({
        conceptId,
        fetchResult: next,
      });
      setConcept(resolved.concept);
      setLoadState(resolved.loadState);
    })();
    return () => {
      cancelled = true;
    };
  }, [conceptId]);

  if (loadState === "loading") {
    return <p className="text-sm text-muted-foreground">Loading canonical concept…</p>;
  }
  if (loadState === "unavailable") {
    return (
      <p className="text-sm text-muted-foreground">
        Canonical model unavailable.
      </p>
    );
  }
  if (loadState === "missing" || !concept) {
    return <p className="text-sm text-muted-foreground">Canonical concept not found.</p>;
  }

  const supports = concept.evidence.filter((row) => row.role === "supports");
  const context = concept.evidence.filter((row) => row.role === "context");

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <SectionLabel>Canonical concept</SectionLabel>
        <h3 className="text-base font-medium leading-snug">{concept.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{concept.summary}</p>
      </div>

      <div className="grid gap-2 text-sm">
        <div>Concept ID: {concept.conceptId}</div>
        <div>Current revision ID: {concept.currentRevisionId}</div>
        <div>Revision: v{concept.version}</div>
        <div>Status: {concept.status.replace(/_/g, " ")}</div>
        <div>
          Confidence: {concept.confidenceLevel} ({concept.confidenceScore.toFixed(2)})
        </div>
        <div>Accepted: {formatDateTime(concept.acceptedAt)}</div>
        <div>Evidence count: {concept.evidenceCount}</div>
      </div>

      {concept.rationale ? (
        <div className="space-y-1">
          <SectionLabel>Rationale</SectionLabel>
          <p className="text-sm leading-relaxed">{concept.rationale}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <SectionLabel>Supporting evidence</SectionLabel>
        {supports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No supporting evidence links.</p>
        ) : (
          supports.map((row) => {
            const sourceLabel = formatPublicEvidenceSourceTypeLabel(row.sourceType);
            return (
              <div key={row.id} className="text-sm">
                <div className="font-medium">{row.summary}</div>
                <div className="text-muted-foreground">
                  {row.disclosure === "redacted" || !row.sourceObjectHref ? (
                    `${sourceLabel} · details unavailable`
                  ) : (
                    <Link href={row.sourceObjectHref} className="hover:underline">
                      {sourceLabel}
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-2">
        <SectionLabel>Context evidence</SectionLabel>
        {context.length === 0 ? (
          <p className="text-sm text-muted-foreground">No context evidence links.</p>
        ) : (
          context.map((row) => {
            const sourceLabel = formatPublicEvidenceSourceTypeLabel(row.sourceType);
            return (
              <div key={row.id} className="text-sm">
                <div className="font-medium">{row.summary}</div>
                <div className="text-muted-foreground">
                  {row.disclosure === "redacted" || !row.sourceObjectHref ? (
                    `${sourceLabel} · details unavailable`
                  ) : (
                    <Link href={row.sourceObjectHref} className="hover:underline">
                      {sourceLabel}
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-2">
        <SectionLabel>Revision history</SectionLabel>
        {concept.revisionHistory.map((revision) => (
          <div key={revision.id} className="text-sm">
            <div className="font-medium">
              v{revision.version} · {revision.title}
            </div>
            <div className="text-muted-foreground">{revision.summary}</div>
            <div className="text-muted-foreground">
              {revision.operation} · {formatDateTime(revision.acceptedAt)}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <SectionLabel>Movement history</SectionLabel>
        {concept.movementHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published movements yet.</p>
        ) : (
          concept.movementHistory.map((movement) => (
            <div key={movement.modelUpdateId} className="text-sm">
              <div className="font-medium">{movement.userFacingSummary}</div>
              <div className="text-muted-foreground">
                ModelUpdate: {movement.modelUpdateId}
              </div>
              <div className="text-muted-foreground">
                {movement.previousRevisionId} → {movement.resultingRevisionId}
              </div>
              <div className="text-muted-foreground">
                {formatDateTime(movement.createdAt)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
