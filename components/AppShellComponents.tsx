// Shared page layout primitives — workbench-aware headers.

export function PageHeader({
  eyebrow,
  title,
  meta,
  right,
  compact,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
  right?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-end justify-between gap-6 ${compact ? "mb-5" : "mb-8"}`}>
      <div>
        {eyebrow ? (
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h1
          className={
            compact
              ? "text-xl font-semibold tracking-tight text-foreground"
              : "text-[28px] font-semibold leading-tight tracking-tight text-foreground text-balance"
          }
        >
          {title}
        </h1>
        {meta ? (
          <div className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {children}
      </div>
      {right}
    </div>
  );
}
