export default function Loading() {
  return (
    <div className="space-y-6 mx-auto max-w-5xl animate-pulse-soft">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-8 w-48 bg-surface-200 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-surface-200 rounded-md" />
        </div>
        <div className="h-10 w-40 bg-surface-200 rounded-xl" />
      </div>

      {/* Filter Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="h-11 w-full bg-surface-200 rounded-xl" />
      </div>

      {/* Table Skeleton */}
      <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
        <div className="w-full">
          {/* Header */}
          <div className="bg-surface-50 h-12 w-full border-b border-surface-200" />
          {/* Rows */}
          <div className="divide-y divide-surface-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 sm:px-6">
                <div className="space-y-2">
                  <div className="h-5 w-16 bg-surface-200 rounded-md" />
                  <div className="h-3 w-12 bg-surface-200 rounded-md" />
                </div>
                <div className="h-5 w-32 bg-surface-200 rounded-md" />
                <div className="h-5 w-48 bg-surface-200 rounded-md hidden sm:block" />
                <div className="h-6 w-12 bg-surface-200 rounded-lg" />
                <div className="h-4 w-12 bg-surface-200 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
