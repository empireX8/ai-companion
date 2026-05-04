"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

import { SurfaceChatShell } from "../chat/_components/SurfaceChatShell";

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
      title="Journal Chat"
      subtitle="Guided reflection"
      surfaceType="journal_chat"
      sessionStorageKey={JOURNAL_CHAT_STORAGE_KEY}
      placeholder="Respond to the prompt..."
      emptyPrompt={
        handoffText
          ? handoffText
          : "Let's begin. What's been most present for you in the last 24 hours?"
      }
      assistantEyebrow="Guided reflection"
      footerNote="Reflective mode"
      contextPanel={<JournalContextPanel />}
    />
  );
}

function JournalContextPanel() {
  return (
    <>
      <div className="label-meta mb-3">Context</div>
      <div className="card-standard p-3 mb-3">
        <div className="label-meta mb-1.5">Recent entry</div>
        <div className="text-[13px] leading-snug">The shape of a quiet morning</div>
        <div className="text-[11.5px] text-meta mt-1">May 1 · Calm</div>
      </div>
      <div className="card-standard p-3 mb-3">
        <div className="label-meta mb-1.5">Memory</div>
        <div className="text-[13px] leading-snug">You associate &ldquo;forward-lean&rdquo; with anticipatory rumination.</div>
      </div>
      <div className="card-surfaced p-4 mb-3">
        <div className="label-meta mb-2 text-cyan/70 flex items-center gap-2">
          <Sparkles className="h-3 w-3" strokeWidth={1.5} /> Pattern surfaced
        </div>
        <div className="text-[13.5px] leading-relaxed">
          The forward-lean has appeared repeatedly this week, often before unstructured time.
        </div>
        <div className="flex gap-2 mt-3">
          <Link
            href="/patterns"
            className="label-meta px-2.5 h-7 rounded bg-white/5 hover:bg-white/10 inline-flex items-center gap-1"
          >
            Open patterns <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <div className="label-meta mb-2 mt-5">References</div>
      <div className="text-[12px] text-meta">Use the Memory panel in `/chat` for full reference controls.</div>
    </>
  );
}
