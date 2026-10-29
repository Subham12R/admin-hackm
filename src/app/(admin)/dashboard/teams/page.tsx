"use client"

import { Fragment, type ReactNode, useState } from "react"

import { format } from "date-fns"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { CalendarIcon, EllipsisVertical, Lock } from "lucide-react"

import { BarChart } from "@/components/charts/bar-chart"
import { Bar } from "@/components/charts/bar"
import { BarXAxis } from "@/components/charts/bar-x-axis"
import { Grid } from "@/components/charts/grid"
import { ChartTooltip } from "@/components/charts/tooltip"
import { RichButton } from "@/components/rich-button"
import { Badge, RegistrationBadge, StatusBadge } from "@/components/admin/kit"
import { REGISTRATION_AREAS, RegistrationDrawer } from "@/components/admin/registration-drawer"
import { FinalsDecisions } from "@/components/admin/finals-decisions"
import { rupees } from "@/lib/api"
import { can, keys, useAdminMutation, useMe } from "@/lib/queries"
import { notify } from "@/lib/notify"
import {
  adminQuery,
  registrationCategories,
  teamsPageSchema,
  toTeamsPage,
  type RegistrationCategory,
  type Team as Registration,
  type TeamFinals,
} from "@/lib/admin-client"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PAGE_SIZE = 10

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
    new Date(`${date}T00:00:00`)
  )
}

type RegistrationColumnKey =
  | "registeredAt"
  | "teamName"
  | "leader"
  | "email"
  | "phone"
  | "college"
  | "members"
  | "acm"
  | "category"
  | "finals"
  | "tracks"

type RegistrationColumn = {
  key: RegistrationColumnKey
  label: string
  className?: string
  defaultVisible?: boolean
  render: (registration: Registration) => ReactNode
}

const registrationColumns: readonly RegistrationColumn[] = [
  { key: "registeredAt", label: "Date", defaultVisible: false, render: (registration: Registration) => formatDate(registration.registeredAt) },
  { key: "teamName", label: "Team name", className: "font-medium", render: (registration: Registration) => registration.teamName },
  { key: "leader", label: "Team leader", render: (registration: Registration) => registration.leader },
  { key: "email", label: "Email", render: (registration: Registration) => registration.email },
  { key: "phone", label: "Phone", render: (registration: Registration) => registration.phone },
  { key: "college", label: "College", render: (registration: Registration) => registration.college },
  { key: "members", label: "Members", className: "text-center tabular-nums", render: (registration: Registration) => registration.memberCount },
  {
    key: "acm",
    label: "ACM",
    render: (registration: Registration) =>
      registration.acm === "Yes" ? (
        <span className="inline-flex items-center gap-1.5">
          Yes
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs tracking-tighter text-muted-foreground">
            {registration.acmMembers} ACM
          </span>
        </span>
      ) : (
        "No"
      ),
  },
  { key: "category", label: "Category", defaultVisible: false, render: (registration: Registration) => registration.category },
  { key: "finals", label: "Finals", render: (registration: Registration) => <StatusBadge status={registration.finals.status} label={FINALS_LABELS[registration.finals.status]} /> },
  { key: "tracks", label: "Track", render: (registration: Registration) => <TrackList tracks={registration.tracks} /> },
]

/** The team's locked problem statement in each event that has several to choose from. */
function TrackList({ tracks }: { tracks: Registration["tracks"] }) {
  if (!tracks.length) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex flex-col gap-0.5">
      {tracks.map((item) => (
        <span key={item.stageId} className="inline-flex items-center gap-1 text-xs" title={item.stage}>
          {item.track ? <Lock className="size-3 text-amber-600" aria-label="Locked" /> : null}
          {tracks.length > 1 ? <span className="text-muted-foreground">{item.stage}:</span> : null}
          {item.track ? item.track.title : <span className="text-amber-700">not chosen</span>}
        </span>
      ))}
    </span>
  )
}

const FINALS_LABELS: Record<TeamFinals["status"], string> = { PENDING: "not decided", ACCEPTED: "accepted", DECLINED: "not selected" }

