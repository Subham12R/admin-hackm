"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  ClipboardList,
  Gavel,
  LogOut,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Target,
  Trophy,
  Upload,
  Users,
  type LucideIcon,
  ChevronDown,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import FallbackAvatar from "./fallback-avatar"
import { useEffect, useState } from "react"

type NavigationGroup = {
  label: string
  items: { title: string; href: string; icon: LucideIcon }[]
}

const navigation: NavigationGroup[] = [
  {
    label: "",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Events",
    items: [
      { title: "Registrations", href: "/dashboard/registrations", icon: ClipboardList },
      { title: "Teams", href: "/dashboard/teams", icon: Users },
      { title: "Submissions", href: "/dashboard/submissions", icon: Upload },
      { title: "Evaluations", href: "/dashboard/evaluations", icon: Gavel },
      { title: "Leaderboard", href: "/dashboard/leaderboard", icon: Trophy },
      { title: "Challenge", href: "/dashboard/challenge", icon: Target },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Contacts", href: "/dashboard/contacts", icon: MessageSquare },
      { title: "Announcements", href: "/dashboard/announcements", icon: Megaphone },
    ],
  },
  {
    label: "Insights",
    items: [{ title: "Analytics", href: "/dashboard/analytics", icon: BarChart3 }],
  },
  {
    label: "Operations",
    items: [
      { title: "Event Control", href: "/dashboard/event-control", icon: SlidersHorizontal },
      { title: "Audit Logs", href: "/dashboard/logs", icon: ScrollText },
    ],
  },
  {
    label: "System",
    items: [{ title: "Settings", href: "/dashboard/settings", icon: Settings }],
  },
]

export function AdminSidebar() {
  const pathname = usePathname() ?? ""
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState({ name: "", email: "" })

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign("/login")
          return null
        }
        return response.ok ? response.json() : null
      })
      .then((data) => {
        if (!data?.user) return
        setUser({ name: data.user.display_name, email: data.user.email })
      })
  }, [])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.assign("/login")
  }
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/dashboard" />}
              size="lg"
              className="rounded-md"
            >
              <span className="truncate font-semibold font-pixel-square text-xl">Admin Dashboard</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navigation.map((group) => (
          <SidebarGroup key={group.label || "dashboard"}>
            {group.label && <SidebarGroupLabel className="font-pixel-square text-md capitalize">{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))
                  const Icon = item.icon

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive}
                        aria-current={isActive ? "page" : undefined}
                        className="rounded-md"
                      >
                        <Icon />
                        <span className="font-pixel-square text-md">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="relative isolate mt-auto min-h-14 justify-end bg-linear-to-t from-white to-white/0 p-2 backdrop-blur-md border-t border-sidebar-border/60">
        <SidebarMenu className="relative">
          <SidebarMenuItem>
            <DropdownMenu open={open} onOpenChange={setOpen}>
              <SidebarMenuButton
                render={<DropdownMenuTrigger />}
                size="lg"
                className="rounded-lg bg-sidebar px-2 py-1 data-popup-open:bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer"
              >
                {user.name ? <FallbackAvatar name={user.name} className="border" size={24} animated /> : <span className="size-6 animate-pulse rounded-full bg-zinc-200" />}
                <span className="min-w-0 truncate font-pixel-square text-md capitalize tracking-tighter">{user.name || <span className="inline-block h-4 w-24 animate-pulse rounded bg-zinc-200" />}</span>
                <ChevronDown
                  className={`ml-auto size-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
              </SidebarMenuButton>
              <DropdownMenuContent
                side="top"
                sideOffset={10}
                className="rounded-xl border border-sidebar-border/60 bg-sidebar/85 p-1 text-sidebar-foreground shadow-xl backdrop-blur-xl cursor-pointer"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-pixel-square normal-case tracking-tighter">
                    <span className="block capitalize">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={logout}
                    className="font-pixel-square normal-case cursor-pointer rounded-md tracking-tighter"
                  >
                    <LogOut />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
