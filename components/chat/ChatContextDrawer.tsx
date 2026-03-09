"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type TopContradiction = {
  id: string;
  title: string;
  status: string;
  escalationLevel: number;
};

type ReferenceSummary = {
  active: number;
  candidate: number;
  inactive: number;
  superseded: number;
  total: number;
};

type AuditSnapshot = {
  weekStart: string;
  status: string;
  stabilityProxy: number;
  contradictionDensity: number;
  openContradictionCount: number;
  activeReferenceCount: number;
  preview?: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Skeleton() {
  return (
    <div className="space-y-1.5 p-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-5 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

/** Maps a numeric escalation level to a human-readable phrase. */
function escalationPhrase(level: number): string {
  if (level <= 1) return "Gentle";
  if (level <= 3) return "Exploring";
  return "Direct";
}

/** Maps a stability proxy float to a human-readable label. */
function stabilityLabel(s: number): string {
  if (s >= 0.75) return "Stable";
  if (s >= 0.5) return "Stressed";
  return "Critical";
}

/** Color class for the stability label. */
function stabilityColor(s: number): string {
  if (s >= 0.75) return "text-emerald-500";
  if (s >= 0.5) return "text-amber-500";
  return "text-destructive";
}

// ── Body (lazy-mounted, GET-only) ─────────────────────────────────────────────

function DrawerBody() {
  const [contradictions, setContradictions] = useState<TopContradiction[]>([]);
  const [refSummary, setRefSummary] = useState<ReferenceSummary | null>(null);
  const [audit, setAudit] = useState<AuditSnapshot | null>(null);
  const [hasCandidateTensions, setHasCandidateTensions] = useState(false);
  const [forecastCount, setForecastCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [cRes, rRes, aRes, ctRes, fRes] = await Promise.all([
          fetch("/api/contradiction?top=3&mode=read_only", { cache: "no-store" }),
          fetch("/api/reference/summary", { cache: "no-store" }),
          fetch("/api/audit/weekly", { cache: "no-store" }),
          fetch("/api/contradiction?status=candidate&page=1&limit=1", { cache: "no-store" }),
          fetch("/api/projection/list", { cache: "no-store" }),
        ]);
        if (cancelled) return;

        if (cRes.ok) {
          const data = (await cRes.json()) as TopContradiction[];
          if (!cancelled) setContradictions(data);
        }
        if (rRes.ok) {
          const data = (await rRes.json()) as ReferenceSummary;
          if (!cancelled) setRefSummary(data);
        }
        if (aRes.ok && aRes.status !== 401 && aRes.status !== 404) {
          const data = (await aRes.json()) as AuditSnapshot;
          if (!cancelled) setAudit(data);
        }
        if (ctRes.ok) {
          const data = (await ctRes.json()) as { items: unknown[] };
          if (!cancelled) setHasCandidateTensions(data.items.length > 0);
        }
        if (fRes.ok) {
          const data = (await fRes.json()) as unknown[];
          if (!cancelled) setForecastCount(data.length);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Skeleton />;

  const hasCandidateMemories = (refSummary?.candidate ?? 0) > 0;
  const hasPendingCandidates = hasCandidateTensions || hasCandidateMemories;

  return (
    <div className="divide-y divide-border/60 text-xs">
      {/* Surfaced tensions */}
      <div className="p-3">
        <SectionHeader>Surfaced tensions</SectionHeader>
        <p className="mb-1.5 text-[11px] text-muted-foreground/70">
          Unresolved conflicts currently shaping this conversation.
        </p>
        {contradictions.length === 0 ? (
          <p className="text-muted-foreground">No tensions are surfaced right now.</p>
        ) : (
          <ul className="space-y-1.5">
            {contradictions.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <Link
                  href={`/contradictions/${c.id}`}
                  className="truncate text-foreground underline-offset-2 hover:text-primary hover:underline"
                >
                  {c.title}
                </Link>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {escalationPhrase(c.escalationLevel)}
                </span>
              </li>
            ))}
          </ul>
      )}
      </div>

      {/* Context */}
      <div className="p-3">
        <SectionHeader>Context</SectionHeader>
        <p className="mb-1.5 text-[11px] text-muted-foreground/70">
          Confirmed context available to the assistant.
        </p>
        <ul className="space-y-1">
          <li className="text-muted-foreground">
            {(refSummary?.active ?? 0) > 0 ? (
              <span>
                Using{" "}
                <span className="font-medium text-foreground">{refSummary!.active}</span>{" "}
                confirmed{" "}
                {refSummary!.active === 1 ? "memory" : "memories"}
              </span>
            ) : (
              "No confirmed memories yet"
            )}
          </li>
          <li className="text-muted-foreground">
            {forecastCount > 0 ? (
              <span>
                <span className="font-medium text-foreground">{forecastCount}</span>{" "}
                active{" "}
                {forecastCount === 1 ? "forecast" : "forecasts"}
              </span>
            ) : (
              "No active forecasts"
            )}
          </li>
        </ul>
        <div className="mt-2 space-y-1">
          {(refSummary?.active ?? 0) > 0 && (
            <Link
              href="/references"
              className="block text-primary underline-offset-2 hover:underline"
            >
              View memories →
            </Link>
          )}
          {forecastCount > 0 && (
            <Link
              href="/projections"
              className="block text-primary underline-offset-2 hover:underline"
            >
              View forecasts →
            </Link>
          )}
        </div>
      </div>

      {/* Pending candidate review — only shown when candidates exist */}
      {hasPendingCandidates && (
        <div className="p-3">
          <SectionHeader>Pending review</SectionHeader>
          <div className="space-y-1">
            {hasCandidateTensions && (
              <Link
                href="/contradictions/candidates"
                className="block text-primary underline-offset-2 hover:underline"
              >
                Review candidate tensions →
              </Link>
            )}
            {hasCandidateMemories && (
              <Link
                href="/references/candidates"
                className="block text-primary underline-offset-2 hover:underline"
              >
                Review candidate memories →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* This week */}
      {audit && (
        <div className="p-3">
          <SectionHeader>
            {audit.preview ? "This week (preview)" : "This week"}
          </SectionHeader>
          <p className="mb-1.5 text-[11px] text-muted-foreground/70">
            Quick review snapshot for this week.
          </p>
          <div className="grid grid-cols-2 gap-1">
            {/* Stability — human label with color */}
            <div className="rounded border border-border px-2 py-1">
              <div className="text-[10px] text-muted-foreground">Stability</div>
              <div className={cn("font-medium", stabilityColor(audit.stabilityProxy))}>
                {stabilityLabel(audit.stabilityProxy)}
              </div>
            </div>
            {/* Remaining tiles — unchanged */}
            {[
              { label: "Tension density", value: audit.contradictionDensity.toFixed(3) },
              { label: "Open tensions", value: String(audit.openContradictionCount) },
              { label: "Active memories", value: String(audit.activeReferenceCount) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded border border-border px-2 py-1">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="font-medium">{value}</div>
              </div>
            ))}
          </div>
          <Link
            href="/audit"
            className="mt-2 block text-primary underline-offset-2 hover:underline"
          >
            View review →
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Drawer ─────────────────────────────────────────────────────────────────────
//
// Vertical "tuck-down" panel anchored at the top of the chat workspace column.
// Uses max-height transition — never translates horizontally, never affects Memory.

export function ChatContextDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        // Overflow-hidden clips the content; max-h drives the open/close animation.
        "overflow-hidden bg-background",
        "transition-[max-height] duration-200 ease-in-out",
        isOpen ? "max-h-96 pointer-events-auto border-b border-border" : "max-h-0 pointer-events-none"
      )}
    >
      {/* Header — always in DOM so the border-b transition looks clean */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2.5">
        <span className="text-sm font-medium text-foreground">Context</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close context panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body — lazy-mount so no fetches happen while closed */}
      <div className="max-h-72 overflow-y-auto">
        {isOpen && <DrawerBody />}
      </div>
    </div>
  );
}
