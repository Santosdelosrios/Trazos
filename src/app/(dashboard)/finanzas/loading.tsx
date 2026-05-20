export default function FinanzasLoading() {
  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-40 bg-surface-200 rounded-lg animate-pulse" />
        <div className="h-4 w-72 bg-surface-100 rounded animate-pulse" />
      </div>

      {/* 4-card summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-surface-200">
            <div className="h-3 w-20 bg-surface-100 rounded animate-pulse mb-3" />
            <div className="h-8 w-24 bg-surface-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Action cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-white p-6 shadow-sm border border-surface-200 space-y-3">
            <div className="h-6 w-32 bg-surface-200 rounded animate-pulse" />
            <div className="h-4 w-full bg-surface-100 rounded animate-pulse" />
            <div className="h-10 w-32 bg-primary-100 rounded-xl animate-pulse mt-4" />
          </div>
        ))}
      </div>

      {/* List */}
      <div className="rounded-2xl bg-white shadow-sm border border-surface-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-100 bg-surface-50/50">
          <div className="h-5 w-40 bg-surface-200 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-surface-100">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 sm:p-6 flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 bg-surface-200 rounded animate-pulse" />
                <div className="h-3 w-1/4 bg-surface-100 rounded animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-success-100 rounded-md animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