export default function TeamsPage() {
  const me = useMe()
  const canReview = can.review(me.data?.user.roles ?? [])
  const [openRegistration, setOpenRegistration] = useState<string | null>(null)
  const [date, setDate] = useState<Date>()
  const [category, setCategory] = useState<RegistrationCategory | "all">("all")
  const [finals, setFinals] = useState<TeamFinals["status"] | "all">("all")
  const [page, setPage] = useState(1)
  const [expandedRegistration, setExpandedRegistration] = useState<string | null>(null)
  const [selectedColumns, setSelectedColumns] = useState<RegistrationColumnKey[]>(
    registrationColumns
      .filter((column) => column.defaultVisible !== false)
      .map((column) => column.key)
  )

  const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
  if (date) params.set("date", format(date, "yyyy-MM-dd"))
  if (category !== "all") params.set("category", category)
  if (finals !== "all") params.set("finals", finals)
  const query = useQuery({
    queryKey: keys.teams(params.toString()),
    queryFn: adminQuery(`/api/admin/teams?${params}`, teamsPageSchema),
    select: toTeamsPage,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
  const data = query.data ?? null
  const loadError = query.isError ? "Teams could not be loaded." : ""
  const review = useAdminMutation<{ registrationId: string; status: string }>(
    ({ registrationId, status }) => ({ path: `/api/admin/teams/${registrationId}/review`, body: { status } }),
    REGISTRATION_AREAS
  )
  const decideFinals = useAdminMutation<{ registrationId: string; status: TeamFinals["status"] }>(
    ({ registrationId, status }) => ({ path: `/api/admin/teams/${registrationId}/finals`, body: { status } }),
    [...REGISTRATION_AREAS, ["checkins"], ["finals"]]
  )

  const registrations = data?.teams ?? []
  const chartData = (data?.dailyCounts ?? []).map((point) => ({
    day: formatDate(point.date),
    value: point.adamas + point.other,
  }))
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))
  const visibleRegistrations = registrations
  const hasFilters = Boolean(date) || category !== "all" || finals !== "all"
  const visibleColumns = registrationColumns.filter((column) =>
    selectedColumns.includes(column.key)
  )

  function resetPage() {
    setPage(1)
  }

  function clearFilters() {
    setDate(undefined)
    setCategory("all")
    setFinals("all")
    resetPage()
  }

  function setColumnVisible(column: RegistrationColumnKey, checked: boolean) {
    setSelectedColumns((current) => {
      if (checked) {
        return current.includes(column) ? current : [...current, column]
      }

      return current.length === 1 ? current : current.filter((key) => key !== column)
    })
  }

  async function decideTeamFinals(registrationId: string, status: TeamFinals["status"]) {
    await notify(
      decideFinals.mutateAsync({ registrationId, status }),
      status === "ACCEPTED" ? "Team accepted for the finals." : status === "DECLINED" ? "Team marked as not selected." : "Finals decision cleared."
    )
  }

  async function reviewTeam(registrationId: string, status: "PENDING" | "VERIFIED" | "DECLINED") {
    await notify(review.mutateAsync({ registrationId, status }), status === "VERIFIED" ? "Team verified." : status === "DECLINED" ? "Team declined." : "Team moved back to pending.")
  }

  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-4 rounded-2xl p-2 font-pixel-square leading-tighter">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="text-sm tracking-tighter text-muted-foreground">
          Monitor team activity and review team details.
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-xs tracking-tighter text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-[3px] border border-amber-200 bg-amber-50 dark:border-amber-500/40 dark:bg-[color-mix(in_oklab,var(--color-amber-500)_12%,var(--card))] shadow-[inset_3px_0_0_var(--color-amber-400)]" />Awaiting review</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-[3px] border border-emerald-200 bg-emerald-50 dark:border-emerald-500/40 dark:bg-[color-mix(in_oklab,var(--color-emerald-500)_12%,var(--card))] shadow-[inset_3px_0_0_var(--color-emerald-400)]" />Verified</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-[3px] border border-red-200 bg-red-50 dark:border-red-500/40 dark:bg-[color-mix(in_oklab,var(--color-red-500)_12%,var(--card))] shadow-[inset_3px_0_0_var(--color-red-400)]" />Declined</span>
        </p>
      </div>

      <FinalsDecisions canRelease={canReview} />

      <section className="rounded-2xl glass-shell p-1">
        <div className="rounded-xl bg-card p-4">
          <div className="mb-3">
            <h2 className="text-lg font-semibold tracking-tight">Team analytics</h2>
            <p className="text-sm tracking-tighter text-muted-foreground">
              Daily team counts from the table rows below.
            </p>
          </div>
          <figure className="w-full text-left">
            <BarChart
              aspectRatio="4 / 1"
              barGap={0.1}
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 40, left: 8 }}
              xDataKey="day"
            >
              <Grid horizontal />
              <Bar dataKey="value" lineCap="butt" />
              <BarXAxis maxLabels={8} />
              <ChartTooltip
                rows={(point) => [
                  {
                    color: "var(--chart-line-primary)",
                    label: "Teams",
                    value: Number(point.value ?? 0),
                  },
                ]}
              />
            </BarChart>
            <figcaption className="sr-only">
              Daily team counts from the current table filters.
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="min-w-0 rounded-2xl glass-shell p-1">
        <div className="min-w-0 overflow-hidden rounded-xl bg-card p-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">All teams</h2>
              {loadError ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError}</p> : null}
              <p aria-live="polite" className="text-sm tracking-tighter text-muted-foreground">
                {data?.total ?? 0} matching team{data?.total === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                <span id="registration-date-label">Registration date</span>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        aria-labelledby="registration-date-label"
                        variant="outline"
                        size="sm"
                        className="h-8 w-40 justify-start rounded-md border-input bg-background normal-case font-normal tracking-tighter"
                      />
                    }
                  >
                    <CalendarIcon />
                    {date ? format(date, "dd MMM yyyy") : "Pick a date"}
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-auto rounded-xl border border-border bg-popover p-0"
                  >
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(selectedDate) => {
                        setDate(selectedDate)
                        resetPage()
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <label className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                Category
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value as RegistrationCategory | "all")
                    resetPage()
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All categories</option>
                  {registrationCategories.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                Finals
                <select
                  value={finals}
                  onChange={(event) => {
                    setFinals(event.target.value as TeamFinals["status"] | "all")
                    resetPage()
                  }}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All teams</option>
                  <option value="ACCEPTED">Accepted for finals</option>
                  <option value="PENDING">Not decided</option>
                  <option value="DECLINED">Not selected</option>
                </select>
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-md border-input bg-background normal-case font-normal tracking-tighter"
                    >
                      Columns
                    </Button>
                  }
                />
                <DropdownMenuContent
                  align="end"
                  className="w-44 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-pixel-square normal-case tracking-tighter">
                      Visible columns
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {registrationColumns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={selectedColumns.includes(column.key)}
                        disabled={
                          selectedColumns.length === 1 && selectedColumns.includes(column.key)
                        }
                        onCheckedChange={(checked) => setColumnVisible(column.key, checked)}
                        className="font-pixel-square normal-case tracking-tighter"
                      >
                        {column.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <RichButton
                type="button"
                color="zinc"
                size="sm"
                disabled={!hasFilters}
                onClick={clearFilters}
                className="font-pixel-square tracking-tighter"
              >
                Clear filters
              </RichButton>
            </div>
          </div>

          <Table className="min-w-[1200px]">
            <TableCaption className="sr-only">
              Registrations with date, team, leader, contact, college, team size, ACM status, and category.
            </TableCaption>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={`h-10 normal-case tracking-tighter ${column.className ?? ""}`}
                  >
                    {column.label}
                  </TableHead>
                ))}
                <TableHead className="sticky right-0 z-10 h-10 bg-card">
                  <span className="sr-only">Team details</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data === null && !loadError ? (
                Array.from({ length: 3 }, (_, index) => (
                  <TableRow key={index} aria-hidden="true">
                    <TableCell colSpan={visibleColumns.length + 1}>
                      <div className="h-5 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : visibleRegistrations.length ? (
                visibleRegistrations.map((registration) => {
                  const isExpanded = expandedRegistration === registration.registrationId
                  const teamMembers = registration.members

                  return (
                    <Fragment key={registration.registrationId}>
                      <TableRow className={reviewTint(registration)?.row}>
                        {visibleColumns.map((column, columnIndex) => (
                          <TableCell key={column.key} className={`${column.className ?? ""} ${columnIndex === 0 ? reviewTint(registration)?.bar ?? "" : ""}`}>
                            {column.render(registration)}
                          </TableCell>
                        ))}
                        <TableCell className={`sticky right-0 z-10 text-right ${reviewTint(registration)?.cell ?? "bg-card"}`}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? "Hide" : "Show"} team details for ${registration.teamName}`}
                            title="Team details"
                            onClick={() =>
                              setExpandedRegistration((current) =>
                                current === registration.registrationId ? null : registration.registrationId
                              )
                            }
                            className="rounded-md"
                          >
                            <EllipsisVertical />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={visibleColumns.length + 1} className="whitespace-normal p-4">
                            <div className="space-y-4">
                              <div className="flex flex-wrap items-end justify-between gap-3">
                                <div>
                                  <h3 className="font-medium tracking-tight">Team details</h3>
                                  <p className="text-sm tracking-tighter text-muted-foreground">
                                    {registration.teamName} · {registration.memberCount} participants
                                  </p>
                                  <p className="mt-1 flex flex-wrap gap-1">
                                    <RegistrationBadge status={registration.status} feeWaived={registration.feeWaived} />
                                    {registration.adjustment.status === "REQUIRED" ? <Badge tone="amber">owes {rupees(registration.adjustment.amountMinor)}</Badge> : null}
                                    {registration.review.reviewedBy ? <Badge>reviewed by {registration.review.reviewedBy}</Badge> : null}
                                    {registration.finals.decidedBy ? <Badge>finals set by {registration.finals.decidedBy}</Badge> : null}
                                    {registration.finals.status !== "PENDING" && registration.finals.notifiedStatus !== registration.finals.status ? <Badge tone="amber">decision not emailed yet</Badge> : null}
                                    {registration.finals.status === "ACCEPTED" && registration.finals.notifiedStatus === "ACCEPTED" ? (
                                      <StatusBadge status={registration.finals.rsvpStatus === "CONFIRMED" ? "VERIFIED" : registration.finals.rsvpStatus === "DECLINED" ? "DECLINED" : "PENDING"}
                                        label={registration.finals.rsvpStatus === "CONFIRMED" ? "attending" : registration.finals.rsvpStatus === "DECLINED" ? "can't attend" : "RSVP pending"} />
                                    ) : null}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setOpenRegistration(registration.registrationId)}
                                  className="text-sm underline underline-offset-2"
                                >
                                  Members, payments &amp; ACM review
                                </button>
                                <label className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                                  Details review
                                  <select
                                    aria-label={`Details review for ${registration.teamName}`}
                                    value={registration.review.status}
                                    disabled={!canReview || (review.isPending && review.variables?.registrationId === registration.registrationId)}
                                    onChange={(event) => {
                                      void reviewTeam(
                                        registration.registrationId,
                                        event.target.value as "PENDING" | "VERIFIED" | "DECLINED"
                                      )
                                    }}
                                    className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    <option value="PENDING">Pending review</option>
                                    <option value="VERIFIED">Verified</option>
                                    <option value="DECLINED">Declined</option>
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1 text-xs tracking-tighter text-muted-foreground">
                                  Finals
                                  <select
                                    aria-label={`Finals decision for ${registration.teamName}`}
                                    value={registration.finals.status}
                                    disabled={!canReview || (decideFinals.isPending && decideFinals.variables?.registrationId === registration.registrationId)}
                                    onChange={(event) => {
                                      void decideTeamFinals(registration.registrationId, event.target.value as TeamFinals["status"])
                                    }}
                                    className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    <option value="PENDING">Not decided</option>
                                    <option value="ACCEPTED" disabled={registration.status !== "PAID"}>Accepted for finals</option>
                                    <option value="DECLINED">Not selected</option>
                                  </select>
                                </label>
                              </div>
                              <Table className="min-w-[820px]">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="h-10 normal-case tracking-tighter">Name</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">Role</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">Email</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">Phone</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">College</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">ACM</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">ACM ID</TableHead>
                                    <TableHead className="h-10 normal-case tracking-tighter">ACM check</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {teamMembers.map((member) => (
                                    <TableRow key={member.id}>
                                      <TableCell className="font-medium">{member.name}</TableCell>
                                      <TableCell>{member.role === "leader" ? "Team leader" : "Member"}</TableCell>
                                      <TableCell>{member.email}</TableCell>
                                      <TableCell>{member.phone}</TableCell>
                                      <TableCell>{member.college}</TableCell>
                                      <TableCell>{member.acm}</TableCell>
                                      <TableCell>{member.acmId ?? "—"}</TableCell>
                                      <TableCell>{member.acm === "Yes" ? <StatusBadge status={member.acmReviewStatus} /> : "—"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length + 1}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {loadError || "No registrations match these filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm tracking-tighter text-muted-foreground">
              Showing {visibleRegistrations.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, data?.total ?? 0)} of {data?.total ?? 0}
            </p>
            <nav aria-label="Team table pagination" className="flex items-center gap-2">
              <RichButton
                type="button"
                color="zinc"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
                className="font-pixel-square tracking-tighter"
              >
                Previous
              </RichButton>
              <span className="min-w-20 text-center text-sm tracking-tighter text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <RichButton
                type="button"
                color="zinc"
                size="sm"
                disabled={page === pageCount}
                onClick={() => setPage((current) => current + 1)}
                className="font-pixel-square tracking-tighter"
              >
                Next
              </RichButton>
            </nav>
          </div>
        </div>
      </section>
      <RegistrationDrawer registrationId={openRegistration} onClose={() => setOpenRegistration(null)} />
    </div>
  )
}

/**
 * Light tints so the review state reads at a glance: amber for registered teams waiting on review
 * (including teams sent back after a roster change), green for verified teams, red for declined.
 * The sticky actions cell needs an opaque colour of its own.
 */
const REVIEW_TINTS = {
  PENDING: { row: "bg-amber-50 hover:bg-amber-100/70 dark:bg-[color-mix(in_oklab,var(--color-amber-500)_12%,var(--card))] dark:hover:bg-[color-mix(in_oklab,var(--color-amber-500)_18%,var(--card))]", cell: "bg-amber-50 dark:bg-[color-mix(in_oklab,var(--color-amber-500)_12%,var(--card))]", bar: "shadow-[inset_3px_0_0_var(--color-amber-400)]" },
  VERIFIED: { row: "bg-emerald-50 hover:bg-emerald-100/70 dark:bg-[color-mix(in_oklab,var(--color-emerald-500)_12%,var(--card))] dark:hover:bg-[color-mix(in_oklab,var(--color-emerald-500)_18%,var(--card))]", cell: "bg-emerald-50 dark:bg-[color-mix(in_oklab,var(--color-emerald-500)_12%,var(--card))]", bar: "shadow-[inset_3px_0_0_var(--color-emerald-400)]" },
  DECLINED: { row: "bg-red-50 hover:bg-red-100/70 dark:bg-[color-mix(in_oklab,var(--color-red-500)_12%,var(--card))] dark:hover:bg-[color-mix(in_oklab,var(--color-red-500)_18%,var(--card))]", cell: "bg-red-50 dark:bg-[color-mix(in_oklab,var(--color-red-500)_12%,var(--card))]", bar: "shadow-[inset_3px_0_0_var(--color-red-400)]" },
} as const

function reviewTint(team: Registration) {
  return team.status === "PAID" ? REVIEW_TINTS[team.review.status] : undefined
}
