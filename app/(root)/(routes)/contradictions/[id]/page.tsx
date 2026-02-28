"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  type AddEvidencePayload,
  type ContradictionDetail,
  type LinkedReference,
  type ReferenceListItem,
  addContradictionEvidence,
  fetchContradictionById,
  fetchLinkedReferences,
  fetchReferences,
  linkReferenceToContradiction,
  performContradictionAction,
  setContradictionReferenceAsserted,
  unlinkReferenceFromContradiction,
} from "@/lib/nodes-api";
import { getSnoozedLabel } from "@/lib/contradiction-snooze-label";
import { DetailSkeleton } from "@/components/skeletons/DetailSkeleton";
import { postMetricEvent } from "@/lib/metrics-api";
import { undoManager } from "@/lib/undo-manager";

// ── Constants ────────────────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set(["resolved", "accepted_tradeoff", "archived_tension"]);

const ACTION_NEXT_STATUS: Record<string, string> = {
  snooze: "snoozed",
  unsnooze: "open",
  resolve: "resolved",
  accept_tradeoff: "accepted_tradeoff",
  archive_tension: "archived_tension",
  reopen: "open",
};

const INDEFINITE_SNOOZE_ISO = "2099-12-31T23:59:59.000Z";

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (value: string | null | undefined) => {
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

function getMinDateForInput(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function evidenceOrigin(item: ContradictionDetail["evidence"][number]): string {
  const parts: string[] = [item.source];
  if (item.sessionId) parts.push(`session:${item.sessionId.slice(0, 8)}`);
  if (item.messageId) parts.push(`msg:${item.messageId.slice(0, 8)}`);
  return parts.join(" · ");
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContradictionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<ContradictionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [customSnoozeDate, setCustomSnoozeDate] = useState("");

  const [evidenceSource, setEvidenceSource] = useState<AddEvidencePayload["source"]>("user_input");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [evidenceSessionId, setEvidenceSessionId] = useState("");
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  // ── Linked references ─────────────────────────────────────────────────────
  const [linkedRefs, setLinkedRefs] = useState<LinkedReference[]>([]);
  const [linkedRefsLoading, setLinkedRefsLoading] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [pendingLinkId, setPendingLinkId] = useState<string | null>(null);
  // Search / add panel
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [allRefs, setAllRefs] = useState<ReferenceListItem[]>([]);
  const [allRefsLoading, setAllRefsLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const data = await fetchContradictionById(id);
        if (!mounted) return;
        if (!data) {
          setUnauthorized(true);
        } else {
          setDetail(data);
        }
      } catch (err) {
        if (!mounted) return;
        setFetchError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [id]);

  // ── Linked references fetch ───────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    const loadLinked = async () => {
      setLinkedRefsLoading(true);
      try {
        const data = await fetchLinkedReferences(id);
        if (mounted) setLinkedRefs(data);
      } catch {
        // silently fail — section shows empty state
      } finally {
        if (mounted) setLinkedRefsLoading(false);
      }
    };
    void loadLinked();
    return () => { mounted = false; };
  }, [id]);

  const linkedRefIds = useMemo(
    () => new Set(linkedRefs.map((r) => r.id)),
    [linkedRefs]
  );

  const searchResults = useMemo(() => {
    if (!linkSearch.trim()) return [];
    const q = linkSearch.toLowerCase();
    return allRefs
      .filter((r) => (r.status ?? "active") === "active" && r.statement.toLowerCase().includes(q))
      .slice(0, 6);
  }, [allRefs, linkSearch]);

  const openLinkSearch = async () => {
    setShowLinkSearch(true);
    if (allRefs.length > 0) return; // already loaded
    setAllRefsLoading(true);
    try {
      const data = await fetchReferences();
      setAllRefs(data ?? []);
    } catch {
      // silently fail — search just shows no results
    } finally {
      setAllRefsLoading(false);
    }
  };

  const handleLink = async (referenceId: string) => {
    setLinkError(null);
    setPendingLinkId(referenceId);
    try {
      const updated = await linkReferenceToContradiction(id, referenceId);
      setLinkedRefs(updated);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Failed to link");
    } finally {
      setPendingLinkId(null);
    }
  };

  const handleUnlink = async (referenceId: string) => {
    setLinkError(null);
    setPendingLinkId(referenceId);
    try {
      const updated = await unlinkReferenceFromContradiction(id, referenceId);
      setLinkedRefs(updated);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Failed to unlink");
    } finally {
      setPendingLinkId(null);
    }
  };

  const handleAssert = async (referenceId: string, asserted: boolean) => {
    setLinkError(null);
    setPendingLinkId(referenceId);
    try {
      const updated = await setContradictionReferenceAsserted(id, referenceId, asserted);
      setLinkedRefs(updated);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setPendingLinkId(null);
    }
  };

  const handleAction = async (action: string, snoozedUntil?: string) => {
    if (!detail) return;
    setActionError(null);
    setLoadingAction(true);

    const nextStatus = ACTION_NEXT_STATUS[action] ?? action;
    const prevDetail = detail;

    // Optimistic update
    setDetail({
      ...detail,
      status: nextStatus,
      snoozedUntil:
        action === "snooze"
          ? (snoozedUntil ?? null)
          : action === "unsnooze" || TERMINAL_STATUSES.has(nextStatus)
            ? null
            : detail.snoozedUntil,
    });

    try {
      await performContradictionAction(id, action, snoozedUntil);

      // Metric + undo registration for reversible actions
      if (action === "resolve" || action === "snooze" || action === "accept_tradeoff") {
        void postMetricEvent({
          name: `contradiction.${action}.executed`,
          meta: { contradictionId: id },
          route: "/contradictions/[id]",
        });
        undoManager.addUndoAction({
          id,
          name: `contradiction.${action}`,
          expiresAt: Date.now() + 10_000,
          revert: async () => {
            await performContradictionAction(id, "reopen");
            const refreshed = await fetchContradictionById(id);
            if (refreshed) setDetail(refreshed);
          },
        });
      }
    } catch (err) {
      setDetail(prevDetail);
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSnoozeDays = (days: number) => {
    setSnoozeOpen(false);
    void handleAction("snooze", addDays(days));
  };

  const handleSnoozeCustom = () => {
    if (!customSnoozeDate) return;
    const d = new Date(`${customSnoozeDate}T23:59:59`);
    setSnoozeOpen(false);
    void handleAction("snooze", d.toISOString());
  };

  const reload = async () => {
    if (!id) return;
    const data = await fetchContradictionById(id);
    if (data) setDetail(data);
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = evidenceNote.trim();
    if (!trimmed) return;
    setEvidenceError(null);
    setSubmittingEvidence(true);
    try {
      await addContradictionEvidence(id, {
        source: evidenceSource,
        note: trimmed,
        sessionId: evidenceSessionId.trim() || undefined,
      });
      setEvidenceNote("");
      setEvidenceSessionId("");
      await reload();
    } catch (err) {
      setEvidenceError(err instanceof Error ? err.message : "Failed to add evidence");
    } finally {
      setSubmittingEvidence(false);
    }
  };

  // ── Early returns ─────────────────────────────────────────────────────────

  if (loading) {
    return <DetailSkeleton />;
  }

  if (unauthorized) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Sign in to view this contradiction.
      </div>
    );
  }

  if (fetchError || !detail) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          {fetchError ?? "Contradiction not found."}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been deleted or you may not have access.
        </p>
        <Link
          href="/contradictions"
          className="mt-3 inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Back to contradictions
        </Link>
      </div>
    );
  }

  const isTerminal = TERMINAL_STATUSES.has(detail.status);
  const isSnoozed = detail.status === "snoozed";
  const snoozedLabel = isSnoozed ? getSnoozedLabel(detail.snoozedUntil) : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Snooze modal */}
      {snoozeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSnoozeOpen(false)}
        >
          <div
            className="w-72 rounded-lg border border-border bg-card p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-medium">Snooze until...</h3>
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
                onClick={() => {
                  setSnoozeOpen(false);
                  void handleAction("snooze", INDEFINITE_SNOOZE_ISO);
                }}
                className="w-full rounded border border-border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                Indefinite
              </button>
              {process.env.NODE_ENV !== "production" && (
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setMinutes(d.getMinutes() + 5);
                    setSnoozeOpen(false);
                    void handleAction("snooze", d.toISOString());
                  }}
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
              onClick={() => setSnoozeOpen(false)}
              className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Back links */}
      <div className="flex items-center gap-4">
        <Link
          href="/chat"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back to chat
        </Link>
        <Link
          href="/contradictions"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          All contradictions
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">{detail.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          [{detail.type}]{" "}
          <span className="font-medium">{detail.status}</span>
          {snoozedLabel && (
            <span className="ml-1 text-amber-600 dark:text-amber-400">
              — {snoozedLabel}
            </span>
          )}{" "}
          rung={detail.recommendedRung ?? "n/a"} escalation=
          {detail.escalationLevel}
        </p>
        {detail.cooldownActive && (
          <div className="mt-1">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Cooldown active
            </span>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Escalation eligible at {formatDate(detail.cooldownUntil)}
            </p>
          </div>
        )}
      </div>

      {/* Action row */}
      {actionError && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <div
        className={`flex flex-wrap gap-2 ${loadingAction ? "pointer-events-none opacity-50" : ""}`}
      >
        {isTerminal ? (
          <button
            type="button"
            onClick={() => void handleAction("reopen")}
            className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Reopen
          </button>
        ) : isSnoozed ? (
          <>
            <button
              type="button"
              onClick={() => void handleAction("unsnooze")}
              className="rounded border border-primary px-3 py-1.5 text-xs text-primary hover:bg-muted"
            >
              Unsnooze
            </button>
            <button
              type="button"
              onClick={() => void handleAction("resolve")}
              className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              Resolve
            </button>
            <button
              type="button"
              onClick={() => void handleAction("accept_tradeoff")}
              className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              Trade-off
            </button>
            <button
              type="button"
              onClick={() => void handleAction("archive_tension")}
              className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Archive
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSnoozeOpen(true)}
              className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Snooze
            </button>
            <button
              type="button"
              onClick={() => void handleAction("resolve")}
              className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              Resolve
            </button>
            <button
              type="button"
              onClick={() => void handleAction("accept_tradeoff")}
              className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              Trade-off
            </button>
            <button
              type="button"
              onClick={() => void handleAction("archive_tension")}
              className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Archive
            </button>
          </>
        )}
      </div>

      {/* Content: Side A / B */}
      <section className="space-y-4">
        <div className="rounded-md border border-border bg-card p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Side A
          </p>
          <p className="text-sm text-foreground">{detail.sideA}</p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Side B
          </p>
          <p className="text-sm text-foreground">{detail.sideB}</p>
        </div>
      </section>

      {/* Add Evidence Form */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-foreground">Add Evidence</h2>
        <form onSubmit={(e) => void handleAddEvidence(e)} className="space-y-3">
          <div className="flex gap-2">
            <select
              value={evidenceSource}
              onChange={(e) =>
                setEvidenceSource(e.target.value as AddEvidencePayload["source"])
              }
              className="rounded border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="user_input">User input</option>
              <option value="reflection">Reflection</option>
              <option value="session">Session</option>
            </select>
            <input
              type="text"
              placeholder="Session ID (optional)"
              value={evidenceSessionId}
              onChange={(e) => setEvidenceSessionId(e.target.value)}
              className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <textarea
            placeholder="Note (required, max 2000 chars)"
            value={evidenceNote}
            onChange={(e) => setEvidenceNote(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
          {evidenceError && (
            <p className="text-xs text-destructive">{evidenceError}</p>
          )}
          <button
            type="submit"
            disabled={!evidenceNote.trim() || submittingEvidence}
            className="rounded bg-primary px-4 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
          >
            {submittingEvidence ? "Adding..." : "Add evidence"}
          </button>
        </form>
      </section>

      {/* Evidence */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Evidence ({detail.evidence.length})
        </h2>
        {detail.evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">No evidence yet.</p>
        ) : (
          <div className="space-y-2">
            {detail.evidence.map((ev) => (
              <div
                key={ev.id}
                className="rounded-md border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {formatDate(ev.createdAt)}
                    <span className="ml-2 opacity-60">{evidenceOrigin(ev)}</span>
                  </p>
                  {ev.spanId && (
                    <Link
                      href={`/evidence/${ev.spanId}`}
                      className="text-[10px] text-primary/70 hover:text-primary"
                    >
                      → span
                    </Link>
                  )}
                </div>
                {ev.quote ? (
                  <p className="mt-1 text-sm text-foreground">{ev.quote}</p>
                ) : (
                  <p className="mt-1 text-sm italic text-muted-foreground">
                    (no note)
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Linked references */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-foreground">
          Linked references ({linkedRefsLoading ? "…" : linkedRefs.length})
        </h2>

        {linkError && (
          <div className="mb-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {linkError}
          </div>
        )}

        {linkedRefsLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : linkedRefs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked references.</p>
        ) : (
          <div className="space-y-2">
            {linkedRefs.map((ref) => {
              const busy = pendingLinkId === ref.id;
              return (
                <div
                  key={ref.id}
                  className={`rounded-md border border-border bg-card px-4 py-3 ${busy ? "opacity-60" : ""}`}
                >
                  <Link
                    href={`/references/${ref.id}`}
                    className="line-clamp-2 text-sm text-foreground hover:underline"
                  >
                    {ref.statement}
                  </Link>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {ref.type} · {ref.confidence} · {ref.status} ·{" "}
                      {formatDate(ref.updatedAt)}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          ref.link.asserted
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {ref.link.asserted ? "Asserted" : "Saved"}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleAssert(ref.id, !ref.link.asserted)}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        {busy
                          ? "…"
                          : ref.link.asserted
                            ? "Unassert"
                            : "Assert"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleUnlink(ref.id)}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        {busy ? "…" : "Unlink"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Link search panel */}
        {!showLinkSearch ? (
          <button
            type="button"
            onClick={() => void openLinkSearch()}
            className="mt-3 text-xs text-primary hover:opacity-80"
          >
            + Link a reference
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="search"
                placeholder="Search references…"
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                autoFocus
                className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => { setShowLinkSearch(false); setLinkSearch(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>

            {allRefsLoading ? (
              <p className="text-xs text-muted-foreground">Loading references…</p>
            ) : !linkSearch.trim() ? (
              <p className="text-xs text-muted-foreground">Type to search.</p>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-muted-foreground">No matches.</p>
            ) : (
              <ul className="space-y-1">
                {searchResults.map((ref) => {
                  const alreadyLinked = linkedRefIds.has(ref.id);
                  const busy = pendingLinkId === ref.id;
                  return (
                    <li
                      key={ref.id}
                      className="flex items-start justify-between gap-2 rounded border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm text-foreground">
                          {ref.statement}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {ref.type} · {ref.confidence}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={alreadyLinked || busy}
                        onClick={() => void handleLink(ref.id)}
                        className="shrink-0 rounded border border-primary/50 px-2 py-1 text-xs text-primary hover:bg-muted disabled:opacity-40"
                      >
                        {busy ? "Linking…" : alreadyLinked ? "Linked" : "Link"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-foreground">History</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          {(
            [
              ["Created", formatDate(detail.createdAt)],
              ["Last touched", formatDate(detail.lastTouchedAt)],
              ["Last evidence", formatDate(detail.lastEvidenceAt)],
              ["Evidence count", String(detail.evidenceCount)],
              [
                "Snoozed until",
                detail.snoozedUntil ? formatDate(detail.snoozedUntil) : "—",
              ],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
