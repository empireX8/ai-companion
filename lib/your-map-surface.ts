import type { UserMapConclusionStatus } from "@prisma/client";

import type { InspectorEvidenceLinkItem } from "./inspector-object-api";
import {
  formatUserMapArea,
  formatUserMapConfidenceLevel,
  formatUserMapStatus,
  type UserMapConclusionPublicApiDetailItem,
  type UserMapConclusionPublicApiListItem,
} from "./public-intelligence-safe-slice";
import { ORVEK_COPY, PRODUCT_NAME } from "./trust-language";

export const YOUR_MAP_PAGE_TITLE = "Your Map";
export const YOUR_MAP_PAGE_META = "Current understanding from your evidence";
export const YOUR_MAP_PAGE_INTRO =
  `What ${PRODUCT_NAME} currently understands about you from your evidence. Each item is read-only and links to supporting signals when available.`;

export const YOUR_MAP_EMPTY_PRIMARY = "Nothing on your map yet.";
export const YOUR_MAP_EMPTY_SECONDARY =
  `${PRODUCT_NAME} builds this map from journal, explore, import, decisions, and linked evidence over time. Keep capturing signal and conclusions will appear here when supported.`;

export const YOUR_MAP_PROVENANCE_INTRO =
  "Patterns and signals linked to this conclusion. Message content is never shown here.";
export const YOUR_MAP_EVIDENCE_BREADTH_INTRO =
  "Counts from linked evidence — not a certainty score.";
export const YOUR_MAP_CORRECTION_DEFERRED_COPY =
  `To correct ${ORVEK_COPY.orveksRead}, use Explore or Journal to add contradicting evidence. Correction controls are deferred here.`;
export const YOUR_MAP_INSPECTOR_EVIDENCE_HINT =
  "Open the Inspector Evidence tab for the full linked-evidence list.";

export const YOUR_MAP_CONCLUSIONS_ENDPOINT = "/api/user-map/conclusions?limit=50&sortOrder=desc";

export type YourMapRailGroupKey =
  | "established"
  | "emerging"
  | "needs_evidence"
  | "conflicting"
  | "superseded";

export type YourMapRailGroup = {
  key: YourMapRailGroupKey;
  label: string;
  deferred?: boolean;
  items: UserMapConclusionPublicApiListItem[];
};

const STATUS_TO_RAIL_GROUP: Record<UserMapConclusionStatus, YourMapRailGroupKey> = {
  supported: "established",
  emerging: "emerging",
  tentative: "emerging",
  hypothesis: "needs_evidence",
  disputed: "conflicting",
  superseded: "superseded",
};

const RAIL_GROUP_META: Record<
  YourMapRailGroupKey,
  { label: string; deferred?: boolean }
> = {
  established: { label: "Established" },
  emerging: { label: "Emerging" },
  needs_evidence: { label: "Needs more evidence" },
  conflicting: { label: "Conflicting signal" },
  superseded: { label: "Superseded", deferred: true },
};

const RAIL_GROUP_ORDER: YourMapRailGroupKey[] = [
  "established",
  "emerging",
  "needs_evidence",
  "conflicting",
  "superseded",
];

export function groupUserMapConclusionsByStatus(
  items: UserMapConclusionPublicApiListItem[]
): YourMapRailGroup[] {
  const buckets = new Map<YourMapRailGroupKey, UserMapConclusionPublicApiListItem[]>();

  for (const item of items) {
    const groupKey = STATUS_TO_RAIL_GROUP[item.status];
    const bucket = buckets.get(groupKey) ?? [];
    bucket.push(item);
    buckets.set(groupKey, bucket);
  }

  return RAIL_GROUP_ORDER.flatMap((key) => {
    const groupItems = buckets.get(key);
    if (!groupItems || groupItems.length === 0) {
      return [];
    }

    return [
      {
        key,
        label: RAIL_GROUP_META[key].label,
        deferred: RAIL_GROUP_META[key].deferred,
        items: groupItems,
      },
    ];
  });
}

export function pickInitialYourMapSelectionId(
  items: UserMapConclusionPublicApiListItem[],
  preferredId: string | null | undefined
): string | null {
  const normalizedPreferred = preferredId?.trim();
  if (
    normalizedPreferred &&
    items.some((item) => item.id === normalizedPreferred)
  ) {
    return normalizedPreferred;
  }

  return items[0]?.id ?? null;
}

export async function fetchYourMapConclusions(): Promise<
  UserMapConclusionPublicApiListItem[]
> {
  const response = await fetch(YOUR_MAP_CONCLUSIONS_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    items?: UserMapConclusionPublicApiListItem[];
  };

  return Array.isArray(payload.items) ? payload.items : [];
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

export function formatYourMapDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return DATE_FORMATTER.format(date);
}

export function toYourMapListRowMeta(item: UserMapConclusionPublicApiListItem): string {
  return `${formatUserMapArea(item.area)} · ${formatUserMapStatus(item.status)} · ${formatUserMapConfidenceLevel(item.confidenceLevel)}`;
}

export function toYourMapDetailEyebrow(item: UserMapConclusionPublicApiDetailItem): string {
  return `${formatUserMapArea(item.area)} · ${formatUserMapStatus(item.status)}`;
}

export function summarizeCentreEvidence(
  items: InspectorEvidenceLinkItem[],
  maxItems = 4
): {
  preview: InspectorEvidenceLinkItem[];
  hasMore: boolean;
} {
  return {
    preview: items.slice(0, maxItems),
    hasMore: items.length > maxItems,
  };
}
