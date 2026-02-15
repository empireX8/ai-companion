"use client";

import { useEffect, useMemo, useState } from "react";

import { type ReferenceListItem, fetchReferences } from "@/lib/nodes-api";

type TypeFilter = "all" | "goal" | "constraint" | "preference" | "pattern";

const typeOptions: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "goal", label: "Goal" },
  { value: "constraint", label: "Constraint" },
  { value: "preference", label: "Preference" },
  { value: "pattern", label: "Pattern" },
];

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "n/a";
  }

  return parsed.toISOString().slice(0, 19).replace("T", " ");
};

export default function ReferencesPage() {
  const [items, setItems] = useState<ReferenceListItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchReferences();
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
        const message = err instanceof Error ? err.message : "Failed to load references";
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
  }, []);

  const filtered = useMemo(() => {
    if (typeFilter === "all") {
      return items;
    }

    return items.filter((item) => item.type === typeFilter);
  }, [items, typeFilter]);

  if (loading) {
    return <div className="h-full p-4 text-sm text-muted-foreground">Loading references...</div>;
  }

  if (unauthorized) {
    return <div className="h-full p-4 text-sm text-muted-foreground">Sign in to view references.</div>;
  }

  if (error) {
    return <div className="h-full p-4 text-sm text-destructive">{error}</div>;
  }

  return (
    <div className="h-full space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">References</h1>
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">No references found.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((item) => (
            <article key={item.id} className="rounded-md border border-border bg-card p-4">
              <p className="text-sm text-foreground">{item.statement}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                type={item.type} | confidence={item.confidence}
              </p>
              <p className="text-xs text-muted-foreground">
                status=active | createdAt={formatDate(item.createdAt)}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
