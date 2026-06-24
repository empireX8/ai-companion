"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Compass, Loader2 } from "lucide-react";

import { fetchActionsPageData } from "@/lib/actions-api";
import {
  EXPLORE_ACTION_ID_PARAM,
  parseExploreActionIdParam,
  resolveExploreActionHandoffContext,
  type ExploreActionHandoffContext,
} from "@/lib/explore-action-handoff";
import { EXPLORE_MOVEMENT_EMPTY_SUBCOPY } from "@/lib/explore-session-model-updates";
import {
  refreshExploreSessionMovement,
  setExploreSessionBridgeSessionId,
} from "@/lib/explore-session-bridge";
import { ExploreModelMovementStrip } from "@/components/explore/ExploreModelMovementStrip";
import { ExploreConversationReviewStrip } from "@/components/explore/ExploreConversationReviewStrip";
import { useInspector } from "@/components/inspector/InspectorContext";
import { ORVEK_COPY } from "@/lib/trust-language";
import { SurfaceChatShell } from "../chat/_components/SurfaceChatShell";

const EXPLORE_CHAT_STORAGE_KEY = "mindlabs:explore:session-id";

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const rawActionId = searchParams.get(EXPLORE_ACTION_ID_PARAM);
  const parsedActionId = useMemo(
    () => parseExploreActionIdParam(rawActionId),
    [rawActionId]
  );
  const hasActionHandoffRequest = rawActionId !== null;

  const [handoffContext, setHandoffContext] =
    useState<ExploreActionHandoffContext | null>(null);
  const [isLoadingHandoff, setIsLoadingHandoff] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const handleConversationUpdated = useCallback(() => {
    refreshExploreSessionMovement();
  }, []);

  useEffect(() => {
    setExploreSessionBridgeSessionId(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    return () => {
      setExploreSessionBridgeSessionId(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!hasActionHandoffRequest) {
      setHandoffContext(null);
      setHandoffError(null);
      setIsLoadingHandoff(false);
      return;
    }

    if (!parsedActionId) {
      setHandoffContext(null);
      setHandoffError("Action handoff is unavailable.");
      setIsLoadingHandoff(false);
      return;
    }

    const load = async () => {
      setIsLoadingHandoff(true);
      setHandoffError(null);

      try {
        const data = await fetchActionsPageData();
        if (cancelled) {
          return;
        }

        const context = resolveExploreActionHandoffContext(data, parsedActionId);
        if (!context) {
          setHandoffContext(null);
          setHandoffError("Action handoff is unavailable.");
          return;
        }

        setHandoffContext(context);
      } catch {
        if (!cancelled) {
          setHandoffContext(null);
          setHandoffError("Action handoff is unavailable.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHandoff(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [hasActionHandoffRequest, parsedActionId]);

  const contextBanner = hasActionHandoffRequest ? (
    <ExploreActionHandoffBanner
      context={handoffContext}
      isLoading={isLoadingHandoff}
      error={handoffError}
    />
  ) : null;

  const contextPanel = hasActionHandoffRequest ? (
    <ExploreActionHandoffPanel
      context={handoffContext}
      isLoading={isLoadingHandoff}
      error={handoffError}
    />
  ) : (
    <ExploreDefaultContextPanel />
  );

  return (
    <SurfaceChatShell
      title="Explore"
      subtitle="Open reflection"
      surfaceType="explore_chat"
      sessionStorageKey={EXPLORE_CHAT_STORAGE_KEY}
      placeholder="Bring anything..."
      emptyPrompt="What feels most important to explore right now?"
      assistantEyebrow="Open reflection"
      footerNote="Saves automatically"
      contextBanner={contextBanner}
      contextPanel={contextPanel}
      sessionAccessory={
        <div className="space-y-2">
          <ExploreModelMovementStrip />
          <ExploreConversationReviewStrip />
        </div>
      }
      onActiveSessionIdChange={setActiveSessionId}
      onConversationUpdated={handleConversationUpdated}
    />
  );
}

function ExploreActionHandoffBanner({
  context,
  isLoading,
  error,
}: {
  context: ExploreActionHandoffContext | null;
  isLoading: boolean;
  error: string | null;
}) {
  if (isLoading) {
    return (
      <div className="ml-material flex items-center gap-3 rounded-xl px-4 py-3">
        <Loader2 className="h-4 w-4 text-cyan animate-spin" strokeWidth={1.5} />
        <div className="label-meta">Loading action handoff...</div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="ml-material flex items-center gap-3 rounded-xl px-4 py-3">
        <Compass className="h-4 w-4 text-meta" strokeWidth={1.5} />
        <div className="label-meta">{error ?? "Action handoff is unavailable."}</div>
      </div>
    );
  }

  return (
    <div className="card-surfaced px-4 py-3 flex items-center gap-3">
      <Compass className="h-4 w-4 text-cyan" strokeWidth={1.5} />
      <div className="flex-1">
        <div className="label-meta text-cyan/70 mb-0.5">Opened from Action</div>
        <div className="text-[13.5px]">{context.title}</div>
        <div className="label-meta mt-1">
          {toBucketLabel(context.bucket)} · {toStatusLabel(context.status)}
        </div>
      </div>
      <Link
        href={`/actions?bucket=${context.bucket}`}
        className="label-meta px-2.5 h-7 rounded bg-white/5 hover:bg-white/10 inline-flex items-center"
      >
        View action
      </Link>
    </div>
  );
}

function ExploreActionHandoffPanel({
  context,
  isLoading,
  error,
}: {
  context: ExploreActionHandoffContext | null;
  isLoading: boolean;
  error: string | null;
}) {
  const { selectObject } = useInspector();

  if (isLoading) {
    return (
      <>
        <div className="label-meta mb-3">Handoff context</div>
        <div className="card-standard p-3 text-[13px] text-meta">Loading action handoff...</div>
      </>
    );
  }

  if (!context) {
    return (
      <>
        <div className="label-meta mb-3">Handoff context</div>
        <div className="card-standard p-3 text-[13px] text-meta">
          {error ?? "Action handoff is unavailable."}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="label-meta mb-3">Handoff context</div>
      <div className="card-standard p-3 mb-3">
        <div className="label-meta mb-1.5">Action</div>
        <div className="text-[13px] leading-snug">{context.title}</div>
        <div className="text-[11.5px] text-meta mt-1">
          {toBucketLabel(context.bucket)} · {toStatusLabel(context.status)}
        </div>
      </div>
      <div className="card-standard p-3 mb-3">
        <div className="label-meta mb-1.5">Why this was suggested</div>
        <div className="text-[13px] leading-snug">{context.whySuggested}</div>
      </div>
      <div className="card-standard p-3 mb-3">
        <div className="label-meta mb-1.5">Linked source</div>
        <div className="text-[13px] leading-snug">
          {context.linkedClaimSummary ?? context.linkedSourceLabel}
        </div>
        {context.linkedClaimId ? (
          <button
            type="button"
            onClick={() => {
              selectObject({
                objectType: "pattern_claim",
                objectId: context.linkedClaimId!,
                title: context.linkedClaimSummary ?? context.title,
                sourceSurface: "explore",
                tab: "evidence",
              });
            }}
            className="mt-2 label-meta inline-flex items-center gap-1.5 text-meta hover:text-cyan transition-colors"
          >
            Open linked pattern in Inspector
          </button>
        ) : null}
      </div>
    </>
  );
}

function ExploreDefaultContextPanel() {
  return (
    <>
      <div className="label-meta mb-3">Context</div>
      <div className="ml-material mb-3 rounded-xl p-3">
        <div className="label-meta mb-1.5">Mode</div>
        <div className="text-[13px] leading-snug">
          Open reflection without a preset handoff.
        </div>
      </div>
      <div className="ml-material mb-3 rounded-xl p-3">
        <div className="label-meta mb-1.5">Conversation review</div>
        <div className="text-[12px] leading-relaxed text-muted-foreground">
          Draft review items from this conversation appear above the chat. Published
          movement is shown separately in the strip above and in Inspector → {ORVEK_COPY.mindModelMovementTab}.
        </div>
      </div>
      <div className="ml-material mb-3 rounded-xl p-3">
        <div className="label-meta mb-1.5">{ORVEK_COPY.mindModelMovement}</div>
        <div className="text-[12px] leading-relaxed text-muted-foreground">
          Published movement from this conversation appears above the chat and in the
          Inspector → {ORVEK_COPY.mindModelMovementTab} tab.
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {EXPLORE_MOVEMENT_EMPTY_SUBCOPY}
        </p>
      </div>
    </>
  );
}

function toBucketLabel(bucket: ExploreActionHandoffContext["bucket"]): string {
  return bucket === "build" ? "Build Forward" : "Stabilize Now";
}

function toStatusLabel(status: ExploreActionHandoffContext["status"]): string {
  if (status === "done") return "Done";
  if (status === "helped") return "Helped";
  if (status === "didnt_help") return "Didn't help";
  return "Not started";
}
