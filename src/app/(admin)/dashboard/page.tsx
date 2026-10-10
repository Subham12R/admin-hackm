"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowUpRight } from "lucide-react"
import NumberFlow, { type Format } from "@number-flow/react"

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
  adminQuery,
  overviewSchema,
  registrationCategories,
  toOverview,
  type RegistrationCategory,
} from "@/lib/admin-client"
import { Notice } from "@/components/admin/kit"
import { Bones } from "@/components/admin/bones"
import { can, keys, useMe } from "@/lib/queries"
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

const registrationSplitPresentation = {
  "Adamas ACM": {
    group: "ACM Students from Adamas",
    label: "Adamas ACM",
    fill: "var(--color-adamas-acm)",
  },
  "Adamas only": {
    group: "Adamas University Only No ACM",
    label: "Adamas only",
    fill: "var(--color-adamas-no-acm)",
  },
  "Outer college": {
    group: "Outer College No ACM",
    label: "Outer college",
    fill: "var(--color-outer-no-acm)",
  },
  "Outer + ACM": {
    group: "Outer College + ACM Chapter Member",
    label: "Outer + ACM",
    fill: "var(--color-outer-acm)",
  },
} satisfies Record<RegistrationCategory, { group: string; label: string; fill: string }>

export default function DashboardPage() {
  const router = useRouter()
  const me = useMe()
  const roles = me.data?.user.roles
  const staff = can.read(roles ?? [])
  const overview = useQuery({
    queryKey: keys.overview,
    queryFn: adminQuery("/api/admin/overview", overviewSchema),
    select: toOverview,
    enabled: staff,
    refetchInterval: 60_000,
  })
  const data = overview.data ?? null
  const loadError = overview.isError ? "Dashboard data could not be loaded." : ""

  useEffect(() => {
    // Judges have no access to identity-bearing dashboards; send them to their queue.
    if (roles && !staff && can.judge(roles)) router.replace("/dashboard/judging")
  }, [staff, roles, router])

  const registrationSeries = data?.registrationSeries ?? []
  const registrationSplit = registrationCategories.map((category) => ({
    ...registrationSplitPresentation[category],
    registrations: data?.registrationSplit.find((item) => item.category === category)?.registrations ?? 0,
  }))
  const recentRegistrations = data?.recentRegistrations ?? []
  const recentLogs = data?.recentLogs ?? []
  const metrics = data?.metrics
  const loading = !data && !loadError

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-2 rounded-2xl p-2 font-pixel-square leading-tighter ">
      <h1 className="admin-fade flex flex-wrap items-center gap-x-2 text-xl font-semibold tracking-tight sm:text-2xl">
        Welcome Back {data ? `${data.viewerName}!` : <span className="admin-shimmer inline-block h-7 w-36 rounded-md" aria-hidden="true" />}
      </h1>
      <p className="admin-fade text-sm tracking-tighter text-muted-foreground">
        Here is a summary of your dashboard, while you were away!
      </p>
      {loadError ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError}</p> : null}
      {metrics && metrics.paymentsNeedingReview > 0 ? (
        <Notice tone="amber">
          {metrics.paymentsNeedingReview} captured payment{metrics.paymentsNeedingReview === 1 ? "" : "s"} need review (late, duplicate, or mismatched).{" "}
          <Link href="/dashboard/payments" className="underline">Open payments</Link>
        </Notice>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricsCard
          title="Registrations"
          description={metrics ? `${metrics.paidTeams.toLocaleString()} paid, the rest awaiting payment` : "Active registrations"}
        >
          <Metric value={metrics?.registrations} />
        </MetricsCard>
        <MetricsCard
          title="Monetary Amount"
          description="Captured payments, net of refunds"
        >
          <Metric
            value={metrics ? metrics.monetaryAmountMinor / 100 : undefined}
            format={{ style: "currency", currency: "INR", maximumFractionDigits: 0 }}
          />
        </MetricsCard>
        <MetricsCard title="Submissions" description="Final project submissions">
          <Metric value={metrics?.submissions} />
        </MetricsCard>
        <MetricsCard title="Total Users" description="The total number of users">
          <Metric value={metrics?.totalUsers} />
        </MetricsCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="min-w-0 lg:col-span-3">
        <MetricsCard
          title="Registration Analytics"
          description="Registrations per day (IST)"

        >
          <figure className="h-72 w-full p-3 text-left">
            <LineChart
              aspectRatio=""
              className="h-full"
              data={[...registrationSeries]}
              margin={{ top: 16, right: 16, bottom: 36, left: 16 }}
            >
              <Grid horizontal numTicksRows={4} />
              <Line dataKey="registrations" stroke="var(--chart-line-strong)" />
              <XAxis numTicks={4} />
              <ChartTooltip
                backgroundColor="var(--color-zinc-950)"
                indicatorColor="var(--color-zinc-950)"
                rows={(point) => [
                  {
                    color: "var(--chart-line-strong)",
                    label: "Registrations",
                    value: String(point.registrations),
                  },
                ]}
              />
            </LineChart>
            <figcaption className="sr-only">
              {registrationSeries.length
                ? `Daily registrations from ${registrationSeries[0].date} to ${registrationSeries[registrationSeries.length - 1].date}.`
                : "No registrations yet."}
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

      <section className="admin-rise min-w-0 rounded-2xl glass-shell p-1">
        <div className="min-w-0 rounded-xl bg-card p-3 sm:p-4">
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

          <Bones name="overview-registrations" loading={loading}>
          <Table>
            <TableCaption className="sr-only">
              The ten most recent HackMatrix registrations.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="h-10 normal-case tracking-tighter">Team name</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Team leader</TableHead>
                <TableHead className="hidden h-10 normal-case tracking-tighter md:table-cell">Email</TableHead>
                <TableHead className="hidden h-10 normal-case tracking-tighter xl:table-cell">Phone</TableHead>
                <TableHead className="hidden h-10 normal-case tracking-tighter lg:table-cell">College</TableHead>
                <TableHead className="h-10 text-center normal-case tracking-tighter">Members</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">ACM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRegistrations.length ? recentRegistrations.map((registration) => (
                <TableRow key={registration.registrationId}>
                  <TableCell className="font-medium">{registration.teamName}</TableCell>
                  <TableCell>{registration.leader}</TableCell>
                  <TableCell className="hidden md:table-cell">{registration.email}</TableCell>
                  <TableCell className="hidden xl:table-cell">{registration.phone}</TableCell>
                  <TableCell className="hidden lg:table-cell">{registration.college}</TableCell>
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
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {loadError || "No registrations yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </Bones>
        </div>
      </section>

      <section className="admin-rise min-w-0 rounded-2xl glass-shell p-1">
        <div className="min-w-0 rounded-xl bg-card p-3 sm:p-4">
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

          <Bones name="overview-logs" loading={loading}>
          <Table>
            <TableCaption className="sr-only">
              The ten most recent HackMatrix admin log entries.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="h-10 normal-case tracking-tighter">Time</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Actor</TableHead>
                <TableHead className="h-10 normal-case tracking-tighter">Action</TableHead>
                <TableHead className="hidden h-10 normal-case tracking-tighter md:table-cell">Target</TableHead>
                <TableHead className="hidden h-10 normal-case tracking-tighter lg:table-cell">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogs.length ? recentLogs.map((log) => (
                <TableRow
                  key={log.id ?? `${log.timestamp}-${log.action}-${log.resource}`}
                  className={log.actor === "Admin" ? "bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/15" : undefined}
                >
                  <TableCell>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.timestamp))}</TableCell>
                  <TableCell className="font-medium">{log.actor}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell className="hidden md:table-cell">{log.resource}</TableCell>
                  <TableCell className="hidden max-w-md truncate lg:table-cell" title={log.details}>{log.details}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {loadError || "No activity recorded yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </Bones>
        </div>
      </section>
    </div>
  )
}

function Metric({ value, format }: { value: number | undefined; format?: Format }) {
  if (value === undefined) return <span className="admin-shimmer my-1 block h-9 w-24 rounded-md" aria-hidden="true" />
  return <NumberFlow value={value} locales="en-IN" format={format} className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl" />
}
