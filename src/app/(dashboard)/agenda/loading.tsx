export default function AgendaLoading() {
  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-surface-200 rounded-lg animate-pulse" />
          <div className="h-4 w-56 bg-surface-100 rounded-md animate-pulse" />
        </div>
        <div className="h-11 w-40 bg-primary-200 rounded-xl animate-pulse" />
      </div>

      {/* Week nav */}
      <div className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white p-3 shadow-sm">
        <div className="h-9 w-9 bg-surface-100 rounded-lg animate-pulse" />
        <div className="h-5 w-48 bg-surface-200 rounded animate-pulse" />
        <div className="h-9 w-9 bg-surface-100 rounded-lg animate-pulse" />
      </div>

      {/* Calendar grid skeleton */}
      <div className="rounded-3xl border border-surface-200 bg-white shadow-xl overflow-hidden">
        <div className="flex border-b border-surface-100 bg-surface-50/50">
          <div className="w-10 md:w-16 border-r border-surface-100" />
          <div className="flex-1 grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="px-1 py-4 text-center border-r border-surface-100 last:border-r-0">
                <div className="h-3 w-8 mx-auto bg-surface-200 rounded animate-pulse mb-2" />
                <div className="h-6 w-6 mx-auto bg-surface-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex h-[500px]">
          <div className="w-10 md:w-16 flex-none bg-surface-50/30 border-r border-surface-100" />
          <div className="flex-1 grid grid-cols-7 gap-px bg-surface-100">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="bg-white p-2 space-y-2">
                {i % 3 === 0 && <div className="h-12 bg-primary-100 rounded-lg animate-pulse" />}
                {i % 4 === 0 && <div className="h-8 bg-primary-100 rounded-lg animate-pulse mt-8" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
