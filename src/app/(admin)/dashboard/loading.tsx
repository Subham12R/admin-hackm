export default function DashboardLoading() {
  return (
    <div className="admin-fade space-y-4 p-2" aria-busy="true" aria-label="Loading page">
      <div className="admin-shimmer h-8 w-48 rounded-md" />
      <div className="admin-shimmer h-4 w-80 max-w-full rounded-md" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="admin-shimmer h-32 rounded-2xl" />)}
      </div>
      <div className="admin-shimmer h-72 rounded-2xl" />
    </div>
  )
}
