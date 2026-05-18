export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse-soft mx-auto max-w-4xl">
      <div className="flex justify-between items-center">
        <div>
          <div className="h-8 w-48 bg-surface-200 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-surface-200 rounded-md" />
        </div>
        <div className="h-10 w-24 bg-surface-200 rounded-xl" />
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Form skeleton */}
        <div className="md:col-span-1 rounded-2xl bg-white p-6 shadow-sm border border-surface-200 space-y-4">
          <div className="h-6 w-32 bg-surface-200 rounded-md mb-6" />
          <div className="h-10 w-full bg-surface-200 rounded-xl" />
          <div className="h-10 w-full bg-surface-200 rounded-xl" />
          <div className="h-10 w-full bg-surface-200 rounded-xl mt-4" />
        </div>

        {/* List skeleton */}
        <div className="md:col-span-2 rounded-2xl bg-white shadow-sm border border-surface-200 overflow-hidden divide-y divide-surface-100">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4 sm:p-6">
              <div className="h-12 w-12 rounded-full bg-surface-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 bg-surface-200 rounded-md" />
                <div className="h-4 w-24 bg-surface-200 rounded-md" />
              </div>
              <div className="h-8 w-8 rounded-xl bg-surface-200 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
