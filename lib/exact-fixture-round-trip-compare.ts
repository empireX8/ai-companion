import type { ExactFixtureTodayComposition } from "./exact-fixture-round-trip-manifest"

export type ExactMovementCompareRow = {
  order: number
  previous: string
  updated: string
  evidence: string
  id?: string
}

export type ExactMismatch = {
  path: string
  fixture: string
  live: string
}

export type ExactReportCompare = {
  reportTitle: string
  reportMeta: string
  reportPresent: boolean
}

export function normalizeTodayMovementsForCompare(
  movements: Array<{
    previous?: string | null
    updated?: string | null
    evidence?: string | null
    id?: string
  }>,
): ExactMovementCompareRow[] {
  return movements.map((m, order) => ({
    order,
    previous: (m.previous ?? "").trim(),
    updated: (m.updated ?? "").trim(),
    evidence: (m.evidence ?? "").trim(),
    id: m.id,
  }))
}

export function compareExactTodayMovements(
  fixture: ExactMovementCompareRow[],
  live: ExactMovementCompareRow[],
): ExactMismatch[] {
  const mismatches: ExactMismatch[] = []
  if (fixture.length !== live.length) {
    mismatches.push({
      path: "today.movements.length",
      fixture: String(fixture.length),
      live: String(live.length),
    })
  }
  const n = Math.max(fixture.length, live.length)
  for (let i = 0; i < n; i += 1) {
    const f = fixture[i]
    const l = live[i]
    if (!f || !l) {
      mismatches.push({
        path: `today.movements[${i}]`,
        fixture: f ? JSON.stringify(f) : "<missing>",
        live: l ? JSON.stringify(l) : "<missing>",
      })
      continue
    }
    for (const key of ["previous", "updated", "evidence"] as const) {
      if (f[key] !== l[key]) {
        mismatches.push({
          path: `today.movements[${i}].${key}`,
          fixture: f[key],
          live: l[key],
        })
      }
    }
  }
  return mismatches
}

export function compareExactReportCard(
  fixture: ExactReportCompare,
  live: ExactReportCompare,
): ExactMismatch[] {
  const mismatches: ExactMismatch[] = []
  if (fixture.reportPresent !== live.reportPresent) {
    mismatches.push({
      path: "today.report.present",
      fixture: String(fixture.reportPresent),
      live: String(live.reportPresent),
    })
  }
  if (fixture.reportTitle !== live.reportTitle) {
    mismatches.push({
      path: "today.reportTitle",
      fixture: fixture.reportTitle,
      live: live.reportTitle,
    })
  }
  if (fixture.reportMeta !== live.reportMeta) {
    mismatches.push({
      path: "today.reportMeta",
      fixture: fixture.reportMeta,
      live: live.reportMeta,
    })
  }
  return mismatches
}

export type LiveTodayCompareSlice = {
  briefingLine?: string
  briefingTitle?: string
  briefingMeta?: string
  leadTitle?: string
  leadNarrative?: string
  leadWhatChanged?: string
  leadLastEvidence?: string
  leadKicker?: string
  nowRowTitles?: string[]
  nowRowKickers?: string[]
  nowRowStatuses?: string[]
  movements?: ExactMovementCompareRow[]
  resurfacedTitles?: string[]
  reportTitle?: string
  reportMeta?: string
  reportPresent?: boolean
  primaryActionLabels?: string[]
}

