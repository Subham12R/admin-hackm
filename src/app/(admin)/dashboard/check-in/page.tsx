"use client"

import { useMemo, useState } from "react"

import { BarChart } from "@/components/charts/bar-chart"
import { Bar } from "@/components/charts/bar"
import { BarXAxis } from "@/components/charts/bar-x-axis"
import { Grid } from "@/components/charts/grid"
import { ChartTooltip } from "@/components/charts/tooltip"
import { Badge, Button, Empty, Field, Notice, PageHeader, Panel, Select, TextInput } from "@/components/admin/kit"
import { ExportCsv } from "@/components/admin/export-csv"
import { Bones } from "@/components/admin/bones"
import { errorMessage } from "@/lib/api"
import { notify } from "@/lib/notify"
import { can, keys, useAdminMutation, useAdminQuery, useRoles } from "@/lib/queries"

import { MetricsCard } from "../../components/ui/metricscard"

type Member = {
  id: string
  name: string
  role: string
  email: string
  phone: string
  college: string
  checked_in_at: string | null
  checked_in_by: string | null
}

type CheckinTeam = {
  registration_id: string
  team_id: string
  team_name: string
  college: string
  members: Member[]
  member_count: number
  checked_in: number
}

type Checkins = {
  summary: { teams: number; participants: number; checked_in: number; teams_complete: number; teams_partial: number; teams_waiting: number }
  timeline: { time: string; arrived: number; total: number }[]
  teams: CheckinTeam[]
}

type Progress = "all" | "waiting" | "partial" | "complete"

const AREA = [["checkins"], ["teams"]]
const clock = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })

function progressOf(team: CheckinTeam): Exclude<Progress, "all"> {
  if (team.member_count && team.checked_in === team.member_count) return "complete"
  return team.checked_in ? "partial" : "waiting"
}

