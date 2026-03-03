"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type TopContradiction = {
  id: string;
  title: string;
  status: string;
  escalationRung: number;
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

// ── Body (lazy-mounted, GET-only) ─────────────────────────────────────────────

function DrawerBody() {
  const [contradictions, setContradictions] = useState<TopContradiction[]>([]);
  const [refSummary, setRefSummary] = useState<ReferenceSummary | null>(null);
  const [audit, setAudit] = useState<AuditSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [cRes, rRes, aRes] = await Promise.all([
          fetch("/api/contradiction?top=3&mode=read_only", { cache: "no-store" }),
          fetch("/api/reference/summary", { cache: "no-store" }),
          fetch("/api/audit/weekly", { cache: "no-store" }),
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Skeleton />;

  return (
    <div className="divide-y divide-border/60 text-xs">
      <div className="p-3">
        <SectionHeader>Surfaced contradictions</SectionHeader>
        {contradictions.length === 0 ? (
          <p className="text-muted-foreground">None surfaced.</p>
        ) : (
          <ul className="space-y-1.5">
            {contradictions.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-foreground">{c.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  rung {c.escalationRung}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {refSummary && (
        <div className="p-3">
          <SectionHeader>References</SectionHeader>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active</span>
              <span className="font-medium text-emerald-600">{refSummary.active}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Candidate</span>
              <span className="font-medium">{refSummary.candidate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">{refSummary.total}</span>
            </div>
          </div>
        </div>
      )}

      {audit && (
        <div className="p-3">
          <SectionHeader>
            {audit.preview ? "This week (preview)" : "This week"}
          </SectionHeader>
          <div className="grid grid-cols-2 gap-1">
            {[
              { label: "Stability", value: audit.stabilityProxy.toFixed(3) },
              { label: "Density", value: audit.contradictionDensity.toFixed(3) },
              { label: "Open", value: String(audit.openContradictionCount) },
              { label: "Active refs", value: String(audit.activeReferenceCount) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded border border-border px-2 py-1">
                <div className="text-[10px] text-muted-foreground">{label}</div>
                <div className="font-medium">{value}</div>
              </div>
            ))}
          </div>
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
        "overflow-hidden border-b border-border bg-background",
        "transition-[max-height] duration-200 ease-in-out",
        isOpen ? "max-h-96 pointer-events-auto" : "max-h-0 pointer-events-none"
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
