import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import type { WhatChangedListItem } from "@/lib/public-intelligence-safe-slice";
import {
  formatWhatChangedDateTime,
  toWhatChangedMovementTitle,
} from "@/lib/what-changed-surface";

import { WhatChangedInspectorButton } from "./WhatChangedInspectorButton";

export function WhatChangedMovementCard({ item }: { item: WhatChangedListItem }) {
  return (
    <article className="ml-material rounded-2xl p-5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-cyan/75">
        {item.updateTypeLabel} · {item.affectedObjectTypeLabel}
      </div>
      <p className="text-[14px] font-medium leading-snug text-foreground">
        {toWhatChangedMovementTitle(item)}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground line-clamp-3">
        {item.userFacingSummary}
      </p>
      <div className="mt-4 border-t ml-hairline pt-3">
        <PublicLinkedObjectContinuity
          objectType={item.affectedObjectType}
          objectId={item.affectedObjectId}
          href={item.affectedObjectHref}
          context="model_update"
        />
        <div className="label-meta mt-2">
          Recorded {formatWhatChangedDateTime(item.createdAt)}
        </div>
        <WhatChangedInspectorButton item={item} />
      </div>
    </article>
  );
}
