export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading page">
      <div className="h-8 w-48 rounded-md bg-zinc-200" />
      <div className="h-4 w-80 max-w-full rounded-md bg-zinc-100" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-28 rounded-xl bg-zinc-100" />
        <div className="h-28 rounded-xl bg-zinc-100" />
        <div className="h-28 rounded-xl bg-zinc-100" />
      </div>
      <div className="h-72 rounded-xl bg-zinc-100" />
    </div>
  )
}
