export const IMPORT_DIAGNOSTICS_RESULT_ERRORS_PREFIX = "__IMPORT_DIAGNOSTICS_V1__:";
export const IMPORT_DIAGNOSTICS_UNAVAILABLE = "unavailable_without_refactor" as const;
const DIAGNOSTIC_VERSION = "import_diagnostics_v1" as const;

type UnavailableWithoutRefactor = typeof IMPORT_DIAGNOSTICS_UNAVAILABLE;

export type ImportDiagnosticReasonCode =
  | "too_short"
  | "non_user_role"
  | "question_like"
  | "assistant_directed"
  | "no_behavioral_signal"
  | "topic_query"
  | "accepted_reference_candidate"
  | "accepted_contradiction_evidence"
  | "candidate_contradiction_created"
  | "skipped_unavailable_without_refactor"
  | "reference_intent_not_detected"
  | "reference_rule_intent_skipped"
  | "reference_dedup_overlap"
  | "pattern_derivation_triggered"
  | "pattern_derivation_failed"
  | (string & {});

type MetricOrUnavailable = number | UnavailableWithoutRefactor;

export type ImportDiagnosticReasonCount = {
  reason: string;
  count: number;
};

export type ImportDiagnosticSample = {
  reason: string;
  snippet: string;
  sessionId?: string;
  messageId?: string;
};

export type ImportRunDiagnostics = {
  version: typeof DIAGNOSTIC_VERSION;
  generatedAt: string;
  importedConversationCount: number;
  importedMessageCount: number;
  importedUserMessageCount: number;
  importedAssistantMessageCount: number;
  userMessagesSkippedForLength: number;
  candidateMessagesConsideredForReferenceExtraction: number;
  referenceCandidatesAccepted: number;
  referenceCandidatesRejected: number;
  contradictionDetectionAttemptedCount: number;
  contradictionEvidenceAcceptedCount: number;
  patternDerivationTriggered: boolean;
  patternBehavioralAcceptedCount: MetricOrUnavailable;
  patternBehavioralRejectedCount: MetricOrUnavailable;
  topBehavioralRejectionReasons: ImportDiagnosticReasonCount[] | UnavailableWithoutRefactor;
  patternClaimsCreatedCount: MetricOrUnavailable;
  patternClaimsSurfacedCount: MetricOrUnavailable;
  patternClaimsSuppressedCount: MetricOrUnavailable;
  suppressionReasons: ImportDiagnosticReasonCount[] | UnavailableWithoutRefactor;
  reasonCodeCounts: Record<string, number>;
  samples: {
    accepted: ImportDiagnosticSample[];
    rejected: ImportDiagnosticSample[];
  };
};

function nowIsoString() {
  return new Date().toISOString();
}

function truncateSnippet(raw: string, maxLength = 140) {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
}

function asMetricOrUnavailable(value: unknown, fallback: MetricOrUnavailable): MetricOrUnavailable {
  if (value === IMPORT_DIAGNOSTICS_UNAVAILABLE) return IMPORT_DIAGNOSTICS_UNAVAILABLE;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function normalizeReasonCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  const output: Record<string, number> = {};
  for (const [reason, count] of Object.entries(input)) {
    if (typeof reason !== "string") continue;
    if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) continue;
    output[reason] = Math.floor(count);
  }
  return output;
}

function normalizeReasonList(
  value: unknown
): ImportDiagnosticReasonCount[] | UnavailableWithoutRefactor {
  if (value === IMPORT_DIAGNOSTICS_UNAVAILABLE) return IMPORT_DIAGNOSTICS_UNAVAILABLE;
  if (!Array.isArray(value)) return [];
  const result: ImportDiagnosticReasonCount[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.reason !== "string") continue;
    const count = asFiniteNumber(record.count, -1);
    if (count <= 0) continue;
    result.push({ reason: record.reason, count: Math.floor(count) });
  }
  return result;
}

function normalizeSampleList(value: unknown): ImportDiagnosticSample[] {
  if (!Array.isArray(value)) return [];
  const samples: ImportDiagnosticSample[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.reason !== "string") continue;
    if (typeof record.snippet !== "string") continue;
    const sample: ImportDiagnosticSample = {
      reason: record.reason,
      snippet: truncateSnippet(record.snippet),
    };
    if (typeof record.sessionId === "string" && record.sessionId.length > 0) {
      sample.sessionId = record.sessionId;
    }
    if (typeof record.messageId === "string" && record.messageId.length > 0) {
      sample.messageId = record.messageId;
    }
    samples.push(sample);
  }
  return samples;
}

export function createEmptyImportRunDiagnostics(): ImportRunDiagnostics {
  return {
    version: DIAGNOSTIC_VERSION,
    generatedAt: nowIsoString(),
    importedConversationCount: 0,
    importedMessageCount: 0,
    importedUserMessageCount: 0,
    importedAssistantMessageCount: 0,
    userMessagesSkippedForLength: 0,
    candidateMessagesConsideredForReferenceExtraction: 0,
    referenceCandidatesAccepted: 0,
    referenceCandidatesRejected: 0,
    contradictionDetectionAttemptedCount: 0,
    contradictionEvidenceAcceptedCount: 0,
    patternDerivationTriggered: false,
    patternBehavioralAcceptedCount: IMPORT_DIAGNOSTICS_UNAVAILABLE,
    patternBehavioralRejectedCount: IMPORT_DIAGNOSTICS_UNAVAILABLE,
    topBehavioralRejectionReasons: IMPORT_DIAGNOSTICS_UNAVAILABLE,
    patternClaimsCreatedCount: IMPORT_DIAGNOSTICS_UNAVAILABLE,
    patternClaimsSurfacedCount: IMPORT_DIAGNOSTICS_UNAVAILABLE,
    patternClaimsSuppressedCount: IMPORT_DIAGNOSTICS_UNAVAILABLE,
    suppressionReasons: IMPORT_DIAGNOSTICS_UNAVAILABLE,
    reasonCodeCounts: {},
    samples: {
      accepted: [],
      rejected: [],
    },
  };
}

