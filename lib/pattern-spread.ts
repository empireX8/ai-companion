export type SessionEvidenceLike = {
  sessionId: string | null | undefined;
};

export type JournalEvidenceLike = {
  journalEntryId?: string | null;
  createdAt: Date;
  journalEntry?: {
    authoredAt?: Date | null;
    createdAt: Date;
  } | null;
};

export function computeSessionCount(
  evidence: ReadonlyArray<SessionEvidenceLike>
): number {
  return new Set(
    evidence
      .map((entry) => entry.sessionId)
      .filter((sessionId): sessionId is string => sessionId !== null && sessionId !== undefined)
  ).size;
}

export function computeJournalEvidenceCount(
  evidence: ReadonlyArray<Pick<JournalEvidenceLike, "journalEntryId">>
): number {
  return evidence.filter((entry) => entry.journalEntryId !== null && entry.journalEntryId !== undefined).length;
}

export function resolveJournalEvidenceDate(
  entry: JournalEvidenceLike
): Date | null {
  if (entry.journalEntryId === null || entry.journalEntryId === undefined) {
    return null;
  }
  return entry.journalEntry?.authoredAt ?? entry.journalEntry?.createdAt ?? entry.createdAt;
}

export function computeJournalDaySpread(
  evidence: ReadonlyArray<JournalEvidenceLike>
): number {
  const dayKeys = evidence.flatMap((entry) => {
    const sourceDate = resolveJournalEvidenceDate(entry);
    if (!sourceDate) return [];
    return [sourceDate.toISOString().slice(0, 10)];
  });
  return new Set(dayKeys).size;
}

export function computeEffectiveSpread(
  sessionCount: number,
  journalDaySpread: number
): number {
  const safeSessionCount = Number.isFinite(sessionCount)
    ? Math.max(0, Math.floor(sessionCount))
    : 0;
  const safeJournalDaySpread = Number.isFinite(journalDaySpread)
    ? Math.max(0, Math.floor(journalDaySpread))
    : 0;
  return safeSessionCount + Math.floor(safeJournalDaySpread / 2);
}
