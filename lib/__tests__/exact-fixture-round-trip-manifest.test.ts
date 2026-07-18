import { describe, expect, it } from "vitest"

import {
  EXACT_FIXTURE_GENERATED_AT,
  EXACT_FIXTURE_MANIFEST_VERSION,
  buildExactFixtureManifest,
} from "../exact-fixture-round-trip-manifest"

describe("exact fixture round-trip manifest", () => {
  const manifest = buildExactFixtureManifest()

  it("uses deterministic manifest metadata", () => {
    expect(manifest.version).toBe(EXACT_FIXTURE_MANIFEST_VERSION)
    expect(manifest.generatedAt).toBe(EXACT_FIXTURE_GENERATED_AT)
  })

  it("captures today composition authority", () => {
    expect(manifest.today.leadId).toBe("d1")
    expect(manifest.today.reportTitle).toBe("Weekly Model Movement report")
    expect(manifest.today.reportId).toBe("rep-weekly")
    expect(manifest.today.nowRows).toHaveLength(4)
    expect(manifest.today.resurfacedIds).toEqual(["r6", "r5", "r2"])
    expect(manifest.today.movements).toHaveLength(3)
    expect(manifest.today.movements.map((movement) => movement.previous)).toEqual([
      "Decision pressure was treated as an isolated state.",
      "Background context was held as loose metadata.",
      "Avoidance read as a general tendency under pressure.",
    ])
  })

  it("includes referenced frozen objects with ids", () => {
    const objectIds = manifest.objects.map((object) => object.id)
    expect(objectIds).toContain("d1")
    expect(objectIds).toContain("mu-1")
    expect(objectIds).toContain("rep-weekly")
    expect(objectIds).toContain("r6")
  })

  it("uses iconKey strings instead of icon components in today rows", () => {
    for (const row of manifest.today.nowRows) {
      expect(typeof row.iconKey).toBe("string")
      expect(row).not.toHaveProperty("icon")
    }
  })

  it("defines an ordered fixture review path", () => {
    expect(manifest.reviewPath.length).toBeGreaterThan(0)
    expect(manifest.reviewPath[0]?.id).toBe("01-today-initial")
    expect(manifest.reviewPath[0]?.expectedTitles).toContain("Your model moved in 3 places.")
  })
})
