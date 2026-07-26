/**
 * Keeps approved presentation positions in the tree without inventing objects.
 * Genuine items are preserved in order; null values only represent unavailable
 * visual slots and must never be used as object identities.
 */
export function minimumPermanentSlots<T>(
  items: readonly T[] | undefined,
  minimumCount: number,
): (T | null)[] {
  const values = items ?? []
  const length = Math.max(values.length, minimumCount)
  return Array.from({ length }, (_, index) => values[index] ?? null)
}
