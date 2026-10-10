import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { AdminSidebar } from "@/components/admin-sidebar"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Providers } from "@/app/providers"
import { REFRESH_COOKIE } from "@/lib/admin-backend"

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  // The refresh cookie is the session; an expired access token is renewed by the API proxy.
  if (!(await cookies()).get(REFRESH_COOKIE)?.value) redirect("/login")

  return (
    <Providers>
      <SidebarProvider className="min-h-svh bg-background font-pixel-square rounded-xl ">
        <AdminSidebar />
        <SidebarInset className="min-w-0 rounded-xl">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl bg-background/80 px-3 font-pixel-square backdrop-blur-md sm:px-4">
            <SidebarTrigger className="rounded-md hover:bg-zinc-100" />
            <span className="text-sm font-medium font-pixel-square">HackMatrix Admin</span>
          </header>
          <div className="min-w-0 flex flex-1 flex-col gap-2 p-2 sm:p-4 md:p-6 font-pixel-square rounded-2xl">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </Providers>
  )
}
