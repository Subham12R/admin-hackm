"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { Grid } from "@/components/charts/grid"
import { Line, LineChart } from "@/components/charts/line-chart"
import { ChartTooltip } from "@/components/charts/tooltip"
import { XAxis } from "@/components/charts/x-axis"
import {
  ChartContainer,
  ChartTooltip as RechartsTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Pie, PieChart } from "recharts"

import { RichButton } from "@/components/rich-button"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { MetricsCard } from "../components/ui/metricscard"

const registrationSeries = [
  { date: "2026-11-01", registrations: 24 },
  { date: "2026-11-02", registrations: 31 },
  { date: "2026-11-03", registrations: 45 },
  { date: "2026-11-04", registrations: 38 },
  { date: "2026-11-05", registrations: 52 },
  { date: "2026-11-06", registrations: 61 },
  { date: "2026-11-07", registrations: 73 },
] as const

const metrics = {
  name: "Admin",
  registrations: 324,
  monetaryAmount: 32400,
  submissions: 86,
  totalUsers: 512,
} as const

const registrationSplit = [
  {
    group: "ACM Students from Adamas",
    label: "Adamas ACM",
    registrations: 102,
    fill: "var(--color-adamas-acm)",
  },
  {
    group: "Adamas University Only No ACM",
    label: "Adamas only",
    registrations: 86,
    fill: "var(--color-adamas-no-acm)",
  },
  {
    group: "Outer College No ACM",
    label: "Outer college",
    registrations: 74,
    fill: "var(--color-outer-no-acm)",
  },
  {
    group: "Outer College + ACM Chapter Member",
    label: "Outer + ACM",
    registrations: 62,
    fill: "var(--color-outer-acm)",
  },
] as const

const registrationSplitConfig = {
  registrations: { label: "Registrations" },
  "adamas-acm": {
    label: "ACM Students from Adamas",
    color: "oklch(0.3 0.01 260)",
  },
  "adamas-no-acm": {
    label: "Adamas University Only No ACM",
    color: "oklch(0.48 0.01 260)",
  },
  "outer-no-acm": {
    label: "Outer College No ACM",
    color: "oklch(0.65 0.01 260)",
  },
  "outer-acm": {
    label: "Outer College + ACM Chapter Member",
    color: "oklch(0.8 0.01 260)",
  },
} satisfies ChartConfig

const recentRegistrations = [
  { teamName: "Binary Beacons", leader: "Aarav Sen", email: "aarav.sen@example.com", phone: "+91 98310 42165", college: "Adamas University", members: 4, acm: "Yes" },
  { teamName: "Stack Sprinters", leader: "Ishita Roy", email: "ishita.roy@example.com", phone: "+91 98745 10326", college: "Jadavpur University", members: 3, acm: "No" },
  { teamName: "Pixel Pioneers", leader: "Rohan Das", email: "rohan.das@example.com", phone: "+91 90071 62548", college: "Adamas University", members: 2, acm: "Yes" },
  { teamName: "Logic Loom", leader: "Sneha Paul", email: "sneha.paul@example.com", phone: "+91 89102 30714", college: "Heritage Institute of Technology", members: 4, acm: "No" },
  { teamName: "Code Catalysts", leader: "Arjun Ghosh", email: "arjun.ghosh@example.com", phone: "+91 98367 49021", college: "Adamas University", members: 3, acm: "Yes" },
  { teamName: "Null Pointers", leader: "Mira Dutta", email: "mira.dutta@example.com", phone: "+91 99031 86425", college: "Techno India University", members: 2, acm: "No" },
  { teamName: "Byte Brigade", leader: "Kabir Shah", email: "kabir.shah@example.com", phone: "+91 97480 51362", college: "Adamas University", members: 4, acm: "Yes" },
  { teamName: "Runtime Rebels", leader: "Nandini Bose", email: "nandini.bose@example.com", phone: "+91 90731 48269", college: "Narula Institute of Technology", members: 3, acm: "No" },
  { teamName: "Circuit Crew", leader: "Dev Mallick", email: "dev.mallick@example.com", phone: "+91 98312 67504", college: "Adamas University", members: 2, acm: "Yes" },
  { teamName: "Kernel Knights", leader: "Tanya Mitra", email: "tanya.mitra@example.com", phone: "+91 89614 23058", college: "University of Calcutta", members: 4, acm: "No" },
] as const

