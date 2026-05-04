"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";

import { SurfaceChatShell } from "../chat/_components/SurfaceChatShell";

const EXPLORE_CHAT_STORAGE_KEY = "mindlabs:explore:session-id";

export default function ExplorePage() {
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
      contextBanner={<ExploreContextBanner />}
      contextPanel={<ExploreContextPanel />}
    />
  );
}

function ExploreContextBanner() {
  return (
    <div className="card-surfaced px-4 py-3 flex items-center gap-3">
      <GitBranch className="h-4 w-4 text-cyan" strokeWidth={1.5} />
      <div className="flex-1">
        <div className="label-meta text-cyan/70 mb-0.5">Opened from Tension</div>
        <div className="text-[13.5px]">Wanting depth · Wanting space</div>
      </div>
      <Link
        href="/contradictions"
        className="label-meta px-2.5 h-7 rounded bg-white/5 hover:bg-white/10 inline-flex items-center"
      >
        View tension
      </Link>
    </div>
  );
}

function ExploreContextPanel() {
  return (
    <>
      <div className="label-meta mb-3">Context</div>
      <div className="card-standard p-3 mb-3">
        <div className="label-meta mb-1.5">Prompt</div>
        <div className="text-[13px] leading-snug">
          Explore this tension without forcing resolution.
        </div>
      </div>
      <div className="card-standard p-3 mb-3">
        <div className="label-meta mb-1.5">Related surfaces</div>
        <div className="text-[12px] text-meta">Timeline · Patterns · Contradictions</div>
      </div>
      <div className="label-meta mb-2 mt-5">References</div>
      <div className="text-[12px] text-meta">Use the Memory panel in `/chat` for full reference controls.</div>
    </>
  );
}
