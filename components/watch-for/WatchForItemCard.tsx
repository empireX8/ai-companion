import Link from "next/link";

import { PublicLinkedObjectContinuity } from "@/lib/public-continuity-display";
import type { WatchForListItem } from "@/lib/public-intelligence-safe-slice";
import {
  toWatchForFieldActionHint,
  formatWatchForListDateTime,
} from "@/lib/watch-for-surface";
import type { FieldworkStatus } from "@prisma/client";

export function WatchForItemCard({
  item,
  verifiedHref,
  status,
}: {
  item: WatchForListItem;
  verifiedHref: string | null;
  status: FieldworkStatus;
}) {
  const actionHint = toWatchForFieldActionHint(status);

  return (
    <article className="ml-material rounded-2xl p-5 transition-colors hover:bg-white/[0.02]">
      <Link href={item.detailHref} className="group block">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan/75">
            {item.statusLabel}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {item.linkedObjectTypeLabel}
          </span>
          {actionHint ? (
            <span className="text-[10px] font-medium text-muted-foreground/80">
              · {actionHint}
            </span>
          ) : null}
        </div>
        <h2 className="text-[16px] font-medium leading-snug group-hover:text-cyan transition-colors">
          {item.prompt}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground line-clamp-3">
          {item.reason}
        </p>
      </Link>

      <div className="mt-4 border-t ml-hairline pt-3">
        <PublicLinkedObjectContinuity
          objectType={item.linkedObjectType}
          objectId={item.linkedObjectId}
          href={verifiedHref}
          context="linked_target"
        />
        <div className="label-meta mt-2">
          Updated {formatWatchForListDateTime(item.updatedAt)}
          {typeof item.priority === "number" ? ` · Priority ${item.priority}` : ""}
        </div>
      </div>
    </article>
  );
}