export function reviveImportRunDiagnostics(raw: unknown): ImportRunDiagnostics | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== DIAGNOSTIC_VERSION) return null;

  const baseline = createEmptyImportRunDiagnostics();
  return {
    ...baseline,
    generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : baseline.generatedAt,
    importedConversationCount: asFiniteNumber(record.importedConversationCount),
    importedMessageCount: asFiniteNumber(record.importedMessageCount),
    importedUserMessageCount: asFiniteNumber(record.importedUserMessageCount),
    importedAssistantMessageCount: asFiniteNumber(record.importedAssistantMessageCount),
    userMessagesSkippedForLength: asFiniteNumber(record.userMessagesSkippedForLength),
    candidateMessagesConsideredForReferenceExtraction: asFiniteNumber(
      record.candidateMessagesConsideredForReferenceExtraction
    ),
    referenceCandidatesAccepted: asFiniteNumber(record.referenceCandidatesAccepted),
    referenceCandidatesRejected: asFiniteNumber(record.referenceCandidatesRejected),
    contradictionDetectionAttemptedCount: asFiniteNumber(record.contradictionDetectionAttemptedCount),
    contradictionEvidenceAcceptedCount: asFiniteNumber(record.contradictionEvidenceAcceptedCount),
    patternDerivationTriggered: Boolean(record.patternDerivationTriggered),
    patternBehavioralAcceptedCount: asMetricOrUnavailable(
      record.patternBehavioralAcceptedCount,
      baseline.patternBehavioralAcceptedCount
    ),
    patternBehavioralRejectedCount: asMetricOrUnavailable(
      record.patternBehavioralRejectedCount,
      baseline.patternBehavioralRejectedCount
    ),
    topBehavioralRejectionReasons: normalizeReasonList(record.topBehavioralRejectionReasons),
    patternClaimsCreatedCount: asMetricOrUnavailable(
      record.patternClaimsCreatedCount,
      baseline.patternClaimsCreatedCount
    ),
    patternClaimsSurfacedCount: asMetricOrUnavailable(
      record.patternClaimsSurfacedCount,
      baseline.patternClaimsSurfacedCount
    ),
    patternClaimsSuppressedCount: asMetricOrUnavailable(
      record.patternClaimsSuppressedCount,
      baseline.patternClaimsSuppressedCount
    ),
    suppressionReasons: normalizeReasonList(record.suppressionReasons),
    reasonCodeCounts: normalizeReasonCounts(record.reasonCodeCounts),
    samples: {
      accepted: normalizeSampleList((record.samples as Record<string, unknown> | undefined)?.accepted),
      rejected: normalizeSampleList((record.samples as Record<string, unknown> | undefined)?.rejected),
    },
  };
}

export function splitResultErrorsAndDiagnostics(resultErrors: string[]): {
  errors: string[];
  diagnostics: ImportRunDiagnostics | null;
} {
  const errors: string[] = [];
  let diagnostics: ImportRunDiagnostics | null = null;

  for (const entry of resultErrors) {
    if (!entry.startsWith(IMPORT_DIAGNOSTICS_RESULT_ERRORS_PREFIX)) {
      errors.push(entry);
      continue;
    }

    const payload = entry.slice(IMPORT_DIAGNOSTICS_RESULT_ERRORS_PREFIX.length);
    try {
      const parsed = JSON.parse(payload);
      const revived = reviveImportRunDiagnostics(parsed);
      if (revived) diagnostics = revived;
    } catch {
      errors.push(entry);
    }
  }

  return { errors, diagnostics };
}

export function combineResultErrorsWithDiagnostics(
  errors: string[],
  diagnostics: ImportRunDiagnostics | null
): string[] {
  const cleaned = errors.filter((entry) => !entry.startsWith(IMPORT_DIAGNOSTICS_RESULT_ERRORS_PREFIX));
  if (!diagnostics) return cleaned;

  diagnostics.generatedAt = nowIsoString();
  return [
    ...cleaned,
    `${IMPORT_DIAGNOSTICS_RESULT_ERRORS_PREFIX}${JSON.stringify(diagnostics)}`,
  ];
}

export function incrementReasonCodeCount(
  diagnostics: ImportRunDiagnostics,
  reasonCode: ImportDiagnosticReasonCode,
  incrementBy = 1
) {
  if (!Number.isFinite(incrementBy) || incrementBy <= 0) return;
  diagnostics.reasonCodeCounts[reasonCode] = (diagnostics.reasonCodeCounts[reasonCode] ?? 0) + Math.floor(incrementBy);
}

export function pushDiagnosticSample(
  diagnostics: ImportRunDiagnostics,
  bucket: "accepted" | "rejected",
  sample: {
    reason: string;
    snippet: string;
    sessionId?: string;
    messageId?: string;
  },
  limit = 6
) {
  if (limit <= 0) return;
  const target = diagnostics.samples[bucket];
  if (target.length >= limit) return;

  target.push({
    reason: sample.reason,
    snippet: truncateSnippet(sample.snippet),
    ...(sample.sessionId ? { sessionId: sample.sessionId } : {}),
    ...(sample.messageId ? { messageId: sample.messageId } : {}),
  });
}

export function toTopReasonCounts(
  reasonCounts: Record<string, number>,
  limit = 5
): ImportDiagnosticReasonCount[] {
  return Object.entries(reasonCounts)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, Math.max(0, limit))
    .map(([reason, count]) => ({ reason, count }));
}
