"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

import type { OrvekObject } from "@/lib/orvek-v0/orvek-types"

const InspectorObjectOverlayContext = createContext<Record<string, OrvekObject>>({})

export function InspectorObjectOverlayProvider({
  objects,
  children,
}: {
  objects: Record<string, OrvekObject>
  children: ReactNode
}) {
  const value = useMemo(() => objects, [objects])
  return (
    <InspectorObjectOverlayContext.Provider value={value}>
      {children}
    </InspectorObjectOverlayContext.Provider>
  )
}

export function useInspectorObjectOverlay(): Record<string, OrvekObject> {
  return useContext(InspectorObjectOverlayContext)
}
