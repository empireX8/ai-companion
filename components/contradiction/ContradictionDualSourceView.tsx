"use client";

import type {
  ContradictionDualSourcePresentation,
  ContradictionSourceSidePresentation,
  DualSourceCopySurface,
} from "@/lib/contradiction-dual-source-presentation-contract";
import {
  dualSourceLineageNoticeCopy,
  dualSourceSessionOriginCopy,
  dualSourceSideUnavailableCopy,
} from "@/lib/contradiction-dual-source-presentation-contract";

function formatRecordedDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SideSourceBlock({
  interpretation,
  sideLabel,
  side,
  compact,
  copySurface,
}: {
  interpretation: string;
  sideLabel: string;
  side: ContradictionSourceSidePresentation;
  compact?: boolean;
  copySurface: DualSourceCopySurface;
}) {
  const textClass = compact
    ? "text-[10px] text-muted-foreground"
    : "text-xs text-muted-foreground";
  const bodyClass = compact
    ? "mt-0.5 text-[10px] text-foreground"
    : "mt-0.5 text-xs text-foreground";

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <div>
        <p className={`uppercase tracking-wider ${textClass}`}>
          {sideLabel} interpretation
        </p>
        <p className={bodyClass}>{interpretation}</p>
      </div>
      <div>
        <p className={`uppercase tracking-wider ${textClass}`}>
          {sideLabel} source
        </p>
        {side.availability === "available" ? (
          <>
            <p className={`mt-0.5 font-medium ${compact ? "text-[10px]" : "text-[11px]"} text-muted-foreground`}>
              Exact source excerpt
            </p>
            <p className={`${bodyClass} whitespace-pre-wrap`}>{side.exactQuote}</p>
            <p className={`mt-0.5 ${textClass}`}>
              {[
                dualSourceSessionOriginCopy(side.sessionOrigin),
                side.sessionLabel,
                formatRecordedDate(side.recordedAt),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </>
        ) : (
          <p className={bodyClass}>
            {dualSourceSideUnavailableCopy(side.reason, copySurface)}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Shared dual-source presentation block for candidate cards and Inspector panels.
 * Never labels the interpreted proposition as a quote.
 * Never prints IDs, hashes, or internal reason enums.
 */
export function ContradictionDualSourceView({
  interpretationA,
  interpretationB,
  dualSource,
  compact = false,
  showLegacyAsSingleNotice = true,
  copySurface = "generic",
}: {
  interpretationA: string;
  interpretationB: string;
  dualSource: ContradictionDualSourcePresentation;
  compact?: boolean;
  /** When true, legacy both-null shows one calm notice instead of two side errors. */
  showLegacyAsSingleNotice?: boolean;
  /** Candidate page may pass "candidate" for candidate-specific legacy copy. */
  copySurface?: DualSourceCopySurface;
}) {
  const notice = dualSourceLineageNoticeCopy(dualSource, copySurface);

  if (
    showLegacyAsSingleNotice &&
    dualSource.lineageState === "legacy_unavailable"
  ) {
    return (
      <div className="space-y-2">
        <div className={compact ? "grid gap-2" : "grid grid-cols-2 gap-2"}>
          <div className="rounded bg-muted/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Side A interpretation
            </p>
            <p className="mt-0.5 text-xs text-foreground">{interpretationA}</p>
          </div>
          <div className="rounded bg-muted/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Side B interpretation
            </p>
            <p className="mt-0.5 text-xs text-foreground">{interpretationB}</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">{notice}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notice && dualSource.lineageState !== "complete_verified" ? (
        <p className="text-[11px] text-muted-foreground">{notice}</p>
      ) : null}
      <div className={compact ? "space-y-3" : "grid grid-cols-2 gap-2"}>
        <div className="rounded bg-muted/50 px-3 py-2">
          <SideSourceBlock
            interpretation={interpretationA}
            sideLabel="Side A"
            side={dualSource.sideA}
            compact={compact}
            copySurface={copySurface}
          />
        </div>
        <div className="rounded bg-muted/50 px-3 py-2">
          <SideSourceBlock
            interpretation={interpretationB}
            sideLabel="Side B"
            side={dualSource.sideB}
            compact={compact}
            copySurface={copySurface}
          />
        </div>
      </div>
    </div>
  );
}
