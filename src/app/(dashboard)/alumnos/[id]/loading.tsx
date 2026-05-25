export default function AlumnoDetalleLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-in-up pb-12">
      {/* Breadcrumb */}
      <div className="space-y-4">
        <div className="h-4 w-48 bg-surface-100 rounded-md animate-pulse" />

        {/* Header card */}
        <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-surface-200">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-surface-200 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-7 w-48 bg-surface-200 rounded-lg animate-pulse" />
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-surface-100 rounded-md animate-pulse" />
                <div className="h-6 w-24 bg-surface-100 rounded-md animate-pulse" />
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <div className="h-10 w-full sm:w-32 bg-surface-100 rounded-xl animate-pulse" />
            <div className="h-10 w-full sm:w-36 bg-primary-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Evolución */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl bg-white shadow-sm border border-surface-200 overflow-hidden">
            <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-surface-100 bg-surface-50/50">
              <div className="h-6 w-40 bg-surface-200 rounded animate-pulse" />
              <div className="h-3 w-56 bg-surface-100 rounded mt-2 animate-pulse" />
            </div>
            <div className="divide-y divide-surface-100">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-3 py-4 sm:px-6 flex items-center gap-4">
                  <div className="h-4 flex-1 bg-surface-100 rounded animate-pulse" />
                  <div className="h-8 w-10 bg-surface-100 rounded-lg animate-pulse" />
                  <div className="h-5 w-5 bg-surface-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl bg-white shadow-sm border border-surface-200 overflow-hidden">
            <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-surface-100 bg-surface-50/50">
              <div className="h-6 w-32 bg-surface-200 rounded animate-pulse" />
            </div>
            <div className="p-4 sm:p-6 space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-16 bg-surface-100 rounded animate-pulse" />
                  <div className="h-4 w-3/4 bg-surface-200 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-surface-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
