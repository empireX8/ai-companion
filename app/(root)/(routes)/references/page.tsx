"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  type ReferenceListItem,
  fetchReferences,
  performReferenceActionApi,
} from "@/lib/nodes-api";
import { ListSkeleton } from "@/components/skeletons/ListSkeleton";

// ── Type filters ──────────────────────────────────────────────────────────────

type TypeFilter = "all" | "goal" | "constraint" | "preference" | "pattern";

const typeOptions: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "goal", label: "Goal" },
  { value: "constraint", label: "Constraint" },
  { value: "preference", label: "Preference" },
  { value: "pattern", label: "Pattern" },
];

type StatusFilter = "all" | "active" | "candidate" | "inactive";

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "candidate", label: "Candidate" },
  { value: "inactive", label: "Inactive" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toISOString().slice(0, 10);
};

const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReferencesPage() {
  const [items, setItems] = useState<ReferenceListItem[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Action state ────────────────────────────────────────────────────────────
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Supersede modal ─────────────────────────────────────────────────────────
  const [supersedeModal, setSupersedeModal] = useState<{
    itemId: string;
    currentStatement: string;
  } | null>(null);
  const [supersedeStatement, setSupersedeStatement] = useState("");
  const [supersedeConfidence, setSupersedeConfidence] = useState<ConfidenceLevel | "">("");

  // ── Confidence edit modal ───────────────────────────────────────────────────
  const [confidenceEdit, setConfidenceEdit] = useState<{
    itemId: string;
    value: ConfidenceLevel;
  } | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReferences();
      if (!data) {
        setUnauthorized(true);
        setItems([]);
        return;
      }
      setUnauthorized(false);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load references");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // ── Action helpers ──────────────────────────────────────────────────────────

  const markLoading = (id: string) =>
    setLoadingIds((prev) => new Set(prev).add(id));
  const clearLoading = (id: string) =>
    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const runAction = async (
    id: string,
    action: string,
    payload?: Record<string, unknown>
  ) => {
    setActionError(null);
    markLoading(id);
    try {
      await performReferenceActionApi(id, action, payload);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      clearLoading(id);
    }
  };

  const handleSupersede = async () => {
    if (!supersedeModal || !supersedeStatement.trim()) return;
    const { itemId } = supersedeModal;
    const payload: Record<string, unknown> = {
      newStatement: supersedeStatement.trim(),
    };
    if (supersedeConfidence) payload.newConfidence = supersedeConfidence;

    setSupersedeModal(null);
    setSupersedeStatement("");
    setSupersedeConfidence("");
    await runAction(itemId, "supersede", payload);
  };

  const handleUpdateConfidence = async () => {
    if (!confidenceEdit) return;
    const { itemId, value } = confidenceEdit;
    setConfidenceEdit(null);
    await runAction(itemId, "update_confidence", { confidence: value });
  };

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (q && !item.statement.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, typeFilter, statusFilter]);

  // ── Early returns ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full p-4">
        <ListSkeleton rows={6} />
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="h-full p-4 text-sm text-muted-foreground">
        Sign in to view references.
      </div>
    );
  }

  if (error) {
    return <div className="h-full p-4 text-sm text-destructive">{error}</div>;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full space-y-4 p-4">
      {/* Supersede modal */}
      {supersedeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => {
            setSupersedeModal(null);
            setSupersedeStatement("");
            setSupersedeConfidence("");
          }}
        >
          <div
            className="w-96 rounded-lg border border-border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-sm font-medium">Supersede reference</h3>
            <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
              Current: {supersedeModal.currentStatement}
            </p>
            <textarea
              autoFocus
              placeholder="New statement (required)"
              value={supersedeStatement}
              onChange={(e) => setSupersedeStatement(e.target.value)}
              rows={3}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="mt-2">
              <label className="mb-1 block text-xs text-muted-foreground">
                New confidence (optional — inherits current if blank)
              </label>
              <select
                value={supersedeConfidence}
                onChange={(e) =>
                  setSupersedeConfidence(e.target.value as ConfidenceLevel | "")
                }
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">Inherit</option>
                {CONFIDENCE_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!supersedeStatement.trim()}
                onClick={() => void handleSupersede()}
                className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
              >
                Confirm supersede
              </button>
              <button
                type="button"
                onClick={() => {
                  setSupersedeModal(null);
                  setSupersedeStatement("");
                  setSupersedeConfidence("");
                }}
                className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confidence edit modal */}
      {confidenceEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setConfidenceEdit(null)}
        >
          <div
            className="w-64 rounded-lg border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-medium">Edit confidence</h3>
            <select
              autoFocus
              value={confidenceEdit.value}
              onChange={(e) =>
                setConfidenceEdit({
                  ...confidenceEdit,
                  value: e.target.value as ConfidenceLevel,
                })
              }
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            >
              {CONFIDENCE_LEVELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void handleUpdateConfidence()}
                className="flex-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setConfidenceEdit(null)}
                className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-lg font-medium">References</h1>
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
        >
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search statements…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
      />

      {actionError && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {actionError}
        </div>
      )}

      {filtered.length === 0 ? (
        items.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-foreground">No references yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Import your ChatGPT history to extract references automatically, or start
              chatting and Double will detect them over time.
            </p>
            <Link
              href="/import"
              className="mt-3 inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Import data
            </Link>
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No references match this filter.
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((item) => {
            const busy = loadingIds.has(item.id);

            return (
              <article
                key={item.id}
                className={`rounded-md border border-border bg-card p-4 ${busy ? "opacity-60" : ""}`}
              >
                <Link
                  href={`/references/${item.id}`}
                  className="block text-sm text-foreground hover:underline"
                >
                  {item.statement}
                </Link>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.type} · {item.confidence} ·{" "}
                  <span
                    className={
                      item.status === "candidate"
                        ? "text-amber-600 dark:text-amber-400"
                        : item.status === "inactive"
                          ? "opacity-50"
                          : ""
                    }
                  >
                    {item.status}
                  </span>{" "}
                  · {formatDate(item.updatedAt)}
                </p>

                {/* Candidate actions */}
                {item.status === "candidate" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(item.id, "promote_candidate")}
                      className="rounded border border-primary px-3 py-1 text-xs text-primary hover:bg-muted disabled:opacity-40"
                    >
                      Promote
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(item.id, "deactivate")}
                      className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      Deactivate
                    </button>
                  </div>
                )}

                {/* Active actions */}
                {item.status === "active" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSupersedeModal({
                          itemId: item.id,
                          currentStatement: item.statement,
                        });
                        setSupersedeStatement("");
                        setSupersedeConfidence("");
                      }}
                      className="rounded border border-border px-3 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-40"
                    >
                      Supersede
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setConfidenceEdit({
                          itemId: item.id,
                          value: item.confidence as ConfidenceLevel,
                        })
                      }
                      className="rounded border border-border px-3 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-40"
                    >
                      Edit confidence
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(item.id, "deactivate")}
                      className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      Deactivate
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