export default function CheckInPage() {
  const canCheckIn = can.checkin(useRoles())
  // Polled so several check-in desks see each other's arrivals.
  const query = useAdminQuery<Checkins>(keys.checkins(""), "/api/admin/checkins", { refetchInterval: 10_000 })
  const [search, setSearch] = useState("")
  const [progress, setProgress] = useState<Progress>("all")
  const member = useAdminMutation<{ id: string; checkedIn: boolean }>(({ id, checkedIn }) => ({ path: `/api/admin/checkins/members/${id}`, body: { checked_in: checkedIn } }), AREA)
  const team = useAdminMutation<{ id: string; checkedIn: boolean }>(({ id, checkedIn }) => ({ path: `/api/admin/checkins/teams/${id}`, body: { checked_in: checkedIn } }), AREA)

  const data = query.data
  const teams = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (data?.teams ?? []).filter((item) =>
      (progress === "all" || progressOf(item) === progress) &&
      (!needle || [item.team_name, item.team_id, item.college, ...item.members.flatMap((person) => [person.name, person.email, person.phone])]
        .some((value) => value.toLowerCase().includes(needle)))
    )
  }, [data, progress, search])

  if (query.isError) return <Notice tone="red">{errorMessage(query.error, "Check-in could not be loaded.")}</Notice>

  const summary = data?.summary
  const percent = summary?.participants ? Math.round((summary.checked_in / summary.participants) * 100) : 0
  const chartData = (data?.timeline ?? []).map((point) => ({ slot: clock.format(new Date(point.time)), arrived: point.arrived, total: point.total }))
  const busy = member.isPending || team.isPending

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <PageHeader
        title="Finals check-in"
        description="Only teams accepted for the finals appear here. Accept teams from the Teams page."
      />

      <Bones name="checkin-summary" loading={!summary}>
      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Tile title="Checked in" description={`${percent}% of ${summary.participants} participants`} value={`${summary.checked_in}/${summary.participants}`} />
          <Tile title="Teams complete" description="Every member has arrived" value={`${summary.teams_complete}/${summary.teams}`} />
          <Tile title="Teams partial" description="Some members still to arrive" value={summary.teams_partial.toLocaleString()} />
          <Tile title="Teams waiting" description="Nobody has arrived yet" value={summary.teams_waiting.toLocaleString()} />
        </div>
      ) : null}
      </Bones>

      <Panel title="Arrivals over time" description="Participants checked in per 15 minutes (IST), with the running total in the tooltip.">
        {chartData.length ? (
          <figure className="w-full text-left">
            <BarChart aspectRatio="4 / 1" barGap={0.1} data={chartData} margin={{ top: 8, right: 8, bottom: 40, left: 8 }} xDataKey="slot">
              <Grid horizontal />
              <Bar dataKey="arrived" lineCap="butt" />
              <BarXAxis maxLabels={10} />
              <ChartTooltip
                rows={(point) => [
                  { color: "var(--chart-line-primary)", label: "Arrived", value: Number(point.arrived ?? 0) },
                  { color: "var(--chart-line-secondary)", label: "Total so far", value: Number(point.total ?? 0) },
                ]}
              />
            </BarChart>
            <figcaption className="sr-only">Participants checked in per 15-minute slot.</figcaption>
          </figure>
        ) : <Empty>No arrivals yet.</Empty>}
      </Panel>

      <Panel
        title="Teams"
        description={data ? `${teams.length} of ${data.teams.length} finalist teams shown` : undefined}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Search">
              <TextInput value={search} placeholder="Team, name, email or phone" className="w-full sm:w-64" onChange={(event) => setSearch(event.target.value)} />
            </Field>
            <ExportCsv datasets={["checkins"]} filters={{ search: search.trim() || undefined }}
              ignored={progress !== "all" ? "The progress filter is not applied; the file lists every member who has checked in." : undefined} />
            <Field label="Progress">
              <Select value={progress} onChange={(event) => setProgress(event.target.value as Progress)}>
                <option value="all">All teams</option>
                <option value="waiting">Waiting</option>
                <option value="partial">Partial</option>
                <option value="complete">Complete</option>
              </Select>
            </Field>
          </div>
        }
      >
        <Bones name="checkin-teams" loading={!data}>
        {!data ? null : !data.teams.length ? (
          <Empty>No teams are accepted for the finals yet.</Empty>
        ) : !teams.length ? (
          <Empty>No teams match these filters.</Empty>
        ) : (
          <ul className="admin-stagger grid gap-3 xl:grid-cols-2">
            {teams.map((item) => {
              const state = progressOf(item)
              return (
                <li key={item.registration_id} className="rounded-xl border border-border p-3 transition-colors hover:border-foreground/25">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 font-medium">
                        {item.team_name}
                        <Badge>{item.team_id}</Badge>
                        <Badge tone={state === "complete" ? "green" : state === "partial" ? "amber" : "zinc"}>
                          {item.checked_in}/{item.member_count} in
                        </Badge>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{item.college}</p>
                    </div>
                    {canCheckIn ? (
                      <div className="flex gap-1">
                        {item.checked_in < item.member_count ? (
                          <Button tone="green" disabled={busy}
                            onClick={() => void notify(team.mutateAsync({ id: item.registration_id, checkedIn: true }), `${item.team_name} checked in.`)}>
                            Check in all
                          </Button>
                        ) : null}
                        {item.checked_in ? (
                          <Button disabled={busy}
                            onClick={() => void notify(team.mutateAsync({ id: item.registration_id, checkedIn: false }), `Check-in undone for ${item.team_name}.`)}>
                            Undo all
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <span className="mt-2 block h-1.5 rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-1.5 rounded-full bg-emerald-600 transition-[width] duration-500 ease-out" style={{ width: `${item.member_count ? (item.checked_in / item.member_count) * 100 : 0}%` }} />
                  </span>
                  <ul className="mt-2 divide-y divide-border">
                    {item.members.map((person) => (
                      <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate">
                            {person.name}
                            {person.role === "leader" ? <span className="ml-1.5 text-xs text-muted-foreground">leader</span> : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{person.phone} · {person.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {person.checked_in_at ? (
                            <span className="text-xs text-emerald-700" title={person.checked_in_by ? `by ${person.checked_in_by}` : undefined}>
                              in at {clock.format(new Date(person.checked_in_at))}
                            </span>
                          ) : null}
                          {canCheckIn ? (
                            person.checked_in_at ? (
                              <Button disabled={busy}
                                onClick={() => void notify(member.mutateAsync({ id: person.id, checkedIn: false }), `Check-in undone for ${person.name}.`)}>
                                Undo
                              </Button>
                            ) : (
                              <Button tone="green" disabled={busy}
                                onClick={() => void notify(member.mutateAsync({ id: person.id, checkedIn: true }), `${person.name} checked in.`)}>
                                Check in
                              </Button>
                            )
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
        </Bones>
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
