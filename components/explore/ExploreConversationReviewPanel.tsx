"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Clock3, Pencil, X } from "lucide-react";

import type {
  ExploreConversationReviewItem,
  ExploreConversationReviewItemsResponse,
  ExploreConversationReviewKind,
  ExploreConversationReviewStatus,
} from "@/lib/explore-conversation-review-types";

type LoadState = "idle" | "loading" | "ready" | "error";

type ExploreConversationReviewPanelProps = {
  sessionId: string | null;
  refreshKey: number;
  variant?: "strip" | "inspector";
};

const KIND_LABELS: Record<ExploreConversationReviewKind, string> = {
  receipt_extracted: "Receipt",
  context_profile_update: "Draft context update",
  active_question_proposed: "Draft active question",
  model_update_candidate: "Possible movement",
  fieldwork_suggestion: "Watch-for suggestion",
  pattern_signal: "Pattern signal",
  contradiction_signal: "Contradiction signal",
};

const STATUS_LABELS: Record<ExploreConversationReviewStatus, string> = {
  draft: "Draft",
  needs_review: "Needs review",
  confirmed: "Confirmed",
  rejected: "Rejected",
  deferred: "Deferred",
};

function getStatusLabel(status: ExploreConversationReviewStatus): string {
  return STATUS_LABELS[status] ?? "Draft";
}

function getKindLabel(kind: ExploreConversationReviewKind): string {
  return KIND_LABELS[kind] ?? "Review item";
}

export function ExploreConversationReviewPanel({
  sessionId,
  refreshKey,
  variant = "strip",
}: ExploreConversationReviewPanelProps) {
  const [items, setItems] = useState<ExploreConversationReviewItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!sessionId) {
      setItems([]);
      setLoadState("idle");
      setErrorMessage(null);
      return;
    }

    const load = async () => {
      setLoadState("loading");
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/explore/sessions/${encodeURIComponent(sessionId)}/review-items`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (cancelled) {
          return;
        }

        if (response.status === 404) {
          setItems([]);
          setLoadState("ready");
          return;
        }

        if (!response.ok) {
          throw new Error("Conversation review is unavailable.");
        }

        const payload = (await response.json()) as ExploreConversationReviewItemsResponse;
        if (cancelled) {
          return;
        }

        setItems(Array.isArray(payload.items) ? payload.items : []);
        setLoadState("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setItems([]);
        setLoadState("error");
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : "Conversation review is unavailable."
        );
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, sessionId]);

  const visibleItems = useMemo(
    () => items.slice(0, variant === "strip" ? 3 : 5),
    [items, variant]
  );

  if (!sessionId) {
    return null;
  }

  if (loadState === "loading") {
    return <ReviewShell variant={variant} body="Checking conversation review…" />;
  }

  if (loadState === "error") {
    return (
      <ReviewShell
        variant={variant}
        body={errorMessage ?? "Conversation review is unavailable."}
      />
    );
  }

  if (visibleItems.length === 0) {
    return <ReviewShell variant={variant} body="No proposed updates from this conversation yet." />;
  }

  return (
    <section className={variant === "strip" ? "card-surfaced p-4" : "space-y-3"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label-meta text-cyan/75 mb-1">Conversation Review</div>
          <h3 className="text-[13.5px] font-medium">Review possible updates from this conversation</h3>
          <p className="text-[12px] text-meta mt-1 leading-relaxed">
            These are drafts until you confirm them. Published model movement appears separately.
          </p>
        </div>
        <div className="label-meta shrink-0 px-2 py-1 rounded bg-white/[0.04]">
          {items.length} draft{items.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {visibleItems.map((item) => (
          <ReviewItemCard key={item.id} item={item} variant={variant} />
        ))}
      </div>

      {items.length > visibleItems.length ? (
        <div className="label-meta mt-3">Showing {visibleItems.length} of {items.length} review items.</div>
      ) : null}
    </section>
  );
}

function ReviewShell({
  variant,
  body,
}: {
  variant: "strip" | "inspector";
  body: string;
}) {
  return (
    <section className={variant === "strip" ? "card-surfaced p-4" : "card-standard p-3"}>
      <div className="label-meta text-cyan/75 mb-1">Conversation Review</div>
      <div className="text-[12.5px] text-meta leading-relaxed">{body}</div>
      <div className="text-[11.5px] text-meta-deep mt-2 leading-relaxed">
        Published model movement appears separately.
      </div>
    </section>
  );
}

function ReviewItemCard({
  item,
  variant,
}: {
  item: ExploreConversationReviewItem;
  variant: "strip" | "inspector";
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="label-meta text-cyan/75">{getKindLabel(item.kind)}</span>
            <span className="label-meta px-1.5 py-0.5 rounded bg-white/[0.04]">
              {getStatusLabel(item.status)}
            </span>
          </div>
          <div className="text-[13px] leading-snug line-clamp-2">{item.title}</div>
        </div>
        {item.confidenceLabel ? (
          <span className="label-meta shrink-0 hidden sm:inline">{item.confidenceLabel}</span>
        ) : null}
      </div>

      <p className="text-[12.5px] text-meta leading-relaxed mt-2 line-clamp-3">
        {item.summary}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {item.sourceLabel ? <Chip>{item.sourceLabel}</Chip> : null}
        {item.linkedObjectLabel ? (
          item.linkedObjectHref ? (
            <Link href={item.linkedObjectHref} className="label-meta px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.07] transition-colors">
              {item.linkedObjectLabel}
            </Link>
          ) : (
            <Chip>{item.linkedObjectLabel}</Chip>
          )
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <DisabledAction icon={<Check className="h-3 w-3" strokeWidth={1.5} />} label="Confirm" />
        <DisabledAction icon={<Pencil className="h-3 w-3" strokeWidth={1.5} />} label="Edit" />
        <DisabledAction icon={<X className="h-3 w-3" strokeWidth={1.5} />} label="Reject" />
        {variant === "inspector" ? (
          <span className="label-meta ml-1 inline-flex items-center gap-1 text-meta-deep">
            <Clock3 className="h-3 w-3" strokeWidth={1.5} /> actions coming later
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="label-meta px-2 py-1 rounded bg-white/[0.04]">{children}</span>;
}

function DisabledAction({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Review actions coming later"
      className="label-meta inline-flex items-center gap-1.5 px-2 py-1 rounded border border-white/[0.06] opacity-45 cursor-not-allowed"
    >
      {icon}
      {label}
    </button>
  );
}
