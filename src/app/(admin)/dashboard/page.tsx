"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
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
  AdminDataError,
  getAdminJson,
  overviewSchema,
  registrationCategories,
  toOverview,
  type RegistrationCategory,
} from "@/lib/admin-client"
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
  const [data, setData] = useState<ReturnType<typeof toOverview> | null>(null)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    getAdminJson("/api/admin/overview", overviewSchema, controller.signal)
      .then((response) => {
        setLoadError("")
        setData(toOverview(response))
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof AdminDataError && error.status === 401) {
          router.replace("/login")
          return
        }
        setData(null)
        setLoadError("Dashboard data could not be loaded.")
      })
    return () => controller.abort()
  }, [router])

  const registrationSeries = data?.registrationSeries ?? []
  const registrationSplit = registrationCategories.map((category) => ({
    ...registrationSplitPresentation[category],
    registrations: data?.registrationSplit.find((item) => item.category === category)?.registrations ?? 0,
  }))
  const recentRegistrations = data?.recentRegistrations ?? []
  const recentLogs = data?.recentLogs ?? []
  const metrics = data?.metrics

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-2 rounded-2xl p-2 font-pixel-square leading-tighter ">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome Back {data?.viewerName ?? "..."}!
      </h1>
      <p className="text-sm tracking-tighter text-muted-foreground">
        Here is a summary of your dashboard, while you were away!
      </p>
      {loadError ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError}</p> : null}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Registrations"
          description="The total number of registrations"
        >
          <p className="font-mono text-4xl font-semibold tracking-tight">
            {metrics ? metrics.registrations.toLocaleString() : "—"}
          </p>
        </MetricsCard>
        <MetricsCard
          title="Monetary Amount"
          description="The total monetary amount of submissions"
        >
          <p className="font-mono text-4xl font-semibold tracking-tight">
            {metrics ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(metrics.monetaryAmountMinor / 100) : "—"}
          </p>
        </MetricsCard>
        <MetricsCard title="Submissions" description="The total number of submissions">
          <p className="font-mono text-4xl font-semibold tracking-tight">
            {metrics ? metrics.submissions.toLocaleString() : "—"}
          </p>
        </MetricsCard>
        <MetricsCard title="Total Users" description="The total number of users">
          <p className="font-mono text-4xl font-semibold tracking-tight">
            {metrics ? metrics.totalUsers.toLocaleString() : "—"}
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

      <section className="rounded-2xl glass-shell p-1">
        <div className="rounded-xl bg-card p-4">
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
              {recentRegistrations.length ? recentRegistrations.map((registration) => (
                <TableRow key={registration.registrationId}>
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
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {loadError || (data ? "No registrations yet." : "Loading registrations...")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-2xl glass-shell p-1">
        <div className="rounded-xl bg-card p-4">
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
              {recentLogs.length ? recentLogs.map((log) => (
                <TableRow
                  key={`${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.timestamp))}-${log.action}`}
                  className={log.actor === "Admin" ? "bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/15" : undefined}
                >
                  <TableCell>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.timestamp))}</TableCell>
                  <TableCell className="font-medium">{log.actor}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.resource}</TableCell>
                  <TableCell>{log.details}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {loadError || (data ? "No activity recorded yet." : "Loading activity...")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
