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
import {
  EXPLORE_CHAT_EMPTY_PROMPT,
  EXPLORE_CHAT_FOOTER_NOTE,
  EXPLORE_CHAT_PLACEHOLDER,
  EXPLORE_DRAFT_REVIEW_SECTION_INTRO,
  EXPLORE_DRAFT_REVIEW_SECTION_LABEL,
  EXPLORE_GROUNDING_SECTION_INTRO,
  EXPLORE_GROUNDING_SECTION_LABEL,
  EXPLORE_HANDOFF_BANNER_LABEL,
  EXPLORE_HANDOFF_LINKED_SOURCE_LABEL,
  EXPLORE_HANDOFF_LOADING_COPY,
  EXPLORE_HANDOFF_OPEN_PATTERN_LABEL,
  EXPLORE_HANDOFF_SECTION_LABEL,
  EXPLORE_HANDOFF_UNAVAILABLE_COPY,
  EXPLORE_HANDOFF_VIEW_DECISION_LABEL,
  EXPLORE_HANDOFF_WHY_LABEL,
  EXPLORE_PAGE_INTRO,
  EXPLORE_PAGE_SUBTITLE,
  EXPLORE_PAGE_TITLE,
  EXPLORE_PUBLISHED_MOVEMENT_SECTION_INTRO,
  EXPLORE_PUBLISHED_MOVEMENT_SECTION_LABEL,
  EXPLORE_REENTRY_LINKS,
} from "@/lib/explore-surface";
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
      setHandoffError(EXPLORE_HANDOFF_UNAVAILABLE_COPY);
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
          setHandoffError(EXPLORE_HANDOFF_UNAVAILABLE_COPY);
          return;
        }

        setHandoffContext(context);
      } catch {
        if (!cancelled) {
          setHandoffContext(null);
          setHandoffError(EXPLORE_HANDOFF_UNAVAILABLE_COPY);
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
      title={EXPLORE_PAGE_TITLE}
      subtitle={EXPLORE_PAGE_SUBTITLE}
      surfaceType="explore_chat"
      sessionStorageKey={EXPLORE_CHAT_STORAGE_KEY}
      placeholder={EXPLORE_CHAT_PLACEHOLDER}
      emptyPrompt={EXPLORE_CHAT_EMPTY_PROMPT}
      assistantEyebrow={EXPLORE_PAGE_SUBTITLE}
      footerNote={EXPLORE_CHAT_FOOTER_NOTE}
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
        <div className="label-meta">{EXPLORE_HANDOFF_LOADING_COPY}</div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="ml-material flex items-center gap-3 rounded-xl px-4 py-3">
        <Compass className="h-4 w-4 text-meta" strokeWidth={1.5} />
        <div className="label-meta">{error ?? EXPLORE_HANDOFF_UNAVAILABLE_COPY}</div>
      </div>
    );
  }

  return (
    <div className="card-surfaced px-4 py-3 flex items-center gap-3">
      <Compass className="h-4 w-4 text-cyan" strokeWidth={1.5} />
      <div className="flex-1">
        <div className="label-meta text-cyan/70 mb-0.5">{EXPLORE_HANDOFF_BANNER_LABEL}</div>
        <div className="text-[13.5px]">{context.title}</div>
        <div className="label-meta mt-1">
          {toBucketLabel(context.bucket)} · {toStatusLabel(context.status)}
        </div>
      </div>
      <Link
        href={`/actions?bucket=${context.bucket}`}
        className="label-meta px-2.5 h-7 rounded bg-white/5 hover:bg-white/10 inline-flex items-center"
      >
        {EXPLORE_HANDOFF_VIEW_DECISION_LABEL}
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
        <div className="label-meta mb-3">{EXPLORE_HANDOFF_SECTION_LABEL}</div>
        <div className="card-standard p-3 text-[13px] text-meta">{EXPLORE_HANDOFF_LOADING_COPY}</div>
      </>
    );
  }

  if (!context) {
    return (
      <>
        <div className="label-meta mb-3">{EXPLORE_HANDOFF_SECTION_LABEL}</div>
        <div className="card-standard p-3 text-[13px] text-meta">
          {error ?? EXPLORE_HANDOFF_UNAVAILABLE_COPY}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="label-meta mb-3">{EXPLORE_HANDOFF_SECTION_LABEL}</div>
      <div className="card-standard p-3 mb-3">
        <div className="label-meta mb-1.5">Decision</div>
        <div className="text-[13px] leading-snug">{context.title}</div>
        <div className="text-[11.5px] text-meta mt-1">
          {toBucketLabel(context.bucket)} · {toStatusLabel(context.status)}
        </div>
      </div>
      <div className="card-standard p-3 mb-3">
        <div className="label-meta mb-1.5">{EXPLORE_HANDOFF_WHY_LABEL}</div>
        <div className="text-[13px] leading-snug">{context.whySuggested}</div>
      </div>
      <div className="card-standard p-3 mb-3">
        <div className="label-meta mb-1.5">{EXPLORE_HANDOFF_LINKED_SOURCE_LABEL}</div>
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
            {EXPLORE_HANDOFF_OPEN_PATTERN_LABEL}
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
      <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">{EXPLORE_PAGE_INTRO}</p>
      <div className="ml-material mb-3 rounded-xl p-3">
        <div className="label-meta mb-1.5">{EXPLORE_GROUNDING_SECTION_LABEL}</div>
        <div className="text-[12px] leading-relaxed text-muted-foreground">
          {EXPLORE_GROUNDING_SECTION_INTRO}
        </div>
      </div>
      <div className="ml-material mb-3 rounded-xl p-3">
        <div className="label-meta mb-1.5">{EXPLORE_DRAFT_REVIEW_SECTION_LABEL}</div>
        <div className="text-[12px] leading-relaxed text-muted-foreground">
          {EXPLORE_DRAFT_REVIEW_SECTION_INTRO}
        </div>
      </div>
      <div className="ml-material mb-3 rounded-xl p-3">
        <div className="label-meta mb-1.5">{EXPLORE_PUBLISHED_MOVEMENT_SECTION_LABEL}</div>
        <div className="text-[12px] leading-relaxed text-muted-foreground">
          {EXPLORE_PUBLISHED_MOVEMENT_SECTION_INTRO}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {EXPLORE_MOVEMENT_EMPTY_SUBCOPY}
        </p>
      </div>
      <p className="label-meta text-meta">
        Re-enter from:{" "}
        {EXPLORE_REENTRY_LINKS.map((link, index) => (
          <span key={link.href}>
            {index > 0 ? " · " : null}
            <Link href={link.href} className="hover:text-cyan transition-colors">
              {link.label}
            </Link>
          </span>
        ))}
      </p>
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
