export function Skeleton({ className = '' }) {
  return (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`} />
  )
}

export function SkeletonCard() {
  return (
    <div className="card space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="card">
      <div className="space-y-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Pulse skeleton */}
      <Skeleton className="h-24 w-full rounded-xl" />
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}
