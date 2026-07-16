"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

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

export function InvestigationCreateCard({
  onCreated,
  useRouterRefresh = true,
}: {
  onCreated?: (created: {
    id: string;
    title: string;
    organizingQuestion: string;
  }) => void;
  useRouterRefresh?: boolean;
}) {
  const { getToken } = useAuth();
  const router = useRouter();
  const { refreshAfterDurableWrite } = useDurableActionsRefresh();
  const [isPending, startTransition] = useTransition();
  const [isHydrated, setIsHydrated] = useState(false);
  const [title, setTitle] = useState("");
  const [organizingQuestion, setOrganizingQuestion] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  async function handleCreate() {
    if (!isHydrated || !title.trim() || !organizingQuestion.trim() || isPending) {
      return;
    }

    setErrorMessage(null);
    setCreatedId(null);

    const sessionToken = await getToken();
    const response = await fetch("/api/investigations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({
        title: title.trim(),
        organizingQuestion: organizingQuestion.trim(),
        status: "open",
        seedType: "user_curiosity",
        competingTheories: [],
        evidenceNeeded: [],
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { item?: { id?: string } }
      | null;

    if (!response.ok) {
      setErrorMessage(readErrorMessage(payload, "Investigation could not be created."));
      return;
    }

    const nextId = payload?.item?.id;
    if (!nextId) {
      setErrorMessage("Investigation response did not include an ID.");
      return;
    }

    setCreatedId(nextId);
    refreshAfterDurableWrite();
    onCreated?.({
      id: nextId,
      title: title.trim(),
      organizingQuestion: organizingQuestion.trim(),
    });
    setTitle("");
    setOrganizingQuestion("");
    if (useRouterRefresh) {
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <section className="card-standard mb-8 p-5" data-testid="active-questions-create-card">
      <h2 className="text-[15px] font-medium text-foreground">Create investigation</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[hsl(216_11%_70%)]">
        Open a real question tied to your account. Nothing is backfilled from reference data.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="label-meta text-meta" htmlFor="investigation-title">
            Title
          </label>
          <input
            id="investigation-title"
            data-testid="active-questions-create-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Campaign investigation question"
            className="mt-1 w-full rounded-[10px] border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-cyan/40"
          />
        </div>

        <div>
          <label className="label-meta text-meta" htmlFor="investigation-organizing-question">
            Organizing question
          </label>
          <textarea
            id="investigation-organizing-question"
            data-testid="active-questions-create-question"
            value={organizingQuestion}
            onChange={(event) => setOrganizingQuestion(event.target.value)}
            placeholder="What exactly needs to be understood?"
            rows={3}
            className="mt-1 w-full resize-none rounded-[10px] border border-white/10 bg-black/20 px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-cyan/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="active-questions-create-submit"
            onClick={() => void handleCreate()}
            disabled={!isHydrated || isPending || !title.trim() || !organizingQuestion.trim()}
            className="rounded-[9px] bg-cyan px-3 py-2 text-[12px] font-semibold text-black transition hover:brightness-105 disabled:opacity-50"
          >
            {isPending ? "Creating…" : "Create investigation"}
          </button>
          {createdId ? (
            <p
              className="text-[12px] text-cyan"
              data-testid="active-questions-create-success-id"
            >
              Created durable investigation ID: {createdId}
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <p
            className="text-[12px] text-[hsl(0_80%_70%)]"
            data-testid="active-questions-create-error"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
