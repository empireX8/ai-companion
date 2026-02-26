import {
  AlertCircle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock3,
  History,
} from "lucide-react";
import { FormEvent, ReactNode, useMemo } from "react";

type ReferenceType =
  | "rule"
  | "constraint"
  | "pattern"
  | "goal"
  | "preference"
  | "assumption"
  | "hypothesis";

type ReferenceConfidence = "low" | "medium" | "high";

type ReferenceItem = {
  id: string;
  type: ReferenceType;
  confidence: ReferenceConfidence;
  statement: string;
  createdAt: string;
  updatedAt: string;
  status?: "active" | "inactive" | "superseded" | string;
  sourceSessionId?: string | null;
  sourceMessageId?: string | null;
  supersedesId?: string | null;
};

type PendingReferenceItem = {
  id: string;
  type: ReferenceType;
  confidence: ReferenceConfidence;
  statement: string;
  sourceSessionId: string | null;
  sourceMessageId: string | null;
  supersedesId: string | null;
  createdAt: string;
  updatedAt: string;
} | null;

const REFERENCE_TYPES: ReferenceType[] = [
  "rule",
  "constraint",
  "pattern",
  "goal",
  "preference",
  "assumption",
  "hypothesis",
];

const REFERENCE_CONFIDENCE: ReferenceConfidence[] = ["low", "medium", "high"];

