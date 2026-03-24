"use client";

/**
 * ReflectionCapture — minimal post-action reflection input (P2.5-06)
 *
 * Shown after "Done". Optional text field, max 200 chars.
 * "Skip" saves without a note. No coaching prompts, no mandatory fields.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PatternClaimActionView } from "@/lib/patterns-api";
import { updateClaimAction } from "@/lib/patterns-api";
import { REFLECTION_LABEL, REFLECTION_PLACEHOLDER } from "@/lib/trust-copy";

type Props = {
  actionId: string;
  existingNote: string | null;
  onSaved: (updated: PatternClaimActionView) => void;
};

const MAX_NOTE_LEN = 200;

export function ReflectionCapture({ actionId, existingNote, onSaved }: Props) {
  const [note, setNote] = useState(existingNote ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (noteText: string) => {
    setSaving(true);
    const updated = await updateClaimAction(actionId, {
      status: "completed",
      outcomeSignal: "helpful",
      reflectionNote: noteText.trim() || undefined,
    });
    setSaving(false);
    if (updated) onSaved(updated);
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        {REFLECTION_LABEL} <span className="text-muted-foreground/60">(optional)</span>
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LEN))}
        placeholder={REFLECTION_PLACEHOLDER}
        rows={2}
        className={cn(
          "w-full resize-none rounded-md border border-border/60 bg-background px-2.5 py-1.5",
          "text-xs text-foreground placeholder:text-muted-foreground/50",
          "focus:outline-none focus:ring-1 focus:ring-primary/40"
        )}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => save(note)}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
            "bg-primary/15 text-primary hover:bg-primary/25",
            saving && "opacity-50 cursor-not-allowed"
          )}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => save("")}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip
        </button>
        {note.length > MAX_NOTE_LEN * 0.9 && (
          <span className="ml-auto text-[10px] text-muted-foreground/60">
            {MAX_NOTE_LEN - note.length} left
          </span>
        )}
      </div>
    </div>
  );
}
