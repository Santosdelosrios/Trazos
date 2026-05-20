export default function HitosLoading() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-32 bg-surface-200 rounded-lg animate-pulse" />
        <div className="h-4 w-64 bg-surface-100 rounded animate-pulse" />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 bg-surface-100 rounded-full animate-pulse shrink-0" />
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-2xl bg-white p-5 shadow-sm border border-surface-200 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary-100 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-surface-200 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-surface-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="h-3 w-full bg-surface-100 rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-surface-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
