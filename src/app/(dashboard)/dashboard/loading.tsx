export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse-soft">
      {/* Header */}
      <div>
        <div className="h-10 w-64 bg-surface-200 rounded-lg mb-2" />
        <div className="h-4 w-48 bg-surface-200 rounded-md" />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left column (Agenda) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="h-8 w-40 bg-surface-200 rounded-xl" />
            <div className="flex gap-2">
              <div className="h-8 w-8 bg-surface-200 rounded-lg" />
              <div className="h-8 w-8 bg-surface-200 rounded-lg" />
            </div>
          </div>
          {/* Agenda items */}
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 w-full bg-white border border-surface-200 shadow-sm rounded-2xl flex p-4 gap-4">
                <div className="w-16 h-full bg-surface-200 rounded-xl" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-1/3 bg-surface-200 rounded-md" />
                  <div className="h-4 w-1/4 bg-surface-200 rounded-md" />
                  <div className="flex gap-2">
                    <div className="h-6 w-20 bg-surface-200 rounded-md" />
                    <div className="h-6 w-20 bg-surface-200 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column (Resumen & Quick Actions) */}
        <div className="space-y-6">
          <div className="h-64 w-full bg-white border border-surface-200 rounded-2xl shadow-sm p-5 space-y-5">
             <div className="h-6 w-1/2 bg-surface-200 rounded-md" />
             <div className="h-10 w-full bg-surface-200 rounded-xl" />
             <div className="h-10 w-full bg-surface-200 rounded-xl" />
             <div className="grid grid-cols-2 gap-4">
               <div className="h-16 bg-surface-200 rounded-xl" />
               <div className="h-16 bg-surface-200 rounded-xl" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
