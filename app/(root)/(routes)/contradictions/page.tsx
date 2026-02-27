"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { computeEscalationCooldown } from "@/lib/contradiction-escalation";
import {
  type ContradictionFilter,
  type ContradictionListItem,
  fetchContradictions,
  performContradictionAction,
} from "@/lib/nodes-api";
import { getSnoozedLabel } from "@/lib/contradiction-snooze-label";
import { ListSkeleton } from "@/components/skeletons/ListSkeleton";
import { postMetricEvent } from "@/lib/metrics-api";
import { undoManager } from "@/lib/undo-manager";

const filterOptions: Array<{ value: ContradictionFilter; label: string }> = [
  { value: "activeish", label: "Open+Explored+Snoozed" },
  { value: "open", label: "Open" },
  { value: "explored", label: "Explored" },
  { value: "snoozed", label: "Snoozed" },
  { value: "terminal", label: "Resolved+Archived+Trade-off" },
];

// Statuses that remain visible for each filter after a status change
const FILTER_STATUSES: Record<ContradictionFilter, readonly string[]> = {
  activeish: ["open", "explored", "snoozed"],
  open: ["open"],
  explored: ["explored"],
  snoozed: ["snoozed"],
  terminal: ["resolved", "accepted_tradeoff", "archived_tension"],
};

// Expected next status for each action
const ACTION_NEXT_STATUS: Record<string, string> = {
  snooze: "snoozed",
  unsnooze: "open",
  resolve: "resolved",
  accept_tradeoff: "accepted_tradeoff",
  archive_tension: "archived_tension",
  reopen: "open",
};

const TERMINAL_STATUSES = new Set(["resolved", "accepted_tradeoff", "archived_tension"]);

type SortKey = "weight" | "lastTouched";
type EscalationFilter = "all" | "0" | "1" | "2" | "3" | "4";

function applyContradictionFilters(
  items: ContradictionListItem[],
  query: string,
  sortKey: SortKey,
  escalationFilter: EscalationFilter
): ContradictionListItem[] {
  const q = query.trim().toLowerCase();
  let result = q
    ? items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.sideA.toLowerCase().includes(q) ||
          item.sideB.toLowerCase().includes(q)
      )
    : items;

  if (escalationFilter !== "all") {
    const level = parseInt(escalationFilter, 10);
    result = result.filter((item) => item.escalationLevel === level);
  }

  return [...result].sort((a, b) => {
    if (sortKey === "weight") {
      const diff = (b.weight ?? 0) - (a.weight ?? 0);
      if (diff !== 0) return diff;
    }
    const ta = a.lastTouchedAt ? new Date(a.lastTouchedAt).getTime() : 0;
    const tb = b.lastTouchedAt ? new Date(b.lastTouchedAt).getTime() : 0;
    return tb - ta;
  });
}

const truncate = (value: string, max = 240) =>
  value.length <= max ? value : `${value.slice(0, max - 3)}...`;

const formatDate = (value: string | null) => {
  if (!value) return "n/a";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toISOString().slice(0, 10);
};

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
}

// Sentinel used for "indefinite" snooze — year >= 2099 is treated as indefinite in the label
const INDEFINITE_SNOOZE_ISO = "2099-12-31T23:59:59.000Z";

