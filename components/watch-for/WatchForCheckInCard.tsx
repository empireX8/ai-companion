"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { useDurableActionsRefresh } from "@/lib/orvek-v0/durable-actions-context";

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

export function WatchForCheckInCard({
  fieldworkId,
  observationNote,
  observationOutcome,
}: {
  fieldworkId: string;
  observationNote: string | null;
  observationOutcome: string | null;
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const { refreshAfterDurableWrite } = useDurableActionsRefresh();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState(observationNote ?? "");
  const [outcome, setOutcome] = useState(observationOutcome ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!note.trim() || isPending) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const sessionToken = await getToken();
    const response = await fetch(`/api/fieldwork/${encodeURIComponent(fieldworkId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({
        status: "active",
        observationNote: note.trim(),
        observationOutcome: outcome.trim() ? outcome.trim() : null,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setErrorMessage(readErrorMessage(payload, "Check-in could not be saved."));
      return;
    }

    setSuccessMessage(`Saved fieldwork check-in for ID: ${fieldworkId}`);
    refreshAfterDurableWrite();
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <section className="ml-material mt-4 rounded-2xl p-5" data-testid="watch-for-check-in-card">
      <div className="label-meta text-meta">Record a check-in</div>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        Save a real observation against this fieldwork ID without losing the linked investigation.
      </p>
      <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          data-testid="watch-for-check-in-note"
          placeholder="What did you notice?"
          className="w-full resize-none rounded-[10px] border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-cyan/40"
        />
        <textarea
          value={outcome}
          onChange={(event) => setOutcome(event.target.value)}
          rows={2}
          data-testid="watch-for-check-in-outcome"
          placeholder="What did that observation suggest?"
          className="w-full resize-none rounded-[10px] border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-cyan/40"
        />
        <button
          type="submit"
          data-testid="watch-for-check-in-submit"
          disabled={isPending || !note.trim()}
          className="rounded-[9px] bg-cyan px-3 py-2 text-[12px] font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save check-in"}
        </button>
      </form>

      {successMessage ? (
        <p className="mt-3 text-[12px] text-cyan" data-testid="watch-for-check-in-success">
          {successMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p
          className="mt-3 text-[12px] text-[hsl(0_80%_70%)]"
          data-testid="watch-for-check-in-error"
        >
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
