"use client"

import { createContext, useContext, type ReactNode } from "react"

import type { CanonicalRuntimeData } from "./canonical-contract"

const CanonicalDataContext = createContext<CanonicalRuntimeData | null>(null)

export function CanonicalDataProvider({
  value,
  children,
}: {
  value: CanonicalRuntimeData
  children: ReactNode
}) {
  return (
    <CanonicalDataContext.Provider value={value}>{children}</CanonicalDataContext.Provider>
  )
}

export function useCanonicalData(): CanonicalRuntimeData {
  const ctx = useContext(CanonicalDataContext)
  if (!ctx) {
    throw new Error("useCanonicalData must be used within CanonicalDataProvider")
  }
  return ctx
}
