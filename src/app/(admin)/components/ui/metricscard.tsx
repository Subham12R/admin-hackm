export function MetricsCard({ title, description, children }: { title: string, description: string, children: React.ReactNode }) {
  return (
    <div className="admin-rise flex flex-col gap-2 px-1 pb-1 font-pixel-square rounded-2xl glass-shell min-h-32 min-w-24 justify-center items-start text-start">
      <h1 className="text-xs md:text-sm font-semibold tracking-tight font-pixel-square w-full text-center text-foreground pt-1">{title}</h1>
      <p className="w-full px-2 text-center text-xs tracking-tighter text-muted-foreground">{description}</p>
      <div className="bg-card rounded-xl p-1 w-full h-full flex justify-center items-center text-center">
        {children}
      </div>
    </div>
  )
}