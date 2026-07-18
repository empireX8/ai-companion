/**
 * Shared ModelUpdate identity resolution for Today, Inspector, and adapters.
 * Prefer live semantic identity over type/object shell labels.
 */

import { isGenericInspectorEvidenceLabel, sanitizeInspectorDisplayText } from "./inspector-evidence-presentation"

const GENERIC_IDENTITY_FRAGMENTS = [
  "related pattern",
  "related map item",
  "related signal",
  "reference item",
  "linked pattern",
  "linked evidence",
  "linked pattern evidence",
  "linked signal evidence",
] as const

export function isGenericModelUpdateIdentity(value: string | null | undefined): boolean {
  if (!value) return true
  const trimmed = value.trim()
  if (!trimmed) return true
  if (isGenericInspectorEvidenceLabel(trimmed)) return true
  const key = trimmed.toLowerCase()
  if (GENERIC_IDENTITY_FRAGMENTS.some((fragment) => key === fragment)) return true
  if (
    /^[a-z0-9 _/-]+ · (related pattern|related map item|related signal|reference item)$/i.test(
      trimmed,
    )
  ) {
    return true
  }
  // Short shell labels that embed a generic fragment ("Related pattern movement").
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  if (
    wordCount <= 5 &&
    GENERIC_IDENTITY_FRAGMENTS.some((fragment) => key.includes(fragment))
  ) {
    return true
  }
  return false
}

export function firstMeaningfulModelUpdateText(
  values: Array<string | null | undefined>,
): string | null {
  const seen = new Set<string>()
  for (const value of values) {
    const sanitized = sanitizeInspectorDisplayText(value)
    if (!sanitized) continue
    if (isGenericModelUpdateIdentity(sanitized)) continue
    const key = sanitized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    return sanitized
  }
  return null
}

export function resolveModelUpdateDisplayTitle(input: {
  userFacingSummary?: string | null
  affectedObjectTitle?: string | null
  packetTargetLabel?: string | null
  existingTitle?: string | null
  updateTypeLabel?: string | null
  affectedObjectTypeLabel?: string | null
}): string {
  return (
    firstMeaningfulModelUpdateText([
      input.userFacingSummary,
      input.affectedObjectTitle,
      input.packetTargetLabel,
      input.existingTitle,
    ]) ??
    firstMeaningfulModelUpdateText([input.updateTypeLabel]) ??
    "Model update"
  )
}

export function resolveModelUpdateShellLabel(input: {
  updateTypeLabel?: string | null
  affectedObjectTypeLabel?: string | null
}): string | null {
  const updateType = sanitizeInspectorDisplayText(input.updateTypeLabel)
  const affectedType = sanitizeInspectorDisplayText(input.affectedObjectTypeLabel)
  if (updateType && affectedType && !isGenericModelUpdateIdentity(affectedType)) {
    return `${updateType} · ${affectedType}`
  }
  if (updateType) return updateType
  if (affectedType && !isGenericModelUpdateIdentity(affectedType)) return affectedType
  return null
}
