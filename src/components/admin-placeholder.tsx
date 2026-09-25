export function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col gap-2 p-4 md:p-6 font-pixel-square ">
      <p className="text-sm text-muted-foreground font-pixel-square">Admin Dashboard</p>
      <h1 className="text-2xl font-semibold tracking-tight font-pixel-square">{title}</h1>
    </div>
  )
}
