"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"

import { CanonicalWorkbench } from "@/components/orvek-v0-canonical/workbench"
import { buildCanonicalLiveRuntimeData } from "@/components/orvek-v0-canonical/live-provider"
import { useOrvekHybridWorkbenchDataApi } from "@/components/orvek-workbench/useOrvekHybridWorkbenchDataApi"
import { DurableActionsRefreshProvider } from "@/lib/orvek-v0/durable-actions-context"
import { OrvekPageHandlersProvider } from "@/lib/orvek-v0/page-handlers"

function isExplorePath(pathname: string): boolean {
  return pathname === "/explore" || pathname.startsWith("/explore/")
}

/**
 * Shared production + live-candidate runtime entry.
 * Canonical presentation + live hybrid provider — one path for `/` and
 * `/dev/orvek-v0-canonical-live` (route bootstrap only differs).
 */
export function CanonicalLiveRuntimeEntry({
  syncRoutesFromPathname = true,
  testId,
}: {
  /** Production keeps URL sync; blue/green candidate forces false. */
  syncRoutesFromPathname?: boolean
  testId?: string
}) {
  const pathname = usePathname()
  const { dataApi, handlers, durableActionsRevision, refreshAfterDurableWrite } =
    useOrvekHybridWorkbenchDataApi()
  const [pendingExploreDraft, setPendingExploreDraft] = useState("")
  const liveExploreDraftHandler = handlers.explore?.onDraftChange
  const usePendingExploreDraft = isExplorePath(pathname) && !liveExploreDraftHandler

  useEffect(() => {
    if (!pendingExploreDraft || !liveExploreDraftHandler) {
      return
    }

    liveExploreDraftHandler(pendingExploreDraft)
    setPendingExploreDraft("")
  }, [liveExploreDraftHandler, pendingExploreDraft])

  const canonicalData = useMemo(() => {
    const live = buildCanonicalLiveRuntimeData(dataApi)

    if (!usePendingExploreDraft) {
      return {
        ...live,
        syncRoutesFromPathname,
      }
    }

    const readinessCopy =
      dataApi.explore?.errorMessage ??
      (dataApi.explore?.isBooting
        ? "Starting conversation…"
        : "Conversation is not ready. Reload the page.")

    return {
      ...live,
      syncRoutesFromPathname,
      explore: {
        ...(live.explore ?? {}),
        composerDraft: pendingExploreDraft,
      },
      exploreLiveDetectionCopy: readinessCopy,
    }
  }, [dataApi, pendingExploreDraft, syncRoutesFromPathname, usePendingExploreDraft])

  const pageHandlers = useMemo(() => {
    if (!usePendingExploreDraft) {
      return handlers
    }

    return {
      ...handlers,
      explore: {
        onDraftChange: setPendingExploreDraft,
        onQuickPrompt: setPendingExploreDraft,
        onComposerFocus: () => {},
      },
    }
  }, [handlers, usePendingExploreDraft])

  const body = (
    <DurableActionsRefreshProvider
      value={{
        revision: durableActionsRevision,
        refreshAfterDurableWrite,
      }}
    >
      <OrvekPageHandlersProvider value={pageHandlers}>
        <CanonicalWorkbench data={canonicalData} enableProductionBridge />
      </OrvekPageHandlersProvider>
    </DurableActionsRefreshProvider>
  )

  if (!testId) {
    return body
  }

  return <div data-testid={testId}>{body}</div>
}
