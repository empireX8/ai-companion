"use client";

import { cn } from "@/lib/utils";
import {
  formatYourMapDateTime,
  toYourMapListRowMeta,
  type YourMapRailGroup,
} from "@/lib/your-map-surface";
import type { UserMapConclusionPublicApiListItem } from "@/lib/public-intelligence-safe-slice";

function YourMapRailRow({
  item,
  isSelected,
  onSelect,
}: {
  item: UserMapConclusionPublicApiListItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onSelect(item.id);
      }}
      className={cn(
        "ml-calm w-full rounded-lg px-3 py-2.5 text-left transition-colors",
        isSelected
          ? "bg-cyan/10 ring-1 ring-inset ring-cyan/25"
          : "hover:bg-white/[0.03]"
      )}
    >
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-cyan/70">
        {toYourMapListRowMeta(item)}
      </div>
      <div className="text-[14px] font-medium leading-snug text-foreground line-clamp-2">
        {item.title}
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
        {item.summary}
      </p>
      <div className="label-meta mt-2">
        {item.evidenceCount} linked evidence
        {item.evidenceCount === 1 ? " source" : " sources"} · Updated{" "}
        {formatYourMapDateTime(item.updatedAt)}
      </div>
    </button>
  );
}

export function YourMapListRail({
  groups,
  selectedId,
  onSelect,
}: {
  groups: YourMapRailGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Map conclusions" className="space-y-5">
      {groups.map((group) => (
        <section key={group.key}>
          <h3
            className={cn(
              "mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide",
              group.deferred ? "text-muted-foreground/70" : "text-muted-foreground"
            )}
          >
            {group.label}
            {group.deferred ? (
              <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/60">
                · archived
              </span>
            ) : null}
          </h3>
          <div className="space-y-1.5">
            {group.items.map((item) => (
              <YourMapRailRow
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}