const formatRelativeTime = (timestamp: string) => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "just now";
  }

  const diffMs = parsed.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (absMs < minute) return "just now";
  if (absMs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (absMs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (absMs < week) return rtf.format(Math.round(diffMs / day), "day");
  if (absMs < month) return rtf.format(Math.round(diffMs / week), "week");
  if (absMs < year) return rtf.format(Math.round(diffMs / month), "month");
  return rtf.format(Math.round(diffMs / year), "year");
};

export type MemoryPanelProps = {
  savedReferences: ReferenceItem[];
  pendingCandidate: PendingReferenceItem;

  referenceStatement: string;
  setReferenceStatement: (v: string) => void;
  referenceType: ReferenceType;
  setReferenceType: (v: ReferenceType) => void;
  referenceConfidence: ReferenceConfidence;
  setReferenceConfidence: (v: ReferenceConfidence) => void;
  isSavingReference: boolean;
  referenceStatus: string | null;
  onSaveReference: (e: FormEvent<HTMLFormElement>) => Promise<void>;

  updatingReferenceId: string | null;
  deactivatingReferenceId: string | null;
  supersedingReferenceId: string | null;
  editingReferenceId: string | null;

  onStartEditReference: (item: ReferenceItem) => void;
  onStartSupersedeReference: (item: ReferenceItem) => void;
  onDeactivateReference: (id: string) => Promise<void>;
  onUpdateReference: (id: string) => Promise<void>;
  onSupersedeReference: (id: string) => Promise<void>;

  editStatement: string;
  setEditStatement: (v: string) => void;
  editType: ReferenceType;
  setEditType: (v: ReferenceType) => void;
  editConfidence: ReferenceConfidence;
  setEditConfidence: (v: ReferenceConfidence) => void;
  onCancelEdit: () => void;

  replaceStatement: string;
  setReplaceStatement: (v: string) => void;
  replaceType: ReferenceType;
  setReplaceType: (v: ReferenceType) => void;
  replaceConfidence: ReferenceConfidence;
  setReplaceConfidence: (v: ReferenceConfidence) => void;
  onCancelSupersede: () => void;

  onTogglePanel?: () => void;
};

function SectionHeader({
  icon,
  title,
  count,
  accentClass,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  accentClass: string;
  subtitle: string;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={accentClass}>{icon}</span>
          <h3 className="font-display text-xs uppercase tracking-[0.12em] text-foreground">
            {title}
          </h3>
          <span className="text-xs text-text-dim">({count})</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-text-dim/70" />
      </div>
      <p className="text-[11px] text-text-dim">{subtitle}</p>
      <div className="mt-1 mb-2 border-b border-border/40" />
    </>
  );
}

export function MemoryPanel({
  savedReferences,
  pendingCandidate,
  referenceStatement,
  setReferenceStatement,
  referenceType,
  setReferenceType,
  referenceConfidence,
  setReferenceConfidence,
  isSavingReference,
  referenceStatus,
  onSaveReference,
  updatingReferenceId,
  deactivatingReferenceId,
  supersedingReferenceId,
  editingReferenceId,
  onStartEditReference,
  onStartSupersedeReference,
  onDeactivateReference,
  onUpdateReference,
  onSupersedeReference,
  editStatement,
  setEditStatement,
  editType,
  setEditType,
  editConfidence,
  setEditConfidence,
  onCancelEdit,
  replaceStatement,
  setReplaceStatement,
  replaceType,
  setReplaceType,
  replaceConfidence,
  setReplaceConfidence,
  onCancelSupersede,
  onTogglePanel,
}: MemoryPanelProps) {
  const subtleActionClass =
    "rounded-md bg-transparent px-2 py-1 text-[11px] text-text-dim transition-colors hover:text-foreground disabled:opacity-50";

  const { manual, governed, historical } = useMemo(() => {
    const active = savedReferences.filter((item) => (item.status ?? "active") === "active");
    const hasSourceMetadata = savedReferences.some((item) =>
      Object.prototype.hasOwnProperty.call(item, "sourceMessageId")
    );

    const manualItems = hasSourceMetadata
      ? active.filter((item) => (item.sourceMessageId ?? null) === null)
      : active;
    const governedItems = hasSourceMetadata
      ? active.filter((item) => (item.sourceMessageId ?? null) !== null)
      : [];
    const historicalItems = savedReferences.filter((item) => (item.status ?? "active") !== "active");

    return {
      manual: manualItems,
      governed: governedItems,
      historical: historicalItems,
    };
  }, [savedReferences]);

  const renderSection = (
    title: string,
    items: ReferenceItem[],
    icon: ReactNode,
    iconClass: string,
    accentClass: string,
    subtitle: string,
    emptyLabel: string
  ) => {
    if (items.length === 0) {
      return (
        <section className="space-y-3">
          <SectionHeader
            icon={icon}
            title={title}
            count={0}
            accentClass={iconClass}
            subtitle={subtitle}
          />
          <p className="text-xs text-text-dim">{emptyLabel}</p>
        </section>
      );
    }

    return (
      <section className="space-y-3">
        <SectionHeader
          icon={icon}
          title={title}
          count={items.length}
          accentClass={iconClass}
          subtitle={subtitle}
        />

        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={`relative rounded-xl bg-(--memory-card-bg) p-4 shadow-[inset_0_0_0_1px_var(--memory-card-border)] before:absolute before:top-3 before:bottom-3 before:left-0 before:w-0.75 before:rounded-full before:content-[''] ${accentClass}`}
            >
              <p className="text-sm leading-snug text-foreground">{item.statement}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-text-dim">
                <Clock3 className="h-3 w-3 text-text-dim" />
                <span>{formatRelativeTime(item.createdAt)}</span>
                <span>•</span>
                <span className="capitalize">{item.type}</span>
                <span>•</span>
                <span className="capitalize">{item.confidence}</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onStartEditReference(item)}
                  disabled={
                    !!updatingReferenceId ||
                    !!deactivatingReferenceId ||
                    !!supersedingReferenceId
                  }
                  className={subtleActionClass}
                >
                  {editingReferenceId === item.id ? "Editing" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={() => onStartSupersedeReference(item)}
                  disabled={
                    !!updatingReferenceId ||
                    !!deactivatingReferenceId ||
                    !!editingReferenceId
                  }
                  className={subtleActionClass}
                >
                  {supersedingReferenceId === item.id ? "Replacing" : "Supersede"}
                </button>
                <button
                  type="button"
                  onClick={() => void onDeactivateReference(item.id)}
                  disabled={
                    updatingReferenceId === item.id ||
                    deactivatingReferenceId === item.id ||
                    supersedingReferenceId === item.id
                  }
                  className={subtleActionClass}
                >
                  {deactivatingReferenceId === item.id ? "Deactivating..." : "Deactivate"}
                </button>
              </div>

              {editingReferenceId === item.id ? (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={editStatement}
                    onChange={(event) => setEditStatement(event.target.value)}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                    disabled={updatingReferenceId === item.id}
                  />
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={editType}
                      onChange={(event) => setEditType(event.target.value as ReferenceType)}
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                      disabled={updatingReferenceId === item.id}
                    >
                      {REFERENCE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editConfidence}
                      onChange={(event) =>
                        setEditConfidence(event.target.value as ReferenceConfidence)
                      }
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                      disabled={updatingReferenceId === item.id}
                    >
                      {REFERENCE_CONFIDENCE.map((confidence) => (
                        <option key={confidence} value={confidence}>
                          {confidence}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void onUpdateReference(item.id)}
                      disabled={
                        updatingReferenceId === item.id || editStatement.trim().length === 0
                      }
                      className={subtleActionClass}
                    >
                      {updatingReferenceId === item.id ? "Updating..." : "Update"}
                    </button>
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      disabled={updatingReferenceId === item.id}
                      className={subtleActionClass}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {supersedingReferenceId === item.id ? (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={replaceStatement}
                    onChange={(event) => setReplaceStatement(event.target.value)}
                    placeholder="Replace with..."
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                    disabled={updatingReferenceId === item.id}
                  />
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={replaceType}
                      onChange={(event) => setReplaceType(event.target.value as ReferenceType)}
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                      disabled={updatingReferenceId === item.id}
                    >
                      {REFERENCE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <select
                      value={replaceConfidence}
                      onChange={(event) =>
                        setReplaceConfidence(event.target.value as ReferenceConfidence)
                      }
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                      disabled={updatingReferenceId === item.id}
                    >
                      {REFERENCE_CONFIDENCE.map((confidence) => (
                        <option key={confidence} value={confidence}>
                          {confidence}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void onSupersedeReference(item.id)}
                      disabled={
                        updatingReferenceId === item.id || replaceStatement.trim().length === 0
                      }
                      className={subtleActionClass}
                    >
                      {updatingReferenceId === item.id ? "Replacing..." : "Replace"}
                    </button>
                    <button
                      type="button"
                      onClick={onCancelSupersede}
                      disabled={updatingReferenceId === item.id}
                      className={subtleActionClass}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-foreground">
          MEMORY
        </h2>
        {onTogglePanel ? (
          <button
            type="button"
            onClick={onTogglePanel}
            className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="flex-1 space-y-7 overflow-y-auto p-4">
        <section className="rounded-lg border border-border bg-card/40 p-3">
          <p className="text-sm font-semibold">Save memory</p>
          <form onSubmit={onSaveReference} className="mt-2 flex flex-col gap-2">
            <input
              type="text"
              value={referenceStatement}
              onChange={(event) => setReferenceStatement(event.target.value)}
              placeholder="Save a stable preference, goal, or constraint"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              disabled={isSavingReference}
            />

            <div className="flex gap-2">
              <select
                value={referenceType}
                onChange={(event) => setReferenceType(event.target.value as ReferenceType)}
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-2 text-xs"
                disabled={isSavingReference}
              >
                {REFERENCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                value={referenceConfidence}
                onChange={(event) =>
                  setReferenceConfidence(event.target.value as ReferenceConfidence)
                }
                className="rounded-md border border-border bg-background px-2 py-2 text-xs"
                disabled={isSavingReference}
              >
                {REFERENCE_CONFIDENCE.map((confidence) => (
                  <option key={confidence} value={confidence}>
                    {confidence}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isSavingReference || referenceStatement.trim().length === 0}
                className="rounded-md border border-border px-3 py-2 text-xs disabled:opacity-50"
              >
                {isSavingReference ? "Saving..." : "Save"}
              </button>
            </div>
          </form>

          {referenceStatus ? (
            <p className="mt-2 text-xs text-muted-foreground">{referenceStatus}</p>
          ) : null}
        </section>

        {renderSection(
          "Manual",
          manual,
          <CheckCircle2 className="h-3.5 w-3.5" />,
          "text-memory-manual",
          "before:bg-memory-manual/40",
          "Explicitly set",
          "No manual entries"
        )}
        {renderSection(
          "Governed",
          governed,
          <Brain className="h-3.5 w-3.5" />,
          "text-memory-governed",
          "before:bg-memory-governed/40",
          "Derived from conversation",
          "No governed entries"
        )}

        <section className="space-y-3">
          <SectionHeader
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            title="Pending"
            count={pendingCandidate ? 1 : 0}
            accentClass="text-memory-pending"
            subtitle="Awaiting confirmation"
          />

          {pendingCandidate ? (
            <div className="relative rounded-xl bg-memory-pending/10 p-4 shadow-[inset_0_0_0_1px_var(--memory-card-border)] before:absolute before:top-3 before:bottom-3 before:left-0 before:w-0.75 before:rounded-full before:bg-memory-pending/40 before:content-['']">
              <p className="text-sm leading-snug text-foreground">{pendingCandidate.statement}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-text-dim">
                <Clock3 className="h-3 w-3 text-text-dim" />
                <span>{formatRelativeTime(pendingCandidate.createdAt)}</span>
                <span>•</span>
                <span className="capitalize">{pendingCandidate.type}</span>
                <span>•</span>
                <span className="capitalize">{pendingCandidate.confidence}</span>
              </div>
              <p className="mt-1 text-[11px] text-text-dim">Awaiting confirmation in chat</p>
            </div>
          ) : (
            <p className="text-xs text-text-dim">No pending entries</p>
          )}
        </section>

        {historical.length > 0
          ? renderSection(
              "Historical",
              historical,
              <History className="h-3.5 w-3.5" />,
              "text-memory-historical",
              "before:bg-memory-historical/40",
              "Prior states",
              "No historical entries"
            )
          : null}

        <p className="pt-2 text-[11px] text-text-dim">
          {savedReferences.length} entries · {pendingCandidate ? 1 : 0} pending
        </p>
      </div>
    </div>
  );
}
