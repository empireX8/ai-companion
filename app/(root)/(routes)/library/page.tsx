"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/AppShell";
import { fetchLibraryItems, type LibraryItemView } from "@/lib/library-surface";
import {
  Search,
  BookText,
  MessageCircle,
  Compass,
  CircleDot,
  Image as ImageIcon,
  Receipt,
  X,
  ArrowUpDown,
  Link2,
  ChevronRight,
} from "lucide-react";

type SortKey = "newest" | "oldest" | "signals" | "title";

const categories = [
  { id: "all", label: "All", icon: null },
  { id: "Journal", label: "Journal Entries", icon: BookText },
  { id: "Journal Chat", label: "Journal Chat", icon: MessageCircle },
  { id: "Explore", label: "Explore", icon: Compass },
  { id: "Check-in", label: "Check-ins", icon: CircleDot },
  { id: "Media", label: "Media", icon: ImageIcon },
  { id: "Receipts", label: "Receipts", icon: Receipt },
] as const;

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cat, setCat] = useState<string>("all");
  const [activeMoods, setActiveMoods] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeLinks, setActiveLinks] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextItems = await fetchLibraryItems();
        if (!cancelled) {
          setItems(nextItems);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setError("Could not load Library.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const allMoods = useMemo(
    () => Array.from(new Set(items.map((item) => item.mood).filter((value): value is string => Boolean(value)))).sort(),
    [items]
  );

  const allTags = useMemo(
    () => Array.from(new Set(items.flatMap((item) => item.tags))).sort(),
    [items]
  );

  const allLinks = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      for (const linked of item.linked) {
        set.add(`${linked.kind} · ${linked.label}`);
      }
    }
    return Array.from(set).sort();
  }, [items]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  const counts = useMemo(() => {
    const next: Record<string, number> = { all: items.length };
    for (const item of items) {
      next[item.type] = (next[item.type] ?? 0) + 1;
    }
    return next;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = items.filter((item) => {
      if (cat !== "all" && item.type !== cat) return false;
      if (activeMoods.length > 0 && (!item.mood || !activeMoods.includes(item.mood))) return false;
      if (activeTags.length > 0 && !item.tags.some((tag) => activeTags.includes(tag))) return false;
      if (
        activeLinks.length > 0 &&
        !item.linked.some((linked) => activeLinks.includes(`${linked.kind} · ${linked.label}`))
      ) {
        return false;
      }

      if (!q) {
        return true;
      }

      const haystack = [
        item.title,
        item.preview ?? "",
        item.mood ?? "",
        item.tags.join(" "),
        item.linked.map((linked) => `${linked.kind} ${linked.label}`).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    const sorted = [...matching];

    switch (sort) {
      case "newest":
        sorted.sort((left, right) => right.sortKey - left.sortKey);
        break;
      case "oldest":
        sorted.sort((left, right) => left.sortKey - right.sortKey);
        break;
      case "signals":
        sorted.sort((left, right) => right.signals - left.signals || right.sortKey - left.sortKey);
        break;
      case "title":
        sorted.sort((left, right) => left.title.localeCompare(right.title));
        break;
    }

    return sorted;
  }, [items, cat, activeMoods, activeTags, activeLinks, query, sort]);

  const hasFilters =
    cat !== "all" ||
    activeMoods.length + activeTags.length + activeLinks.length > 0 ||
    query.length > 0;

  return (
    <div className="flex h-screen">
      <div className="w-[280px] shrink-0 border-r hairline overflow-y-auto p-5">
        <h2 className="text-[15px] font-semibold mb-1">Library</h2>
        <div className="label-meta mb-5">Organized archive</div>

        <div className="label-meta mb-2">Categories</div>
        <div className="space-y-0.5 mb-6">
          {categories.map((category) => {
            const Icon = category.icon;
            const active = cat === category.id;
            const count = counts[category.id] ?? 0;

            return (
              <button
                key={category.id}
                onClick={() => setCat(category.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] transition-colors ${
                  active
                    ? "bg-[hsl(187_100%_50%/0.06)] text-cyan border border-[hsl(187_100%_50%/0.18)]"
                    : "text-[hsl(216_11%_70%)] hover:text-white border border-transparent"
                }`}
              >
                {Icon ? (
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                ) : (
                  <span className="h-1 w-1 rounded-full bg-meta" />
                )}
                <span className="flex-1 text-left">{category.label}</span>
                <span className="label-meta">{count}</span>
              </button>
            );
          })}
        </div>

        {allMoods.length > 0 ? (
          <FilterGroup label="Moods">
            {allMoods.map((mood) => (
              <Pill
                key={mood}
                on={activeMoods.includes(mood)}
                onClick={() => setActiveMoods((state) => toggle(state, mood))}
              >
                {mood}
              </Pill>
            ))}
          </FilterGroup>
        ) : null}

        {allTags.length > 0 ? (
          <FilterGroup label="Tags">
            {allTags.map((tag) => (
              <Pill
                key={tag}
                on={activeTags.includes(tag)}
                onClick={() => setActiveTags((state) => toggle(state, tag))}
              >
                #{tag}
              </Pill>
            ))}
          </FilterGroup>
        ) : null}

        {allLinks.length > 0 ? (
          <FilterGroup label="Linked to">
            {allLinks.map((linkValue) => {
              const [kind, ...rest] = linkValue.split(" · ");
              return (
                <Pill
                  key={linkValue}
                  on={activeLinks.includes(linkValue)}
                  onClick={() => setActiveLinks((state) => toggle(state, linkValue))}
                >
                  <Link2 className="h-2.5 w-2.5 mr-1 inline" strokeWidth={1.5} />
                  <span className="text-cyan/70 mr-1">{kind}</span>
                  {rest.join(" · ")}
                </Pill>
              );
            })}
          </FilterGroup>
        ) : null}

        {hasFilters ? (
          <button
            onClick={() => {
              setCat("all");
              setActiveMoods([]);
              setActiveTags([]);
              setActiveLinks([]);
              setQuery("");
            }}
            className="label-meta text-meta hover:text-white mt-2"
          >
            Clear all filters
          </button>
        ) : null}
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-10 py-10 max-w-[1100px]">
          <PageHeader title="Library" meta={`${filtered.length} of ${items.length} items`} />

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-meta" strokeWidth={1.5} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search across titles, previews, moods, tags, links…"
                className="w-full h-10 pl-9 pr-9 rounded-md bg-[hsl(213_41%_9%)] border hairline text-[13px] focus:outline-none focus:border-[hsl(187_100%_50%/0.3)]"
              />
              {query ? (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-meta hover:text-white"
                >
                  <X className="h-3 w-3" strokeWidth={1.5} />
                </button>
              ) : null}
            </div>
            <div className="relative">
              <ArrowUpDown
                className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-meta pointer-events-none"
                strokeWidth={1.5}
              />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="h-10 pl-9 pr-3 rounded-md bg-[hsl(213_41%_9%)] border hairline text-[12.5px] text-[hsl(216_11%_75%)] focus:outline-none focus:border-[hsl(187_100%_50%/0.3)]"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="signals">Most signals</option>
                <option value="title">Title (A-Z)</option>
              </select>
            </div>
          </div>

          {activeMoods.length + activeTags.length + activeLinks.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {activeMoods.map((mood) => (
                <ActiveChip key={`m-${mood}`} onRemove={() => setActiveMoods((state) => state.filter((value) => value !== mood))}>
                  Mood · {mood}
                </ActiveChip>
              ))}
              {activeTags.map((tag) => (
                <ActiveChip key={`t-${tag}`} onRemove={() => setActiveTags((state) => state.filter((value) => value !== tag))}>
                  #{tag}
                </ActiveChip>
              ))}
              {activeLinks.map((linkValue) => (
                <ActiveChip key={`l-${linkValue}`} onRemove={() => setActiveLinks((state) => state.filter((value) => value !== linkValue))}>
                  {linkValue}
                </ActiveChip>
              ))}
            </div>
          ) : null}

          {loading ? (
            <div className="card-standard px-6 py-14 text-center">
              <div className="text-[14px] text-[hsl(216_11%_75%)] mb-1">Loading Library…</div>
            </div>
          ) : error ? (
            <div className="card-standard px-6 py-14 text-center">
              <div className="text-[14px] text-[hsl(12_80%_64%)] mb-1">{error}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card-standard px-6 py-14 text-center">
              <div className="text-[14px] text-[hsl(216_11%_75%)] mb-1">Nothing matches these filters.</div>
              <div className="label-meta text-meta">Try removing a filter or widening the search.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => (
                <Row key={item.id} item={item} query={query} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ item, query }: { item: LibraryItemView; query: string }) {
  const visibleTags = item.tags.slice(0, 2);
  const visibleLinks = item.linked.slice(0, 2);

  return (
    <Link
      href={`/library/${item.id}`}
      className="card-standard px-5 py-4 hover:border-[hsl(187_100%_50%/0.25)] hover:bg-white/[0.015] transition-colors cursor-pointer block group"
    >
      <div className="flex items-center gap-4">
        <div className="label-meta w-16 shrink-0">{item.date}</div>
        <div className="label-meta text-cyan/70 px-2 h-5 rounded bg-[hsl(187_100%_50%/0.06)] inline-flex items-center w-[110px] shrink-0 justify-center">
          {item.type}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-medium leading-snug truncate">
            <Highlight text={item.title} query={query} />
          </div>
          {item.preview ? (
            <div className="text-[12px] text-meta truncate mt-0.5">
              <Highlight text={item.preview} query={query} />
            </div>
          ) : null}
        </div>
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          {item.mood ? (
            <span className="label-meta px-1.5 h-5 inline-flex items-center rounded bg-white/[0.04] text-[hsl(216_11%_75%)]">
              <Highlight text={item.mood} query={query} />
            </span>
          ) : null}
          {visibleTags.map((tag) => (
            <span key={tag} className="label-meta px-1.5 h-5 inline-flex items-center rounded bg-white/[0.03] text-meta">
              #<Highlight text={tag} query={query} />
            </span>
          ))}
        </div>
        {visibleLinks.length > 0 ? (
          <div className="hidden lg:flex items-center gap-1 shrink-0 max-w-[280px]">
            {visibleLinks.map((linked, index) => (
              <span
                key={`${linked.kind}-${linked.label}-${index}`}
                className="label-meta inline-flex items-center px-2 h-5 rounded bg-white/[0.03] truncate max-w-[160px]"
              >
                <Link2 className="h-2.5 w-2.5 mr-1 text-cyan/70 shrink-0" strokeWidth={1.5} />
                <span className="text-cyan/70 mr-1">{linked.kind}</span>
                <span className="truncate">
                  <Highlight text={linked.label} query={query} />
                </span>
              </span>
            ))}
            {item.linked.length > visibleLinks.length ? (
              <span className="label-meta text-meta">+{item.linked.length - visibleLinks.length}</span>
            ) : null}
          </div>
        ) : null}
        <div className="label-meta text-meta w-10 text-right shrink-0">
          {item.signals > 0 ? `${item.signals}↗` : "—"}
        </div>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-meta opacity-0 group-hover:opacity-100 group-hover:text-cyan transition-opacity"
          strokeWidth={1.5}
        />
      </div>
    </Link>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="label-meta mb-2">{label}</div>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 h-6 rounded text-[11px] tracking-wide border transition-colors ${
        on
          ? "bg-[hsl(187_100%_50%/0.12)] border-[hsl(187_100%_50%/0.4)] text-cyan"
          : "border-white/[0.06] bg-white/[0.02] text-meta hover:text-white hover:border-white/15"
      }`}
    >
      {children}
    </button>
  );
}

function ActiveChip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 h-6 rounded bg-[hsl(187_100%_50%/0.08)] border border-[hsl(187_100%_50%/0.25)] text-[11px] text-cyan">
      {children}
      <button onClick={onRemove} className="text-cyan/60 hover:text-cyan">
        <X className="h-2.5 w-2.5" strokeWidth={1.5} />
      </button>
    </span>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;

  const parts = text.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")})`, "ig"));

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark key={index} className="bg-[hsl(187_100%_50%/0.18)] text-cyan rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}
