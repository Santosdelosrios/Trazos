export default function ClaseDetalleLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in-up pb-12">
      {/* Breadcrumb */}
      <div className="h-4 w-32 bg-surface-100 rounded animate-pulse" />

      {/* Header card */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-surface-200">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-surface-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-7 w-3/4 bg-surface-200 rounded-lg animate-pulse" />
            <div className="h-4 w-2/3 bg-surface-100 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* 2-column content */}
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-white p-6 shadow-sm border border-surface-200 space-y-4">
            <div className="h-5 w-32 bg-surface-200 rounded animate-pulse" />
            <div className="space-y-3">
              <div className="h-4 w-full bg-surface-100 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-surface-100 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-surface-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
