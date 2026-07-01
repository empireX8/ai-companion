import { PATTERN_FAMILY_SECTIONS, type PatternsResponse } from "./patterns-api";
import { ORVEK_COPY, PATTERN_STATUS_LABELS, PRODUCT_NAME } from "./trust-language";

export const MIND_CONTEXT_REFERENCE_ENDPOINT =
  "/api/reference/list?status=active&limit=50";

export const MIND_CONTEXT_SECTION_LABEL = ORVEK_COPY.mindContext;
export const MIND_CONTEXT_SECTION_INTRO =
  `Stable context ${PRODUCT_NAME} draws on when forming ${ORVEK_COPY.orveksRead.toLowerCase()}. Each item is a model read backed by your records — not a personality summary or final verdict.`;

export const MIND_CONTEXT_EMPTY_PRIMARY =
  `${PRODUCT_NAME} has not confirmed enough stable ${ORVEK_COPY.mindContext.toLowerCase()} yet.`;
export const MIND_CONTEXT_EMPTY_SECONDARY =
  "Active memories and patterns appear here when supported. Inspect them in Context or Memories, or capture a correction in Capture Life Data.";

export const MIND_CONTEXT_GOVERNANCE_HREF = "/context";
export const MIND_CONTEXT_MEMORIES_HREF = "/memories";

