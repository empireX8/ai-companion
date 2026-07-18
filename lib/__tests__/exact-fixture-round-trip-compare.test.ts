import { describe, expect, it } from "vitest"

import {
  compareExactReportCard,
  compareExactTodayComposition,
  compareExactTodayMovements,
  normalizeTodayMovementsForCompare,
} from "../exact-fixture-round-trip-compare"
import { buildExactFixtureManifest } from "../exact-fixture-round-trip-manifest"

describe("exact fixture round-trip compare", () => {
  const manifest = buildExactFixtureManifest()

  it("fixture vs fixture today composition → zero mismatches", () => {
    const f = manifest.today
    const mismatches = compareExactTodayComposition(f, {
      briefingLine: f.briefingLine,
      briefingTitle: f.briefingTitle,
      briefingMeta: f.briefingMeta,
      leadNarrative: f.leadNarrative,
      leadWhatChanged: f.leadWhatChanged,
      leadLastEvidence: f.leadLastEvidence,
      leadKicker: f.leadKicker,
      nowRowTitles: f.nowRows.map((r) => r.title),
      nowRowKickers: f.nowRows.map((r) => r.kicker),
      nowRowStatuses: f.nowRows.map((r) => r.status),
      movements: normalizeTodayMovementsForCompare(f.movements),
      reportTitle: f.reportTitle,
      reportMeta: f.reportMeta,
      reportPresent: true,
      primaryActionLabels: f.primaryActions.map((a) => a.label),
      resurfacedTitles: ["a", "b", "c"],
    })
    expect(mismatches).toEqual([])
  })

  it("wrong report title is an exact mismatch", () => {
    const mismatches = compareExactReportCard(
      {
        reportTitle: "Weekly Model Movement report",
        reportMeta: "Ready · 3 loops, 2 decisions, 1 context update",
        reportPresent: true,
      },
      {
        reportTitle: "What Changed",
        reportMeta: "3 published movements in this window",
        reportPresent: true,
      },
    )
    expect(mismatches.some((m) => m.path === "today.reportTitle")).toBe(true)
    expect(mismatches.some((m) => m.path === "today.reportMeta")).toBe(true)
  })

  it("wrong movement evidence is an exact mismatch", () => {
    const fixture = normalizeTodayMovementsForCompare(manifest.today.movements)
    const live = fixture.map((row, i) =>
      i === 0 ? { ...row, evidence: "Decision pressure is now linked to scope reopening." } : row,
    )
    const mismatches = compareExactTodayMovements(fixture, live)
    expect(mismatches).toEqual([
      {
        path: "today.movements[0].evidence",
        fixture: "6 receipts tied pressure to repeated scope reopening.",
        live: "Decision pressure is now linked to scope reopening.",
      },
    ])
  })
})
