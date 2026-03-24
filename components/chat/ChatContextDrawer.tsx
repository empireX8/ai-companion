"use client";

/**
 * ChatContextDrawer — quick-glance context tuck-down (P1-05)
 *
 * Subsumed under the canonical /context page. This drawer shows a
 * lightweight summary only: active memory count, active pattern count.
 * No forecast fetch. No tension links. No audit snapshot.
 * "View full context →" links to /context for the authoritative view.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type ReferenceSummary = {
  active: number;
};

type PatternsResponse = {
  sections: Array<{
    claims: Array<{ status: string }>;
  }>;
};

// ── Body (lazy-mounted, GET-only) ─────────────────────────────────────────────

function DrawerBody() {
  const [activeMemories, setActiveMemories] = useState<number | null>(null);
  const [activePatterns, setActivePatterns] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [rRes, pRes] = await Promise.all([
          fetch("/api/reference/summary", { cache: "no-store" }),
          fetch("/api/patterns", { cache: "no-store" }),
        ]);
        if (cancelled) return;

        if (rRes.ok) {
          const data = (await rRes.json()) as ReferenceSummary;
          if (!cancelled) setActiveMemories(data.active ?? 0);
        }
        if (pRes.ok) {
          const data = (await pRes.json()) as PatternsResponse;
          const count =
            data.sections?.reduce(
              (acc, s) => acc + s.claims.filter((c) => c.status === "active").length,
              0
            ) ?? 0;
          if (!cancelled) setActivePatterns(count);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-1.5 p-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-5 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  const memCount = activeMemories ?? 0;
  const patCount = activePatterns ?? 0;

  return (
    <div className="p-3 text-xs space-y-2">
      <ul className="space-y-1.5">
        <li className="text-muted-foreground">
          {memCount > 0 ? (
            <span>
              Using{" "}
              <span className="font-medium text-foreground">{memCount}</span>{" "}
              confirmed {memCount === 1 ? "memory" : "memories"}
            </span>
          ) : (
            "No confirmed memories yet"
          )}
        </li>
        <li className="text-muted-foreground">
          {patCount > 0 ? (
            <span>
              <span className="font-medium text-foreground">{patCount}</span>{" "}
              active {patCount === 1 ? "pattern" : "patterns"}
            </span>
          ) : (
            "No active patterns yet"
          )}
        </li>
      </ul>

      <Link
        href="/context"
        className="block text-primary underline-offset-2 hover:underline"
      >
        View full context →
      </Link>
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
        "overflow-hidden bg-background",
        "transition-[max-height] duration-200 ease-in-out",
        isOpen
          ? "max-h-96 pointer-events-auto border-b border-border"
          : "max-h-0 pointer-events-none"
      )}
    >
      {/* Header */}
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
