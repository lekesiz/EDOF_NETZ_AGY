'use client';

/**
 * Loading Skeleton components for the premium dark dashboard.
 */

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-64 rounded-lg bg-zinc-800" />
          <div className="mt-2 h-4 w-48 rounded bg-zinc-800" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 rounded-lg bg-zinc-800" />
          <div className="h-10 w-24 rounded-lg bg-zinc-700" />
          <div className="h-10 w-24 rounded-lg bg-zinc-800" />
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-zinc-800" />
              <div className="space-y-1">
                <div className="h-4 w-20 rounded bg-zinc-800" />
                <div className="h-3 w-16 rounded bg-zinc-850" />
              </div>
            </div>
            <div className="mt-4 h-8 w-28 rounded bg-zinc-800" />
          </div>
        ))}
      </div>

      {/* Main Charts & Details Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="h-6 w-48 rounded bg-zinc-800" />
          <div className="mt-6 h-72 rounded-lg bg-zinc-850" />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
          <div className="h-6 w-32 rounded bg-zinc-800" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-800/30">
                <div className="h-4 w-32 rounded bg-zinc-800" />
                <div className="h-4 w-20 rounded bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 rounded-lg bg-zinc-800" />
          <div className="mt-2 h-4 w-60 rounded bg-zinc-800" />
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="h-10 flex-1 rounded-lg bg-zinc-800" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-24 rounded-lg bg-zinc-800" />
          ))}
        </div>
      </div>

      {/* Table Skeletons */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30">
        <div className="flex gap-4 border-b border-zinc-800 bg-zinc-900/80 px-6 py-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 flex-1 rounded bg-zinc-800" />
          ))}
        </div>
        <div className="divide-y divide-zinc-800/50">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 px-6 py-4">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="h-4 flex-1 rounded bg-zinc-850" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
