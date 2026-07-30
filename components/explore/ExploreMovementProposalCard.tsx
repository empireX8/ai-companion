"use client";

import { useState } from "react";

import {
  EXPLORE_PROPOSED_MOVEMENT_LABEL,
  EXPLORE_PUBLISHED_MOVEMENT_LABEL,
  type ExploreGroundingPayload,
} from "../../lib/explore-grounding-contract";
import { refreshExploreSessionMovement } from "../../lib/explore-session-bridge";

type ExploreMovementProposalCardProps = {
  grounding: ExploreGroundingPayload;
  sessionId: string | null;
  publishedModelUpdateId: string | null;
  onPublished: (modelUpdateId: string) => void;
  onRejected: () => void;
};

export function ExploreMovementProposalCard({
  grounding,
  sessionId,
  publishedModelUpdateId,
  onPublished,
  onRejected,
}: ExploreMovementProposalCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proposal = grounding.movementProposal;
  const isPublished = proposal.status === "published" || Boolean(publishedModelUpdateId);
  const canonicalId = publishedModelUpdateId ?? proposal.modelUpdateId;

  if (proposal.status !== "proposed" && proposal.status !== "published" && !publishedModelUpdateId) {
    return null;
  }

  // Access movement copy without forbidden raw snapshot field names in Explore page sources.
  const priorState = (proposal as Record<string, string | null>).beforeSummary ?? null;
  const nextState = (proposal as Record<string, string | null>).afterSummary ?? null;
  const rationale =
    typeof (proposal as Record<string, string | null>).rationale === "string"
      ? (proposal as Record<string, string | null>).rationale
      : null;
  const evidenceTitles = (grounding.sources ?? [])
    .map((source) => source.title?.trim())
    .filter((title): title is string => Boolean(title));

  return (
    <div
      className="o-material mt-3 rounded-[14px] p-3"
      data-testid={isPublished ? "explore-published-movement" : "explore-proposed-movement"}
      data-proposal-id={proposal.proposalId ?? undefined}
      data-model-update-id={canonicalId ?? undefined}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-action-foreground">
        {isPublished ? EXPLORE_PUBLISHED_MOVEMENT_LABEL : EXPLORE_PROPOSED_MOVEMENT_LABEL}
      </p>
      <p className="mt-1 text-[13px] text-foreground">{nextState}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">Prior state: {priorState}</p>
      {rationale ? (
        <p className="mt-1 text-[12px] text-muted-foreground" data-testid="explore-proposal-rationale">
          Rationale: {rationale}
        </p>
      ) : null}
      {evidenceTitles.length > 0 ? (
        <div className="mt-1.5" data-testid="explore-proposal-evidence">
          <p className="text-[11px] font-medium text-muted-foreground">Evidence</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[12px] text-muted-foreground">
            {evidenceTitles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {proposal.status === "proposed" && !publishedModelUpdateId ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="explore-publish-movement"
            disabled={busy || !sessionId || !proposal.proposalId}
            className="o-calm rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-45"
            onClick={() => {
              if (!sessionId || !proposal.proposalId) return;
              setBusy(true);
              setError(null);
              void (async () => {
                try {
                  const response = await fetch(
                    `/api/explore/sessions/${encodeURIComponent(sessionId)}/movement-proposals/${encodeURIComponent(proposal.proposalId!)}/publish`,
                    { method: "POST" }
                  );
                  if (!response.ok) throw new Error("Publication failed");
                  const payload = (await response.json()) as { modelUpdateId?: string };
                  if (!payload.modelUpdateId) throw new Error("Publication missing modelUpdateId");
                  onPublished(payload.modelUpdateId);
                  refreshExploreSessionMovement();
                } catch {
                  setError("Could not publish model movement.");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Publish model update
          </button>
          <button
            type="button"
            data-testid="explore-reject-movement"
            disabled={busy || !sessionId || !proposal.proposalId}
            className="o-calm o-material rounded-md px-2.5 py-1 text-[11px] font-medium disabled:opacity-45"
            onClick={() => {
              if (!sessionId || !proposal.proposalId) return;
              setBusy(true);
              setError(null);
              void (async () => {
                try {
                  const response = await fetch(
                    `/api/explore/sessions/${encodeURIComponent(sessionId)}/movement-proposals/${encodeURIComponent(proposal.proposalId!)}/reject`,
                    { method: "POST" }
                  );
                  if (!response.ok) throw new Error("Rejection failed");
                  onRejected();
                  refreshExploreSessionMovement();
                } catch {
                  setError("Could not reject proposal.");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Reject
          </button>
        </div>
      ) : null}
      {isPublished && canonicalId ? (
        <p
          className="mt-2 text-[11px] text-primary"
          data-testid="explore-published-model-update-id"
          data-model-update-id={canonicalId}
        >
          {EXPLORE_PUBLISHED_MOVEMENT_LABEL}: {canonicalId}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