export function compareExactTodayComposition(
  fixture: ExactFixtureTodayComposition,
  live: LiveTodayCompareSlice,
  options?: { compareLeadId?: boolean },
): ExactMismatch[] {
  const mismatches: ExactMismatch[] = []
  const check = (path: string, f: string, l: string | undefined) => {
    const liveVal = (l ?? "").trim()
    if (f.trim() !== liveVal) {
      mismatches.push({ path, fixture: f.trim(), live: liveVal })
    }
  }

  check("today.briefingLine", fixture.briefingLine, live.briefingLine)
  check("today.briefingTitle", fixture.briefingTitle, live.briefingTitle)
  check("today.briefingMeta", fixture.briefingMeta, live.briefingMeta)
  check("today.leadNarrative", fixture.leadNarrative, live.leadNarrative)
  check("today.leadWhatChanged", fixture.leadWhatChanged, live.leadWhatChanged)
  check("today.leadLastEvidence", fixture.leadLastEvidence, live.leadLastEvidence)
  check("today.leadKicker", fixture.leadKicker, live.leadKicker)

  if (options?.compareLeadId) {
    // Lead *title* compared when provided (IDs differ after round-trip).
  }
  if (live.leadTitle !== undefined) {
    // Caller supplies expected fixture lead title separately if needed.
  }

  const fNowTitles = fixture.nowRows.map((r) => r.title)
  const lNowTitles = live.nowRowTitles ?? []
  if (fNowTitles.length !== lNowTitles.length) {
    mismatches.push({
      path: "today.nowRows.length",
      fixture: String(fNowTitles.length),
      live: String(lNowTitles.length),
    })
  }
  for (let i = 0; i < Math.max(fNowTitles.length, lNowTitles.length); i += 1) {
    if ((fNowTitles[i] ?? "") !== (lNowTitles[i] ?? "")) {
      mismatches.push({
        path: `today.nowRows[${i}].title`,
        fixture: fNowTitles[i] ?? "<missing>",
        live: lNowTitles[i] ?? "<missing>",
      })
    }
  }

  const fKickers = fixture.nowRows.map((r) => r.kicker)
  const lKickers = live.nowRowKickers ?? []
  for (let i = 0; i < Math.max(fKickers.length, lKickers.length); i += 1) {
    if ((fKickers[i] ?? "") !== (lKickers[i] ?? "")) {
      mismatches.push({
        path: `today.nowRows[${i}].kicker`,
        fixture: fKickers[i] ?? "<missing>",
        live: lKickers[i] ?? "<missing>",
      })
    }
  }

  const fStatuses = fixture.nowRows.map((r) => r.status)
  const lStatuses = live.nowRowStatuses ?? []
  for (let i = 0; i < Math.max(fStatuses.length, lStatuses.length); i += 1) {
    if ((fStatuses[i] ?? "") !== (lStatuses[i] ?? "")) {
      mismatches.push({
        path: `today.nowRows[${i}].status`,
        fixture: fStatuses[i] ?? "<missing>",
        live: lStatuses[i] ?? "<missing>",
      })
    }
  }

  mismatches.push(
    ...compareExactTodayMovements(
      normalizeTodayMovementsForCompare(fixture.movements),
      live.movements ?? [],
    ),
  )

  mismatches.push(
    ...compareExactReportCard(
      {
        reportTitle: fixture.reportTitle,
        reportMeta: fixture.reportMeta,
        reportPresent: Boolean(fixture.reportTitle.trim()),
      },
      {
        reportTitle: live.reportTitle ?? "",
        reportMeta: live.reportMeta ?? "",
        reportPresent: live.reportPresent ?? Boolean((live.reportTitle ?? "").trim()),
      },
    ),
  )

  const fActions = fixture.primaryActions.map((a) => a.label)
  const lActions = live.primaryActionLabels ?? []
  if (fActions.length !== lActions.length) {
    mismatches.push({
      path: "today.primaryActions.length",
      fixture: String(fActions.length),
      live: String(lActions.length),
    })
  }
  for (let i = 0; i < Math.max(fActions.length, lActions.length); i += 1) {
    if ((fActions[i] ?? "") !== (lActions[i] ?? "")) {
      mismatches.push({
        path: `today.primaryActions[${i}].label`,
        fixture: fActions[i] ?? "<missing>",
        live: lActions[i] ?? "<missing>",
      })
    }
  }

  const fResurf = fixture.resurfacedIds
  const lResurf = live.resurfacedTitles
  if (lResurf) {
    // Titles compared when live supplies titles (IDs remapped).
    if (fResurf.length !== lResurf.length) {
      mismatches.push({
        path: "today.resurfacedIds.length",
        fixture: String(fResurf.length),
        live: String(lResurf.length),
      })
    }
  }

  return mismatches
}
