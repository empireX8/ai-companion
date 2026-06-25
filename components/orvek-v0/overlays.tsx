"use client"

import { useMemo, useState } from "react"
import { getObject, OBJECTS } from "@/lib/orvek-v0/mock-orvek-data"
import type { OrvekObject } from "@/lib/orvek-v0/orvek-types"
import { useWorkbench } from "./store"
import { Chip, SectionLabel, TypeBadge, TYPE_META } from "./primitives"
import {
  ArrowRight,
  Camera,
  Check,
  FileText,
  Search as SearchIcon,
  Upload,
  X,
} from "lucide-react"

/* ───────────────────────── Shell ───────────────────────── */

function OverlayShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/25 p-4 backdrop-blur-md sm:p-8">
      <div
        className={`o-sheet o-raised relative my-auto w-full ${
          wide ? "max-w-3xl" : "max-w-xl"
        } rounded-[14px]`}
      >
        <div className="flex items-start justify-between gap-4 border-b o-hairline px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t o-hairline px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="o-calm inline-flex items-center gap-1.5 rounded-[8px] bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:brightness-[1.05] active:scale-[0.98]"
    >
      {children}
    </button>
  )
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
    >
      {children}
    </button>
  )
}

/* ───────────────────────── Capture ───────────────────────── */

function CaptureOverlay({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("")
  const [stage, setStage] = useState<"input" | "saved">("input")

  if (stage === "saved") {
    return (
      <OverlayShell title="Captured" onClose={onClose}>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-evidence-muted text-primary">
            <Check className="size-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">Receipt added to your model.</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
            Orvek will read it in the background. If it touches an active loop or decision, it
            shows up on Today — nothing is interpreted out loud yet.
          </p>
          <div className="mt-4 flex gap-2">
            <GhostButton onClick={onClose}>Done</GhostButton>
            <PrimaryButton
              onClick={() => {
                setText("")
                setStage("input")
              }}
            >
              Capture another
            </PrimaryButton>
          </div>
        </div>
      </OverlayShell>
    )
  }

  return (
    <OverlayShell
      title="Capture a receipt"
      subtitle="One thought, exactly as you said it. No structure required — Orvek keeps the raw words and reads them later."
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => text.trim() && setStage("saved")}>
            <Camera className="size-4" />
            Capture
          </PrimaryButton>
        </>
      }
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What did you just notice, say, or decide?"
        className="h-32 w-full resize-none rounded-lg border border-border bg-background px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
      />
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Optional tag:</span>
        {["Launch", "Decision", "Loop", "Visual feedback"].map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Stored verbatim as evidence. Your words stay the source of truth — interpretations are
        always shown separately and labeled.
      </p>
    </OverlayShell>
  )
}

/* ───────────────────────── Import Review ───────────────────────── */

const IMPORT_CANDIDATES: {
  id: string
  raw: string
  proposed: string
  type: OrvekObject["type"]
  confidence: "high" | "medium" | "low"
}[] = [
  {
    id: "ic1",
    raw: "I keep reopening the design instead of shipping it.",
    proposed: "Repeated loop: reopening before shipping",
    type: "map-object",
    confidence: "high",
  },
  {
    id: "ic2",
    raw: "I want to see everything expressed before I commit.",
    proposed: "Belief: completeness precedes commitment",
    type: "context",
    confidence: "high",
  },
  {
    id: "ic3",
    raw: "Maybe a small public test would help.",
    proposed: "Open question: would a narrow public test break the loop?",
    type: "active-question",
    confidence: "medium",
  },
  {
    id: "ic4",
    raw: "Colours aren't the point right now.",
    proposed: "Receipt only — no model change",
    type: "receipt",
    confidence: "low",
  },
]

