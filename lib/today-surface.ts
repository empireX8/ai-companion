import { toJournalPreview } from "./journal-ui";
import { buildPublicReceiptHref } from "./public-continuity-registry";

const META_DATE = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
  timeZone: "Europe/London",
});

export type TodayJournalEntry = {
  id: string | null;
  title: string | null;
  body: string;
  createdAt: string;
  authoredAt: string | null;
};

export type TodayTopContradiction = {
  id: string | null;
  title: string;
  sideA: string;
  sideB: string;
  status: string;
  lastEvidenceAt: string | null;
  lastTouchedAt: string;
};

export type TodayPatternClaim = {
  id: string | null;
  summary: string;
  strengthLevel: "tentative" | "developing" | "established";
  evidenceCount: number;
};

export type TodayPatternSection = {
  claims: TodayPatternClaim[];
};

export type TodayPatternsResponse = {
  sections: TodayPatternSection[];
};

export type TodaySurfacingCard = {
  kind: "Recent Journal" | "Active Tension" | "Recent Pattern";
  title: string;
  body: string;
  meta: string;
  detailHref: string | null;
  receiptHref: string | null;
};

export const TODAY_SURFACING_ENDPOINTS = {
  journal: "/api/journal/entries?limit=1",
  contradiction: "/api/contradiction?top=3&mode=read_only",
  patterns: "/api/patterns",
} as const;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clampText(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function normalizeId(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatShortDate(iso: string | null): string {
  if (!iso) {
    return "recently";
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "recently";
  }

  return META_DATE.format(parsed);
}

function strengthLabel(value: TodayPatternClaim["strengthLevel"]): string {
  if (value === "established") return "High";
  if (value === "developing") return "Medium";
  return "Emerging";
}

function toTensionPreview(top: TodayTopContradiction): string {
  const combined = [normalizeText(top.sideA), normalizeText(top.sideB)]
    .filter(Boolean)
    .join(" · ");
  if (!combined) {
    return clampText(normalizeText(top.title), 220);
  }
  return clampText(combined, 220);
}

export function buildTodaySurfacingCards({
  journalEntries,
  contradictions,
  patterns,
}: {
  journalEntries: TodayJournalEntry[];
  contradictions: TodayTopContradiction[];
  patterns: TodayPatternsResponse | null;
}): TodaySurfacingCard[] {
  const cards: TodaySurfacingCard[] = [];

  const latestJournal = journalEntries[0];
  if (latestJournal) {
    const journalId = normalizeId(latestJournal.id);
    const createdAt = latestJournal.authoredAt ?? latestJournal.createdAt;
    cards.push({
      kind: "Recent Journal",
      title: clampText(
        (
          latestJournal.title?.trim() ||
          toJournalPreview(latestJournal.body, 72) ||
          "Journal entry"
        ).trim(),
        170
      ),
      body: toJournalPreview(latestJournal.body, 130),
      meta: `Last touched · ${formatShortDate(createdAt)}`,
      detailHref: journalId ? `/library/journal-${journalId}` : null,
      receiptHref: null,
    });
  }

  const topContradiction = contradictions[0];
  if (topContradiction) {
    const contradictionId = normalizeId(topContradiction.id);
    cards.push({
      kind: "Active Tension",
      title: clampText(normalizeText(topContradiction.title), 170),
      body: toTensionPreview(topContradiction),
      meta: `${topContradiction.status.replace(/_/g, " ")} · ${formatShortDate(
        topContradiction.lastEvidenceAt ?? topContradiction.lastTouchedAt
      )}`,
      detailHref: contradictionId
        ? `/contradictions/${contradictionId}`
        : null,
      receiptHref: buildPublicReceiptHref({
        namespace: "receipt-tension",
        id: contradictionId,
      }),
    });
  }

  const claims = patterns?.sections.flatMap((section) => section.claims) ?? [];
  const topClaim = [...claims].sort(
    (left, right) => right.evidenceCount - left.evidenceCount
  )[0];
  if (topClaim) {
    const patternId = normalizeId(topClaim.id);
    cards.push({
      kind: "Recent Pattern",
      title: clampText(normalizeText(topClaim.summary), 170),
      body:
        topClaim.evidenceCount > 0
          ? `${topClaim.evidenceCount} evidence receipts in recent material.`
          : "Early signal from recent material.",
      meta: `Strength · ${strengthLabel(topClaim.strengthLevel)}`,
      detailHref: patternId ? `/patterns/${patternId}` : null,
      receiptHref: buildPublicReceiptHref({
        namespace: "receipt-pattern",
        id: patternId,
      }),
    });
  }

  return cards;
}
