export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-10 w-48 bg-surface-200 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-surface-100 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-48 bg-surface-100 rounded-2xl" />
        <div className="h-48 bg-surface-100 rounded-2xl" />
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 h-96 bg-surface-100 rounded-2xl" />
        <div className="lg:col-span-1 h-96 bg-surface-100 rounded-2xl" />
      </div>
    </div>
  );
}
