export default function PerfilLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-fade-in-up pb-12">
      {/* Header card */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-surface-200">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-surface-200 animate-pulse" />
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <div className="h-7 w-48 bg-surface-200 rounded mx-auto sm:mx-0 animate-pulse" />
            <div className="h-4 w-64 bg-surface-100 rounded mx-auto sm:mx-0 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-white p-5 shadow-sm border border-surface-200">
            <div className="h-10 w-16 bg-surface-200 rounded animate-pulse mb-2" />
            <div className="h-3 w-24 bg-surface-100 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Sections */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-white p-6 shadow-sm border border-surface-200 space-y-4">
          <div className="h-5 w-40 bg-surface-200 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-surface-100 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-surface-100 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