function getMinDateForInput(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function ContradictionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const parsedInitial = useMemo<ContradictionFilter>(() => {
    if (
      initialStatus === "open" ||
      initialStatus === "explored" ||
      initialStatus === "snoozed" ||
      initialStatus === "terminal"
    ) {
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
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Search / sort / escalation controls
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("weight");
  const [escalationFilter, setEscalationFilter] = useState<EscalationFilter>("all");

  // Single-node action state
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Snooze modal — snoozeTargetIds.length > 0 means modal is open.
  // Single-node: [id]; batch: [...selectedIds]
  const [snoozeTargetIds, setSnoozeTargetIds] = useState<string[]>([]);
  const [customSnoozeDate, setCustomSnoozeDate] = useState("");

  // Multi-select + batch state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  useEffect(() => {
    setFilter(parsedInitial);
  }, [parsedInitial]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      setActionError(null);
      setBatchError(null);
      try {
        const data = await fetchContradictions(filter);
        if (!mounted) return;

        if (!data) {
          setUnauthorized(true);
          setItems([]);
          setLoading(false);
          return;
        }

        setUnauthorized(false);
        setItems(data);
      } catch (err) {
        if (!mounted) return;
        const message =
          err instanceof Error ? err.message : "Failed to load contradictions";
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [filter, reloadTrigger]);

  const triggerReload = () => setReloadTrigger((n) => n + 1);

  const onFilterChange = (value: ContradictionFilter) => {
    setFilter(value);
    setSelectedIds(new Set());
    const next = new URLSearchParams(searchParams.toString());
    if (value === "activeish") {
      next.delete("status");
    } else {
      next.set("status", value);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  const handleAction = async (
    id: string,
    action: string,
    snoozedUntil?: string
  ) => {
    setActionError(null);
    setLoadingId(id);

    const newStatus = ACTION_NEXT_STATUS[action] ?? action;
    const prevItems = [...items];

    // Optimistic update: remove if new status won't match the current filter
    const filterStatuses = FILTER_STATUSES[filter];
    const willRemain = filterStatuses.includes(newStatus);

    if (willRemain) {
      setItems(
        prevItems.map((item) =>
          item.id === id
            ? {
                ...item,
                status: newStatus,
                snoozedUntil:
                  action === "snooze"
                    ? (snoozedUntil ?? null)
                    : TERMINAL_STATUSES.has(newStatus)
                      ? null
                      : item.snoozedUntil,
              }
            : item
        )
      );
    } else {
      setItems(prevItems.filter((item) => item.id !== id));
    }

    try {
      await performContradictionAction(id, action, snoozedUntil);

      // Metric + undo registration for reversible actions
      if (action === "resolve" || action === "snooze" || action === "accept_tradeoff") {
        void postMetricEvent({
          name: `contradiction.${action}.executed`,
          meta: { contradictionId: id },
          route: "/contradictions",
        });
        undoManager.addUndoAction({
          id,
          name: `contradiction.${action}`,
          expiresAt: Date.now() + 10_000,
          revert: async () => {
            await performContradictionAction(id, "reopen");
            triggerReload();
          },
        });
      }
    } catch (err) {
      // Revert optimistic update on failure
      setItems(prevItems);
      setActionError(
        err instanceof Error ? err.message : "Action failed"
      );
    } finally {
      setLoadingId(null);
    }
  };

  // ── Snooze modal handlers ─────────────────────────────────────────────────

  const openSnoozeModal = (id: string) => {
    setCustomSnoozeDate("");
    setSnoozeTargetIds([id]);
  };

  const openBatchSnoozeModal = () => {
    setCustomSnoozeDate("");
    setSnoozeTargetIds([...selectedIds]);
  };

  // Core snooze dispatcher — handles both single (optimistic) and batch (reload) paths.
  const doSnoozeIds = async (ids: string[], snoozedUntil: string) => {
    setSnoozeTargetIds([]);
    if (ids.length === 1) {
      void handleAction(ids[0], "snooze", snoozedUntil);
      return;
    }
    // Batch path
    setBatchLoading(true);
    setBatchError(null);
    const errors: string[] = [];
    await Promise.all(
      ids.map(async (id) => {
        try {
          await performContradictionAction(id, "snooze", snoozedUntil);
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
          console.error(`Batch snooze failed for ${id}:`, err);
        }
      })
    );
    setSelectedIds(new Set());
    setBatchLoading(false);
    if (errors.length > 0) {
      setBatchError(`${errors.length} item(s) failed to snooze.`);
    }
    triggerReload();
  };

  const handleSnoozeDays = (days: number) => {
    const ids = snoozeTargetIds;
    if (!ids.length) return;
    void doSnoozeIds(ids, addDays(days));
  };

  const handleSnoozeIndefinite = () => {
    const ids = snoozeTargetIds;
    if (!ids.length) return;
    void doSnoozeIds(ids, INDEFINITE_SNOOZE_ISO);
  };

  const handleSnoozeDevMin = () => {
    const ids = snoozeTargetIds;
    if (!ids.length) return;
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    void doSnoozeIds(ids, d.toISOString());
  };

  const handleSnoozeCustom = () => {
    const ids = snoozeTargetIds;
    if (!ids.length || !customSnoozeDate) return;
    const d = new Date(`${customSnoozeDate}T23:59:59`);
    void doSnoozeIds(ids, d.toISOString());
  };

  // ── Batch action handlers ─────────────────────────────────────────────────

  const handleBatchArchive = async () => {
    setBatchLoading(true);
    setBatchError(null);
    const ids = [...selectedIds];
    const errors: string[] = [];
    await Promise.all(
      ids.map(async (id) => {
        try {
          await performContradictionAction(id, "archive_tension");
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
          console.error(`Batch archive failed for ${id}:`, err);
        }
      })
    );
    setSelectedIds(new Set());
    setBatchLoading(false);
    if (errors.length > 0) {
      setBatchError(`${errors.length} item(s) failed to archive.`);
    }
    triggerReload();
  };

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const visibleItems = useMemo(
    () => applyContradictionFilters(items, query, sortKey, escalationFilter),
    [items, query, sortKey, escalationFilter]
  );

  const toggleSelectAll = () => {
    if (visibleItems.every((i) => selectedIds.has(i.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleItems.map((i) => i.id)));
    }
  };

  if (loading) {
    return (
      <div className="h-full p-4">
        <ListSkeleton rows={8} />
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="h-full p-4 text-sm text-muted-foreground">
        Sign in to view contradictions.
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full p-4 text-sm text-destructive">{error}</div>
    );
  }

  const allSelected =
    visibleItems.length > 0 && visibleItems.every((i) => selectedIds.has(i.id));

  return (
    <div className="h-full space-y-4 p-4">
      {/* Snooze duration modal — shared for single-node and batch */}
      {snoozeTargetIds.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSnoozeTargetIds([])}
        >
          <div
            className="w-72 rounded-lg border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-medium">
              {snoozeTargetIds.length > 1
                ? `Snooze ${snoozeTargetIds.length} items until...`
                : "Snooze until..."}
            </h3>
            <div className="space-y-2">
              {([1, 3, 7, 30] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => handleSnoozeDays(days)}
                  className="w-full rounded border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {days === 1 ? "1 day" : `${days} days`}
                </button>
              ))}
              <button
                type="button"
                onClick={handleSnoozeIndefinite}
                className="w-full rounded border border-border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                Indefinite
              </button>
              {process.env.NODE_ENV !== "production" && (
                <button
                  type="button"
                  onClick={handleSnoozeDevMin}
                  className="w-full rounded border border-border px-3 py-2 text-left text-sm opacity-60 hover:bg-muted"
                >
                  5 min (dev only)
                </button>
              )}
              <div className="border-t border-border pt-2">
                <p className="mb-1 text-xs text-muted-foreground">
                  Custom date
                </p>
                <input
                  type="date"
                  value={customSnoozeDate}
                  min={getMinDateForInput()}
                  onChange={(e) => setCustomSnoozeDate(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  disabled={!customSnoozeDate}
                  onClick={handleSnoozeCustom}
                  className="mt-2 w-full rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
                >
                  Confirm
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSnoozeTargetIds([])}
              className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Contradictions</h1>
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={filter}
          onChange={(event) =>
            onFilterChange(event.target.value as ContradictionFilter)
          }
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Search / sort / escalation controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search title, sides…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="weight">Sort: Weight</option>
          <option value="lastTouched">Sort: Last touched</option>
        </select>
        <select
          value={escalationFilter}
          onChange={(e) => setEscalationFilter(e.target.value as EscalationFilter)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="all">All escalation</option>
          <option value="0">Level 0</option>
          <option value="1">Level 1</option>
          <option value="2">Level 2</option>
          <option value="3">Level 3</option>
          <option value="4">Level 4</option>
        </select>
      </div>

      {/* Error banners */}
      {actionError && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}
      {batchError && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {batchError}
        </div>
      )}

      {items.length === 0 ? (
        filter === "activeish" ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-foreground">No contradictions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Double will surface conflicts as you chat and log evidence.
            </p>
            <Link
              href="/chat"
              className="mt-3 inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Go to chat
            </Link>
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-foreground">No results</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different filter.</p>
          </div>
        )
      ) : visibleItems.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No results match your search.
        </div>
      ) : (
        <>
          {/* Select All + inline Batch Action Bar */}
          <div className="flex items-center gap-3 text-xs">
            <label className="flex cursor-pointer select-none items-center gap-1.5 text-muted-foreground">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="rounded"
              />
              {allSelected ? "Deselect all" : "Select all"}
            </label>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {selectedIds.size} selected
                </span>
                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={openBatchSnoozeModal}
                  className="rounded border border-border px-2.5 py-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  Snooze
                </button>
                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={() => void handleBatchArchive()}
                  className="rounded border border-border px-2.5 py-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  Archive
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Items grid */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {visibleItems.map((item) => {
              const expanded = expandedId === item.id;
              const isLoading = loadingId === item.id;
              const isSelected = selectedIds.has(item.id);
              const isTerminal = TERMINAL_STATUSES.has(item.status);
              const isSnoozed = item.status === "snoozed";
              const snoozedLabel =
                item.status === "snoozed"
                  ? getSnoozedLabel(item.snoozedUntil)
                  : null;
              const cooldownActive = computeEscalationCooldown(
                item.lastEscalatedAt ? new Date(item.lastEscalatedAt) : null
              ).active;

              return (
                <article
                  key={item.id}
                  className={`rounded-md border bg-card p-4 transition-opacity ${
                    isLoading || batchLoading ? "pointer-events-none opacity-50" : ""
                  } ${isSelected ? "border-primary/60" : "border-border"}`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-0.5 shrink-0 cursor-pointer"
                      aria-label={`Select ${item.title}`}
                    />
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                      <h2 className="text-sm font-medium text-foreground">
                        <Link
                          href={`/contradictions/${item.id}`}
                          className="hover:underline"
                        >
                          {item.title}
                        </Link>
                      </h2>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : item.id)
                        }
                        className="shrink-0 rounded border border-border px-2 py-1 text-xs text-muted-foreground"
                      >
                        {expanded ? "Collapse" : "Expand"}
                      </button>
                    </div>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    [{item.type}]{" "}
                    <span className="font-medium">{item.status}</span>
                    {snoozedLabel && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400">
                        — {snoozedLabel}
                      </span>
                    )}{" "}
                    rung={item.recommendedRung ?? "n/a"}
                    {cooldownActive && (
                      <span className="ml-1 opacity-60">· cooldown</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    lastEvidence={formatDate(item.lastEvidenceAt)} |
                    lastTouched={formatDate(item.lastTouchedAt)}
                  </p>

                  <div className="mt-3 space-y-2 text-sm text-foreground">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-text-dim">
                        Side A
                      </p>
                      <p>{expanded ? item.sideA : truncate(item.sideA, 180)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-text-dim">
                        Side B
                      </p>
                      <p>{expanded ? item.sideB : truncate(item.sideB, 180)}</p>
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                    {isTerminal ? (
                      <button
                        type="button"
                        onClick={() => void handleAction(item.id, "reopen")}
                        className="rounded border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                      >
                        Reopen
                      </button>
                    ) : isSnoozed ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleAction(item.id, "unsnooze")}
                          className="rounded border border-primary px-2.5 py-1 text-xs text-primary hover:bg-muted"
                        >
                          Unsnooze
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAction(item.id, "resolve")}
                          className="rounded border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleAction(item.id, "accept_tradeoff")
                          }
                          className="rounded border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                        >
                          Trade-off
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleAction(item.id, "archive_tension")
                          }
                          className="rounded border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                        >
                          Archive
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openSnoozeModal(item.id)}
                          className="rounded border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                        >
                          Snooze
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAction(item.id, "resolve")}
                          className="rounded border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleAction(item.id, "accept_tradeoff")
                          }
                          className="rounded border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                        >
                          Trade-off
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleAction(item.id, "archive_tension")
                          }
                          className="rounded border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                        >
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
