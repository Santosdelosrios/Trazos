export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-10 w-48 bg-surface-200 rounded-lg" />
      </div>
      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1 h-80 bg-surface-100 rounded-2xl" />
        <div className="md:col-span-2 h-96 bg-surface-100 rounded-2xl" />
      </div>
    </div>
  );
}
