"use client"

import { Area, AreaChart } from "@/components/charts/area-chart"
import { Grid } from "@/components/charts/grid"
import { ChartTooltip } from "@/components/charts/tooltip"
import { XAxis } from "@/components/charts/x-axis"
import { Empty, Notice, PageHeader, Panel, StatusBadge } from "@/components/admin/kit"
import { Bones } from "@/components/admin/bones"
import { errorMessage, rupees } from "@/lib/api"
import { keys, useAdminQuery } from "@/lib/queries"

import { MetricsCard } from "../../components/ui/metricscard"

type Analytics = {
  daily: { date: string; registrations: number; paid: number }[]
  top_colleges: { college: string; participants: number }[]
  revenue_by_tier: { tier: string; teams: number; amount_minor: number }[]
  funnel: { orders_created: number; orders_captured: number; payments_failed: number; payments_needing_review: number; refunded_minor: number }
  teams: { paid: number; participants: number }
  submissions: { submitted: number; draft: number; not_started: number }
  rounds: { name: string; status: string; assigned: number; submitted: number }[]
}

const TIERS: Record<string, string> = { "adamas-acm": "Adamas + ACM (₹200)", acm: "ACM (₹300)", standard: "Standard (₹400)" }

export default function AnalyticsPage() {
  const analytics = useAdminQuery<Analytics>(keys.analytics, "/api/admin/analytics", { refetchInterval: 60_000 })
  const data = analytics.data

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader title="Analytics" description="Computed from live records; refreshed every minute." />
      {analytics.isError ? <Notice tone="red">{errorMessage(analytics.error, "Analytics could not be loaded.")}</Notice> : (
        <Bones name="analytics" loading={!data}>
          {data ? <AnalyticsBody data={data} /> : null}
        </Bones>
      )}
    </div>
  )
}

function AnalyticsBody({ data }: { data: Analytics }) {
  const conversion = data.funnel.orders_created ? Math.round((data.funnel.orders_captured / data.funnel.orders_created) * 100) : 0
  const collegeMax = Math.max(1, ...data.top_colleges.map((item) => item.participants))
  const revenue = data.revenue_by_tier.reduce((sum, item) => sum + item.amount_minor, 0)
  const submissionTotal = data.submissions.submitted + data.submissions.draft + data.submissions.not_started

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile title="Paid teams" description={`${data.teams.participants} participants`} value={data.teams.paid.toLocaleString()} />
        <Tile title="Checkout conversion" description={`${data.funnel.orders_captured} of ${data.funnel.orders_created} orders paid`} value={`${conversion}%`} />
        <Tile title="Collected" description={`${rupees(data.funnel.refunded_minor)} refunded`} value={rupees(revenue - data.funnel.refunded_minor)} />
        <Tile title="Final submissions" description={`${data.submissions.draft} drafts, ${data.submissions.not_started} not started`} value={`${data.submissions.submitted}/${submissionTotal}`} />
      </div>
      {data.funnel.payments_needing_review || data.funnel.payments_failed ? (
        <Notice tone="amber">{data.funnel.payments_failed} failed payment attempts · {data.funnel.payments_needing_review} captured payments need review.</Notice>
      ) : null}

      <Panel title="Registrations per day" description="All registrations versus those that completed payment (IST days).">
        {data.daily.length ? (
          <figure className="h-72 w-full text-left">
            <AreaChart aspectRatio="auto" className="h-full" data={data.daily} margin={{ top: 16, right: 16, bottom: 36, left: 16 }}>
              <Grid horizontal />
              <Area dataKey="registrations" fill="var(--chart-line-secondary)" fillOpacity={0.25} />
              <Area dataKey="paid" fill="var(--chart-line-primary)" fillOpacity={0.35} />
              <XAxis />
              <ChartTooltip
                rows={(point) => [
                  { color: "var(--chart-line-secondary)", label: "Registered", value: Number(point.registrations ?? 0) },
                  { color: "var(--chart-line-primary)", label: "Paid", value: Number(point.paid ?? 0) },
                ]}
              />
            </AreaChart>
            <figcaption className="mt-1 flex gap-4 text-xs text-muted-foreground">
              <Legend color="var(--chart-line-secondary)" label="Registered" />
              <Legend color="var(--chart-line-primary)" label="Paid" />
            </figcaption>
          </figure>
        ) : <Empty>No registrations yet.</Empty>}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top colleges" description="Participants in paid teams.">
          {data.top_colleges.length ? (
            <ul className="admin-stagger space-y-2">
              {data.top_colleges.map((item) => (
                <li key={item.college} className="grid grid-cols-[minmax(0,8rem)_1fr_2.5rem] sm:grid-cols-[minmax(0,10rem)_1fr_2.5rem] items-center gap-2 text-sm">
                  <span className="truncate" title={item.college}>{item.college}</span>
                  <span className="h-2 rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-2 rounded-full bg-foreground/70 transition-[width] duration-700 ease-out" style={{ width: `${(item.participants / collegeMax) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{item.participants}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>No paid teams yet.</Empty>}
        </Panel>
        <Panel title="Revenue by pricing tier" description="Captured orders, before refunds.">
          {data.revenue_by_tier.length ? (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1 font-normal">Tier</th><th className="py-1 text-right font-normal">Orders</th><th className="py-1 text-right font-normal">Amount</th></tr></thead>
              <tbody>
                {data.revenue_by_tier.map((item) => (
                  <tr key={item.tier} className="border-t border-border">
                    <td className="py-1.5">{TIERS[item.tier] ?? item.tier}</td>
                    <td className="py-1.5 text-right tabular-nums">{item.teams}</td>
                    <td className="py-1.5 text-right tabular-nums">{rupees(item.amount_minor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty>No captured payments yet.</Empty>}
        </Panel>
      </div>

      <Panel title="Judging progress" description="Submitted scorecards against assignments, per round.">
        {data.rounds.length ? (
          <ul className="admin-stagger space-y-3">
            {data.rounds.map((round) => (
              <li key={round.name} className="grid grid-cols-[minmax(0,8rem)_1fr_4rem] sm:grid-cols-[minmax(0,12rem)_1fr_5rem] items-center gap-3 text-sm">
                <span className="flex items-center gap-2 truncate">{round.name} <StatusBadge status={round.status} /></span>
                <span className="h-2 rounded-full bg-muted" aria-hidden="true">
                  <span className="block h-2 rounded-full bg-foreground/70 transition-[width] duration-700 ease-out" style={{ width: `${round.assigned ? (round.submitted / round.assigned) * 100 : 0}%` }} />
                </span>
                <span className="text-right tabular-nums">{round.submitted}/{round.assigned}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>No judging rounds yet.</Empty>}
      </Panel>
    </div>
  )
}

function Tile({ title, description, value }: { title: string; description: string; value: string }) {
  return (
    <MetricsCard title={title} description={description}>
      <p className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
    </MetricsCard>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  )
}
