"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  type ContradictionFilter,
  type ContradictionListItem,
  fetchContradictions,
} from "@/lib/nodes-api";

const filterOptions: Array<{ value: ContradictionFilter; label: string }> = [
  { value: "activeish", label: "Open+Explored+Snoozed" },
  { value: "open", label: "Open" },
  { value: "explored", label: "Explored" },
  { value: "snoozed", label: "Snoozed" },
];

const truncate = (value: string, max = 240) =>
  value.length <= max ? value : `${value.slice(0, max - 3)}...`;

const formatDate = (value: string | null) => {
  if (!value) {
    return "n/a";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "n/a";
  }

  return parsed.toISOString().slice(0, 19).replace("T", " ");
};

export default function ContradictionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const parsedInitial = useMemo<ContradictionFilter>(() => {
    if (initialStatus === "open" || initialStatus === "explored" || initialStatus === "snoozed") {
      return initialStatus;
    }

    return "activeish";
  }, [initialStatus]);

  const [filter, setFilter] = useState<ContradictionFilter>(parsedInitial);
  const [items, setItems] = useState<ContradictionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setFilter(parsedInitial);
  }, [parsedInitial]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchContradictions(filter);
        if (!mounted) {
          return;
        }

        if (!data) {
          setUnauthorized(true);
          setItems([]);
          setLoading(false);
          return;
        }

        setUnauthorized(false);
        setItems(data);
      } catch (err) {
        if (!mounted) {
          return;
        }
        const message = err instanceof Error ? err.message : "Failed to load contradictions";
        setError(message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [filter]);

  const onFilterChange = (value: ContradictionFilter) => {
    setFilter(value);
    const next = new URLSearchParams(searchParams.toString());
    if (value === "activeish") {
      next.delete("status");
    } else {
      next.set("status", value);
    }

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  if (loading) {
    return <div className="h-full p-4 text-sm text-muted-foreground">Loading contradictions...</div>;
  }

  if (unauthorized) {
    return <div className="h-full p-4 text-sm text-muted-foreground">Sign in to view contradictions.</div>;
  }

  if (error) {
    return <div className="h-full p-4 text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="h-full space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Contradictions</h1>
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={filter}
          onChange={(event) => onFilterChange(event.target.value as ContradictionFilter)}
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No contradictions for this filter.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            return (
              <article key={item.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-medium text-foreground">{item.title}</h2>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                    className="rounded border border-border px-2 py-1 text-xs text-muted-foreground"
                  >
                    {expanded ? "Collapse" : "Expand"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  [{item.type}] status={item.status} rung={item.recommendedRung ?? "n/a"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  lastEvidenceAt={formatDate(item.lastEvidenceAt)} | lastTouchedAt=
                  {formatDate(item.lastTouchedAt)}
                </p>

                <div className="mt-3 space-y-2 text-sm text-foreground">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-dim">Side A</p>
                    <p>{expanded ? item.sideA : truncate(item.sideA, 180)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-text-dim">Side B</p>
                    <p>{expanded ? item.sideB : truncate(item.sideB, 180)}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
