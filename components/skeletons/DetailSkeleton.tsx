export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* back link placeholder */}
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      {/* title + subtitle */}
      <div className="space-y-2">
        <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
      {/* action buttons row */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-7 w-16 animate-pulse rounded-md border border-border bg-muted"
          />
        ))}
      </div>
      {/* two content cards (e.g. Side A / Side B) */}
      {[0, 1].map((i) => (
        <div key={i} className="rounded-md border border-border bg-card p-4">
          <div className="h-3 w-14 animate-pulse rounded bg-muted" />
          <div className="mt-3 space-y-1.5">
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
