"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  type ReferenceListItem,
  fetchReferences,
  performReferenceActionApi,
} from "@/lib/nodes-api";
import { ListSkeleton } from "@/components/skeletons/ListSkeleton";

// ── Types / constants ──────────────────────────────────────────────────────────

type TypeFilter = "all" | "goal" | "constraint" | "preference" | "pattern";
type StatusFilter = "all" | "active" | "candidate" | "inactive";
const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

const typeOptions: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "goal", label: "Goal" },
  { value: "constraint", label: "Constraint" },
  { value: "preference", label: "Preference" },
  { value: "pattern", label: "Pattern" },
];

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "candidate", label: "Candidate" },
  { value: "inactive", label: "Inactive" },
];

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toISOString().slice(0, 10);
};

const truncate = (value: string, max = 100) =>
  value.length <= max ? value : `${value.slice(0, max - 3)}...`;

// ── Component ──────────────────────────────────────────────────────────────────

export function ReferenceListPanel() {
  const pathname = usePathname();

  // Derive active ID from pathname (e.g. /references/abc123)
  const activeId = pathname.startsWith("/references/")
    ? pathname.slice("/references/".length).split("/")[0]
    : null;

  const [items, setItems] = useState<ReferenceListItem[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const [supersedeModal, setSupersedeModal] = useState<{
    itemId: string;
    currentStatement: string;
  } | null>(null);
  const [supersedeStatement, setSupersedeStatement] = useState("");
  const [supersedeConfidence, setSupersedeConfidence] = useState<ConfidenceLevel | "">("");

  const [confidenceEdit, setConfidenceEdit] = useState<{
    itemId: string;
    value: ConfidenceLevel;
  } | null>(null);

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

  const markLoading = (id: string) =>
    setLoadingIds((prev) => new Set(prev).add(id));
  const clearLoading = (id: string) =>
    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const runAction = async (id: string, action: string, payload?: Record<string, unknown>) => {
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
    const payload: Record<string, unknown> = { newStatement: supersedeStatement.trim() };
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (q && !item.statement.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, typeFilter, statusFilter]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
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
                onChange={(e) => setSupersedeConfidence(e.target.value as ConfidenceLevel | "")}
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">Inherit</option>
                {CONFIDENCE_LEVELS.map((c) => (
                  <option key={c} value={c}>{c}</option>
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
                setConfidenceEdit({ ...confidenceEdit, value: e.target.value as ConfidenceLevel })
              }
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            >
              {CONFIDENCE_LEVELS.map((c) => (
                <option key={c} value={c}>{c}</option>
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

      {/* Filter + search controls */}
      <div className="shrink-0 space-y-1.5 border-b border-border/60 px-3 py-2">
        <div className="flex gap-1">
          <select
            className="flex-1 rounded-md border border-border bg-background px-1 py-1 text-xs"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          >
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className="flex-1 rounded-md border border-border bg-background px-1 py-1 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <input
          type="search"
          placeholder="Search statements…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
        />
      </div>

      {/* Error banner */}
      {actionError && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {actionError}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="flex-1 p-2">
          <ListSkeleton rows={6} />
        </div>
      ) : unauthorized ? (
        <p className="flex-1 p-3 text-xs text-muted-foreground">Sign in to view references.</p>
      ) : error ? (
        <p className="flex-1 p-3 text-xs text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <div className="flex-1 p-4 text-center">
          <p className="text-xs font-medium text-foreground">No references yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Import your ChatGPT history or start chatting.
          </p>
          <Link
            href="/import"
            className="mt-2 inline-block rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
          >
            Import data
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <p className="flex-1 p-3 text-center text-xs text-muted-foreground">
          No references match this filter.
        </p>
      ) : (
        <ul className="flex-1 divide-y divide-border/60 overflow-y-auto">
          {filtered.map((item) => {
            const busy = loadingIds.has(item.id);
            const isActive = activeId === item.id;

            return (
              <li
                key={item.id}
                className={`p-2 ${busy ? "opacity-60" : ""} ${isActive ? "bg-accent/60" : ""}`}
              >
                <Link
                  href={`/references/${item.id}`}
                  className="block text-xs font-medium leading-snug text-foreground hover:underline"
                >
                  {truncate(item.statement)}
                </Link>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {item.type} ·{" "}
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
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(item.id, "promote_candidate")}
                      className="rounded border border-primary px-1.5 py-0.5 text-[10px] text-primary hover:bg-muted disabled:opacity-40"
                    >
                      Promote
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(item.id, "deactivate")}
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      Deactivate
                    </button>
                  </div>
                )}

                {/* Active actions */}
                {item.status === "active" && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSupersedeModal({ itemId: item.id, currentStatement: item.statement });
                        setSupersedeStatement("");
                        setSupersedeConfidence("");
                      }}
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted disabled:opacity-40"
                    >
                      Supersede
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setConfidenceEdit({ itemId: item.id, value: item.confidence as ConfidenceLevel })
                      }
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted disabled:opacity-40"
                    >
                      Confidence
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(item.id, "deactivate")}
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      Deactivate
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
