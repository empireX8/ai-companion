"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";

import { SurfaceChatShell } from "../chat/_components/SurfaceChatShell";
import { ORVEK_DEFERRED_ACTION_CLASS } from "@/lib/orvek-v0/display-contract";

const JOURNAL_CHAT_STORAGE_KEY = "mindlabs:jchat:session-id";
const TODAY_HANDOFF_KEY = "mindlabs:today-capture-handoff";

export default function JournalChatPage() {
  const [handoffText, setHandoffText] = useState<string | null>(null);

  // Check for Today capture handoff on mount
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(TODAY_HANDOFF_KEY);
      if (stored) {
        setHandoffText(stored);
        window.sessionStorage.removeItem(TODAY_HANDOFF_KEY);
      }
    } catch {
      // Ignore storage failures
    }
  }, []);

  return (
    <SurfaceChatShell
      title="Capture Life Data"
      subtitle="Low-friction evidence entry"
      surfaceType="journal_chat"
      sessionStorageKey={JOURNAL_CHAT_STORAGE_KEY}
      placeholder="Add what happened..."
      emptyPrompt={
        handoffText
          ? handoffText
          : "If something happened, capture it here."
      }
      assistantEyebrow="Capture"
      footerNote="Structure later"
      contextPanel={<JournalContextPanel />}
    />
  );
}

function JournalContextPanel() {
  return (
    <>
      <div className="label-meta mb-3">Context</div>
      <div className="card-standard p-3 mb-3">
        <div className="label-meta mb-1.5">Recent capture</div>
        <div className="text-[13px] leading-snug">Morning note from May 1</div>
        <div className="text-[11.5px] text-meta mt-1">May 1 · Calm</div>
      </div>
      <div className="card-standard p-3 mb-3">
        <div className="label-meta mb-1.5">Evidence</div>
        <div className="text-[13px] leading-snug">
          The phrase &ldquo;forward-lean&rdquo; appears in recent capture.
        </div>
      </div>
      <div className="card-surfaced p-4 mb-3">
        <div className="label-meta mb-2 text-cyan/70 flex items-center gap-2">
          <Sparkles className="h-3 w-3" strokeWidth={1.5} /> Signal surfaced
        </div>
        <div className="text-[13.5px] leading-relaxed">
          The phrase appears more than once in the current capture set.
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            disabled
            title="Patterns view is unavailable in v0"
            className={`label-meta px-2.5 h-7 rounded bg-white/5 hover:bg-white/10 inline-flex items-center gap-1 ${ORVEK_DEFERRED_ACTION_CLASS}`}
          >
            Open patterns <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="label-meta mb-2 mt-5">References</div>
      <div className="text-[12px] text-meta">Reference controls are unavailable in v0.</div>
    </>
  );
}