const recentLogs = [
  { time: "Nov 7, 2026 · 10:42 AM", actor: "Aarav Sen", action: "Submitted registration", target: "Binary Beacons", details: "Adamas University" },
  { time: "Nov 7, 2026 · 10:36 AM", actor: "Ishita Roy", action: "Submitted registration", target: "Stack Sprinters", details: "Jadavpur University" },
  { time: "Nov 7, 2026 · 10:29 AM", actor: "Admin", action: "Updated challenge brief", target: "Challenge", details: "Version 1.3" },
  { time: "Nov 7, 2026 · 10:17 AM", actor: "Rohan Das", action: "Submitted registration", target: "Pixel Pioneers", details: "Adamas University" },
  { time: "Nov 7, 2026 · 10:05 AM", actor: "Admin", action: "Published announcement", target: "Event updates", details: "Registration reminder" },
  { time: "Nov 7, 2026 · 9:54 AM", actor: "Sneha Paul", action: "Submitted registration", target: "Logic Loom", details: "Heritage Institute" },
  { time: "Nov 7, 2026 · 9:41 AM", actor: "Arjun Ghosh", action: "Submitted registration", target: "Code Catalysts", details: "Adamas University" },
  { time: "Nov 7, 2026 · 9:32 AM", actor: "Admin", action: "Updated event controls", target: "Registration", details: "Enabled" },
  { time: "Nov 7, 2026 · 9:18 AM", actor: "Mira Dutta", action: "Submitted registration", target: "Null Pointers", details: "Techno India University" },
  { time: "Nov 7, 2026 · 9:04 AM", actor: "Admin", action: "Updated leaderboard", target: "Leaderboard", details: "Recalculated scores" },
] as const

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-2 rounded-2xl p-2 font-pixel-square leading-tighter ">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome Back {metrics.name}!
      </h1>
      <p className="text-sm tracking-tighter text-muted-foreground">
        Here is a summary of your dashboard, while you were away!
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Registrations"
          description="The total number of registrations"
        >
          <p className="font-mono text-4xl font-semibold tracking-tight">
            {metrics.registrations.toLocaleString()}
          </p>
        </MetricsCard>
        <MetricsCard
          title="Monetary Amount"
          description="The total monetary amount of submissions"
        >
          <p className="font-mono text-4xl font-semibold tracking-tight">
            ₹{metrics.monetaryAmount.toLocaleString()}
          </p>
        </MetricsCard>
        <MetricsCard title="Submissions" description="The total number of submissions">
          <p className="font-mono text-4xl font-semibold tracking-tight">
            {metrics.submissions.toLocaleString()}
          </p>
        </MetricsCard>
        <MetricsCard title="Total Users" description="The total number of users">
          <p className="font-mono text-4xl font-semibold tracking-tight">
            {metrics.totalUsers.toLocaleString()}
          </p>
        </MetricsCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        <div className="col-span-3">
        <MetricsCard
          title="Registration Analytics"
          description="New registrations over the last seven days"

        >
          <figure className="h-72 w-full p-3 text-left">
            <LineChart
              aspectRatio=""
              className="h-full"
              data={[...registrationSeries]}
              margin={{ top: 16, right: 16, bottom: 36, left: 16 }}
            >
              <Grid horizontal numTicksRows={4} />
              <Line dataKey="registrations" stroke="oklch(0.36 0.01 260)" />
              <XAxis numTicks={4} />
              <ChartTooltip
                backgroundColor="var(--color-zinc-950)"
                indicatorColor="var(--color-zinc-950)"
                rows={(point) => [
                  {
                    color: "oklch(0.36 0.01 260)",
                    label: "Registrations",
                    value: String(point.registrations),
                  },
                ]}
              />
            </LineChart>
            <figcaption className="sr-only">
              Daily registrations from November 1 through November 7, 2026.
            </figcaption>
          </figure>
        </MetricsCard>
        </div>

        <MetricsCard
          title="Registration Split"
          description="The split of registrations by source"
        >
          <figure className="w-full p-3">
            <ChartContainer
              config={registrationSplitConfig}
              className="mx-auto aspect-square h-52 max-w-52"
            >
              <PieChart>
                <RechartsTooltip
                  content={<ChartTooltipContent hideLabel nameKey="label" />}
                  cursor={false}
                />
                <Pie
                  data={registrationSplit}
                  dataKey="registrations"
                  nameKey="label"
                  stroke="0"
                />
              </PieChart>
            </ChartContainer>
            <figcaption className="sr-only">
              {registrationSplit
                .map((item) => `${item.group}: ${item.registrations}`)
                .join("; ")}
            </figcaption>
          </figure>
        </MetricsCard>
      </div>

      <section className="rounded-2xl bg-zinc-100 p-1">
        <div className="rounded-xl bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                Recent Registrations

              </h2>
              <p className="text-sm tracking-tighter text-muted-foreground">
                Latest team registrations submitted for HackMatrix 2026.
              </p>
            </div>
            <RichButton asChild color="blue" size="sm" className="shrink-0 font-pixel-square tracking-tighter">
              <Link href="/dashboard/registrations">
                View more
                <ArrowUpRight />
              </Link>
            </RichButton>
          </div>

          <Table>
            <TableCaption className="sr-only">
              The ten most recent HackMatrix registrations.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="h-10 normal-case tracking-tighter">Team name</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Team leader</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Email</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Phone</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">College</TableHead>
                <TableHead className="h-10 text-center normal-case tracking-tighter">Members</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">ACM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRegistrations.map((registration) => (
                <TableRow key={registration.email}>
                  <TableCell className="font-medium">{registration.teamName}</TableCell>
                  <TableCell>{registration.leader}</TableCell>
                  <TableCell>{registration.email}</TableCell>
                  <TableCell>{registration.phone}</TableCell>
                  <TableCell>{registration.college}</TableCell>
                  <TableCell className="text-center tabular-nums">{registration.members}</TableCell>
                  <TableCell>
                    <RichButton
                      asChild
                      size="sm"
                      className={`h-6 cursor-default justify-center bg-zinc-700 px-2 text-xs tracking-tighter ${registration.acm === "Yes" ? "from-emerald-600/65" : "from-red-600/65"}`}
                    >
                      <span>{registration.acm}</span>
                    </RichButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-2xl bg-zinc-100 p-1">
        <div className="rounded-xl bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Recent Logs
              </h2>
              <p className="text-sm tracking-tighter text-muted-foreground">
                Latest activity across the HackMatrix admin dashboard.
              </p>
            </div>
            <RichButton asChild color="blue" size="sm" className="shrink-0 font-pixel-square tracking-tighter">
              <Link href="/dashboard/logs">
                View more
                <ArrowUpRight />
              </Link>
            </RichButton>
          </div>

          <Table>
            <TableCaption className="sr-only">
              The ten most recent HackMatrix admin log entries.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="h-10 normal-case tracking-tighter">Time</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Actor</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Action</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Target</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.map((log) => (
                <TableRow
                  key={`${log.time}-${log.action}`}
                  className={log.actor === "Admin" ? "bg-red-50 hover:bg-red-100" : undefined}
                >
                  <TableCell>{log.time}</TableCell>
                  <TableCell className="font-medium">{log.actor}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.target}</TableCell>
                  <TableCell>{log.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