function ImportOverlay({ onClose }: { onClose: () => void }) {
  const source = getObject("imp-1")
  const [decisions, setDecisions] = useState<Record<string, "accept" | "reject">>({})

  const accepted = Object.values(decisions).filter((d) => d === "accept").length
  const reviewed = Object.keys(decisions).length

  return (
    <OverlayShell
      title="Review import"
      subtitle={source?.reportSummary}
      onClose={onClose}
      wide
      footer={
        <>
          <span className="mr-auto text-xs text-muted-foreground">
            {reviewed} of {IMPORT_CANDIDATES.length} reviewed · {accepted} accepted
          </span>
          <GhostButton onClick={onClose}>Save for later</GhostButton>
          <PrimaryButton onClick={onClose}>
            Add {accepted} to model
          </PrimaryButton>
        </>
      }
    >
      <p className="mb-3 text-sm leading-relaxed text-muted-foreground text-pretty">
        Orvek proposes what each fragment might mean. Nothing enters your model until you accept
        it — the raw words stay either way.
      </p>
      <div className="flex flex-col gap-2.5">
        {IMPORT_CANDIDATES.map((c) => {
          const state = decisions[c.id]
          return (
            <div
              key={c.id}
              className={`rounded-lg border px-3.5 py-3 transition-colors ${
                state === "accept"
                  ? "border-primary/40 bg-evidence-muted/50"
                  : state === "reject"
                    ? "border-border bg-secondary/40 opacity-60"
                    : "border-border bg-background"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SectionLabel>Their words</SectionLabel>
                  <p className="mt-0.5 text-sm leading-relaxed text-foreground">
                    &ldquo;{c.raw}&rdquo;
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    c.confidence === "high"
                      ? "bg-evidence-muted text-primary"
                      : c.confidence === "medium"
                        ? "bg-action-muted text-action-foreground"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {c.confidence} confidence
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-2 rounded-md bg-secondary/60 px-2.5 py-2">
                <TypeBadge type={c.type} />
                <span className="text-sm text-foreground text-pretty">{c.proposed}</span>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={() =>
                    setDecisions((p) => ({ ...p, [c.id]: "accept" }))
                  }
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    state === "accept"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  <Check className="size-3.5" />
                  Accept
                </button>
                <button
                  onClick={() =>
                    setDecisions((p) => ({ ...p, [c.id]: "reject" }))
                  }
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    state === "reject"
                      ? "bg-foreground text-background"
                      : "border border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  <X className="size-3.5" />
                  Keep as receipt only
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </OverlayShell>
  )
}

/* ───────────────────────── Search ───────────────────────── */

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { select } = useWorkbench()
  const [q, setQ] = useState("")

  const results = useMemo(() => {
    const all = Object.values(OBJECTS)
    if (!q.trim()) {
      return all.filter((o) =>
        ["m-loop-1", "d1", "ctx-current", "mu-1", "r5"].includes(o.id),
      )
    }
    const term = q.toLowerCase()
    return all
      .filter(
        (o) =>
          o.title.toLowerCase().includes(term) ||
          o.summary?.toLowerCase().includes(term) ||
          o.sourceText?.toLowerCase().includes(term) ||
          o.tags?.some((t) => t.toLowerCase().includes(term)),
      )
      .slice(0, 12)
  }, [q])

  return (
    <OverlayShell
      title="Search the model"
      subtitle="Find any object — receipts, loops, decisions, questions, context, reports."
      onClose={onClose}
      wide
    >
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 focus-within:border-ring">
        <SearchIcon className="size-4 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search words, beliefs, decisions…"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="mt-3">
        <SectionLabel>{q.trim() ? `${results.length} results` : "Suggested"}</SectionLabel>
        <div className="mt-2 flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
          {results.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                select(o.id)
                onClose()
              }}
              className="flex items-start gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-border hover:bg-secondary/60"
            >
              <span className="mt-0.5">
                <TypeBadge type={o.type} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground text-pretty">
                  {o.title}
                </span>
                {o.summary && (
                  <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                    {o.summary}
                  </span>
                )}
              </span>
              <span className="ml-auto mt-0.5 text-[11px] text-muted-foreground">
                {TYPE_META[o.type].label}
              </span>
            </button>
          ))}
          {results.length === 0 && (
            <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
              Nothing matches &ldquo;{q}&rdquo; yet.
            </p>
          )}
        </div>
      </div>
    </OverlayShell>
  )
}

/* ───────────────────────── Report Viewer ───────────────────────── */

function ReportOverlay({ id, onClose }: { id: string; onClose: () => void }) {
  const { select } = useWorkbench()
  const report = getObject(id)
  if (!report) return null

  const related = (report.relatedIds ?? []).map(getObject).filter(Boolean) as OrvekObject[]
  const receipts = (report.receiptIds ?? []).map(getObject).filter(Boolean) as OrvekObject[]

  return (
    <OverlayShell
      title={report.title}
      subtitle={report.reportSummary}
      onClose={onClose}
      wide
      footer={<GhostButton onClick={onClose}>Close report</GhostButton>}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-evidence-muted px-2.5 py-1 text-xs font-medium text-primary">
          <FileText className="size-3.5" />
          {report.reportType}
        </span>
        {report.period && <Chip>{report.period}</Chip>}
        <Chip>{report.evidenceCount ?? related.length} pieces of evidence</Chip>
        {report.lastUpdated && (
          <span className="ml-auto text-xs text-muted-foreground">
            Updated {report.lastUpdated}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-foreground text-pretty">{report.summary}</p>

      {receipts.length > 0 && (
        <div className="mt-4">
          <SectionLabel>Receipts cited</SectionLabel>
          <div className="mt-2 flex flex-col gap-1.5">
            {receipts.map((r) => (
              <blockquote
                key={r.id}
                className="rounded-md border-l-2 border-primary/50 bg-secondary/50 px-3 py-2 text-sm italic leading-relaxed text-foreground"
              >
                &ldquo;{r.sourceText ?? r.title}&rdquo;
              </blockquote>
            ))}
          </div>
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-4">
          <SectionLabel>What this report points to</SectionLabel>
          <div className="mt-2 flex flex-col gap-1.5">
            {related.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  select(o.id)
                  onClose()
                }}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-secondary/60"
              >
                <TypeBadge type={o.type} />
                <span className="min-w-0 text-sm text-foreground text-pretty">{o.title}</span>
                <ArrowRight className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 rounded-md bg-action-muted/60 px-3 py-2 text-xs leading-relaxed text-action-foreground">
        A report is a generated read of your model at a moment in time. It never replaces your
        words — every claim links back to the evidence it came from.
      </p>
    </OverlayShell>
  )
}

/* ───────────────────────── Mount point ───────────────────────── */

export function Overlays() {
  const { overlay, setOverlay, reportId, openReport } = useWorkbench()

  if (reportId) {
    return <ReportOverlay id={reportId} onClose={() => openReport(null)} />
  }

  switch (overlay) {
    case "capture":
      return <CaptureOverlay onClose={() => setOverlay(null)} />
    case "import":
      return <ImportOverlay onClose={() => setOverlay(null)} />
    case "search":
      return <SearchOverlay onClose={() => setOverlay(null)} />
    default:
      return null
  }
}
