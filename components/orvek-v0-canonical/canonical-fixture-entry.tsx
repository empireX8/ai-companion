"use client"

import { useMemo } from "react"

import { createCanonicalFixtureRuntimeData } from "./fixture-provider"
import { CanonicalWorkbench } from "./workbench"

/**
 * Client-only bootstrap for the canonical fixture verification route.
 * Fixture data (including Lucide icons and getObject/getObjects) is created
 * inside the client module graph — never passed across the Server→Client boundary.
 */
export function CanonicalFixtureEntry() {
  const data = useMemo(() => createCanonicalFixtureRuntimeData(), [])

  return (
    <div data-testid="orvek-v0-canonical-reference-route">
      <CanonicalWorkbench data={data} />
    </div>
  )
}
