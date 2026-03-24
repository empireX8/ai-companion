"use client";

/**
 * PatternReceiptList — inline evidence receipts with progressive disclosure (P2-05)
 *
 * Collapsed by default. "Show more" toggle expands the list.
 * Each receipt shows: quote snippet, session context, and a "View in history" link.
 *
 * Does NOT open a standalone Evidence browser — inline only.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PatternReceiptView } from "@/lib/patterns-api";
import {
  RECEIPT_EMPTY,
  RECEIPT_TOGGLE_OPEN,
  RECEIPT_VIEW_IN_HISTORY,
  RECEIPT_SESSION_UNKNOWN,
  receiptToggleClosed,
  receiptSessionLabel,
} from "@/lib/trust-copy";

type Props = {
  receipts: PatternReceiptView[];
  evidenceCount: number;
};

export function PatternReceiptList({ receipts, evidenceCount }: Props) {
  const [open, setOpen] = useState(false);

  if (evidenceCount === 0) {
    return (
      <p className="text-xs text-muted-foreground/60 italic">{RECEIPT_EMPTY}</p>
    );
  }

  return (
    <div className="mt-2">
      {/* Progressive disclosure toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <span>{open ? RECEIPT_TOGGLE_OPEN : receiptToggleClosed(evidenceCount)}</span>
      </button>

      {/* Expanded receipt list */}
      {open && (
        <ul className="mt-2 space-y-2">
          {receipts.map((receipt) => (
            <li
              key={receipt.id}
              className="rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-xs"
            >
              {/* Quote snippet */}
              {receipt.quote && (
                <p className="mb-1.5 flex items-start gap-1.5 text-foreground/80">
                  <Quote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="italic line-clamp-2">{receipt.quote}</span>
                </p>
              )}

              {/* Session context + view link */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate font-mono text-[10px]">
                    {receipt.sessionId
                      ? receiptSessionLabel(receipt.sessionId.slice(-6))
                      : RECEIPT_SESSION_UNKNOWN}
                  </span>
                </div>

                {/* View in history — P2-05 */}
                <a
                  href="/chat"
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                    "bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  )}
                >
                  {RECEIPT_VIEW_IN_HISTORY}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
