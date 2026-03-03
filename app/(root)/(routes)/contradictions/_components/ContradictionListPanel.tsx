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

const FILTER_STATUSES: Record<ContradictionFilter, readonly string[]> = {
  activeish: ["open", "explored", "snoozed"],
  open: ["open"],
  explored: ["explored"],
  snoozed: ["snoozed"],
  terminal: ["resolved", "accepted_tradeoff", "archived_tension"],
};

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

const truncate = (value: string, max = 120) =>
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

const INDEFINITE_SNOOZE_ISO = "2099-12-31T23:59:59.000Z";

function getMinDateForInput(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function ContradictionListPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive active ID from pathname (e.g. /contradictions/abc123)
  const activeId = pathname.startsWith("/contradictions/")
    ? pathname.slice("/contradictions/".length).split("/")[0]
    : null;

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

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("weight");
  const [escalationFilter, setEscalationFilter] = useState<EscalationFilter>("all");

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [snoozeTargetIds, setSnoozeTargetIds] = useState<string[]>([]);
  const [customSnoozeDate, setCustomSnoozeDate] = useState("");

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
    // Always navigate to /contradictions base, regardless of current path
    if (value === "activeish") {
      router.replace("/contradictions");
    } else {
      router.replace(`/contradictions?status=${value}`);
    }
  };

  const handleAction = async (id: string, action: string, snoozedUntil?: string) => {
    setActionError(null);
    setLoadingId(id);

    const newStatus = ACTION_NEXT_STATUS[action] ?? action;
    const prevItems = [...items];

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
      setItems(prevItems);
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoadingId(null);
    }
  };

  const openSnoozeModal = (id: string) => {
    setCustomSnoozeDate("");
    setSnoozeTargetIds([id]);
  };

  const openBatchSnoozeModal = () => {
    setCustomSnoozeDate("");
    setSnoozeTargetIds([...selectedIds]);
  };

  const doSnoozeIds = async (ids: string[], snoozedUntil: string) => {
    setSnoozeTargetIds([]);
    if (ids.length === 1) {
      void handleAction(ids[0], "snooze", snoozedUntil);
      return;
    }
    setBatchLoading(true);
    setBatchError(null);
    const errors: string[] = [];
    await Promise.all(
      ids.map(async (id) => {
        try {
          await performContradictionAction(id, "snooze", snoozedUntil);
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Snooze modal — fixed overlay, portal-safe */}
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
                <p className="mb-1 text-xs text-muted-foreground">Custom date</p>
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

      {/* Filter + search controls */}
      <div className="shrink-0 space-y-1.5 border-b border-border/60 px-3 py-2">
        <select
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as ContradictionFilter)}
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
        />
        <div className="flex gap-1">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="flex-1 rounded-md border border-border bg-background px-1 py-1 text-xs"
          >
            <option value="weight">Weight</option>
            <option value="lastTouched">Last touched</option>
          </select>
          <select
            value={escalationFilter}
            onChange={(e) => setEscalationFilter(e.target.value as EscalationFilter)}
            className="flex-1 rounded-md border border-border bg-background px-1 py-1 text-xs"
          >
            <option value="all">All levels</option>
            <option value="0">L0</option>
            <option value="1">L1</option>
            <option value="2">L2</option>
            <option value="3">L3</option>
            <option value="4">L4</option>
          </select>
        </div>
      </div>

      {/* Error banners */}
      {(actionError || batchError) && (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {actionError ?? batchError}
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="flex-1 p-2">
          <ListSkeleton rows={6} />
        </div>
      ) : unauthorized ? (
        <p className="flex-1 p-3 text-xs text-muted-foreground">Sign in to view contradictions.</p>
      ) : error ? (
        <p className="flex-1 p-3 text-xs text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <div className="flex-1 p-4 text-center">
          <p className="text-xs font-medium text-foreground">
            {filter === "activeish" ? "No contradictions yet" : "No results"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filter === "activeish"
              ? "Double will surface conflicts as you chat."
              : "Try a different filter."}
          </p>
          {filter === "activeish" && (
            <Link
              href="/chat"
              className="mt-2 inline-block rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
            >
              Go to chat
            </Link>
          )}
        </div>
      ) : visibleItems.length === 0 ? (
        <p className="flex-1 p-3 text-center text-xs text-muted-foreground">
          No results match your search.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Select all + batch bar */}
          <div className="shrink-0 flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-xs">
            <label className="flex cursor-pointer select-none items-center gap-1 text-muted-foreground">
              <input
                type="checkbox"
                checked={visibleItems.every((i) => selectedIds.has(i.id))}
                onChange={toggleSelectAll}
                className="rounded"
              />
              {visibleItems.every((i) => selectedIds.has(i.id)) ? "Deselect all" : "Select all"}
            </label>
            {selectedIds.size > 0 && (
              <>
                <span className="text-muted-foreground">{selectedIds.size} sel.</span>
                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={openBatchSnoozeModal}
                  className="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  Snooze
                </button>
                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={() => void handleBatchArchive()}
                  className="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
                >
                  Archive
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </>
            )}
          </div>

          {/* Item list */}
          <ul className="flex-1 divide-y divide-border/60">
            {visibleItems.map((item) => {
              const expanded = expandedId === item.id;
              const isLoading = loadingId === item.id;
              const isSelected = selectedIds.has(item.id);
              const isActive = activeId === item.id;
              const isTerminal = TERMINAL_STATUSES.has(item.status);
              const isSnoozed = item.status === "snoozed";
              const snoozedLabel =
                item.status === "snoozed" ? getSnoozedLabel(item.snoozedUntil) : null;
              const cooldownActive = computeEscalationCooldown(
                item.lastEscalatedAt ? new Date(item.lastEscalatedAt) : null
              ).active;

              return (
                <li
                  key={item.id}
                  className={`p-2 transition-opacity ${
                    isLoading || batchLoading ? "pointer-events-none opacity-50" : ""
                  } ${isActive ? "bg-accent/60" : ""}`}
                >
                  <div className="flex items-start gap-1.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      className="mt-0.5 shrink-0 cursor-pointer"
                      aria-label={`Select ${item.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <Link
                          href={`/contradictions/${item.id}`}
                          className={`truncate text-xs font-medium leading-snug hover:underline ${
                            isActive ? "text-foreground" : "text-foreground"
                          }`}
                        >
                          {item.title}
                        </Link>
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : item.id)}
                          className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                        >
                          {expanded ? "−" : "+"}
                        </button>
                      </div>

                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        <span className="font-medium">{item.status}</span>
                        {snoozedLabel && (
                          <span className="ml-1 text-amber-600 dark:text-amber-400">
                            — {snoozedLabel}
                          </span>
                        )}
                        {cooldownActive && <span className="ml-1 opacity-60">· cd</span>}
                        {" · "}rung={item.recommendedRung ?? "n/a"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        ev={formatDate(item.lastEvidenceAt)}
                      </p>

                      {expanded && (
                        <div className="mt-1.5 space-y-1 text-[10px] text-foreground">
                          <div>
                            <span className="uppercase tracking-wide text-text-dim">A </span>
                            {truncate(item.sideA)}
                          </div>
                          <div>
                            <span className="uppercase tracking-wide text-text-dim">B </span>
                            {truncate(item.sideB)}
                          </div>
                        </div>
                      )}

                      {/* Action row */}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {isTerminal ? (
                          <button
                            type="button"
                            onClick={() => void handleAction(item.id, "reopen")}
                            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                          >
                            Reopen
                          </button>
                        ) : isSnoozed ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleAction(item.id, "unsnooze")}
                              className="rounded border border-primary px-1.5 py-0.5 text-[10px] text-primary hover:bg-muted"
                            >
                              Unsnooze
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAction(item.id, "resolve")}
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAction(item.id, "accept_tradeoff")}
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
                            >
                              Trade-off
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAction(item.id, "archive_tension")}
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                            >
                              Archive
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => openSnoozeModal(item.id)}
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                            >
                              Snooze
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAction(item.id, "resolve")}
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAction(item.id, "accept_tradeoff")}
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
                            >
                              Trade-off
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAction(item.id, "archive_tension")}
                              className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                            >
                              Archive
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
