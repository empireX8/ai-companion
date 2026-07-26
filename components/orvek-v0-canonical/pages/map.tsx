"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useCanonicalData } from "@/components/orvek-v0-canonical/canonical-data-context"
import { minimumPermanentSlots } from "@/components/orvek-v0-canonical/permanent-presentation"
import { useWorkbench } from "@/components/orvek-v0/store"
import { MapPageHeaderStats } from "@/components/orvek-v0/MapPageHeaderStats"
import { SectionLabel, TYPE_META } from "@/components/orvek-v0/primitives"
import { useOrvekData } from "@/lib/orvek-v0/data-provider"
import { profileSectionMappingForObject } from "@/lib/map-profile-facts"
import {
  AlertTriangle,
  Compass,
  GitCompareArrows,
  HelpCircle,
  Repeat,
  Sparkles,
  Target,
  User,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

const MAP_CATEGORY_SHELLS: {
  id: string
  label: string
  icon: LucideIcon
  minimumRows: number
}[] = [
  { id: "patterns", label: "Patterns", icon: Repeat, minimumRows: 3 },
  { id: "claims", label: "Claims", icon: Compass, minimumRows: 3 },
  { id: "conflicts", label: "Active conflicts", icon: AlertTriangle, minimumRows: 4 },
  { id: "goals", label: "Goals / directions", icon: Target, minimumRows: 3 },
  { id: "context", label: "Background / Context", icon: User, minimumRows: 5 },
  { id: "questions", label: "Active questions", icon: HelpCircle, minimumRows: 4 },
  { id: "updates", label: "Model updates", icon: Sparkles, minimumRows: 5 },
  { id: "uncertainty", label: "Uncertainty", icon: HelpCircle, minimumRows: 3 },
]

const CORRECTIONS = [
  "Confirm",
  "This is wrong",
  "Missing context",
  "Only true here",
  "Used to be true",
  "Don't use this",
]

export function MapPage() {
  const { select, applyCorrection, corrections, setInspectorTab } = useWorkbench()
  const { getObject, getObjects, mapCategories, mapDefaultSelectedId } = useCanonicalData()
  const data = useOrvekData()
  const { mapHeader } = data
  const [localId, setLocalId] = useState(mapDefaultSelectedId)

  const obj = getObject(localId)
  const related = obj ? getObjects(obj.relatedIds) : []
  const correction = obj ? corrections[obj.id] : undefined
  const isLoading = data.mapIsLoading === true
  const supporting = minimumPermanentSlots(obj?.supporting, 2)
  const conflicting = minimumPermanentSlots(obj?.conflicting, 1)
  const relatedSlots = minimumPermanentSlots(related, 3)
  const permanentCategories = [
    ...MAP_CATEGORY_SHELLS.map((shell) => {
      const live = mapCategories.find((category) => category.id === shell.id)
      return {
        ...shell,
        label: live?.label || shell.label,
        icon: live?.icon ?? shell.icon,
        liveCount: live?.ids.length ?? 0,
        ids: minimumPermanentSlots(live?.ids, shell.minimumRows),
      }
    }),
    ...mapCategories
      .filter((category) => !MAP_CATEGORY_SHELLS.some((shell) => shell.id === category.id))
      .map((category) => ({
        ...category,
        minimumRows: 0,
        liveCount: category.ids.length,
        ids: minimumPermanentSlots(category.ids, 0),
      })),
  ]

  useEffect(() => {
    if (!obj && mapDefaultSelectedId && getObject(mapDefaultSelectedId)) {
      setLocalId(mapDefaultSelectedId)
    }
  }, [getObject, mapDefaultSelectedId, obj])

  function open(id: string) {
    setLocalId(id)
    select(id)
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-shell-page="map">
      {/* header */}
      <div className="px-6 pt-5 pb-4 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Map</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              What Orvek currently understands — evidence-backed and correctable.
            </p>
          </div>
          <MapPageHeaderStats
            confidenceLabel={mapHeader?.confidenceLabel?.trim() || "—"}
            receiptsLabel={mapHeader?.receiptsLabel?.trim() || "0"}
            openQuestionsLabel={mapHeader?.openQuestionsLabel?.trim() || "0"}
          />
        </div>
      </div>

      {/* master-detail */}
      <div
        className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr]"
        data-shell-slot="map-master-detail"
      >
        {/* object list — soft embedded rail */}
        <div
          className="o-sunken m-3 mt-0 min-h-0 overflow-y-auto rounded-2xl px-3 py-4 lg:mr-1.5"
          data-shell-slot="map-object-rail"
        >
          {permanentCategories.map((cat) => {
            const CatIcon = cat.icon
            return (
              <div key={cat.id} className="mb-4" data-shell-item="map-category">
                <div className="flex items-center gap-1.5 px-2">
                  <CatIcon className="size-3.5 text-muted-foreground" aria-hidden />
                  <SectionLabel>{cat.label}</SectionLabel>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {cat.liveCount}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {cat.ids.map((id, index) => {
                    const item = id ? getObject(id) : undefined
                    const active = Boolean(item && localId === item.id)
                    const moved = Boolean(
                      item && (item.type === "model-update" || item.before),
                    )
                    const title =
                      item?.title ||
                      (isLoading
                        ? `Loading ${cat.label.toLowerCase()}…`
                        : `No ${cat.label.toLowerCase()} item is available.`)

                    return (
                      <li key={item?.id ?? `${cat.id}-empty-${index}`}>
                        <button
                          type="button"
                          onClick={item ? () => open(item.id) : undefined}
                          disabled={!item}
                          data-shell-item="map-rail-row"
                          data-live-object-id={item?.id}
                          className={cn(
                            "o-calm flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-[13px] leading-snug disabled:cursor-default disabled:opacity-70",
                            active
                              ? "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.14)]"
                              : "text-foreground hover:bg-card/60",
                          )}
                        >
                          {active && (
                            <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-primary" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{title}</span>
                          {moved && (
                            <span
                              className="size-1.5 shrink-0 rounded-full bg-action"
                              title="Recently moved"
                            />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>

        {/* selected detail */}
        <div
          className="min-h-0 overflow-y-auto px-6 py-6 lg:px-8"
          data-shell-slot="map-detail"
        >
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
                  "bg-evidence-muted text-primary",
                )}
              >
                {(() => {
                  const Icon = obj ? TYPE_META[obj.type].icon : Compass
                  return <Icon className="size-3" aria-hidden />
                })()}
                {obj ? TYPE_META[obj.type].label : isLoading ? "Loading" : "Current item"}
              </span>
              <span className="text-xs text-muted-foreground">
                {obj?.lastUpdated
                  ? `Updated ${obj.lastUpdated}`
                  : isLoading
                    ? "Loading update status…"
                    : "Update unavailable"}
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-foreground text-balance">
              {obj?.title ||
                (isLoading ? "Loading current understanding…" : "No map item is available.")}
            </h2>

            {/* current claim */}
            <div
              className="mt-4 rounded-lg border-l-2 border-primary bg-evidence-muted/40 px-4 py-3"
              data-shell-slot="map-current-understanding"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                Current understanding
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-foreground">
                {obj?.recommendation ??
                  obj?.summary ??
                  (isLoading ? "Loading supported information…" : "Not enough information yet.")}
              </p>
            </div>

            {(() => {
              if (!obj) {
                return null
              }
              const profileSection = profileSectionMappingForObject(obj)
              if (!profileSection || data.referenceSurface === true) {
                return null
              }
              const facts = obj.profileFacts ?? []
              const heading =
                obj.profileFactsHeading ?? profileSection.factsHeading
              const emptyCopy =
                obj.profileFactsEmptyCopy ?? profileSection.emptyFactsCopy
              return (
                <div
                  className="mt-5"
                  data-testid="map-profile-facts"
                  data-profile-section={profileSection.sectionObjectId}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {heading}
                  </p>
                  {facts.length === 0 ? (
                    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                      {emptyCopy}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2.5">
                      {facts.map((fact) => (
                        <li
                          key={fact.id}
                          className="o-material rounded-[10px] px-3.5 py-3"
                          data-testid="map-profile-fact"
                          data-reference-item-id={fact.id}
                        >
                          <p className="text-[14px] leading-relaxed text-foreground text-pretty">
                            {fact.statement}
                          </p>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                            {[
                              `type: ${fact.referenceType}`,
                              `confidence: ${fact.confidence}`,
                              `provenance: ${fact.provenanceLabel}`,
                            ].join(" · ")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })()}

            <DetailBlock label="Why Orvek thinks this">
              {obj?.whyItMatters ||
                (isLoading ? "Loading why this matters…" : "Not enough information yet.")}
            </DetailBlock>

            {/* before / after */}
            {(obj?.before || obj?.after) && (
              <DetailBlock label="How this moved">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[10px] bg-muted/70 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Before
                    </p>
                    <p className="mt-0.5 text-[13px] text-foreground">{obj.before}</p>
                  </div>
                  <div className="rounded-[10px] bg-evidence-muted/70 px-3 py-2 ring-1 ring-inset ring-primary/15">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                      After
                    </p>
                    <p className="mt-0.5 text-[13px] text-foreground">{obj.after}</p>
                  </div>
                </div>
              </DetailBlock>
            )}

            {/* supporting / conflicting */}
            <div
              className="mt-5 grid gap-3 sm:grid-cols-2"
              data-shell-slot="map-evidence-pair"
            >
              <div className="o-material rounded-[10px] p-3.5">
                <SectionLabel className="text-primary">Supporting evidence</SectionLabel>
                <ul className="mt-2 space-y-1.5">
                  {supporting.map((item, index) => (
                    <li
                      key={item ?? `empty-supporting-${index}`}
                      className="flex gap-2 text-[13px] text-foreground"
                      data-shell-item="map-supporting-row"
                    >
                      <span className="mt-0.5 text-primary">+</span>
                      {item ||
                        (isLoading
                          ? "Loading supporting evidence…"
                          : "No supporting evidence is available.")}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="o-material rounded-[10px] p-3.5">
                <SectionLabel className="text-destructive/80">Conflicting evidence</SectionLabel>
                <ul className="mt-2 space-y-1.5">
                  {conflicting.map((item, index) => (
                    <li
                      key={item ?? `empty-conflicting-${index}`}
                      className="flex gap-2 text-[13px] text-muted-foreground"
                      data-shell-item="map-conflicting-row"
                    >
                      <span className="mt-0.5 text-destructive">−</span>
                      {item ||
                        (isLoading
                          ? "Loading conflicting evidence…"
                          : "No conflicting evidence is available.")}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* confidence */}
            {obj?.confidence && (
              <DetailBlock label="Confidence">
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[13px] font-medium text-secondary-foreground">
                  {obj.confidence}
                </span>
              </DetailBlock>
            )}

            {/* related */}
            <DetailBlock label="Related across the model">
              <div
                className="o-material divide-y divide-border overflow-hidden rounded-[10px]"
                data-shell-slot="map-related"
              >
                {relatedSlots.map((relatedItem, index) => {
                  const RIcon = relatedItem ? TYPE_META[relatedItem.type].icon : Compass
                  return (
                    <button
                      key={relatedItem?.id ?? `empty-related-${index}`}
                      type="button"
                      onClick={relatedItem ? () => open(relatedItem.id) : undefined}
                      disabled={!relatedItem}
                      data-shell-item="map-related-row"
                      data-live-object-id={relatedItem?.id}
                      className="o-calm group flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/40 disabled:cursor-default disabled:opacity-70"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-secondary text-primary">
                        <RIcon className="size-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {relatedItem?.title ||
                            (isLoading
                              ? "Loading related item…"
                              : "No related item is available.")}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {relatedItem ? TYPE_META[relatedItem.type].label : "Unavailable"}
                        </span>
                      </span>
                      <span className="text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        Open
                      </span>
                    </button>
                  )
                })}
              </div>
            </DetailBlock>

            {/* inspect link */}
            <button
              type="button"
              onClick={
                obj
                  ? () => {
                      select(obj.id)
                      setInspectorTab("evidence")
                    }
                  : undefined
              }
              disabled={!obj}
              data-shell-item="map-inspector-action"
              data-live-object-id={obj?.id}
              className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline disabled:cursor-default disabled:opacity-70"
            >
              <GitCompareArrows className="size-3.5" aria-hidden />
              Full receipts & movement in inspector
            </button>

            {/* corrections */}
            <div
              className="mt-6 rounded-2xl bg-secondary/40 px-4 py-4"
              data-shell-slot="map-corrections"
            >
              <SectionLabel>Correct the model</SectionLabel>
              {correction && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-evidence-muted px-2 py-1 text-xs font-medium text-primary">
                  Recorded: “{correction}”
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CORRECTIONS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={obj ? () => applyCorrection(obj.id, label) : undefined}
                    disabled={!obj}
                    data-shell-item="map-correction-action"
                    data-live-object-id={obj?.id}
                    className={cn(
                      "o-calm rounded-full px-2.5 py-1 text-xs font-medium disabled:cursor-default disabled:opacity-70",
                      label === "Confirm"
                        ? "bg-evidence-muted text-primary hover:brightness-[0.97]"
                        : label === "This is wrong" || label === "Don't use this"
                          ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
                          : "bg-card text-foreground shadow-[0_1px_2px_-1px_rgba(30,41,59,0.12)] hover:bg-accent/60",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  )
}
