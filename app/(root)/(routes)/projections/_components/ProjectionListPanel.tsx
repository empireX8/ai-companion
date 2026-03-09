"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, TrendingUp } from "lucide-react";

import { ListSkeleton } from "@/components/skeletons/ListSkeleton";

type ResolutionVerdict = "correct" | "incorrect" | "mixed";

type Projection = {
  id: string;
  premise: string;
  drivers: string[];
  outcomes: string[];
  confidence: number;
  status: "active" | "archived" | "resolved";
  resolutionVerdict?: ResolutionVerdict | null;
  resolutionNote?: string | null;
  createdAt: string;
};

const formatDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const confidenceColor = (c: number) => {
  if (c >= 0.7) return "bg-emerald-500/15 text-emerald-400";
  if (c >= 0.4) return "bg-amber-500/15 text-amber-400";
  return "bg-muted text-muted-foreground";
};

const VERDICT_LABELS: Record<ResolutionVerdict, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  mixed: "Mixed",
};

const verdictColor = (v: ResolutionVerdict) => {
  if (v === "correct") return "bg-emerald-500/15 text-emerald-400";
  if (v === "incorrect") return "bg-destructive/15 text-destructive";
  return "bg-amber-500/15 text-amber-400";
};

type Tab = "active" | "resolved";

export function ProjectionListPanel() {
  const pathname = usePathname();
  const activeId = pathname.startsWith("/projections/")
    ? pathname.slice("/projections/".length).split("/")[0]
    : null;

  const [tab, setTab] = useState<Tab>("active");
  const [items, setItems] = useState<Projection[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const load = async (status: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/projection/list?status=${status}`);
      if (!r.ok) throw new Error("Failed to load forecasts");
      setItems((await r.json()) as Projection[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(tab);
    setQuery("");
  }, [tab]);

  const filtered = query.trim()
    ? items.filter((item) =>
        item.premise.toLowerCase().includes(query.trim().toLowerCase())
      )
    : items;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Section header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Forecasts</span>
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
            searchOpen ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Search"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 border-b border-border/40">
        {(["active", "resolved"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-[11px] font-medium transition-colors ${
              tab === t
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "active" ? "Active" : "Resolved"}
          </button>
        ))}
      </div>

      {/* Search */}
      {searchOpen && (
        <div className="shrink-0 border-b border-border/40 px-3 py-2">
          <input
            type="search"
            placeholder="Search forecasts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="flex-1 p-2">
          <ListSkeleton rows={5} />
        </div>
      ) : error ? (
        <p className="flex-1 p-3 text-xs text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <div className="flex-1 p-4 text-center">
          {tab === "active" ? (
            <>
              <p className="text-xs font-medium text-foreground">No active forecasts yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Forecasts are useful when you want to track an expectation that may shape a later plan.
              </p>
              <Link href="/chat" className="mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline">
                Save one from chat →
              </Link>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-foreground">No resolved forecasts yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Resolve a forecast from its detail page when the outcome is known.
              </p>
            </>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <p className="flex-1 p-3 text-center text-xs text-muted-foreground">
          No forecasts match.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <p className="shrink-0 border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            Forecasts help you track expectations over time.
          </p>
          <ul className="flex-1 divide-y divide-border/60 overflow-y-auto">
          {filtered.map((item) => {
            const isActive = activeId === item.id;
            return (
              <li
                key={item.id}
                className={`px-3 py-2.5 transition-colors ${isActive ? "bg-primary/10" : "hover:bg-accent/40"}`}
              >
                <Link
                  href={`/projections/${item.id}`}
                  className="block text-xs font-semibold leading-snug text-foreground hover:text-primary"
                >
                  {item.premise.length > 90
                    ? `${item.premise.slice(0, 87)}…`
                    : item.premise}
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {tab === "resolved" && item.resolutionVerdict ? (
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${verdictColor(item.resolutionVerdict)}`}>
                      {VERDICT_LABELS[item.resolutionVerdict]}
                    </span>
                  ) : (
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${confidenceColor(item.confidence)}`}>
                      {Math.round(item.confidence * 100)}%
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground/60">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                {tab === "resolved" && item.resolutionNote && (
                  <p className="mt-1 text-[11px] text-muted-foreground/70 line-clamp-1">
                    {item.resolutionNote}
                  </p>
                )}
              </li>
            );
          })}
          </ul>
        </div>
      )}
    </div>
  );
}