export type MindContextMemoryItem = {
  id: string;
  statement: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type MindContextPatternItem = {
  id: string;
  summary: string;
  status: string;
  strengthLevel: string;
  evidenceCount: number;
  sectionLabel: string;
  updatedAt: string;
};

export type MindContextSnapshot = {
  memories: MindContextMemoryItem[];
  activePatterns: MindContextPatternItem[];
};

export type MindContextDisplayItem = {
  id: string;
  kind: "memory" | "pattern";
  title: string;
  categoryLabel: string;
  statusLabel: string | null;
  evidenceCount: number | null;
  updatedAt: string;
  detailHref: string;
  inspectorObjectId: string | null;
};

export type MindContextEvidenceState = {
  evidenceSummary: string;
  confidenceLabel: string;
  uncertaintyLabel: string | null;
  correctionPrompt: string;
};

/**
 * Returns true if a memory statement is worth showing in Mind Context surfaces.
 * Mirrors the Context page quality gate without importing client components.
 */
export function isQualityMindContextStatement(statement: string): boolean {
  const t = statement.trim();
  if (t.length < 20) return false;
  const wordCount = (t.match(/\b\w{2,}\b/g) ?? []).length;
  if (wordCount < 4) return false;
  const specialChars = (t.match(/[<>{}()[\]|\\=;:$#@!`]/g) ?? []).length;
  if (specialChars / t.length > 0.1) return false;
  if (
    /\b(?:Error|Exception|Traceback|TypeError|ReferenceError|SyntaxError|Cannot\s+(?:find|read)|undefined\s+is\s+not)\b/.test(
      t
    )
  ) {
    return false;
  }
  if (/^[$%#>]\s/.test(t) || /\n\s*[$%#>]\s/.test(t)) return false;
  if (/\b(?:WARN|ERROR|DEBUG|INFO)\b.*?:/.test(t)) return false;
  return true;
}

function normalizeReferencePayload(
  payload: MindContextMemoryItem[] | { items?: MindContextMemoryItem[] }
): MindContextMemoryItem[] {
  const items = Array.isArray(payload) ? payload : (payload.items ?? []);
  return items
    .filter((item) => isQualityMindContextStatement(item.statement))
    .map((item) => ({
      id: item.id,
      statement: item.statement.trim(),
      type: item.type,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt ?? item.createdAt,
    }));
}

function sectionLabelForFamily(familyKey: string): string {
  return (
    PATTERN_FAMILY_SECTIONS.find((section) => section.familyKey === familyKey)
      ?.sectionLabel ?? "Pattern"
  );
}

export function toMindContextPatternItems(
  patterns: PatternsResponse | null
): MindContextPatternItem[] {
  if (!patterns?.sections) {
    return [];
  }

  const items: MindContextPatternItem[] = [];
  for (const section of patterns.sections) {
    for (const claim of section.claims) {
      if (claim.status !== "active") {
        continue;
      }
      items.push({
        id: claim.id,
        summary: claim.summary,
        status: claim.status,
        strengthLevel: claim.strengthLevel,
        evidenceCount: claim.evidenceCount,
        sectionLabel: sectionLabelForFamily(claim.patternType),
        updatedAt: claim.updatedAt,
      });
    }
  }

  return items.sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export function buildMindContextDisplayItems(
  snapshot: MindContextSnapshot,
  limit = 8
): MindContextDisplayItem[] {
  const memoryItems: MindContextDisplayItem[] = snapshot.memories.map((memory) => ({
    id: `memory-${memory.id}`,
    kind: "memory",
    title: memory.statement,
    categoryLabel: memory.type,
    statusLabel: memory.status === "active" ? "Active" : memory.status,
    evidenceCount: null,
    updatedAt: memory.updatedAt,
    detailHref: `/references/${memory.id}`,
    inspectorObjectId: null,
  }));

  const patternItems: MindContextDisplayItem[] = snapshot.activePatterns.map((pattern) => ({
    id: `pattern-${pattern.id}`,
    kind: "pattern",
    title: pattern.summary,
    categoryLabel: pattern.sectionLabel,
    statusLabel: PATTERN_STATUS_LABELS[pattern.status as keyof typeof PATTERN_STATUS_LABELS] ?? pattern.status,
    evidenceCount: pattern.evidenceCount,
    updatedAt: pattern.updatedAt,
    detailHref: `/patterns/${pattern.id}`,
    inspectorObjectId: pattern.id,
  }));

  return [...memoryItems, ...patternItems]
    .sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    )
    .slice(0, limit);
}

export function summarizeMindContextEvidence(
  item: MindContextDisplayItem
): MindContextEvidenceState {
  const isPattern = item.kind === "pattern";
  const evidenceCount = item.evidenceCount ?? 0;
  const evidenceSummary = isPattern
    ? evidenceCount > 0
      ? `${evidenceCount} linked receipt${evidenceCount === 1 ? "" : "s"}`
      : "No linked receipts surfaced yet"
    : "Linked memory record";
  const confidenceLabel = isPattern
    ? evidenceCount === 0
      ? "Provisional"
      : evidenceCount === 1
        ? "Thin support"
        : "Supported by linked receipts"
    : "Record-backed";
  const uncertaintyLabel =
    isPattern && evidenceCount === 0
      ? "Evidence is thin or unavailable in this projection."
      : isPattern && evidenceCount === 1
        ? "Support is thin; review before treating this as settled."
        : null;

  return {
    evidenceSummary,
    confidenceLabel,
    uncertaintyLabel,
    correctionPrompt: [
      "Correct this context read.",
      `Current read: ${item.title}`,
      `Evidence summary: ${evidenceSummary}.`,
      `Linked path: ${item.detailHref}`,
      "User correction is first-class evidence. Capture the correction in Capture Life Data.",
    ].join("\n"),
  };
}

export function hasMindContextContent(snapshot: MindContextSnapshot): boolean {
  return snapshot.memories.length > 0 || snapshot.activePatterns.length > 0;
}

export async function fetchMindContextSnapshot(): Promise<MindContextSnapshot> {
  const [referenceResult, patternsResult] = await Promise.allSettled([
    fetch(MIND_CONTEXT_REFERENCE_ENDPOINT, { method: "GET", cache: "no-store" }),
    fetch("/api/patterns", { method: "GET", cache: "no-store" }),
  ]);

  let memories: MindContextMemoryItem[] = [];
  if (referenceResult.status === "fulfilled" && referenceResult.value.ok) {
    try {
      const payload = (await referenceResult.value.json()) as
        | MindContextMemoryItem[]
        | { items?: MindContextMemoryItem[] };
      memories = normalizeReferencePayload(payload);
    } catch {
      memories = [];
    }
  }

  let activePatterns: MindContextPatternItem[] = [];
  if (patternsResult.status === "fulfilled" && patternsResult.value.ok) {
    try {
      const payload = (await patternsResult.value.json()) as PatternsResponse;
      activePatterns = toMindContextPatternItems(payload);
    } catch {
      activePatterns = [];
    }
  }

  return { memories, activePatterns };
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

export function formatMindContextDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_FORMATTER.format(date);
}
