import { InvestigationStatus, type Investigation } from "@prisma/client";

import { formatInvestigationStatus } from "./public-intelligence-safe-slice";
import { toNonEmptyPublicId } from "./public-continuity-registry";

type ExploreInvestigationRecord = Pick<
  Investigation,
  | "id"
  | "title"
  | "organizingQuestion"
  | "status"
  | "createdAt"
  | "updatedAt"
>;

export type ExploreInvestigationItem = {
  id: string;
  title: string;
  organizingQuestion: string;
  status: InvestigationStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
};

export const EXPLORE_INVESTIGATIONS_ENDPOINT = "/api/explore/investigations";
export const EXPLORE_INVESTIGATIONS_LIMIT = 20;

export {
  buildPublicExploreInvestigationWhere,
  EXPLORE_INVESTIGATION_VISIBLE_STATUSES,
  PUBLIC_INVESTIGATION_ALLOWED_CANDIDATE_LIFECYCLE_STATUSES,
  PUBLIC_INVESTIGATION_VISIBILITY,
} from "./investigation-public-visibility";

export function toExploreInvestigationItem(
  row: ExploreInvestigationRecord
): ExploreInvestigationItem | null {
  const safeId = toNonEmptyPublicId(row.id);
  if (!safeId) {
    return null;
  }

  return {
    id: safeId,
    title: row.title,
    organizingQuestion: row.organizingQuestion,
    status: row.status,
    statusLabel: formatInvestigationStatus(row.status),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function dedupeExploreInvestigationItems(
  items: ExploreInvestigationItem[]
): ExploreInvestigationItem[] {
  const seen = new Set<string>();
  const deduped: ExploreInvestigationItem[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    deduped.push(item);
  }

  return deduped;
}

function isExploreInvestigationItem(value: unknown): value is ExploreInvestigationItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<ExploreInvestigationItem>;

  return (
    typeof item.id === "string" &&
    item.id.trim().length > 0 &&
    typeof item.title === "string" &&
    typeof item.organizingQuestion === "string" &&
    typeof item.status === "string" &&
    typeof item.statusLabel === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

export function normalizeExploreInvestigationItemsPayload(
  payload: unknown
): ExploreInvestigationItem[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const items = (payload as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return [];
  }

  return dedupeExploreInvestigationItems(items.filter(isExploreInvestigationItem));
}

export async function fetchExploreInvestigationItems(): Promise<ExploreInvestigationItem[]> {
  try {
    const response = await fetch(EXPLORE_INVESTIGATIONS_ENDPOINT, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return normalizeExploreInvestigationItemsPayload(payload);
  } catch {
    return [];
  }
}
