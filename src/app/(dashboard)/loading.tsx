export default function DashboardGlobalLoading() {
  return (
    <div className="animate-fade-in-up space-y-6 max-w-4xl">
      {/* Skeleton Title */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-surface-200 rounded-xl animate-pulse"></div>
        <div className="space-y-2">
          <div className="h-8 w-48 bg-surface-200 rounded-lg animate-pulse"></div>
          <div className="h-4 w-72 bg-surface-100 rounded-md animate-pulse"></div>
        </div>
      </div>

      {/* Skeleton Filters/Actions row */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="h-10 w-full sm:w-64 bg-surface-100 rounded-xl animate-pulse"></div>
        <div className="h-10 w-full sm:w-32 bg-primary-100 rounded-xl animate-pulse"></div>
      </div>

      {/* Notebook paper skeleton layout */}
      <div className="trazos-card overflow-hidden">
        <div className="trazos-tape !left-6 !top-[-4px] !w-16 !bg-surface-200 !opacity-40"></div>
        
        {/* Header row */}
        <div className="border-b border-surface-100 bg-surface-50 px-6 py-4 flex gap-4">
          <div className="h-4 w-1/4 bg-surface-200 rounded animate-pulse"></div>
          <div className="h-4 w-1/4 bg-surface-200 rounded animate-pulse"></div>
          <div className="h-4 w-1/4 bg-surface-200 rounded animate-pulse"></div>
        </div>

        {/* List items */}
        <div className="divide-y divide-surface-100">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-surface-100 rounded-full animate-pulse flex-shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-5 w-1/3 bg-surface-200 rounded animate-pulse"></div>
                <div className="h-3 w-1/4 bg-surface-100 rounded animate-pulse"></div>
              </div>
              <div className="w-20 h-8 bg-surface-100 rounded-lg animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
