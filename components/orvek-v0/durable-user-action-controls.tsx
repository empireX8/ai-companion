"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  applyUserMapCorrection,
  DURABLE_CORRECTION_CHIP_LABELS,
  isDurableWriteError,
  resolveCorrectionWriteTarget,
  submitDecisionOutcome,
  submitFieldworkCheckIn,
} from "@/lib/durable-user-actions-contract";
import type { OrvekObject } from "@/lib/orvek-v0/orvek-types";
import { useDurableActionsRefresh } from "@/lib/orvek-v0/durable-actions-context";
import { SectionLabel } from "@/components/orvek-v0/primitives";
import {
  CANONICAL_CORRECTION_HANDOFF_HINT,
  CANONICAL_CORRECTION_PROPOSE_LABEL,
  tryBuildCanonicalCorrectionHandoffFromOrvekObject,
} from "@/lib/canonical-correction-handoff";
import { useWorkbench } from "@/components/orvek-v0/store";

export function supportsCanonicalProposeCorrection(object: OrvekObject): boolean {
  return object.inspectorObjectType === "canonical_concept";
}

export function CanonicalProposeCorrectionControls({
  object,
  className,
}: {
  object: OrvekObject;
  className?: string;
}) {
  const { setPage, setCanonicalCorrectionHandoff } = useWorkbench();
  const handoff = tryBuildCanonicalCorrectionHandoffFromOrvekObject(object);

  if (!supportsCanonicalProposeCorrection(object)) {
    return null;
  }

  return (
    <section
      className={cn("mx-4 mt-5 rounded-2xl bg-secondary/40 px-4 py-3.5", className)}
      data-testid="canonical-propose-correction"
      data-shell-slot="inspector-corrections"
    >
      <SectionLabel>Correct the model</SectionLabel>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        {CANONICAL_CORRECTION_HANDOFF_HINT}
      </p>
      {handoff ? (
        <button
          type="button"
          data-testid="canonical-propose-correction-button"
          onClick={() => {
            // In-memory workbench payload is the sole SPA handoff (no authority write, no storage mirror).
            setCanonicalCorrectionHandoff(handoff);
            setPage("explore");
          }}
          className="o-calm mt-2 rounded-full bg-evidence-muted px-2.5 py-1 text-xs font-medium text-primary hover:brightness-[0.97]"
        >
          {CANONICAL_CORRECTION_PROPOSE_LABEL}
        </button>
      ) : (
        <p
          className="mt-2 text-[12px] leading-relaxed text-muted-foreground"
          data-testid="canonical-propose-correction-unavailable"
        >
          Canonical correction is unavailable until revision identity is loaded. Opening Explore
          alone does not change your model.
        </p>
      )}
    </section>
  );
}

