import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { AdminSidebar } from "@/components/admin-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const access = (await cookies()).get("hackmatrix_admin_access")?.value
  const backend = process.env.BACKEND_URL
  if (!access || !backend) redirect("/login")
  const me = await fetch(`${backend}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  })
  if (!me.ok) redirect("/login")
  const profile = await me.json()

  return (
    <SidebarProvider className="min-h-svh bg-background font-pixel-square rounded-xl ">
      <AdminSidebar user={{ name: profile.user.display_name, email: profile.user.email }} />
      <SidebarInset className="rounded-xl">
        <header className="flex h-14 shrink-0 items-center gap-2  px-4 font-pixel-square ">
          <SidebarTrigger className="rounded-md hover:bg-zinc-100" />

          <span className="text-sm font-medium font-pixel-square">HackMatrix Admin</span>
        </header>
        <div className="flex flex-1 flex-col gap-2 p-4 md:p-6 font-pixel-square rounded-2xl">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
