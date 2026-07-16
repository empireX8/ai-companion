"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { useDurableActionsRefresh } from "@/lib/orvek-v0/durable-actions-context";
import { InvestigationInspectorButton } from "./InvestigationInspectorButton";
import type { InvestigationAvailableEvidenceItem } from "@/lib/investigation-production-detail";

function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const details = (payload as { details?: Array<{ message?: string }> }).details;
    if (Array.isArray(details) && typeof details[0]?.message === "string") {
      return details[0].message;
    }

    const error = (payload as { error?: string }).error;
    if (typeof error === "string" && error.trim().length > 0) {
      return error;
    }
  }

  return fallback;
}

function transitionMeta(status: string): Array<{ nextStatus: string; label: string }> {
  switch (status) {
    case "open":
      return [{ nextStatus: "gathering_evidence", label: "Start gathering evidence" }];
    case "gathering_evidence":
      return [{ nextStatus: "testing", label: "Move to testing" }];
    case "testing":
      return [{ nextStatus: "resolving", label: "Move to resolving" }];
    case "resolving":
      return [{ nextStatus: "resolved", label: "Close as resolved" }];
    default:
      return [];
  }
}

export function InvestigationDetailActions({
  investigationId,
  title,
  status,
  resolutionSummary,
  availableEvidence,
  useRouterRefresh = true,
}: {
  investigationId: string;
  title: string;
  status: string;
  resolutionSummary: string | null;
  availableEvidence: InvestigationAvailableEvidenceItem[];
  useRouterRefresh?: boolean;
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const { refreshAfterDurableWrite } = useDurableActionsRefresh();
  const [isPending, startTransition] = useTransition();
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(
    availableEvidence[0]?.id ?? ""
  );
  const [watchForPrompt, setWatchForPrompt] = useState("");
  const [watchForReason, setWatchForReason] = useState("");
  const [outcome, setOutcome] = useState(resolutionSummary ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const transitions = useMemo(() => transitionMeta(status), [status]);
  const isClosed = status === "resolved" || status === "abandoned";

  function handleRefresh(message: string) {
    setSuccessMessage(message);
    setErrorMessage(null);
    refreshAfterDurableWrite();
    if (useRouterRefresh) {
      startTransition(() => {
        router.refresh();
      });
    }
  }

  async function handleAttachEvidence() {
    if (!selectedEvidenceId || isPending || isClosed) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const sessionToken = await getToken();
    const response = await fetch("/api/understanding/evidence-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({
        targetType: "investigation",
        targetId: investigationId,
        sourceType: "evidence_span",
        sourceId: selectedEvidenceId,
        role: "supports",
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setErrorMessage(readErrorMessage(payload, "Evidence could not be linked."));
      return;
    }

    handleRefresh(`Linked evidence ID: ${selectedEvidenceId}`);
  }

  async function handleCreateWatchFor() {
    if (!watchForPrompt.trim() || !watchForReason.trim() || isPending || isClosed) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const sessionToken = await getToken();
    const response = await fetch("/api/fieldwork", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({
        prompt: watchForPrompt.trim(),
        reason: watchForReason.trim(),
        status: "assigned",
        linkedObjectType: "investigation",
        linkedObjectId: investigationId,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { item?: { id?: string } }
      | null;
    if (!response.ok) {
      setErrorMessage(readErrorMessage(payload, "Watch-for could not be created."));
      return;
    }

    const createdId = payload?.item?.id;
    setWatchForPrompt("");
    setWatchForReason("");
    handleRefresh(createdId ? `Created watch-for ID: ${createdId}` : "Created watch-for.");
  }

  async function handleSaveOutcome() {
    if (!outcome.trim() || isPending) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const sessionToken = await getToken();
    const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({
        resolutionSummary: outcome.trim(),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setErrorMessage(readErrorMessage(payload, "Outcome could not be saved."));
      return;
    }

    handleRefresh("Outcome saved.");
  }

  async function handleTransition(nextStatus: string) {
    if (isPending) {
      return;
    }

    const trimmedOutcome = outcome.trim();
    if (nextStatus === "resolved" && !trimmedOutcome) {
      setErrorMessage("Record an outcome before closing the investigation.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const sessionToken = await getToken();
    const response = await fetch(`/api/investigations/${encodeURIComponent(investigationId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({
        status: nextStatus,
        ...(nextStatus === "resolved"
          ? {
              resolvedAt: new Date().toISOString(),
              resolutionSummary: trimmedOutcome,
            }
          : {}),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setErrorMessage(readErrorMessage(payload, "Lifecycle state could not be updated."));
      return;
    }

    handleRefresh(`Lifecycle state saved: ${nextStatus}`);
  }

  return (
    <section className="card-standard mb-8 p-5" data-testid="investigation-detail-actions">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium text-foreground">Real investigation actions</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_70%)]">
            Writes here use the authenticated production routes for this exact investigation ID.
          </p>
        </div>
        <InvestigationInspectorButton
          investigationId={investigationId}
          title={title}
          className="rounded-[9px] border border-cyan/25 px-3 py-2 text-[12px] font-medium text-cyan transition hover:bg-cyan/10"
        />
      </div>

      {successMessage ? (
        <p className="mt-4 text-[12px] text-cyan" data-testid="investigation-action-success">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          className="mt-4 text-[12px] text-[hsl(0_80%_70%)]"
          data-testid="investigation-action-error"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="rounded-[12px] border border-white/10 bg-black/15 p-4">
          <div className="label-meta text-meta">Link evidence</div>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_70%)]">
            Attach a user-owned evidence span to this investigation. If none are available, the
            page stays honest and empty.
          </p>
          {availableEvidence.length === 0 ? (
            <p
              className="mt-3 text-[12px] text-[hsl(216_11%_70%)]"
              data-testid="investigation-available-evidence-empty"
            >
              No unlinked evidence spans are available for this user right now.
            </p>
          ) : (
            <>
              <div className="mt-3 space-y-2">
                {availableEvidence.map((item) => (
                  <label
                    key={item.id}
                    className="block rounded-[10px] border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="investigation-evidence"
                        value={item.id}
                        checked={selectedEvidenceId === item.id}
                        onChange={() => setSelectedEvidenceId(item.id)}
                        data-testid={`investigation-available-evidence-${item.id}`}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <div className="label-meta text-cyan/70">Evidence ID {item.id}</div>
                        <p className="mt-1 text-[13px] leading-relaxed text-foreground">
                          {item.excerpt}
                        </p>
                        <div className="label-meta mt-2">
                          {item.sessionLabel ?? "Unnamed session"} · {item.origin ?? "APP"}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <button
                type="button"
                data-testid="investigation-link-evidence-submit"
                onClick={() => void handleAttachEvidence()}
                disabled={isPending || !selectedEvidenceId || isClosed}
                className="mt-3 rounded-[9px] bg-cyan px-3 py-2 text-[12px] font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
              >
                Link selected evidence
              </button>
            </>
          )}
        </div>

        <div className="rounded-[12px] border border-white/10 bg-black/15 p-4">
          <div className="label-meta text-meta">Create watch-for</div>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_70%)]">
            Create a durable fieldwork prompt linked directly to this investigation.
          </p>
          <div className="mt-3 space-y-3">
            <input
              value={watchForPrompt}
              onChange={(event) => setWatchForPrompt(event.target.value)}
              placeholder="Watch-for prompt"
              data-testid="investigation-watch-for-prompt"
              className="w-full rounded-[10px] border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-cyan/40"
            />
            <textarea
              value={watchForReason}
              onChange={(event) => setWatchForReason(event.target.value)}
              placeholder="Why this fieldwork matters"
              rows={3}
              data-testid="investigation-watch-for-reason"
              className="w-full resize-none rounded-[10px] border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-cyan/40"
            />
            <button
              type="button"
              data-testid="investigation-watch-for-submit"
              onClick={() => void handleCreateWatchFor()}
              disabled={isPending || !watchForPrompt.trim() || !watchForReason.trim() || isClosed}
              className="rounded-[9px] bg-cyan px-3 py-2 text-[12px] font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
            >
              Create watch-for
            </button>
          </div>
        </div>

        <div className="rounded-[12px] border border-white/10 bg-black/15 p-4 xl:col-span-2">
          <div className="label-meta text-meta">Outcome and closure</div>
          <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_70%)]">
            Save the durable outcome before you close the investigation. Closure respects the
            existing lifecycle contract instead of skipping hidden state transitions.
          </p>
          <textarea
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            rows={4}
            data-testid="investigation-outcome-input"
            placeholder="What outcome has this investigation reached?"
            className="mt-3 w-full resize-none rounded-[10px] border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-cyan/40"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              data-testid="investigation-outcome-save"
              onClick={() => void handleSaveOutcome()}
              disabled={isPending || !outcome.trim()}
              className="rounded-[9px] border border-cyan/25 px-3 py-2 text-[12px] font-medium text-cyan transition hover:bg-cyan/10 disabled:opacity-50"
            >
              Save outcome
            </button>
            {transitions.map((transition) => (
              <button
                key={transition.nextStatus}
                type="button"
                data-testid={`investigation-transition-${transition.nextStatus}`}
                onClick={() => void handleTransition(transition.nextStatus)}
                disabled={isPending || isClosed}
                className="rounded-[9px] bg-cyan px-3 py-2 text-[12px] font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
              >
                {transition.label}
              </button>
            ))}
          </div>
          {isClosed ? (
            <p className="mt-3 text-[12px] text-[hsl(216_11%_70%)]">
              This investigation is closed. Reopening is not exposed on this production surface.
            </p>
          ) : null}
          {status === "resolved" ? (
            <div className="mt-3">
              <Link
                href={`/active-questions/${encodeURIComponent(investigationId)}`}
                className="text-[12px] text-cyan hover:underline"
              >
                Reload the closed investigation detail
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
