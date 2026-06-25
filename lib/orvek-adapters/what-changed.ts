import type { PublicEvidenceContinuityItem } from "../public-evidence-continuity";
import type { WhatChangedListItem } from "../public-intelligence-safe-slice";
import {
  formatWhatChangedDateTime,
  toWhatChangedMovementTitle,
  WHAT_CHANGED_EARLIER_SECTION_INTRO,
  WHAT_CHANGED_EARLIER_SECTION_LABEL,
  WHAT_CHANGED_EMPTY_PRIMARY,
  WHAT_CHANGED_EMPTY_SECONDARY,
  WHAT_CHANGED_EVIDENCE_INTRO,
  WHAT_CHANGED_EVIDENCE_LABEL,
  WHAT_CHANGED_PAGE_INTRO,
  WHAT_CHANGED_PAGE_META,
  WHAT_CHANGED_PAGE_TITLE,
  WHAT_CHANGED_PRIMARY_SECTION_INTRO,
  WHAT_CHANGED_PRIMARY_SECTION_LABEL,
  WHAT_CHANGED_REENTRY_INTRO,
  WHAT_CHANGED_REENTRY_LABEL,
  WHAT_CHANGED_REENTRY_LINKS,
  WHAT_CHANGED_WHAT_CHANGED_LABEL,
  WHAT_CHANGED_WHY_LABEL,
} from "../what-changed-surface";

export type V0WhatChangedMovementCard = {
  id: string;
  title: string;
  recordedAt: string;
  summary: string;
  affectedObjectType: WhatChangedListItem["affectedObjectType"];
  affectedObjectId: string | null;
  affectedObjectHref: string | null;
};

export type V0WhatChangedEvidenceItem = {
  id: string;
  label: string;
  sourceTypeLabel: string;
  href: string | null;
  linkedAt: string;
};

export type V0WhatChangedViewProps = {
  pageTitle: string;
  pageMeta: string;
  pageIntro: string;
  emptyPrimary: string;
  emptySecondary: string;
  primarySectionLabel: string;
  primarySectionIntro: string;
  earlierSectionLabel: string;
  earlierSectionIntro: string;
  whatChangedLabel: string;
  whyLabel: string;
  evidenceLabel: string;
  evidenceIntro: string;
  reentryLabel: string;
  reentryIntro: string;
  reentryLinks: typeof WHAT_CHANGED_REENTRY_LINKS;
  primary: V0WhatChangedMovementCard | null;
  earlier: V0WhatChangedMovementCard[];
  evidenceItems: V0WhatChangedEvidenceItem[];
};

export function mapWhatChangedDataToV0Props(input: {
  primary: WhatChangedListItem | null;
  earlier: WhatChangedListItem[];
  evidenceItems: PublicEvidenceContinuityItem[];
}): V0WhatChangedViewProps {
  const mapItem = (item: WhatChangedListItem): V0WhatChangedMovementCard => ({
    id: item.id,
    title: toWhatChangedMovementTitle(item),
    recordedAt: formatWhatChangedDateTime(item.createdAt),
    summary: item.userFacingSummary,
    affectedObjectType: item.affectedObjectType,
    affectedObjectId: item.affectedObjectId,
    affectedObjectHref: item.affectedObjectHref,
  });

  return {
    pageTitle: WHAT_CHANGED_PAGE_TITLE,
    pageMeta: WHAT_CHANGED_PAGE_META,
    pageIntro: WHAT_CHANGED_PAGE_INTRO,
    emptyPrimary: WHAT_CHANGED_EMPTY_PRIMARY,
    emptySecondary: WHAT_CHANGED_EMPTY_SECONDARY,
    primarySectionLabel: WHAT_CHANGED_PRIMARY_SECTION_LABEL,
    primarySectionIntro: WHAT_CHANGED_PRIMARY_SECTION_INTRO,
    earlierSectionLabel: WHAT_CHANGED_EARLIER_SECTION_LABEL,
    earlierSectionIntro: WHAT_CHANGED_EARLIER_SECTION_INTRO,
    whatChangedLabel: WHAT_CHANGED_WHAT_CHANGED_LABEL,
    whyLabel: WHAT_CHANGED_WHY_LABEL,
    evidenceLabel: WHAT_CHANGED_EVIDENCE_LABEL,
    evidenceIntro: WHAT_CHANGED_EVIDENCE_INTRO,
    reentryLabel: WHAT_CHANGED_REENTRY_LABEL,
    reentryIntro: WHAT_CHANGED_REENTRY_INTRO,
    reentryLinks: WHAT_CHANGED_REENTRY_LINKS,
    primary: input.primary ? mapItem(input.primary) : null,
    earlier: input.earlier.map(mapItem),
    evidenceItems: input.evidenceItems.map((evidence) => ({
      id: evidence.id,
      label: evidence.evidenceSummaryLabel,
      sourceTypeLabel: evidence.sourceTypeLabel,
      href: evidence.href,
      linkedAt: formatWhatChangedDateTime(evidence.createdAt),
    })),
  };
}
