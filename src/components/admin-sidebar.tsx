"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  ClipboardList,
  Gavel,
  Images,
  LogOut,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  ScrollText,
  Settings,
  SlidersHorizontal,
  CalendarRange,
  Trophy,
  Upload,
  UserCheck,
  Users,
  type LucideIcon,
  ChevronDown,
  ClipboardCheck,
  Wallet,
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
import { useState } from "react"

import { can, useMe } from "@/lib/queries"

type Access = (roles: string[]) => boolean

type NavigationGroup = {
  label: string
  items: { title: string; href: string; icon: LucideIcon; access?: Access }[]
}

const navigation: NavigationGroup[] = [
  {
    label: "",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, access: can.read }],
  },
  {
    label: "Judging",
    items: [{ title: "My Assignments", href: "/dashboard/judging", icon: ClipboardCheck, access: can.judge }],
  },
  {
    label: "Events",
    items: [
      { title: "Registrations", href: "/dashboard/registrations", icon: ClipboardList, access: can.read },
      { title: "Payments", href: "/dashboard/payments", icon: Wallet, access: can.read },
      { title: "Teams", href: "/dashboard/teams", icon: Users, access: can.read },
      { title: "Check-in", href: "/dashboard/check-in", icon: UserCheck, access: can.read },
      { title: "Submissions", href: "/dashboard/submissions", icon: Upload, access: can.read },
      { title: "Evaluations", href: "/dashboard/evaluations", icon: Gavel, access: can.read },
      { title: "Rounds & Results", href: "/dashboard/leaderboard", icon: Trophy, access: can.read },
      { title: "Events", href: "/dashboard/events", icon: CalendarRange, access: can.read },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Contacts", href: "/dashboard/contacts", icon: MessageSquare, access: can.read },
      { title: "Announcements", href: "/dashboard/announcements", icon: Megaphone, access: can.read },
      { title: "Gallery", href: "/dashboard/gallery", icon: Images, access: can.read },
    ],
  },
  {
    label: "Insights",
    items: [{ title: "Analytics", href: "/dashboard/analytics", icon: BarChart3, access: can.read }],
  },
  {
    label: "Operations",
    items: [
      { title: "Event Control", href: "/dashboard/event-control", icon: SlidersHorizontal, access: can.read },
      { title: "Audit Logs", href: "/dashboard/logs", icon: ScrollText, access: can.read },
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
  const me = useMe()
  const user = { name: me.data?.user.display_name ?? "", email: me.data?.user.email ?? "" }
  const roles = me.data?.user.roles ?? []
  // Hide links the backend would refuse; until roles load, show nothing role-gated.
  const visibleNavigation = navigation
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.access || item.access(roles)) }))
    .filter((group) => group.items.length)

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
    // Full reload drops every cached query from the signed-out session.
    window.location.replace(new URL("/login", window.location.origin))
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
        {visibleNavigation.map((group) => (
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
