"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  type ReferenceDetail,
  type ReferenceDetailItem,
  fetchReferenceDetail,
  performReferenceActionApi,
} from "@/lib/nodes-api";
import { DetailSkeleton } from "@/components/skeletons/DetailSkeleton";

// ── Constants ─────────────────────────────────────────────────────────────────

const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

const INDEFINITE_SNOOZE_ISO = "2099-12-31T23:59:59.000Z";
void INDEFINITE_SNOOZE_ISO; // unused here but kept for consistency

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "n/a";
  return parsed.toISOString().slice(0, 19).replace("T", " ");
};

const truncate = (text: string, max = 80) =>
  text.length > max ? `${text.slice(0, max)}…` : text;

// ── Supersede modal state shape ───────────────────────────────────────────────

type SupersedeModal = { open: true; currentStatement: string } | { open: false };

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReferenceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<ReferenceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Supersede modal
  const [supersedeModal, setSupersedeModal] = useState<SupersedeModal>({ open: false });
  const [supersedeStatement, setSupersedeStatement] = useState("");
  const [supersedeConfidence, setSupersedeConfidence] = useState<ConfidenceLevel | "">("");

  // Confidence edit modal
  const [confidenceEdit, setConfidenceEdit] = useState<{
    value: ConfidenceLevel;
  } | null>(null);

  // ── Load detail ──────────────────────────────────────────────────────────────

  const load = async () => {
    if (!id) return;
    setFetchError(null);
    setLoading(true);
    try {
      const data = await fetchReferenceDetail(id);
      if (!data) {
        setUnauthorized(true);
      } else {
        setDetail(data);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  const runAction = async (action: string, payload?: Record<string, unknown>) => {
    if (!id) return;
    setActionError(null);
    setLoadingAction(true);
    try {
      await performReferenceActionApi(id, action, payload);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSupersede = async () => {
    if (!supersedeStatement.trim()) return;
    const payload: Record<string, unknown> = {
      newStatement: supersedeStatement.trim(),
    };
    if (supersedeConfidence) payload.newConfidence = supersedeConfidence;
    setSupersedeModal({ open: false });
    setSupersedeStatement("");
    setSupersedeConfidence("");
    await runAction("supersede", payload);
  };

  const handleUpdateConfidence = async () => {
    if (!confidenceEdit) return;
    const { value } = confidenceEdit;
    setConfidenceEdit(null);
    await runAction("update_confidence", { confidence: value });
  };

  // ── Early returns ─────────────────────────────────────────────────────────────

  if (loading) {
    return <DetailSkeleton />;
  }

  if (unauthorized) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Sign in to view this reference.
      </div>
    );
  }

  if (fetchError || !detail) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          {fetchError ?? "Reference not found."}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          It may have been deleted or you may not have access.
        </p>
        <Link
          href="/references"
          className="mt-3 inline-block rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Back to references
        </Link>
      </div>
    );
  }

  const { current, previousVersion, nextVersions } = detail;
  const isActive = current.status === "active";
  const isCandidate = current.status === "candidate";
  const hasActions = isActive || isCandidate;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Supersede modal */}
      {supersedeModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => {
            setSupersedeModal({ open: false });
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
                  setSupersedeModal({ open: false });
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
                setConfidenceEdit({ value: e.target.value as ConfidenceLevel })
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

      {/* Back link */}
      <Link
        href="/references"
        className="inline-block text-xs text-muted-foreground hover:text-foreground"
      >
        ← Back to references
      </Link>

      {/* Section 1 — Current reference */}
      <section className="rounded-md border border-border bg-card p-5">
        <p className="text-base leading-relaxed text-foreground">{current.statement}</p>
        {current.spanId && (
          <div className="mt-2">
            <Link
              href={`/evidence/${current.spanId}`}
              className="text-xs text-primary/70 hover:text-primary"
            >
              → View source evidence span
            </Link>
          </div>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
          {(
            [
              ["Type", current.type],
              ["Confidence", current.confidence],
              [
                "Status",
                current.status,
                current.status === "candidate"
                  ? "text-amber-600 dark:text-amber-400"
                  : current.status === "inactive" || current.status === "superseded"
                    ? "opacity-50"
                    : "",
              ],
              ["Created", formatDate(current.createdAt)],
              ["Updated", formatDate(current.updatedAt)],
            ] as [string, string, string?][]
          ).map(([label, value, className]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className={`font-medium text-foreground ${className ?? ""}`}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Section 2 — Supersession context */}
      {(previousVersion || nextVersions.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">Supersession</h2>

          {previousVersion && (
            <ChainCard
              label="Superseded from"
              item={previousVersion}
            />
          )}

          {nextVersions.map((nv) => (
            <ChainCard key={nv.id} label="Superseded by" item={nv} />
          ))}
        </section>
      )}

      {/* Section 3 — Actions */}
      {hasActions && (
        <section>
          {actionError && (
            <div className="mb-3 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {actionError}
            </div>
          )}
          <div
            className={`flex flex-wrap gap-2 ${loadingAction ? "pointer-events-none opacity-50" : ""}`}
          >
            {isCandidate && (
              <>
                <button
                  type="button"
                  onClick={() => void runAction("promote_candidate")}
                  className="rounded border border-primary px-3 py-1.5 text-xs text-primary hover:bg-muted"
                >
                  Promote
                </button>
                <button
                  type="button"
                  onClick={() => void runAction("deactivate")}
                  className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  Deactivate
                </button>
              </>
            )}

            {isActive && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setSupersedeModal({ open: true, currentStatement: current.statement })
                  }
                  className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                >
                  Supersede
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfidenceEdit({ value: current.confidence as ConfidenceLevel })
                  }
                  className="rounded border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                >
                  Edit confidence
                </button>
                <button
                  type="button"
                  onClick={() => void runAction("deactivate")}
                  className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  Deactivate
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Chain card sub-component ──────────────────────────────────────────────────

function ChainCard({
  label,
  item,
}: {
  label: string;
  item: ReferenceDetailItem;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <Link
        href={`/references/${item.id}`}
        className="text-sm text-foreground hover:underline"
      >
        {truncate(item.statement)}
      </Link>
      <p className="mt-1 text-xs text-muted-foreground">
        {item.confidence} · {item.status}
      </p>
    </div>
  );
}
