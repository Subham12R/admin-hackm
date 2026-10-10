export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading page">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-4 w-80 max-w-full rounded-md bg-muted" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-28 rounded-xl glass-shell" />
        <div className="h-28 rounded-xl glass-shell" />
        <div className="h-28 rounded-xl glass-shell" />
      </div>
      <div className="h-72 rounded-xl glass-shell" />
    </div>
  )
}