export function DurableCorrectionControls({
  object,
  className,
}: {
  object: OrvekObject;
  className?: string;
}) {
  const { getToken } = useAuth();
  const { refreshAfterDurableWrite } = useDurableActionsRefresh();
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(
    object.userCorrectionLabel ?? null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSavedLabel(object.userCorrectionLabel ?? null);
  }, [object.id, object.userCorrectionLabel]);

  const target = resolveCorrectionWriteTarget(object);
  const originalSummary = object.summary ?? object.title;
  const originalAssertionLabel = originalSummary?.startsWith("Original assertion:")
    ? originalSummary
    : `Original assertion: ${originalSummary ?? ""}`;
  const savedCorrection = savedLabel ?? object.userCorrectionLabel ?? null;

  async function handleApply(label: string) {
    if (!target || pendingLabel) {
      return;
    }

    setPendingLabel(label);
    setErrorMessage(null);

    const result = await applyUserMapCorrection({
      conclusionId: target.conclusionId,
      label,
      originalSummary: target.originalSummary,
      correctionCount: target.correctionCount,
      sessionToken: await getToken(),
    });

    setPendingLabel(null);

    if (isDurableWriteError(result)) {
      setErrorMessage(result.error);
      return;
    }

    if (result.lastUserCorrectionLabel !== label) {
      setErrorMessage("Server did not confirm the correction label.");
      return;
    }

    if (result.summary !== originalSummary) {
      setErrorMessage("Correction must not rewrite the original assertion.");
      return;
    }

    setSavedLabel(result.lastUserCorrectionLabel);
    refreshAfterDurableWrite();
  }

  if (!target) {
    return null;
  }

  return (
    <section className={cn("mx-4 mt-5 rounded-2xl bg-secondary/40 px-4 py-3.5", className)}>
      <SectionLabel>Correct the model</SectionLabel>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        {originalAssertionLabel}
      </p>
      {savedCorrection ? (
        <p
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-evidence-muted px-2 py-1 text-xs font-medium text-primary"
          data-testid="durable-correction-recorded"
        >
          <Check className="size-3.5" />
          Recorded: “{savedCorrection}”
        </p>
      ) : null}
      {errorMessage ? (
        <p className="mt-2 text-xs text-destructive" data-testid="durable-action-error">
          {errorMessage}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {DURABLE_CORRECTION_CHIP_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            data-testid={`durable-correction-chip-${label.replace(/\s+/g, "-").toLowerCase()}`}
            onClick={() => void handleApply(label)}
            disabled={Boolean(pendingLabel)}
            className={cn(
              "o-calm rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-60",
              label === "Confirm"
                ? "bg-evidence-muted text-primary hover:brightness-[0.97]"
                : label === "This is wrong" || label === "Do not use this assumption"
                  ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
                  : "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.12)] hover:bg-accent/60"
            )}
          >
            {pendingLabel === label ? "Saving…" : label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function DurableDecisionOutcomeControls({
  object,
  className,
}: {
  object: OrvekObject;
  className?: string;
}) {
  const { getToken } = useAuth();
  const { refreshAfterDurableWrite } = useDurableActionsRefresh();
  const [note, setNote] = useState("");
  const [savedOutcome, setSavedOutcome] = useState(object.actualOutcome ?? null);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSavedOutcome(object.actualOutcome ?? null);
  }, [object.id, object.actualOutcome]);

  const canSubmit = object.type === "decision" && !savedOutcome;

  async function handleSubmit() {
    if (!canSubmit || pending) {
      return;
    }

    setPending(true);
    setErrorMessage(null);

    const result = await submitDecisionOutcome({
      actionId: object.id,
      note,
      sessionToken: await getToken(),
    });

    setPending(false);

    if (isDurableWriteError(result)) {
      setErrorMessage(result.error);
      return;
    }

    if (result.id !== object.id) {
      setErrorMessage("Outcome attached to a different decision.");
      return;
    }

    setSavedOutcome(result.note ?? note);
    refreshAfterDurableWrite();
  }

  if (object.type !== "decision") {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {savedOutcome ? (
        <p
          className="inline-flex items-center gap-1.5 text-[13px] text-primary"
          data-testid="durable-outcome-recorded"
        >
          <Check className="size-4" />
          Outcome recorded: {savedOutcome}
        </p>
      ) : (
        <>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="What happened after this decision?"
            data-testid="durable-outcome-input"
            className="w-full resize-none rounded-[9px] bg-secondary/60 px-2.5 py-2 text-[13px] text-foreground outline-none ring-1 ring-inset ring-transparent focus:bg-card focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={pending || !note.trim()}
            data-testid="durable-outcome-submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-action px-2.5 py-1.5 text-xs font-semibold text-action-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Add outcome"}
          </button>
        </>
      )}
      {errorMessage ? (
        <p className="text-xs text-destructive" data-testid="durable-action-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export function DurableFieldworkCheckInControls({
  object,
  className,
}: {
  object: OrvekObject;
  className?: string;
}) {
  const { getToken } = useAuth();
  const { refreshAfterDurableWrite } = useDurableActionsRefresh();
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState(object.checkInNote ?? null);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSavedNote(object.checkInNote ?? null);
  }, [object.id, object.checkInNote]);

  async function handleSubmit() {
    if (savedNote || pending) {
      return;
    }

    setPending(true);
    setErrorMessage(null);

    const result = await submitFieldworkCheckIn({
      fieldworkId: object.id,
      observationNote: note,
      sessionToken: await getToken(),
    });

    setPending(false);

    if (isDurableWriteError(result)) {
      setErrorMessage(result.error);
      return;
    }

    if (result.id !== object.id) {
      setErrorMessage("Check-in attached to a different fieldwork record.");
      return;
    }

    setSavedNote(result.observationNote);
    refreshAfterDurableWrite();
  }

  if (object.type !== "fieldwork") {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {savedNote ? (
        <p
          className="inline-flex items-center gap-1.5 text-[13px] text-primary"
          data-testid="durable-checkin-recorded"
        >
          <Check className="size-4" />
          Check-in saved: {savedNote}
        </p>
      ) : (
        <>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="What happened in the field?"
            data-testid="durable-checkin-input"
            className="w-full resize-none rounded-[9px] bg-secondary/60 px-2.5 py-2 text-[13px] text-foreground outline-none ring-1 ring-inset ring-transparent focus:bg-card focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={pending || !note.trim()}
            data-testid="durable-checkin-submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-action px-2.5 py-1.5 text-xs font-semibold text-action-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save check-in"}
          </button>
        </>
      )}
      {errorMessage ? (
        <p className="text-xs text-destructive" data-testid="durable-action-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export function supportsDurableCorrection(object: OrvekObject): boolean {
  return resolveCorrectionWriteTarget(object) !== null;
}
