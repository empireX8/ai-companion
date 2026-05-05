"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader, SectionLabel } from "@/components/AppShell";
import {
  fetchLibraryDetail,
  toLibraryBodyPreview,
  toLibraryDateTimeLabel,
  type LibraryDetailView,
} from "@/lib/library-surface";
import {
  ArrowLeft,
  BookText,
  MessageCircle,
  Compass,
  CircleDot,
  Image as ImageIcon,
  Receipt,
  Tag,
  Link2,
  Sparkles,
  Clock,
  ExternalLink,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

const TYPE_ICON = {
  Journal: BookText,
  "Journal Chat": MessageCircle,
  Explore: Compass,
  "Check-in": CircleDot,
  Media: ImageIcon,
  Receipts: Receipt,
} as const;

export default function LibraryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();

  const [detail, setDetail] = useState<LibraryDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextDetail = await fetchLibraryDetail(id);
        if (!cancelled) {
          setDetail(nextDetail);
          if (!nextDetail) {
            setError("Item not found.");
          }
        }
      } catch {
        if (!cancelled) {
          setDetail(null);
          setError("Could not load item.");
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
  }, [id]);

  if (loading) {
    return (
      <div className="px-12 py-10 max-w-[860px] mx-auto animate-fade-in">
        <button
          onClick={() => router.back()}
          className="label-meta inline-flex items-center gap-1.5 text-meta hover:text-white mb-6"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} /> Back
        </button>
        <div className="card-standard px-6 py-14 text-center">
          <div className="text-[14px] text-[hsl(216_11%_75%)] mb-1">Loading item…</div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="px-12 py-10 max-w-[860px] mx-auto animate-fade-in">
        <button
          onClick={() => router.back()}
          className="label-meta inline-flex items-center gap-1.5 text-meta hover:text-white mb-6"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} /> Back
        </button>
        <div className="card-standard px-6 py-14 text-center">
          <div className="text-[14px] text-[hsl(12_80%_64%)] mb-1">{error ?? "Item not found."}</div>
          <Link href="/library" className="label-meta text-cyan hover:underline">
            Return to Library
          </Link>
        </div>
      </div>
    );
  }

  const Icon = TYPE_ICON[detail.item.type];

  return (
    <div className="min-h-screen animate-fade-in">
      <div className="sticky top-0 z-10 px-12 py-4 border-b hairline bg-background/80 backdrop-blur-sm">
        <div className="max-w-[860px] mx-auto flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="label-meta inline-flex items-center gap-1.5 text-meta hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={1.5} /> Library
          </button>
          <div className="label-meta inline-flex items-center gap-2 text-meta">
            <Icon className="h-3 w-3 text-cyan/70" strokeWidth={1.5} />
            <span className="text-cyan/70">{detail.item.type}</span>
            <span>·</span>
            <span>{detail.item.date}</span>
          </div>
        </div>
      </div>

      <div className="px-12 py-10 max-w-[860px] mx-auto">
        <PageHeader eyebrow={`${detail.item.type} · ${detail.item.date}`} title={detail.item.title} />

        {detail.kind === "journal" ? <JournalView detail={detail} /> : null}
        {detail.kind === "session" ? <SessionView detail={detail} /> : null}
        {detail.kind === "checkin" ? <CheckInView detail={detail} /> : null}
        {detail.kind === "receipt" ? <ReceiptView detail={detail} /> : null}

        {detail.item.linked.length > 0 ? (
          <div className="mt-8">
            <SectionLabel>Linked</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {detail.item.linked.map((linked, index) => {
                const path =
                  linked.kind === "Pattern"
                    ? "/patterns"
                    : linked.kind === "Tension"
                      ? "/contradictions"
                      : "/timeline";

                return (
                  <Link
                    key={`${linked.kind}-${linked.label}-${index}`}
                    href={path}
                    className="card-standard px-3 h-8 inline-flex items-center text-[12px] hover:border-[hsl(187_100%_50%/0.3)]"
                  >
                    <Link2 className="h-2.5 w-2.5 mr-1.5 text-cyan/70" strokeWidth={1.5} />
                    <span className="text-cyan/70 label-meta mr-2">{linked.kind}</span>
                    {linked.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function JournalView({ detail }: { detail: Extract<LibraryDetailView, { kind: "journal" }> }) {
  const paragraphs = detail.entry.body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  return (
    <>
      <div className="card-standard p-7 mb-6">
        <div className="prose prose-invert text-[15px] leading-[1.75] text-[hsl(216_11%_82%)] space-y-4">
          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
          ) : (
            <p>{toLibraryBodyPreview(detail.entry.body)}</p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-6 pt-5 border-t hairline">
          <Chip icon={Clock}>{toLibraryDateTimeLabel(detail.entry.authoredAt ?? detail.entry.createdAt)}</Chip>
          <Chip icon={Tag}>Journal</Chip>
        </div>
      </div>
    </>
  );
}

function SessionView({ detail }: { detail: Extract<LibraryDetailView, { kind: "session" }> }) {
  const modeLabel =
    detail.mode === "journal_chat"
      ? "Guided reflection"
      : detail.mode === "explore_chat"
        ? "Open exploration"
        : "Imported archive";

  return (
    <>
      <div className="flex items-center gap-3 mb-5 label-meta text-meta">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-cyan/70" strokeWidth={1.5} />
          {modeLabel}
        </span>
        <span>·</span>
        <span>{toLibraryDateTimeLabel(detail.session.startedAt)}</span>
      </div>

      {detail.messages.length === 0 ? (
        <div className="card-standard p-5 text-[13px] text-meta">No messages in this session yet.</div>
      ) : (
        <div className="space-y-5">
          {detail.messages.map((message) => (
            <div key={message.id} className={`max-w-[640px] ${message.role === "user" ? "ml-auto" : ""}`}>
              <div className="label-meta mb-1.5 text-meta">
                {message.role === "user"
                  ? "You"
                  : detail.mode === "journal_chat"
                    ? "Reflection"
                    : detail.mode === "explore_chat"
                      ? "Exploration"
                      : "Imported"}
              </div>
              <div
                className={`px-5 py-4 rounded-lg text-[14px] leading-relaxed whitespace-pre-wrap ${
                  message.role === "user"
                    ? "bg-[hsl(187_100%_50%/0.04)] border border-[hsl(187_100%_50%/0.12)] text-white"
                    : "card-standard text-[hsl(216_11%_82%)]"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CheckInView({ detail }: { detail: Extract<LibraryDetailView, { kind: "checkin" }> }) {
  const checkIn = detail.checkIn;

  return (
    <>
      <div className="card-focal p-7 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="text-[22px] font-semibold tracking-tight">{detail.item.mood ?? "Check-in"}</div>
          <div className="ml-auto label-meta inline-flex items-center gap-1.5 text-meta">
            <Clock className="h-3 w-3" strokeWidth={1.5} />
            {toLibraryDateTimeLabel(checkIn.createdAt)}
          </div>
        </div>

        {checkIn.note ? (
          <div className="text-[15px] leading-relaxed text-[hsl(216_11%_82%)] mb-5">{checkIn.note}</div>
        ) : null}

        <div className="flex items-center gap-2 pt-5 border-t hairline flex-wrap">
          {checkIn.eventTags.length > 0 ? (
            checkIn.eventTags.map((eventTag) => (
              <Chip key={eventTag} icon={Tag}>
                {eventTag.replace(/_/g, " ")}
              </Chip>
            ))
          ) : (
            <span className="label-meta text-meta">No event tags</span>
          )}
        </div>
      </div>
    </>
  );
}

function ReceiptView({ detail }: { detail: Extract<LibraryDetailView, { kind: "receipt" }> }) {
  const receipt = detail.receipt;
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  return (

    <>
      <div className="card-standard p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="h-4 w-4 text-cyan/70" strokeWidth={1.5} />
          <span className="label-meta text-cyan/70">Receipt · {receipt.conclusionType}</span>
        </div>

        <div className="text-[15px] leading-relaxed text-[hsl(216_11%_82%)] mb-4">
          {receipt.conclusionTitle}
        </div>

        <div className="label-meta text-meta mb-4">
          This is the context MindLab used.
        </div>
      </div>

      <SectionLabel>Supporting evidence</SectionLabel>
      {receipt.evidenceItems.length === 0 ? (
        <div className="card-standard p-4 text-[13px] text-meta mb-6">No evidence items available.</div>
      ) : (
        <div className="space-y-3 mb-6">
          {receipt.evidenceItems.map((item, index) => {
            const quote = item.quote ?? "No quote stored.";
            const isExpanded = expandedIds.includes(String(index));
            const isLong = quote.length > 360;

            return (
              <div key={index} className="card-standard p-4">
                <div className="label-meta mb-2 text-meta">
                  {item.sourceDate ? (
                    <span>{item.sourceDate} · </span>
                  ) : null}
                  {item.sourceLabel ?? "Evidence"}
                </div>
                <div className={`text-[14px] leading-relaxed text-[hsl(216_11%_82%)] ${isExpanded ? "" : "line-clamp-4"}`}>
                  {isExpanded ? quote : quote.length > 360 ? `${quote.slice(0, 359).trimEnd()}…` : quote}
                </div>
                {isLong ? (
                  <button
                    type="button"
                    className="mt-2 label-meta hover:text-white transition-colors"
                    onClick={() =>
                      setExpandedIds((current) =>
                        current.includes(String(index))
                          ? current.filter((id) => id !== String(index))
                          : [...current, String(index)]
                      )
                    }
                  >
                    {isExpanded ? "Show less" : "Show more"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="label-meta text-meta mb-6">
        Receipts are supporting evidence, not proof.
      </div>

      {receipt.linkedHref ? (
        <Link
          href={receipt.linkedHref}
          className="card-standard px-4 h-9 inline-flex items-center gap-2 text-[12.5px] hover:border-[hsl(187_100%_50%/0.3)]"
        >
          <ExternalLink className="h-3.5 w-3.5 text-cyan/70" strokeWidth={1.5} />
          {receipt.linkedLabel ?? "View source"}
        </Link>
      ) : null}
    </>
  );
}

function Chip({
  icon: Icon,
  children,
}: {
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-white/[0.03] border hairline text-[12px] text-[hsl(216_11%_75%)]">
      {Icon ? <Icon className="h-3 w-3 text-meta" strokeWidth={1.5} /> : null}
      {children}
    </span>
  );
}
