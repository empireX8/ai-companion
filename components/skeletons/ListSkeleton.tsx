export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* fake header + controls */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-36 animate-pulse rounded-md bg-muted" />
        <div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 flex-1 animate-pulse rounded-md bg-muted" />
        <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
      </div>
      {/* card grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-md border border-border bg-card p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-muted" />
            <div className="mt-4 space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            </div>
            <div className="mt-4 h-3 w-1/4 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
